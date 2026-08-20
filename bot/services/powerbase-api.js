import { supabase } from "./supabase.js";
import { rawRanksFromProfile } from "./roblox.js";
import { componentsV2Message, containerV2, textDisplayV2, separatorV2, mediaGalleryV2 } from "./discord-ui.js";
import { ROBLOX_GROUPS } from "../../modules/data/roblox-config.js";
import { getVerifiedProfile } from "./roles.js";

export const ROSTER_CHANNEL_ID = "1046537270150299720";

function romanize(num) {
  if (num === 10 || num === "X" || String(num).toUpperCase() === "X") return "X";
  return ["I", "II", "III", "IV"][num - 1] || "I";
}

export function getPowerbaseCapacity(tier, isImperial = false) {
  if (isImperial || tier === 10 || tier === "X") return 3;
  const cap = { 1: 4, 2: 6, 3: 8, 4: 10 };
  return cap[Number(tier)] || 4;
}

/**
 * Auto-detect and sync verified members for the Imperial Powerbase.
 * Looks up verified Roblox profiles for Emperor (253), Voice (252), Wrath (251), and Shadow Guards (42).
 */
export async function syncImperialPowerbaseData(pb) {
  try {
    const { data: verifiedLinks } = await supabase
      .from("verification_links")
      .select("discord_user_id, roblox_user_id");

    if (!verifiedLinks || verifiedLinks.length === 0) return { emperorId: pb.leader_id, voiceId: null, wrathId: null, shadowGuardIds: [] };

    let emperorId = null;
    let voiceId = null;
    let wrathId = null;
    const shadowGuardIds = [];

    // Check profiles
    for (const link of verifiedLinks) {
      if (!link.discord_user_id) continue;
      try {
        const verified = await getVerifiedProfile(link.discord_user_id);
        if (!verified?.profile) continue;

        const dcRank = Number(verified.profile.groupRanks?.[ROBLOX_GROUPS.DARK_COUNCIL.groupId] || 0);
        const mainRank = Number(verified.profile.groupRanks?.[ROBLOX_GROUPS.MAIN_GROUP.groupId] || 0);

        if (dcRank === 253) emperorId = link.discord_user_id;
        if (dcRank === 252) voiceId = link.discord_user_id;
        if (dcRank === 251) wrathId = link.discord_user_id;
        if (mainRank === 42) shadowGuardIds.push(link.discord_user_id);
      } catch (e) {
        // ignore profile lookup failure for single user
      }
    }

    if (emperorId && emperorId !== pb.leader_id) {
      await supabase.from("powerbases").update({ leader_id: emperorId }).eq("id", pb.id);
      pb.leader_id = emperorId;
    }

    return { emperorId: pb.leader_id || emperorId, voiceId, wrathId, shadowGuardIds };
  } catch (err) {
    console.error("Failed to sync Imperial Powerbase data:", err);
    return { emperorId: pb.leader_id, voiceId: null, wrathId: null, shadowGuardIds: [] };
  }
}

/**
 * Sync persistent Powerbase roster message in channel 1046537270150299720.
 */
export async function syncPowerbaseRosterMessage(client, powerbaseId) {
  if (!client || !powerbaseId) return;
  try {
    const pb = await getPowerbase(powerbaseId);
    if (!pb) {
      console.warn(`[syncPowerbaseRosterMessage] Powerbase ${powerbaseId} not found`);
      return;
    }

    const channel = await client.channels.fetch(ROSTER_CHANNEL_ID).catch((err) => {
      console.error(`[syncPowerbaseRosterMessage] Failed to fetch channel ${ROSTER_CHANNEL_ID}:`, err?.message || err);
      return null;
    });
    if (!channel || !channel.isTextBased()) {
      console.warn(`[syncPowerbaseRosterMessage] Channel ${ROSTER_CHANNEL_ID} unavailable or not text-based`);
      return;
    }

    if (pb.status === "DISSOLVED" || pb.status === "DELETED") {
      if (pb.roster_message_id) {
        const existingMsg = await channel.messages.fetch(pb.roster_message_id).catch(() => null);
        if (existingMsg) await existingMsg.delete().catch(() => {});
      }
      return;
    }

    const isImperial = Boolean(pb.is_imperial || pb.tier === 10 || pb.tier === "X" || pb.name?.toLowerCase().includes("imperial powerbase"));

    const memberIds = (pb.powerbase_members || [])
      .map(m => String(m.user_id || m.discord_user_id || ""))
      .filter(Boolean);

    const pbSlug = slugifyPowerbase(pb.name);
    const pbUrl = `https://www.thesithorder.org/powerbases/${pbSlug}`;

    let groupLinkText = "";
    if (pb.roblox_group_id) {
      const match = String(pb.roblox_group_id).match(/\d+/);
      const cleanUrl = String(pb.roblox_group_id).startsWith("http")
        ? pb.roblox_group_id
        : `https://www.roblox.com/groups/${match ? match[0] : pb.roblox_group_id}`;
      groupLinkText = `**Roblox Group:** [Group Link](${cleanUrl})`;
    }

    const components = [];

    if (isImperial) {
      // Imperial Powerbase Embed Formatting
      const { emperorId, voiceId, wrathId, shadowGuardIds } = await syncImperialPowerbaseData(pb);
      const totalMemberCount = (emperorId ? 1 : 0) + (voiceId ? 1 : 0) + (wrathId ? 1 : 0) + shadowGuardIds.length + memberIds.length;

      components.push(textDisplayV2(`# [${pb.name}](${pbUrl})`));
      components.push(textDisplayV2(`**Tier:** X\n**Members:** ${totalMemberCount}`));
      components.push(separatorV2());

      if (pb.description) {
        components.push(textDisplayV2(`### Description\n${pb.description}`));
        components.push(separatorV2());
      }

      if (groupLinkText) {
        components.push(textDisplayV2(groupLinkText));
        components.push(separatorV2());
      }

      // Roster section: Leadership
      const leaderLines = [];
      leaderLines.push(`**Leader:**\n${emperorId ? `<@${emperorId}>` : "*Vacant*"}`);
      if (voiceId) leaderLines.push(`**Emperor's Voice:**\n<@${voiceId}>`);
      if (wrathId) leaderLines.push(`**Emperor's Wrath:**\n<@${wrathId}>`);

      components.push(textDisplayV2(`### Roster\n${leaderLines.join("\n\n")}`));

      // Shadow Guards section (only if any exist)
      if (shadowGuardIds.length > 0) {
        components.push(separatorV2());
        const sgLines = shadowGuardIds.map(id => `**Shadow Guard:**\n<@${id}>`).join("\n\n");
        components.push(textDisplayV2(sgLines));
      }

      // Apprentices section (only if any exist)
      if (memberIds.length > 0) {
        components.push(separatorV2());
        const appLines = memberIds.map(id => `**Apprentice:**\n<@${id}>`).join("\n\n");
        components.push(textDisplayV2(appLines));
      }

      if (pb.image_url) {
        components.push(separatorV2());
        components.push(mediaGalleryV2(pb.image_url));
      }

    } else {
      // Standard Powerbase Embed Formatting
      const apprenticeText = memberIds.length > 0
        ? memberIds.map(id => `<@${id}>`).join("\n")
        : "*None*";

      const sdBadge = pb.is_sudden_death ? " **[SUDDEN DEATH]**" : "";

      components.push(textDisplayV2(`# [${pb.name}](${pbUrl})`));
      components.push(textDisplayV2(`**Tier:** ${romanize(pb.tier)}${sdBadge}\n**Prestige:** ${pb.prestige}\n**Members:** ${memberIds.length + 1} / ${getPowerbaseCapacity(pb.tier)}`));
      components.push(separatorV2());

      if (pb.description) {
        components.push(textDisplayV2(`### Description\n${pb.description}`));
        components.push(separatorV2());
      }

      if (groupLinkText) {
        components.push(textDisplayV2(groupLinkText));
        components.push(separatorV2());
      }

      components.push(textDisplayV2(`### Roster\n**Leader:**\n<@${pb.leader_id}>\n\n**Apprentices:**\n${apprenticeText}`));

      if (pb.image_url) {
        components.push(separatorV2());
        components.push(mediaGalleryV2(pb.image_url));
      }
    }

    const v2Payload = componentsV2Message([containerV2(components, 0xc90705)]);

    let edited = false;
    if (pb.roster_message_id) {
      const messageObj = await channel.messages.fetch(pb.roster_message_id).catch(() => null);
      if (messageObj) {
        try {
          await messageObj.edit(v2Payload);
          edited = true;
        } catch (editErr) {
          console.warn(`[syncPowerbaseRosterMessage] Edit failed for message ${pb.roster_message_id}, sending new message:`, editErr?.message || editErr);
        }
      }
    }

    if (!edited) {
      const newMsg = await channel.send(v2Payload);
      await supabase
        .from("powerbases")
        .update({ roster_message_id: newMsg.id })
        .eq("id", pb.id);
    }
  } catch (err) {
    console.error("Error syncing powerbase roster message:", err);
  }
}

/**
 * Sync stored powerbase rosters for all active powerbases.
 */
export async function syncStoredPowerbaseRosters(client) {
  try {
    const powerbases = await fetchPowerbases();
    const activePbs = (powerbases || []).filter(pb => pb.status === "ACTIVE");
    let synced = 0;
    for (const pb of activePbs) {
      await syncPowerbaseRosterMessage(client, pb.id);
      synced++;
    }
    return { checked: powerbases.length, synced };
  } catch (error) {
    console.error("Failed to sync stored powerbase rosters:", error);
    return { checked: 0, synced: 0 };
  }
}

/**
 * Fetch all powerbases, with their members.
 */
export async function fetchPowerbases() {
  const { data, error } = await supabase
    .from("powerbases")
    .select("*, powerbase_members(*)");
  
  if (error) throw error;
  return data;
}

export function slugifyPowerbase(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Fetch a powerbase by name (case-insensitive / slug-matched).
 */
export async function getPowerbaseByName(name) {
  const targetSlug = slugifyPowerbase(name);
  const { data, error } = await supabase
    .from("powerbases")
    .select("*, powerbase_members(*)")
    .neq("status", "DISSOLVED");
    
  if (error) throw error;
  return (data || []).find(pb => slugifyPowerbase(pb.name) === targetSlug) || null;
}

/**
 * Fetch a specific powerbase by ID.
 */
export async function getPowerbase(id) {
  const { data, error } = await supabase
    .from("powerbases")
    .select("*, powerbase_members(*)")
    .eq("id", id);
    
  if (error) throw error;
  return (data && data.length > 0) ? data[0] : null;
}

/**
 * Check if a user is already in a powerbase.
 * Returns the powerbase they are in, or null.
 */
export async function getPowerbaseForUser(discordId) {
  if (!discordId) return null;

  // First check if they are a leader
  const { data: leaderData, error: leaderError } = await supabase
    .from("powerbases")
    .select("*")
    .eq("leader_id", String(discordId))
    .neq("status", "DISSOLVED");
    
  if (leaderError) throw leaderError;
  if (leaderData && leaderData.length > 0) return leaderData[0];

  // Then check if they are a member
  const { data: memberData, error: memberError } = await supabase
    .from("powerbase_members")
    .select("powerbase_id, powerbases(*)")
    .eq("user_id", String(discordId));

  if (memberError) throw memberError;

  if (memberData && memberData.length > 0) {
    const activeMember = memberData.find(m => m.powerbases && m.powerbases.status !== "DISSOLVED");
    if (activeMember) return activeMember.powerbases;
  }

  return null;
}

/**
 * Creates a new powerbase with status PENDING_APPROVAL.
 */
export async function createPowerbase(payload, members = []) {
  // Check if leader is already in a powerbase
  const leaderPb = await getPowerbaseForUser(payload.leaderId);
  if (leaderPb) {
    throw new Error(`Leader is already in a Powerbase (${leaderPb.name}).`);
  }

  // Check if any members are already in a powerbase
  for (const memberId of members) {
    if (memberId === payload.leaderId) continue;
    const memberPb = await getPowerbaseForUser(memberId);
    if (memberPb) {
      throw new Error(`Member is already in a Powerbase (${memberPb.name}).`);
    }
  }

  const { data: rows, error } = await supabase
    .from("powerbases")
    .insert([{
      name: payload.name,
      description: payload.description || null,
      roblox_group_id: payload.robloxGroupId || null,
      image_url: payload.imageUrl || payload.image_url || null,
      leader_id: payload.leaderId,
      leader_name: payload.leaderName || null,
      status: "PENDING_APPROVAL"
    }])
    .select();
    
  if (error) throw error;
  const data = rows && rows.length > 0 ? rows[0] : null;
  const powerbaseId = data.id;

  const validMembers = members.filter(id => id !== payload.leaderId);
  if (validMembers.length > 0) {
    const membersPayload = validMembers.map(id => ({
      powerbase_id: powerbaseId,
      user_id: id
    }));
    await supabase.from("powerbase_members").insert(membersPayload);
  }

  return data;
}

/**
 * Updates a powerbase and its members.
 */
export async function updatePowerbase(id, payload, newMembers = null) {
  let data = null;

  if (payload && Object.keys(payload).length > 0) {
    const { data: rows, error } = await supabase
      .from("powerbases")
      .update(payload)
      .eq("id", id)
      .select();

    if (error) throw error;
    data = rows && rows.length > 0 ? rows[0] : null;
  }

  if (!data) {
    data = await getPowerbase(id);
  }

  if (!data) {
    throw new Error("Powerbase not found.");
  }

  if (newMembers !== null) {
    const validMembers = newMembers.filter(memberId => memberId !== data.leader_id);

    // Check that none of newMembers are in another active powerbase
    for (const memberId of validMembers) {
      const existingPb = await getPowerbaseForUser(memberId);
      if (existingPb && existingPb.id !== id) {
        throw new Error(`User is already in another Powerbase (${existingPb.name}).`);
      }
    }

    // Delete old members
    await supabase.from("powerbase_members").delete().eq("powerbase_id", id);
    
    // Insert new members
    if (validMembers.length > 0) {
      const membersPayload = validMembers.map(userId => ({
        powerbase_id: id,
        user_id: userId
      }));
      await supabase.from("powerbase_members").insert(membersPayload);
    }
  }

  return data;
}

/**
 * Log a powerbase action.
 */
export async function logPowerbaseAction(userId, action, powerbaseId = null, details = null) {
  const { error } = await supabase
    .from("powerbase_logs")
    .insert([{
      user_id: userId,
      powerbase_id: powerbaseId,
      action: action,
      details: details
    }]);
    
  if (error) console.error("Failed to log powerbase action:", error);
}

export function getMinPrestigeForTier(tier) {
  if (tier >= 4) return 12;
  if (tier >= 3) return 8;
  if (tier >= 2) return 4;
  return 0;
}

export function calculateTierFromPrestige(prestige) {
  if (prestige >= 12) return 4;
  if (prestige >= 8) return 3;
  if (prestige >= 4) return 2;
  return 1;
}

function processMatchPrestigeAndTier(pb, prestigeChange, isWinner) {
  const currentPrestige = pb.prestige || 0;
  const currentTier = pb.tier || 1;
  const wasSuddenDeath = !!pb.is_sudden_death;

  const newPrestige = Math.min(20, Math.max(0, currentPrestige + prestigeChange));
  let newTier = currentTier;
  let isSuddenDeath = wasSuddenDeath;
  let suddenDeathStatus = null; // 'ENTERED', 'CLEARED', 'RELEGATED', or null

  if (isWinner) {
    if (wasSuddenDeath) {
      // Grace Match Victory: Sudden Death removed!
      isSuddenDeath = false;
      const qualifiedTier = calculateTierFromPrestige(newPrestige);
      if (newPrestige >= getMinPrestigeForTier(currentTier)) {
        newTier = Math.max(currentTier, qualifiedTier);
      } else {
        newTier = qualifiedTier;
      }
      suddenDeathStatus = "CLEARED";
    } else {
      // Normal win: check for tier promotion
      const qualifiedTier = calculateTierFromPrestige(newPrestige);
      if (qualifiedTier > currentTier) {
        newTier = qualifiedTier;
      }
      if (newPrestige >= getMinPrestigeForTier(newTier)) {
        isSuddenDeath = false;
      }
    }
  } else {
    // Loser
    if (wasSuddenDeath) {
      // Grace Match Defeat: Immediate relegation to highest qualified tier!
      isSuddenDeath = false;
      newTier = calculateTierFromPrestige(newPrestige);
      suddenDeathStatus = "RELEGATED";
    } else {
      // Normal loss: check if prestige falls below current tier minimum requirement
      const minRequired = getMinPrestigeForTier(currentTier);
      if (newPrestige < minRequired && currentTier > 1) {
        // Enters Sudden Death state! Retains current tier capacity until next Kaggath (Grace Match)
        isSuddenDeath = true;
        newTier = currentTier;
        suddenDeathStatus = "ENTERED";
      } else {
        isSuddenDeath = false;
        newTier = calculateTierFromPrestige(newPrestige);
      }
    }
  }

  return {
    prestige: newPrestige,
    tier: newTier,
    is_sudden_death: isSuddenDeath,
    suddenDeathStatus
  };
}

/**
 * Record a Domination Kaggath result: updates prestige, tier, sudden death, wins, and losses.
 */
export async function recordKaggathResult(winnerPbId, loserPbId, winnerPrestigeChange, loserPrestigeChange, client = null) {
  const winnerPb = await getPowerbase(winnerPbId);
  const loserPb = await getPowerbase(loserPbId);
  if (!winnerPb || !loserPb) return null;

  const winnerRes = processMatchPrestigeAndTier(winnerPb, winnerPrestigeChange, true);
  const loserRes = processMatchPrestigeAndTier(loserPb, loserPrestigeChange, false);

  const { data: updatedWinner } = await supabase
    .from("powerbases")
    .update({
      prestige: winnerRes.prestige,
      tier: winnerRes.tier,
      is_sudden_death: winnerRes.is_sudden_death,
      kaggath_wins: (winnerPb.kaggath_wins || 0) + 1
    })
    .eq("id", winnerPbId)
    .select()
    .single();

  const { data: updatedLoser } = await supabase
    .from("powerbases")
    .update({
      prestige: loserRes.prestige,
      tier: loserRes.tier,
      is_sudden_death: loserRes.is_sudden_death,
      kaggath_losses: (loserPb.kaggath_losses || 0) + 1
    })
    .eq("id", loserPbId)
    .select()
    .single();

  if (client) {
    await syncPowerbaseRosterMessage(client, winnerPbId);
    await syncPowerbaseRosterMessage(client, loserPbId);
  }

  return {
    winner: { ...updatedWinner, suddenDeathStatus: winnerRes.suddenDeathStatus },
    loser: { ...updatedLoser, suddenDeathStatus: loserRes.suddenDeathStatus }
  };
}

/**
 * Adjust prestige and tier based on a manual adjustment.
 */
export async function adjustPrestige(powerbaseId, amount, client = null) {
  const pb = await getPowerbase(powerbaseId);
  if (!pb) return null;
  if (pb.is_imperial || pb.tier === 10 || pb.tier === "X" || pb.name?.toLowerCase().includes("imperial powerbase")) {
    return pb;
  }
  
  const currentPrestige = pb.prestige || 0;
  const currentTier = pb.tier || 1;
  const newPrestige = Math.min(20, Math.max(0, currentPrestige + amount));
  
  let newTier = currentTier;
  let isSuddenDeath = !!pb.is_sudden_death;

  const minReq = getMinPrestigeForTier(currentTier);
  if (newPrestige < minReq && currentTier > 1) {
    isSuddenDeath = true;
  } else if (newPrestige >= minReq) {
    isSuddenDeath = false;
    newTier = Math.max(currentTier, calculateTierFromPrestige(newPrestige));
  } else {
    newTier = calculateTierFromPrestige(newPrestige);
    isSuddenDeath = false;
  }

  const { data, error } = await supabase
    .from("powerbases")
    .update({ prestige: newPrestige, tier: newTier, is_sudden_death: isSuddenDeath })
    .eq("id", powerbaseId)
    .select()
    .single();
    
  if (error) throw error;
  if (client) {
    await syncPowerbaseRosterMessage(client, powerbaseId);
  }
  return data;
}

/**
 * Compare two profiles to see if A is strictly higher rank than B.
 * Checks Dark Council rank first, then High Ranks.
 */
export function isHigherRank(profileA, profileB) {
  const ranksA = rawRanksFromProfile(profileA);
  const ranksB = rawRanksFromProfile(profileB);
  
  if (ranksA.darkCouncil !== ranksB.darkCouncil) {
    return ranksA.darkCouncil > ranksB.darkCouncil;
  }
  return ranksA.highranks > ranksB.highranks;
}

/**
 * Hard delete a powerbase and its members.
 */
export async function deletePowerbase(id) {
  const pb = await getPowerbase(id);
  if (pb && (pb.is_imperial || pb.tier === 10 || pb.tier === "X" || pb.name?.toLowerCase().includes("imperial powerbase"))) {
    throw new Error("The Imperial Powerbase cannot be deleted or dissolved.");
  }
  await supabase.from("powerbase_members").delete().eq("powerbase_id", id);
  const { error } = await supabase.from("powerbases").delete().eq("id", id);
  if (error) throw error;
  return true;
}


