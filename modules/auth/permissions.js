import { tierAtLeast } from "./profile.js";

export const PAGE_ACCESS = {
  registry: { public: true },
  registry_reavers_home: { division: "reavers", minimumTier: "member" },
  registry_dhg: { division: "dhg", minimumTier: "member" },
  registry_inquisitor: { division: "inquisitors", minimumTier: "member" },
  registry_dreadmaster: { division: "dreadmasters", minimumTier: "member" },
  registry_highrank: { highRankMinimumTier: "lower" },
  index: { public: true },
};

const HIGH_RANK_TIERS = ["none", "lower", "upper", "overseer"];

function tierListAtLeast(list, actualTier, requiredTier) {
  return list.indexOf(actualTier) >= list.indexOf(requiredTier);
}

function hasCoreOverride(profile) {
  return profile.isSuperUser || profile.hasFullAccess;
}

export function normalizePageKey(page) {
  return String(page || "")
    .toLowerCase()
    .replace(/\.html$/, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\//g, "_");
}

export function checkPageAccess(profile, page) {
  const pageKey = normalizePageKey(page);
  const rule = PAGE_ACCESS[pageKey];

  if (!rule) {
    return { authorized: false, pageKey, reason: "UNKNOWN_RESOURCE" };
  }

  if (rule.public || hasCoreOverride(profile)) {
    return { authorized: true, pageKey };
  }

  if (rule.division) {
    const actualTier = profile.divisions[rule.division] || "none";
    const authorized = tierAtLeast(actualTier, rule.minimumTier);

    return {
      authorized,
      pageKey,
      ...(authorized ? {} : { reason: "INSUFFICIENT_CLEARANCE_LEVEL" })
    };
  }

  if (rule.highRankMinimumTier) {
    const authorized = tierListAtLeast(HIGH_RANK_TIERS, profile.highRank, rule.highRankMinimumTier);

    return {
      authorized,
      pageKey,
      ...(authorized ? {} : { reason: "INSUFFICIENT_CLEARANCE_LEVEL" })
    };
  }

  return { authorized: false, pageKey, reason: "UNKNOWN_RESOURCE" };
}
