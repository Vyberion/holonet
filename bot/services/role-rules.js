function isRoleIdValue(value) {
  return ["string", "number", "bigint"].includes(typeof value);
}

export function compactRoleIds(values) {
  const ids = [];

  function visit(value) {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!isRoleIdValue(value)) return;

    const id = String(value).trim();
    if (id && !id.includes("ROLE_ID")) ids.push(id);
  }

  visit(values);
  return [...new Set(ids)];
}

export function roleIdsFromRule(rule) {
  if (!rule) return [];
  if (Array.isArray(rule) || isRoleIdValue(rule)) return compactRoleIds(rule);
  if (Array.isArray(rule.roles)) return compactRoleIds(rule.roles);
  if (isRoleIdValue(rule.role)) return compactRoleIds(rule.role);
  return [];
}

export function roleIdsFromRanges(rank, ranges = []) {
  const numericRank = Number(rank) || 0;
  if (!Array.isArray(ranges) || numericRank <= 0) return [];

  return ranges.flatMap(range => {
    const min = range?.min == null ? Number.NEGATIVE_INFINITY : Number(range.min);
    const max = range?.max == null ? Number.POSITIVE_INFINITY : Number(range.max);
    if (Number.isNaN(min) || Number.isNaN(max)) return [];
    return numericRank >= min && numericRank <= max ? roleIdsFromRule(range) : [];
  });
}

function pushRankRules(ids, ranks = {}) {
  Object.values(ranks).forEach(rule => ids.push(roleIdsFromRule(rule)));
}

function pushRangeRules(ids, ranges = []) {
  if (!Array.isArray(ranges)) return;
  ranges.forEach(range => ids.push(roleIdsFromRule(range)));
}

export function managedRoleIdsFromConfig(sourceConfig, options = {}) {
  const roles = sourceConfig?.roles?.managed || {};
  const ids = [
    sourceConfig?.roles?.verified,
    sourceConfig?.roles?.verifiedNonHighRank,
    sourceConfig?.roles?.unlinked,
    options.unlinkedRoleId
  ];

  pushRankRules(ids, roles.DARK_COUNCIL?.ranks);
  pushRangeRules(ids, roles.DARK_COUNCIL?.ranges);
  pushRankRules(ids, roles.DARK_COUNCIL?.senior);
  pushRankRules(ids, roles.HIGH_RANKS?.ranks);
  pushRangeRules(ids, roles.HIGH_RANKS?.ranges);

  Object.values(roles.DIVISIONS || {}).forEach(group => {
    pushRankRules(ids, group.ranks);
    pushRangeRules(ids, group.ranges);
  });

  return compactRoleIds(ids);
}

export function roleSyncPlan({ currentRoleIds = [], wantedRoleIds = [], managedRoleIds = [] } = {}) {
  const current = compactRoleIds(currentRoleIds);
  const wanted = compactRoleIds(wantedRoleIds);
  const managed = new Set(compactRoleIds(managedRoleIds));
  const currentSet = new Set(current);
  const wantedSet = new Set(wanted);

  return {
    add: wanted.filter(id => !currentSet.has(id)),
    remove: current.filter(id => managed.has(id) && !wantedSet.has(id))
  };
}
