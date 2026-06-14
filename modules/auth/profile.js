import { ROBLOX_GROUPS, SUPER_USER_IDS } from "./roblox-groups.js";

export const DIVISION_TIERS = ["none", "member", "nco", "co", "2ic", "1ic", "overseer"];
export const HIGH_RANK_TIERS = ["none", "lower", "upper", "overseer"];
const DARK_COUNCIL_DIVISION_OVERSEERS = {
  darkHonorGuardOverseer: "dhg",
  reaverOverseer: "reavers",
  dreadMasterOverseer: "dreadmasters",
  inquisitoriusOverseer: "inquisitors"
};

const FULL_ACCESS_AUTHORITY_ROLES = [
  "groupOwner",
  "projectManager",
  "emperor",
  "emperorPowerbase",
];

function includesRank(rankSet, rank) {
  return Array.isArray(rankSet) && rankSet.includes(rank);
}

function getTierFromRank(rank, ranks) {
  if (!rank) return "none";

  for (const tier of [...DIVISION_TIERS].reverse()) {
    if (includesRank(ranks[tier], rank)) return tier;
  }

  return "none";
}

function getTierFromRankList(rank, ranks, tiers) {
  if (!rank) return "none";

  for (const tier of [...tiers].reverse()) {
    if (includesRank(ranks[tier], rank)) return tier;
  }

  return "none";
}

function buildGroupRankMap(groupRoles = []) {
  return groupRoles.reduce((map, membership) => {
    const groupId = membership?.group?.id;
    const rank = membership?.role?.rank;

    if (groupId && typeof rank === "number") {
      map[groupId] = rank;
    }

    return map;
  }, {});
}

export function buildProfile({ robloxId, groupRoles }) {
  const userGroups = buildGroupRankMap(groupRoles);
  const darkCouncilRank = userGroups[ROBLOX_GROUPS.DARK_COUNCIL.groupId] || 0;
  const highRank = userGroups[ROBLOX_GROUPS.HIGH_RANKS.groupId] || 0;
  const isSuperUser = SUPER_USER_IDS.includes(String(robloxId));
  const authorityRoles = Object.fromEntries(
    Object.entries(ROBLOX_GROUPS.DARK_COUNCIL.ranks).map(([role, ranks]) => [
      role,
      includesRank(ranks, darkCouncilRank)
    ])
  );

  const profile = {
    robloxId: String(robloxId),
    isSuperUser,
    groupRanks: userGroups,
    authorityRoles,
    hasFullAccess: isSuperUser || FULL_ACCESS_AUTHORITY_ROLES.some(role => authorityRoles[role]),
    highRank: getTierFromRankList(highRank, ROBLOX_GROUPS.HIGH_RANKS.ranks, HIGH_RANK_TIERS),
    divisions: {}
  };

  for (const [divisionKey, division] of Object.entries(ROBLOX_GROUPS.DIVISIONS)) {
    const rank = userGroups[division.groupId] || 0;
    profile.divisions[divisionKey] = getTierFromRank(rank, division.ranks);
  }

  for (const [role, divisionKey] of Object.entries(DARK_COUNCIL_DIVISION_OVERSEERS)) {
    if (authorityRoles[role]) {
      profile.divisions[divisionKey] = "overseer";
    }
  }

  return profile;
}

export function tierAtLeast(actualTier, requiredTier) {
  return DIVISION_TIERS.indexOf(actualTier) >= DIVISION_TIERS.indexOf(requiredTier);
}
