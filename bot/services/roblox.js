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

export async function loadRobloxAvatarBust(robloxUserId) {
  try {
    const url = `https://thumbnails.roblox.com/v1/users/avatar-bust?userIds=${robloxUserId}&size=420x420&format=Png&isCircular=false`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.data?.[0]?.imageUrl || null;
  } catch (error) {
    return null;
  }
}

async function fetchBadgeCount(robloxUserId) {
  let count = 0;
  let cursor = "";

  for (let page = 0; page < 10; page += 1) {
    const url = new URL(`https://badges.roblox.com/v1/users/${robloxUserId}/badges`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("sortOrder", "Asc");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url);
    if (!response.ok) throw new Error("ROBLOX_BADGE_LOOKUP_FAILED");

    const payload = await response.json();
    count += Array.isArray(payload.data) ? payload.data.length : 0;
    cursor = payload.nextPageCursor || "";
    if (!cursor) break;
  }

  return count;
}

export async function loadRobloxProfileSummary(robloxUserId) {
  const [user, friendsResponse, badgeCountResult] = await Promise.all([
    loadRobloxUser(robloxUserId),
    fetch(`https://friends.roblox.com/v1/users/${robloxUserId}/friends/count`),
    fetchBadgeCount(robloxUserId).then(count => ({ ok: true, count })).catch(() => ({ ok: false, count: null }))
  ]);

  if (!friendsResponse.ok) throw new Error("ROBLOX_FRIEND_COUNT_FAILED");

  const friendsPayload = await friendsResponse.json();
  const accountCreated = user.created ? new Date(user.created) : null;
  const accountAgeDays = accountCreated ? Math.max(0, Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24))) : null;

  return {
    user,
    accountAgeDays,
    friendsCount: friendsPayload.count ?? null,
    badgeCount: badgeCountResult.ok ? badgeCountResult.count : null
  };
}

export function personnelLookupWarnings({ accountAgeDays, friendsCount, badgeCount }) {
  const warnings = [];

  if (accountAgeDays !== null && accountAgeDays < 30) {
    warnings.push({ key: "low_age", label: "Low age account", detail: `Account is ${accountAgeDays} day${accountAgeDays === 1 ? "" : "s"} old.` });
  }

  if (typeof friendsCount === "number" && friendsCount < 20) {
    warnings.push({ key: "low_friends", label: "Low number of friends", detail: `${friendsCount} friend${friendsCount === 1 ? "" : "s"} found.` });
  }

  if (typeof badgeCount === "number" && badgeCount < 10) {
    warnings.push({ key: "low_badges", label: "Low number of badges", detail: `${badgeCount} badge${badgeCount === 1 ? "" : "s"} found.` });
  }

  return warnings;
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
