import { ROBLOX_GROUPS } from "./roblox-groups.js";
import { tierAtLeast } from "./profile.js";

const PAGE_ACCESS = {
  codex: { public: true },
  cots: { public: true },
  archives: { public: true },
  hierarchy: { public: true },
  low_ranks: { public: true },
  low_ranks_grotthu: { public: true },
  low_ranks_tyro: { public: true },
  low_ranks_hopeful: { public: true },
  low_ranks_neophyte: { public: true },
  low_ranks_academy_student: { public: true },
  low_ranks_initiate: { public: true },
  low_ranks_acolyte: { public: true },
  low_ranks_sith_prospect: { public: true },
  middle_ranks: { public: true },
  middle_ranks_sith_apprentice: { public: true },
  middle_ranks_sith_adept: { public: true },
  middle_ranks_sith_sorcerer: { public: true },
  middle_ranks_sith_warrior: { public: true },
  middle_ranks_sith_seer: { public: true },
  middle_ranks_sith_marauder: { public: true },
  high_ranks: { public: true },
  high_ranks_sith_overseer: { public: true },
  high_ranks_sith_master: { public: true },
  high_ranks_sith_lord: { public: true },
  high_ranks_darth: { public: true },
  registry: { registry: true },
  nexus: { nexus: true },
  admin: { capability: "admin" },
  lookup: { public: true },
  personnel: { public: true },
  home: { public: true },
  reavers_home: { division: "reavers", minimumTier: "member" },
  reavers_info: { public: true },
  reavers_handbooks: { division: "reavers", minimumTier: "member" },
  reavers_transmissions: { division: "reavers", minimumTier: "member" },
  reavers_reports: { reportDivision: "reavers" },
  reavers_activity: { division: "reavers", minimumTier: "member" },
  reavers_trackers: { division: "reavers", minimumTier: "member" },
  dhg_home: { division: "dhg", minimumTier: "member" },
  dhg_info: { public: true },
  dhg_handbooks: { division: "dhg", minimumTier: "member" },
  dhg_transmissions: { division: "dhg", minimumTier: "member" },
  dhg_reports: { reportDivision: "dhg" },
  dhg_activity: { division: "dhg", minimumTier: "member" },
  dhg_trackers: { division: "dhg", minimumTier: "member" },
  dark_honor_guards_home: { division: "dhg", minimumTier: "member" },
  dark_honor_guards_info: { public: true },
  dark_honor_guards_handbooks: { division: "dhg", minimumTier: "member" },
  dark_honor_guards_transmissions: { division: "dhg", minimumTier: "member" },
  dark_honor_guards_reports: { reportDivision: "dhg" },
  dark_honor_guards_activity: { division: "dhg", minimumTier: "member" },
  dark_honor_guards_trackers: { division: "dhg", minimumTier: "member" },
  inquisitors_home: { division: "inquisitors", minimumTier: "member" },
  inquisitors_info: { public: true },
  inquisitors_handbooks: { division: "inquisitors", minimumTier: "member" },
  inquisitors_transmissions: { division: "inquisitors", minimumTier: "member" },
  inquisitors_reports: { reportDivision: "inquisitors" },
  inquisitors_activity: { division: "inquisitors", minimumTier: "member" },
  inquisitors_trackers: { division: "inquisitors", minimumTier: "member" },
  dreadmasters_home: { division: "dreadmasters", minimumTier: "member" },
  dreadmasters_info: { public: true },
  dreadmasters_handbooks: { division: "dreadmasters", minimumTier: "member" },
  dreadmasters_transmissions: { division: "dreadmasters", minimumTier: "member" },
  dreadmasters_reports: { reportDivision: "dreadmasters" },
  dreadmasters_activity: { division: "dreadmasters", minimumTier: "member" },
  dreadmasters_trackers: { division: "dreadmasters", minimumTier: "member" },
  dread_masters_home: { division: "dreadmasters", minimumTier: "member" },
  dread_masters_info: { public: true },
  dread_masters_handbooks: { division: "dreadmasters", minimumTier: "member" },
  dread_masters_transmissions: { division: "dreadmasters", minimumTier: "member" },
  dread_masters_reports: { reportDivision: "dreadmasters" },
  dread_masters_activity: { division: "dreadmasters", minimumTier: "member" },
  dread_masters_trackers: { division: "dreadmasters", minimumTier: "member" },
  highranks_home: { highRankMinimumTier: "lower" },
  highranks_handbooks: { highRankMinimumTier: "lower" },
  highranks_transmissions: { highRankMinimumTier: "lower" },
  highranks_reports: { highRankMinimumTier: "lower" },
  highranks_activity: { highRankMinimumTier: "lower" },
  highranks_trackers: { highRankMinimumTier: "lower" },
  high_ranks_home: { highRankMinimumTier: "lower" },
  high_ranks_handbooks: { highRankMinimumTier: "lower" },
  high_ranks_transmissions: { highRankMinimumTier: "lower" },
  high_ranks_reports: { highRankMinimumTier: "lower" },
  high_ranks_activity: { highRankMinimumTier: "lower" },
  high_ranks_trackers: { highRankMinimumTier: "lower" },
  dark_council_home: { division: "dark_council", minimumTier: "member" },
  dark_council_council_floor: { division: "dark_council", minimumTier: "member" },
  dark_council_handbooks: { division: "dark_council", minimumTier: "member" },
  dark_council_transmissions: { division: "dark_council", minimumTier: "member" },
  dark_council_reports: { division: "dark_council", minimumTier: "member" },
  dark_council_activity: { division: "dark_council", minimumTier: "member" },
  dark_council_trackers: { division: "dark_council", minimumTier: "member" },
  darkcouncil_home: { division: "dark_council", minimumTier: "member" },
  darkcouncil_council_floor: { division: "dark_council", minimumTier: "member" },
  darkcouncil_handbooks: { division: "dark_council", minimumTier: "member" },
  darkcouncil_transmissions: { division: "dark_council", minimumTier: "member" },
  darkcouncil_reports: { division: "dark_council", minimumTier: "member" },
  darkcouncil_activity: { division: "dark_council", minimumTier: "member" },
  darkcouncil_trackers: { division: "dark_council", minimumTier: "member" },
  agenda_handbooks: { public: true },
  mandate_handbooks: { public: true },
  index: { public: true },
};

const HIGH_RANK_TIERS = ["none", "lower", "upper", "overseer"];

function tierListAtLeast(list, actualTier, requiredTier) {
  return list.indexOf(actualTier) >= list.indexOf(requiredTier);
}

export function hasCoreAccess(profile) {
  return Boolean(profile?.isSuperUser || profile?.hasFullAccess);
}

function coreAccessReason(profile) {
  return profile?.isSuperUser ? "SUPER_USER" : "FULL_ACCESS";
}

function hasAnyDarkCouncilAuthority(profile) {
  return hasCoreAccess(profile) || Object.values(profile.authorityRoles || {}).some(Boolean);
}

export function hasHighCommandAccess(profile) {
  const roles = profile?.authorityRoles || {};

  return Boolean(
    profile?.isSuperUser ||
    roles.groupOwner ||
    roles.projectManager ||
    roles.emperor ||
    roles.emperorPowerbase
  );
}

function hasProjectManagerPlus(profile) {
  const roles = profile?.authorityRoles || {};

  return Boolean(
    profile?.isSuperUser ||
    roles.groupOwner ||
    roles.projectManager
  );
}

function hasAdminAuthority(profile) {
  const roles = profile.authorityRoles || {};

  return Boolean(
    hasCoreAccess(profile) ||
    roles.groupOwner ||
    roles.projectManager ||
    roles.emperor
  );
}

function getOverrides(profile) {
  return Array.isArray(profile?.accessOverrides) ? profile.accessOverrides : [];
}

function isDarkCouncilDivision(division) {
  return ["darkCouncil", "dark_council", "darkcouncil"].includes(String(division || "").toLowerCase());
}

function canAccessDivisionPagesForInquisitors(profile, division) {
  if (isDarkCouncilDivision(division)) return false;

  const roles = profile?.authorityRoles || {};
  const inquisitorTier = profile?.divisions?.inquisitors || "none";
  return Boolean(roles.inquisitoriusOverseer || tierAtLeast(inquisitorTier, "member"));
}

function overrideDecision(profile, predicate) {
  if (hasCoreAccess(profile)) {
    return { hasOverride: false };
  }

  const matches = getOverrides(profile).filter(predicate);
  if (!matches.length) {
    return { hasOverride: false };
  }

  if (matches.some(match => match.effect === "revoke")) {
    return { hasOverride: true, authorized: false, reason: "OVERRIDE_REVOKE" };
  }

  if (matches.some(match => match.effect === "grant")) {
    return { hasOverride: true, authorized: true, reason: "OVERRIDE_GRANT" };
  }

  return { hasOverride: false };
}

function capabilityOverride(profile, capabilityKey) {
  return overrideDecision(profile, override =>
    override.scope_type === "capability" &&
    override.scope_key === capabilityKey
  );
}

function normalizeOverrideScopeKey(value) {
  return normalizePageKey(String(value || "").replace(/([a-z0-9])([A-Z])/g, "$1_$2"));
}

function libraryOverride(profile, libraryKey) {
  return overrideDecision(profile, override =>
    (override.scope_type === "library" && override.scope_key === libraryKey) ||
    (override.scope_type === "capability" && override.scope_key === `edit_library:${libraryKey}`)
  );
}

function pageOverride(profile, pageKey, rule) {
  const normalizedPageKey = normalizePageKey(pageKey);
  const ruleDivision = rule?.division ? normalizeOverrideScopeKey(rule.division) : "";

  return overrideDecision(profile, override => {
    const overrideKey = normalizeOverrideScopeKey(override.scope_key);

    return (
      (override.scope_type === "page" && overrideKey === normalizedPageKey) ||
      (override.scope_type === "division" && ruleDivision && overrideKey === ruleDivision) ||
      (override.scope_type === "division" && (normalizedPageKey === overrideKey || normalizedPageKey.startsWith(`${overrideKey}_`))) ||
      (rule?.capability && override.scope_type === "capability" && overrideKey === normalizeOverrideScopeKey(rule.capability))
    );
  });
}

export function canAccessAdmin(profile) {
  const override = capabilityOverride(profile, "admin");
  if (override.hasOverride) return override;
  if (hasCoreAccess(profile)) return { authorized: true, reason: coreAccessReason(profile) };

  return hasAdminAuthority(profile)
    ? { authorized: true, reason: "ADMIN_AUTHORITY" }
    : { authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" };
}

export function canAccessPersonnelLookup(profile) {
  const override = capabilityOverride(profile, "personnel_lookup");
  if (override.hasOverride) return override;
  if (hasCoreAccess(profile)) return { authorized: true, reason: coreAccessReason(profile) };

  const divisionTiers = Object.entries(profile.divisions || {});
  const authorized = Boolean(
    hasCoreAccess(profile) ||
    hasAnyDarkCouncilAuthority(profile) ||
    profile.highRank !== "none" ||
    tierAtLeast(profile.divisions?.inquisitors || "none", "member") ||
    divisionTiers.some(([division, tier]) => division !== "inquisitors" && tierAtLeast(tier, "nco"))
  );

  return authorized
    ? { authorized: true, reason: "PERSONNEL_CLEARANCE" }
    : { authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" };
}

export function canAccessNexus(profile) {
  const override = capabilityOverride(profile, "nexus");
  if (override.hasOverride) return override;
  if (hasCoreAccess(profile)) return { authorized: true, reason: coreAccessReason(profile) };

  const divisionKeys = ["reavers", "dhg", "inquisitors", "dreadmasters"];
  const authorized = Boolean(
    hasCoreAccess(profile) ||
    divisionKeys.some(division => tierAtLeast(profile.divisions?.[division] || "none", "member"))
  );

  return authorized
    ? { authorized: true, reason: "DIVISION_MEMBER_CLEARANCE" }
    : { authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" };
}

export function canAccessRegistry(profile) {
  if (hasCoreAccess(profile)) return { authorized: true, reason: coreAccessReason(profile) };

  const divisionKeys = ["reavers", "dhg", "inquisitors", "dreadmasters"];
  const authorized = Boolean(
    hasCoreAccess(profile) ||
    canAccessNexus(profile).authorized ||
    profile.highRank !== "none" ||
    hasAnyDarkCouncilAuthority(profile) ||
    tierAtLeast(profile.divisions?.dark_council || "none", "member") ||
    divisionKeys.some(division => tierAtLeast(profile.divisions?.[division] || "none", "member"))
  );

  return authorized
    ? { authorized: true, reason: "REGISTRY_CLEARANCE" }
    : { authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" };
}

export function canEditLibrary(profile, libraryKey) {
  const override = libraryOverride(profile, libraryKey);
  if (override.hasOverride && !override.authorized) return override;

  return hasProjectManagerPlus(profile)
    ? { authorized: true, reason: profile?.isSuperUser ? "SUPER_USER" : "PROJECT_MANAGER_AUTHORITY" }
    : { authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" };
}

export function canViewDivisionReports(profile, division) {
  if (hasCoreAccess(profile)) {
    return { authorized: true, reason: coreAccessReason(profile) };
  }

  const roles = profile?.authorityRoles || {};
  const actualTier = profile?.divisions?.[division] || "none";

  if (tierAtLeast(actualTier, "member")) {
    return { authorized: true, reason: "DIVISION_MEMBER_CLEARANCE" };
  }

  if (canAccessDivisionPagesForInquisitors(profile, division)) {
    return {
      authorized: true,
      reason: roles.inquisitoriusOverseer ? "INQUISITORIUS_OVERSEER" : "INQUISITORIUS_CLEARANCE"
    };
  }

  return hasAnyDarkCouncilAuthority(profile)
    ? { authorized: true, reason: "DARK_COUNCIL_AUTHORITY" }
    : { authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" };
}

export function canWriteDivisionReport(profile, division) {
  if (profile?.isSuperUser) {
    return { authorized: true, reason: "SUPER_USER" };
  }

  const actualTier = profile?.divisions?.[division] || "none";
  if (tierAtLeast(actualTier, "co")) {
    return { authorized: true, reason: "DIVISION_CO_AUTHORITY" };
  }

  return hasHighCommandAccess(profile)
    ? { authorized: true, reason: "HIGH_COMMAND_AUTHORITY" }
    : { authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" };
}

export function checkResourceWriteAccess(profile, { division, resourceType }) {
  if (resourceType === "report") {
    return canWriteDivisionReport(profile, division);
  }

  if (hasCoreAccess(profile)) {
    return { authorized: true, reason: coreAccessReason(profile) };
  }

  if (division === "darkCouncil") {
    return hasHighCommandAccess(profile)
      ? { authorized: true, reason: "POWERBASE_AUTHORITY" }
      : { authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" };
  }

  if (division === "highranks") {
    return hasAnyDarkCouncilAuthority(profile)
      ? { authorized: true, reason: "DARK_COUNCIL_AUTHORITY" }
      : { authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" };
  }

  const actualTier = profile.divisions?.[division] || "none";
  const hasDivisionWrite = tierAtLeast(actualTier, "co");

  return hasDivisionWrite || hasAnyDarkCouncilAuthority(profile)
    ? { authorized: true, reason: hasDivisionWrite ? "DIVISION_CO_AUTHORITY" : "DARK_COUNCIL_AUTHORITY" }
    : { authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" };
}

function normalizePageKey(page) {
  return String(page || "")
    .toLowerCase()
    .replace(/\.html$/, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[/-]/g, "_");
}

export function checkPageAccess(profile, page) {
  const pageKey = normalizePageKey(page);
  const rule = PAGE_ACCESS[pageKey];

  if (!rule) {
    return hasCoreAccess(profile)
      ? { authorized: true, pageKey, reason: `${coreAccessReason(profile)}_UNKNOWN_RESOURCE` }
      : { authorized: false, pageKey, reason: "UNKNOWN_RESOURCE" };
  }

  if (hasCoreAccess(profile)) {
    return { authorized: true, pageKey, reason: coreAccessReason(profile) };
  }

  if (rule.capability) {
    const capabilityAccess = rule.capability === "admin"
      ? canAccessAdmin(profile)
      : canAccessPersonnelLookup(profile);

    return { ...capabilityAccess, pageKey };
  }

  if (rule.nexus) {
    return { ...canAccessNexus(profile), pageKey };
  }

  if (rule.registry) {
    return { ...canAccessRegistry(profile), pageKey };
  }

  if (rule.public) {
    return { authorized: true, pageKey };
  }

  if (rule.reportDivision) {
    const override = pageOverride(profile, pageKey, { division: rule.reportDivision });
    if (override.hasOverride) {
      return { ...override, pageKey };
    }

    return { ...canViewDivisionReports(profile, rule.reportDivision), pageKey };
  }

  if (rule.division) {
    const override = pageOverride(profile, pageKey, rule);
    if (override.hasOverride) {
      return { ...override, pageKey };
    }

    const actualTier = profile.divisions[rule.division] || "none";
    const hasTransmissionAuthority = pageKey.endsWith("_transmissions") && hasAnyDarkCouncilAuthority(profile);
    const inquisitorAccess = canAccessDivisionPagesForInquisitors(profile, rule.division);
    const authorized = inquisitorAccess || tierAtLeast(actualTier, rule.minimumTier) || hasTransmissionAuthority;

    return {
      authorized,
      pageKey,
      ...(authorized ? {} : { reason: "INSUFFICIENT_CLEARANCE_LEVEL" })
    };
  }

  if (rule.highRankMinimumTier) {
    const override = pageOverride(profile, pageKey, rule);
    if (override.hasOverride) {
      return { ...override, pageKey };
    }

    const inquisitorAccess = canAccessDivisionPagesForInquisitors(profile, "highranks");
    const authorized = inquisitorAccess || tierListAtLeast(HIGH_RANK_TIERS, profile.highRank, rule.highRankMinimumTier);

    return {
      authorized,
      pageKey,
      ...(authorized ? {} : { reason: "INSUFFICIENT_CLEARANCE_LEVEL" })
    };
  }

  if (rule.fullAccessOnly) {
    const override = pageOverride(profile, pageKey, rule);
    if (override.hasOverride) {
      return { ...override, pageKey };
    }

    return { authorized: false, pageKey, reason: "INSUFFICIENT_CLEARANCE_LEVEL" };
  }

  return { authorized: false, pageKey, reason: "UNKNOWN_RESOURCE" };
}
