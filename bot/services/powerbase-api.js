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
  // First check if they are a leader
  const { data: leaderData, error: leaderError } = await supabase
    .from("powerbases")
    .select("*")
    .eq("leader_id", discordId)
    .neq("status", "DISSOLVED")
    .single();
    
  if (leaderData) return leaderData;
  if (leaderError && leaderError.code !== 'PGRST116') throw leaderError;

  // Then check if they are a member
  const { data: memberData, error: memberError } = await supabase
    .from("powerbase_members")
    .select("powerbases(*)")
    .eq("user_id", discordId)
    .single();

  if (memberData && memberData.powerbases && memberData.powerbases.status !== "DISSOLVED") {
    return memberData.powerbases;
  }
  if (memberError && memberError.code !== 'PGRST116') throw memberError;

  return null;
}

/**
 * Creates a new powerbase with status PENDING_APPROVAL.
 */
export async function createPowerbase(payload, members = []) {
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

  if (members.length > 0) {
    const membersPayload = members.map(id => ({
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
    // Delete old members
    await supabase.from("powerbase_members").delete().eq("powerbase_id", id);
    
    // Insert new members
    if (newMembers.length > 0) {
      const membersPayload = newMembers.map(userId => ({
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

/**
 * Adjust prestige and tier based on a Kaggath result.
 */
export async function adjustPrestige(powerbaseId, amount) {
  const pb = await getPowerbase(powerbaseId);
  if (!pb) return null;
  
  const newPrestige = Math.max(0, pb.prestige + amount); // Don't drop below 0
  
  // Calculate tier
  let newTier = 1;
  if (newPrestige >= 12) newTier = 4;
  else if (newPrestige >= 8) newTier = 3;
  else if (newPrestige >= 4) newTier = 2;
  
  const { data, error } = await supabase
    .from("powerbases")
    .update({ prestige: newPrestige, tier: newTier })
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

