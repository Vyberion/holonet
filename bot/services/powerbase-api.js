import { supabase } from "./supabase.js";
import { rawRanksFromProfile } from "./roblox.js";

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


