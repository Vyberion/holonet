export const PERMISSIONS = {
  SUPER_USER: ['pages:view:all', 'codex:edit', 'archives:edit', 'admin:access', 'reports:write:all'],
  HIGH_COMMAND: ['pages:view:all', 'admin:access', 'reports:write:all'],
  DARK_COUNCIL: ['pages:view:standard', 'pages:view:divisions', 'pages:view:highranks', 'pages:view:darkcouncil', 'reports:write:all'],
  INQUISITOR_OVERSEER: ['pages:view:standard', 'pages:view:divisions', 'pages:view:highranks', 'pages:view:darkcouncil', 'pages:view:inquisitors', 'reports:write:all'],
  INQUISITORS: ['pages:view:standard', 'pages:view:divisions', 'pages:view:highranks', 'pages:view:inquisitors'],
  MEMBER: ['nexus:access', 'handbooks:view', 'registry:access', 'pages:view:standard'],
};

// Generates division specific permissions
export function getDivisionPermissions(division, tier) {
  const perms = [];
  if (tier === 'hr' || tier === '1ic' || tier === '2ic' || tier === 'co') {
    perms.push(`pages:view:${division}`, `reports:write:${division}`);
  } else if (tier === 'nco') {
    perms.push(`pages:view:${division}`);
  }

  // Inquisitors have special viewing rights
  if (division === 'inquisitors' && tier !== 'none') {
    PERMISSIONS.INQUISITORS.forEach(p => perms.push(p));
  }

  return perms;
}

export function compileProfilePermissions(profile) {
  const perms = new Set([...PERMISSIONS.MEMBER]);

  if (profile.isSuperUser) {
    PERMISSIONS.SUPER_USER.forEach(p => perms.add(p));
    return Array.from(perms);
  }

  const authority = profile.authorityRoles || {};
  
  if (authority.groupOwner || authority.projectManager || authority.emperor || authority.emperorPowerbase) {
    PERMISSIONS.SUPER_USER.forEach(p => perms.add(p));
  } else if (authority.highRankOverseer) {
    PERMISSIONS.HIGH_COMMAND.forEach(p => perms.add(p));
  } else if (authority.inquisitoriusOverseer) {
    PERMISSIONS.INQUISITOR_OVERSEER.forEach(p => perms.add(p));
  } else if (Object.values(authority).some(v => v)) {
    PERMISSIONS.DARK_COUNCIL.forEach(p => perms.add(p));
  }

  for (const [division, tier] of Object.entries(profile.divisions || {})) {
    if (tier && tier !== 'none') {
      const divPerms = getDivisionPermissions(division, tier);
      divPerms.forEach(p => perms.add(p));
    }
  }

  if (profile.highRank && profile.highRank !== 'none') {
    perms.add('pages:view:highranks');
  }

  // Expand 'pages:view:divisions' macro into actual division view permissions
  if (perms.has('pages:view:divisions')) {
    perms.add('pages:view:reavers');
    perms.add('pages:view:dhg');
    perms.add('pages:view:dreadmasters');
  }

  return Array.from(perms);
}
