import { ROBLOX_GROUPS } from "../../modules/auth/roblox-groups.js";
import { buildProfile } from "../../modules/auth/profile.js";

export async function loadGroupRoles(robloxUserId) {
  const response = await fetch(`https://groups.roblox.com/v1/users/${robloxUserId}/groups/roles`);
  if (!response.ok) throw new Error("ROBLOX_GROUP_LOOKUP_FAILED");
  const payload = await response.json();
  return payload.data || [];
}

export async function loadProfileForRoblox(robloxUserId) {
  const groupRoles = await loadGroupRoles(robloxUserId);
  return buildProfile({ robloxId: robloxUserId, groupRoles });
}

export async function loadRobloxUser(robloxUserId) {
  const response = await fetch(`https://users.roblox.com/v1/users/${robloxUserId}`);
  if (!response.ok) throw new Error("ROBLOX_USER_LOOKUP_FAILED");
  return response.json();
}

export function rawRanksFromProfile(profile) {
  return {
    darkCouncil: Number(profile.groupRanks?.[ROBLOX_GROUPS.DARK_COUNCIL.groupId] || 0),
    highranks: Number(profile.groupRanks?.[ROBLOX_GROUPS.HIGH_RANKS.groupId] || 0),
    divisions: Object.fromEntries(
      Object.entries(ROBLOX_GROUPS.DIVISIONS).map(([key, group]) => [
        key,
        Number(profile.groupRanks?.[group.groupId] || 0)
      ])
    )
  };
}

export function isSuperUser(profile) {
  return Boolean(profile?.isSuperUser);
}
