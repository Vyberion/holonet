import { supabase } from "./supabase.js";
import { rawRanksFromProfile } from "./roblox.js";
import { componentsV2Message, containerV2, textDisplayV2, separatorV2 } from "./discord-ui.js";

export const ROSTER_CHANNEL_ID = "1046537270150299720";

function romanize(num) {
  return ["I", "II", "III", "IV"][num - 1] || "I";
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

    const memberIds = (pb.powerbase_members || [])
      .map(m => String(m.user_id || m.discord_user_id || ""))
      .filter(Boolean);

    const leaderText = `<@${pb.leader_id}> *(Leader)*`;
    const apprenticeText = memberIds.length > 0
      ? memberIds.map(id => `<@${id}> *(Apprentice)*`).join("\n")
      : "*No apprentices assigned*";

    const sdBadge = pb.is_sudden_death ? " ⚠️ **[SUDDEN DEATH]**" : "";

    const components = [
      textDisplayV2(`### ${pb.name}`),
      separatorV2(),
      textDisplayV2(`**Leader:** <@${pb.leader_id}>\n**Tier:** ${romanize(pb.tier)}${sdBadge}\n**Prestige:** ${pb.prestige}`)
    ];

    if (pb.description) {
      components.push(separatorV2());
      components.push(textDisplayV2(`**Description:**\n${pb.description}`));
    }

    if (pb.roblox_group_id) {
      components.push(separatorV2());
      components.push(textDisplayV2(`**Roblox Group ID:** ${pb.roblox_group_id}`));
    }

    components.push(separatorV2());
    components.push(textDisplayV2(`**Roster (${memberIds.length + 1} Total):**\n${leaderText}\n${apprenticeText}`));

    const v2Payload = componentsV2Message([containerV2(components, 0x8a1b1b)]);

    let messageObj = null;
    if (pb.roster_message_id) {
      messageObj = await channel.messages.fetch(pb.roster_message_id).catch(() => null);
    }

    if (messageObj) {
      await messageObj.edit(v2Payload);
    } else {
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
    .eq("id", id)
    .single();
    
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
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

  const { data, error } = await supabase
    .from("powerbases")
    .insert([{
      name: payload.name,
      description: payload.description || null,
      roblox_group_id: payload.robloxGroupId || null,
      leader_id: payload.leaderId,
      status: "PENDING_APPROVAL"
    }])
    .select()
    .single();
    
  if (error) throw error;
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
  const { data, error } = await supabase
    .from("powerbases")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
    
  if (error) throw error;

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
export async function recordKaggathResult(winnerPbId, loserPbId, winnerPrestigeChange, loserPrestigeChange) {
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

  return {
    winner: { ...updatedWinner, suddenDeathStatus: winnerRes.suddenDeathStatus },
    loser: { ...updatedLoser, suddenDeathStatus: loserRes.suddenDeathStatus }
  };
}

/**
 * Adjust prestige and tier based on a manual adjustment.
 */
export async function adjustPrestige(powerbaseId, amount) {
  const pb = await getPowerbase(powerbaseId);
  if (!pb) return null;
  
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
  await supabase.from("powerbase_members").delete().eq("powerbase_id", id);
  const { error } = await supabase.from("powerbases").delete().eq("id", id);
  if (error) throw error;
  return true;
}


