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
  lookup: { public: true },
  personnel: { public: true },
  home: { public: true },
  agenda_handbooks: { public: true },
  index: { public: true },

  registry: { require: 'registry:access' },
  nexus: { require: 'nexus:access' },
  admin: { require: 'admin:access' },
  wrath: { require: 'admin:access' }, // Kept for superusers essentially

  reavers: { require: 'pages:view:reavers' },
  reavers_home: { require: 'pages:view:reavers' },
  reavers_info: { public: true },
  reavers_handbooks: { require: 'pages:view:reavers' },
  reavers_transmissions: { require: 'pages:view:reavers' },
  reavers_reports: { require: 'pages:view:reavers' },
  reavers_activity: { require: 'pages:view:reavers' },
  reavers_trackers: { require: 'pages:view:reavers' },

  dhg: { require: 'pages:view:dhg' },
  dhg_home: { require: 'pages:view:dhg' },
  dhg_info: { public: true },
  dhg_handbooks: { require: 'pages:view:dhg' },
  dhg_transmissions: { require: 'pages:view:dhg' },
  dhg_reports: { require: 'pages:view:dhg' },
  dhg_activity: { require: 'pages:view:dhg' },
  dhg_trackers: { require: 'pages:view:dhg' },

  dark_honor_guards: { require: 'pages:view:dhg' },
  dark_honor_guards_home: { require: 'pages:view:dhg' },
  dark_honor_guards_info: { public: true },
  dark_honor_guards_handbooks: { require: 'pages:view:dhg' },
  dark_honor_guards_transmissions: { require: 'pages:view:dhg' },
  dark_honor_guards_reports: { require: 'pages:view:dhg' },
  dark_honor_guards_activity: { require: 'pages:view:dhg' },
  dark_honor_guards_trackers: { require: 'pages:view:dhg' },

  inquisitors: { require: 'pages:view:inquisitors' },
  inquisitors_home: { require: 'pages:view:inquisitors' },
  inquisitors_info: { public: true },
  inquisitors_handbooks: { require: 'pages:view:inquisitors' },
  inquisitors_transmissions: { require: 'pages:view:inquisitors' },
  inquisitors_reports: { require: 'pages:view:inquisitors' },
  inquisitors_activity: { require: 'pages:view:inquisitors' },
  inquisitors_trackers: { require: 'pages:view:inquisitors' },

  dreadmasters: { require: 'pages:view:dreadmasters' },
  dreadmasters_home: { require: 'pages:view:dreadmasters' },
  dreadmasters_info: { public: true },
  dreadmasters_handbooks: { require: 'pages:view:dreadmasters' },
  dreadmasters_transmissions: { require: 'pages:view:dreadmasters' },
  dreadmasters_reports: { require: 'pages:view:dreadmasters' },
  dreadmasters_activity: { require: 'pages:view:dreadmasters' },
  dreadmasters_trackers: { require: 'pages:view:dreadmasters' },

  dread_masters: { require: 'pages:view:dreadmasters' },
  dread_masters_home: { require: 'pages:view:dreadmasters' },
  dread_masters_info: { public: true },
  dread_masters_handbooks: { require: 'pages:view:dreadmasters' },
  dread_masters_transmissions: { require: 'pages:view:dreadmasters' },
  dread_masters_reports: { require: 'pages:view:dreadmasters' },
  dread_masters_activity: { require: 'pages:view:dreadmasters' },
  dread_masters_trackers: { require: 'pages:view:dreadmasters' },

  highranks: { require: 'pages:view:highranks' },
  highranks_home: { require: 'pages:view:highranks' },
  highranks_handbooks: { require: 'pages:view:highranks' },
  highranks_transmissions: { require: 'pages:view:highranks' },
  highranks_reports: { require: 'pages:view:highranks' },
  highranks_activity: { require: 'pages:view:highranks' },
  highranks_trackers: { require: 'pages:view:highranks' },
  high_ranks: { require: 'pages:view:highranks' },
  high_ranks_home: { require: 'pages:view:highranks' },
  high_ranks_handbooks: { require: 'pages:view:highranks' },
  high_ranks_transmissions: { require: 'pages:view:highranks' },
  high_ranks_reports: { require: 'pages:view:highranks' },
  high_ranks_activity: { require: 'pages:view:highranks' },
  high_ranks_trackers: { require: 'pages:view:highranks' },

  dark_council: { require: 'pages:view:darkcouncil' },
  dark_council_home: { require: 'pages:view:darkcouncil' },
  dark_council_council_floor: { require: 'pages:view:darkcouncil' },
  dark_council_handbooks: { require: 'pages:view:darkcouncil' },
  dark_council_transmissions: { require: 'pages:view:darkcouncil' },
  dark_council_reports: { require: 'pages:view:darkcouncil' },
  dark_council_activity: { require: 'pages:view:darkcouncil' },
  dark_council_trackers: { require: 'pages:view:darkcouncil' },
  darkcouncil: { require: 'pages:view:darkcouncil' },
  darkcouncil_home: { require: 'pages:view:darkcouncil' },
  darkcouncil_council_floor: { require: 'pages:view:darkcouncil' },
  darkcouncil_handbooks: { require: 'pages:view:darkcouncil' },
  darkcouncil_transmissions: { require: 'pages:view:darkcouncil' },
  darkcouncil_reports: { require: 'pages:view:darkcouncil' },
  darkcouncil_activity: { require: 'pages:view:darkcouncil' },
  darkcouncil_trackers: { require: 'pages:view:darkcouncil' },
};

function normalizePageKey(page) {
  return String(page || "")
    .toLowerCase()
    .replace(/\.html$/, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[/-]/g, "_");
}

export function hasPermission(profile, perm) {
  if (!profile || !profile.permissions) return false;
  if (profile.permissions.includes('pages:view:all')) return true; // Blanket access
  if (profile.permissions.includes('reports:write:all') && perm.startsWith('reports:write:')) return true; // Blanket write
  return profile.permissions.includes(perm);
}

export function checkPageAccess(profile, page) {
  const pageKey = normalizePageKey(page);
  const rule = PAGE_ACCESS[pageKey];

  if (!rule) {
    return { authorized: false, pageKey, reason: "UNKNOWN_RESOURCE" };
  }

  if (rule.public) {
    return { authorized: true, pageKey };
  }

  // Handle explicit string overrides (e.g., 'grant:admin', 'revoke:nexus')
  const overrides = profile?.accessOverrides || [];
  if (overrides.includes(`revoke:${pageKey}`)) return { authorized: false, pageKey, reason: "OVERRIDE_REVOKE" };
  if (overrides.includes(`grant:${pageKey}`)) return { authorized: true, pageKey, reason: "OVERRIDE_GRANT" };

  if (hasPermission(profile, rule.require)) {
    return { authorized: true, pageKey };
  }

  return { authorized: false, pageKey, reason: "INSUFFICIENT_CLEARANCE_LEVEL" };
}

export function checkResourceWriteAccess(profile, { division, resourceType }) {
  if (resourceType === "report") {
    const perm = `reports:write:${division}`;
    if (hasPermission(profile, perm)) return { authorized: true, reason: "PERMISSION_GRANTED" };
  }

  // Fallback catch-all write checking
  return { authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" };
}

export function canEditLibrary(profile, libraryKey) {
  if (hasPermission(profile, 'library:edit')) return { authorized: true, reason: "PERMISSION_GRANTED" };
  return { authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" };
}

export function canEditStatutes(profile) {
  if (hasPermission(profile, 'codex:edit')) return { authorized: true, reason: "PERMISSION_GRANTED" };
  return { authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" };
}

export function canEditDoctrine(profile) {
  if (!profile) return false;
  return Boolean(
    profile.isSuperUser ||
    profile.hasFullAccess ||
    hasPermission(profile, 'doctrine:edit') ||
    hasPermission(profile, 'codex:edit') ||
    canViewStatuteDrafts(profile)
  );
}

export function canViewStatuteDrafts(profile) {
  if (!profile) return false;
  return Boolean(
    profile.isSuperUser ||
    profile.hasFullAccess ||
    Object.values(profile.authorityRoles || {}).some(Boolean) ||
    (profile.divisions?.darkCouncil && profile.divisions.darkCouncil !== "none") ||
    hasPermission(profile, 'codex:edit')
  );
}

export function hasHighCommandAccess(profile) {
  // Provided for backwards compatibility with any UI elements still using it
  return hasPermission(profile, 'admin:access');
}

export function canWriteInspection(profile) {
  if (!profile) return false;
  return hasPermission(profile, 'inspections:write') || hasHighCommandAccess(profile);
}

export function canAccessAdmin(profile) {
  return hasPermission(profile, 'admin:access')
    ? { authorized: true, reason: "PERMISSION_GRANTED" }
    : { authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" };
}
