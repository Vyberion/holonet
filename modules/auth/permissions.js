import { tierAtLeast } from "./profile.js";

export const PAGE_ACCESS = {
  codex: { public: true },
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
  board: { public: true },
  nexus: { nexus: true },
  admin: { capability: "admin" },
  lookup: { public: true },
  personnel: { public: true },
  reavers_home: { division: "reavers", minimumTier: "member" },
  reavers_info: { public: true },
  reavers_handbooks: { division: "reavers", minimumTier: "member" },
  reavers_transmissions: { division: "reavers", minimumTier: "member" },
  reavers_reports: { division: "reavers", minimumTier: "nco" },
  reavers_trackers: { division: "reavers", minimumTier: "member" },
  dhg_home: { division: "dhg", minimumTier: "member" },
  dhg_info: { public: true },
  dhg_handbooks: { division: "dhg", minimumTier: "member" },
  dhg_transmissions: { division: "dhg", minimumTier: "member" },
  dhg_reports: { division: "dhg", minimumTier: "nco" },
  dhg_trackers: { division: "dhg", minimumTier: "member" },
  dark_honor_guards_home: { division: "dhg", minimumTier: "member" },
  dark_honor_guards_info: { public: true },
  dark_honor_guards_handbooks: { division: "dhg", minimumTier: "member" },
  dark_honor_guards_transmissions: { division: "dhg", minimumTier: "member" },
  dark_honor_guards_reports: { division: "dhg", minimumTier: "nco" },
  dark_honor_guards_trackers: { division: "dhg", minimumTier: "member" },
  inquisitors_home: { division: "inquisitors", minimumTier: "member" },
  inquisitors_info: { public: true },
  inquisitors_handbooks: { division: "inquisitors", minimumTier: "member" },
  inquisitors_transmissions: { division: "inquisitors", minimumTier: "member" },
  inquisitors_reports: { division: "inquisitors", minimumTier: "nco" },
  inquisitors_trackers: { division: "inquisitors", minimumTier: "member" },
  dreadmasters_home: { division: "dreadmasters", minimumTier: "member" },
  dreadmasters_info: { public: true },
  dreadmasters_handbooks: { division: "dreadmasters", minimumTier: "member" },
  dreadmasters_transmissions: { division: "dreadmasters", minimumTier: "member" },
  dreadmasters_reports: { division: "dreadmasters", minimumTier: "member" },
  dreadmasters_trackers: { division: "dreadmasters", minimumTier: "member" },
  dread_masters_home: { division: "dreadmasters", minimumTier: "member" },
  dread_masters_info: { public: true },
  dread_masters_handbooks: { division: "dreadmasters", minimumTier: "member" },
  dread_masters_transmissions: { division: "dreadmasters", minimumTier: "member" },
  dread_masters_reports: { division: "dreadmasters", minimumTier: "member" },
  dread_masters_trackers: { division: "dreadmasters", minimumTier: "member" },
  highranks_home: { highRankMinimumTier: "lower" },
  highranks_handbooks: { highRankMinimumTier: "lower" },
  highranks_transmissions: { highRankMinimumTier: "lower" },
  highranks_reports: { highRankMinimumTier: "lower" },
  highranks_trackers: { highRankMinimumTier: "lower" },
  high_ranks_home: { highRankMinimumTier: "lower" },
  high_ranks_handbooks: { highRankMinimumTier: "lower" },
  high_ranks_transmissions: { highRankMinimumTier: "lower" },
  high_ranks_reports: { highRankMinimumTier: "lower" },
  high_ranks_trackers: { highRankMinimumTier: "lower" },
  dark_council_home: { division: "dark_council", minimumTier: "member" },
  dark_council_council_floor: { division: "dark_council", minimumTier: "member" },
  dark_council_handbooks: { division: "dark_council", minimumTier: "member" },
  dark_council_transmissions: { division: "dark_council", minimumTier: "member" },
  dark_council_reports: { division: "dark_council", minimumTier: "member" },
  dark_council_trackers: { division: "dark_council", minimumTier: "member" },
  darkcouncil_home: { division: "dark_council", minimumTier: "member" },
  darkcouncil_council_floor: { division: "dark_council", minimumTier: "member" },
  darkcouncil_handbooks: { division: "dark_council", minimumTier: "member" },
  darkcouncil_transmissions: { division: "dark_council", minimumTier: "member" },
  darkcouncil_reports: { division: "dark_council", minimumTier: "member" },
  darkcouncil_trackers: { division: "dark_council", minimumTier: "member" },
  index: { public: true },
};

const HIGH_RANK_TIERS = ["none", "lower", "upper", "overseer"];

function tierListAtLeast(list, actualTier, requiredTier) {
  return list.indexOf(actualTier) >= list.indexOf(requiredTier);
}

function hasCoreOverride(profile) {
  return profile.isSuperUser || profile.hasFullAccess;
}

function hasAnyDarkCouncilAuthority(profile) {
  return profile.isSuperUser || Object.values(profile.authorityRoles || {}).some(Boolean);
}

function hasPowerbaseAuthority(profile) {
  const roles = profile.authorityRoles || {};

  return Boolean(
    profile.isSuperUser ||
    roles.groupOwner ||
    roles.projectManager ||
    roles.emperor ||
    roles.emperorPowerbase
  );
}

function hasAdminAuthority(profile) {
  const roles = profile.authorityRoles || {};

  return Boolean(
    profile.isSuperUser ||
    roles.groupOwner ||
    roles.projectManager ||
    roles.emperor
  );
}

function getOverrides(profile) {
  return Array.isArray(profile?.accessOverrides) ? profile.accessOverrides : [];
}

function overrideDecision(profile, predicate) {
  if (profile?.isSuperUser) {
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

function handbookUploadOverride(profile, division, slotKey = "") {
  return overrideDecision(profile, override =>
    (override.scope_type === "division" && override.scope_key === division) ||
    (override.scope_type === "capability" && override.scope_key === `upload_handbook:${division}`) ||
    (slotKey && override.scope_type === "capability" && override.scope_key === `upload_handbook:${division}:${slotKey}`)
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

  return hasAdminAuthority(profile)
    ? { authorized: true, reason: "ADMIN_AUTHORITY" }
    : { authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" };
}

export function canAccessPersonnelLookup(profile) {
  const override = capabilityOverride(profile, "personnel_lookup");
  if (override.hasOverride) return override;

  const divisionTiers = Object.entries(profile.divisions || {});
  const authorized = Boolean(
    profile.isSuperUser ||
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

  const divisionKeys = ["reavers", "dhg", "inquisitors", "dreadmasters"];
  const authorized = Boolean(
    profile.isSuperUser ||
    divisionKeys.some(division => tierAtLeast(profile.divisions?.[division] || "none", "member"))
  );

  return authorized
    ? { authorized: true, reason: "DIVISION_MEMBER_CLEARANCE" }
    : { authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" };
}

export function canAccessRegistry(profile) {
  const divisionKeys = ["reavers", "dhg", "inquisitors", "dreadmasters"];
  const authorized = Boolean(
    profile.isSuperUser ||
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
  if (override.hasOverride) return override;

  return hasAdminAuthority(profile)
    ? { authorized: true, reason: "CANON_AUTHORITY" }
    : { authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" };
}

export function canUploadHandbookSlot(profile, division, slotKey = "") {
  if (profile.isSuperUser) {
    return { authorized: true, reason: "SUPER_USER" };
  }

  const override = handbookUploadOverride(profile, division, slotKey);
  if (override.hasOverride) return override;

  const actualTier = profile.divisions?.[division] || "none";
  const hasDivisionAuthority = tierAtLeast(actualTier, "co");

  return hasDivisionAuthority || hasPowerbaseAuthority(profile)
    ? { authorized: true, reason: hasDivisionAuthority ? "DIVISION_CO_AUTHORITY" : "POWERBASE_AUTHORITY" }
    : { authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" };
}

export function checkResourceWriteAccess(profile, { division }) {
  if (profile.isSuperUser) {
    return { authorized: true, reason: "SUPER_USER" };
  }

  if (division === "darkCouncil") {
    return hasPowerbaseAuthority(profile)
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

export function normalizePageKey(page) {
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
    return hasCoreOverride(profile)
      ? { authorized: true, pageKey, reason: "SUPER_USER_UNKNOWN_RESOURCE" }
      : { authorized: false, pageKey, reason: "UNKNOWN_RESOURCE" };
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

  if (rule.public || hasCoreOverride(profile)) {
    return { authorized: true, pageKey };
  }

  if (rule.division) {
    const override = pageOverride(profile, pageKey, rule);
    if (override.hasOverride) {
      return { ...override, pageKey };
    }

    const actualTier = profile.divisions[rule.division] || "none";
    const authorized = tierAtLeast(actualTier, rule.minimumTier);

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

    const authorized = tierListAtLeast(HIGH_RANK_TIERS, profile.highRank, rule.highRankMinimumTier);

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
