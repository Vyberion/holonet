import { ROBLOX_GROUPS } from "./roblox-config.js";

const rosterCache = new Map();
const ROSTER_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function rosterDefinitionForDivision(division) {
  if (division === "highranks") return ROBLOX_GROUPS.MAIN_GROUP;
  if (division === "darkCouncil") return ROBLOX_GROUPS.DARK_COUNCIL;
  return ROBLOX_GROUPS.DIVISIONS[division];
}

export async function fetchDivisionRoster(division) {
  const cached = rosterCache.get(division);
  if (cached && (Date.now() - cached.timestamp < ROSTER_CACHE_TTL_MS)) {
    return cached.data;
  }

  const definition = rosterDefinitionForDivision(division);
  if (!definition?.groupId) return [];

  const allowedRanks = new Set(
    Object.values(definition.tiers || {}).flat().map(Number).filter(Boolean)
  );
  if (allowedRanks.size === 0) return [];

  const allowedRoleNames = new Set(
    Object.entries(definition.ranks || {}).map(([, cfg]) => {
      const name = typeof cfg === "object" ? cfg.value : cfg;
      return String(name || "").toLowerCase();
    }).filter(Boolean)
  );

  try {
    const rolesResponse = await fetch(`https://groups.roblox.com/v1/groups/${definition.groupId}/roles`, {
      signal: AbortSignal.timeout(4000)
    });
    if (!rolesResponse.ok) throw new Error("ROBLOX_ROLES_LOOKUP_FAILED");
    const rolesPayload = await rolesResponse.json();

    const targetRoles = (rolesPayload.roles || []).filter(role => {
      if (!allowedRanks.has(Number(role.rank))) return false;
      if (role.name === "Guest") return false;
      if (allowedRoleNames.size > 0) {
        const configuredRank = definition.ranks?.[String(Number(role.rank))];
        const expectedName = typeof configuredRank === "object" ? configuredRank.value : configuredRank;
        if (expectedName && role.name.toLowerCase() !== expectedName.toLowerCase()) return false;
      }
      return true;
    });

    const members = [];
    const seenRobloxIds = new Set();

    for (const role of targetRoles) {
      let cursor = "";
      do {
        const url = new URL(`https://groups.roblox.com/v1/groups/${definition.groupId}/roles/${role.id}/users`);
        url.searchParams.set("limit", "100");
        url.searchParams.set("sortOrder", "Asc");
        if (cursor) url.searchParams.set("cursor", cursor);

        const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (!response.ok) break;
        const payload = await response.json();

        (payload.data || []).forEach(item => {
          const userId = String(item.userId || item.id || "");
          if (!userId || userId === "245850865") return;

          const uname = String(item.username || "").toLowerCase();
          const dname = String(item.displayName || "").toLowerCase();
          if (uname === "naktisterminus" || dname === "naktisterminus") return;

          if (seenRobloxIds.has(userId)) return;
          seenRobloxIds.add(userId);

          const rankNumber = Number(role.rank);
          const configuredRank = definition.ranks?.[String(rankNumber)];
          const rankTitle = (typeof configuredRank === "object" ? configuredRank.value : configuredRank) || role.name || "";

          members.push({
            robloxId: userId,
            username: item.username || "",
            displayName: item.displayName || "",
            rank: rankNumber,
            role: rankTitle
          });
        });

        cursor = payload.nextPageCursor || "";
      } while (cursor);
    }

    rosterCache.set(division, { timestamp: Date.now(), data: members });
    return members;
  } catch (err) {
    console.warn(`[rank-roster] Warning: Roster lookup failed for ${division}:`, err?.message);
    if (cached?.data) return cached.data;
    return [];
  }
}

export async function fetchAllRankRosters() {
  const divisionKeys = ["highranks", "darkCouncil", "reavers", "dhg", "inquisitors", "dreadmasters"];
  const results = await Promise.allSettled(
    divisionKeys.map(k => fetchDivisionRoster(k))
  );

  const rosters = {};
  divisionKeys.forEach((key, idx) => {
    rosters[key] = results[idx].status === "fulfilled" ? results[idx].value : [];
  });
  return rosters;
}

export function buildPersonnelRankIndex(allRosters = {}) {
  const index = {
    byRobloxId: new Map(),
    byUsername: new Map(),
    byDisplayName: new Map(),
    allMembers: new Map()
  };

  function getOrCreate(robloxId, username, displayName) {
    const key = String(robloxId || username || "unknown").toLowerCase();
    let entry = index.allMembers.get(key);
    if (!entry) {
      entry = {
        robloxId: String(robloxId || ""),
        robloxUsername: username || "",
        displayName: displayName || username || robloxId || "Unknown",
        mainRank: null,
        mainRole: null,
        dcRank: null,
        dcRole: null,
        divisionRoles: [],
        isMainHR: false,
        isDivHR: false,
        isAllHR: false,
        isDarkCouncil: false,
        isHighCommand: false,
        isMR: false,
        isLR: false,
        primaryRankTitle: "",
        bracketLabel: "Member"
      };
      index.allMembers.set(key, entry);
    }
    if (robloxId) {
      entry.robloxId = String(robloxId);
      index.byRobloxId.set(String(robloxId), entry);
    }
    if (username) {
      entry.robloxUsername = username;
      index.byUsername.set(username.toLowerCase(), entry);
    }
    if (displayName) {
      entry.displayName = displayName;
      index.byDisplayName.set(displayName.toLowerCase(), entry);
    }
    return entry;
  }

  // 1. Dark Council
  for (const m of (allRosters.darkCouncil || [])) {
    const entry = getOrCreate(m.robloxId, m.username, m.displayName);
    entry.dcRank = m.rank;
    entry.dcRole = m.role;
    entry.isDarkCouncil = m.rank >= 15;
    entry.isHighCommand = m.rank >= 250;
    entry.isMainHR = true;
    entry.isAllHR = true;
    entry.bracketLabel = "Dark Council";
    entry.primaryRankTitle = m.role || "Dark Council";
  }

  // 2. Main Group High Ranks (Overseer [44], Master [45], Lord [50], Darth [53])
  for (const m of (allRosters.highranks || [])) {
    const entry = getOrCreate(m.robloxId, m.username, m.displayName);
    entry.mainRank = m.rank;
    entry.mainRole = m.role;
    entry.isMainHR = true;
    entry.isAllHR = true;
    if (!entry.isDarkCouncil) {
      entry.bracketLabel = "High Rank";
      entry.primaryRankTitle = `${m.role} ${entry.displayName}`;
    }
  }

  // 3. Divisions
  const divHRThresholds = {
    reavers: 15,
    dhg: 80,
    inquisitors: 155,
    dreadmasters: 10
  };

  const divMRThresholds = {
    reavers: [10],
    dhg: [60],
    inquisitors: [150],
    dreadmasters: [4]
  };

  const divLRThresholds = {
    reavers: [1, 5],
    dhg: [30, 50],
    inquisitors: [100, 125],
    dreadmasters: [2, 3]
  };

  for (const [divKey, members] of Object.entries(allRosters)) {
    if (divKey === "highranks" || divKey === "darkCouncil") continue;
    const hrMin = divHRThresholds[divKey] || 999;
    const mrRanks = divMRThresholds[divKey] || [];
    const lrRanks = divLRThresholds[divKey] || [];

    for (const m of (members || [])) {
      const entry = getOrCreate(m.robloxId, m.username, m.displayName);
      const isDivHR = m.rank >= hrMin;
      const isMR = mrRanks.includes(m.rank);
      const isLR = lrRanks.includes(m.rank);

      entry.divisionRoles.push({
        division: divKey,
        rank: m.rank,
        role: m.role,
        isDivHR,
        isMR,
        isLR
      });

      if (isDivHR) {
        entry.isDivHR = true;
        entry.isAllHR = true;
        if (!entry.isDarkCouncil && !entry.isMainHR) {
          entry.bracketLabel = "Division High Rank";
          entry.primaryRankTitle = `${m.role} ${entry.displayName}`;
        }
      } else if (isMR) {
        entry.isMR = true;
        if (!entry.primaryRankTitle) {
          entry.bracketLabel = "Middle Rank";
          entry.primaryRankTitle = `${m.role} ${entry.displayName}`;
        }
      } else if (isLR) {
        entry.isLR = true;
        if (!entry.primaryRankTitle) {
          entry.bracketLabel = "Enlisted";
          entry.primaryRankTitle = `${m.role} ${entry.displayName}`;
        }
      }
    }
  }

  // Final fallback title
  for (const entry of index.allMembers.values()) {
    if (!entry.primaryRankTitle) {
      entry.primaryRankTitle = entry.displayName;
    }
  }

  return index;
}

export function matchesRankFilter(memberMeta, filter) {
  if (!memberMeta) return false;
  const raw = String(filter || "").toLowerCase().trim().replace(/[\s_\-]+/g, "_");
  if (!raw || raw === "all" || raw === "*") return true;

  // 1. Combined High Ranks (Main HR + Division HR)
  if (
    raw === "all_hr" ||
    raw === "allhr" ||
    raw === "hr_all" ||
    raw === "hr_div_hr" ||
    raw === "hr_and_div_hr" ||
    raw === "hr_divhr" ||
    raw === "all_high_ranks" ||
    raw === "high_ranks_and_division_hr" ||
    raw === "high_ranks_div_hr" ||
    raw === "highranks_and_div_highranks"
  ) {
    return Boolean(memberMeta.isAllHR);
  }

  // 2. Main Group High Ranks (Overseer, Master, Lord, Darth, DC)
  if (
    raw === "hr" ||
    raw === "main_hr" ||
    raw === "mainhr" ||
    raw === "highranks" ||
    raw === "high_ranks" ||
    raw === "high_rank" ||
    raw === "main_high_ranks"
  ) {
    return Boolean(memberMeta.isMainHR);
  }

  // 3. Division High Ranks (Reaver Lord+, Guard Lieutenant+, High Inquisitor+, Dread Masters)
  if (
    raw === "div_hr" ||
    raw === "divhr" ||
    raw === "div_hr_plus" ||
    raw === "div_hrs" ||
    raw === "division_hr" ||
    raw === "division_hrs" ||
    raw === "division_high_ranks" ||
    raw === "division_high_rank"
  ) {
    return Boolean(memberMeta.isDivHR);
  }

  // 4. Specific Division HRs
  if (raw === "reavers_hr" || raw === "reaver_hr" || raw === "reavers_high_rank") {
    return memberMeta.divisionRoles?.some(d => d.division === "reavers" && d.isDivHR);
  }
  if (raw === "dhg_hr" || raw === "guard_hr" || raw === "guards_hr" || raw === "dhg_high_rank") {
    return memberMeta.divisionRoles?.some(d => d.division === "dhg" && d.isDivHR);
  }
  if (raw === "inquisitors_hr" || raw === "inquisitor_hr" || raw === "inquisitors_high_rank") {
    return memberMeta.divisionRoles?.some(d => d.division === "inquisitors" && d.isDivHR);
  }
  if (raw === "dreadmasters_hr" || raw === "dread_master_hr" || raw === "dread_masters_hr" || raw === "dreads_hr") {
    return memberMeta.divisionRoles?.some(d => d.division === "dreadmasters" && d.isDivHR);
  }

  // 5. Dark Council & High Command
  if (raw === "dc" || raw === "dark_council" || raw === "darkcouncil" || raw === "council") {
    return Boolean(memberMeta.isDarkCouncil);
  }
  if (raw === "hc" || raw === "high_command" || raw === "highcommand") {
    return Boolean(memberMeta.isHighCommand);
  }

  // 6. Middle Ranks & Low Ranks
  if (raw === "mr" || raw === "middle_rank" || raw === "middle_ranks" || raw === "officer" || raw === "officers") {
    return Boolean(memberMeta.isMR || [27, 29, 32, 33, 34, 35].includes(memberMeta.mainRank));
  }
  if (raw === "lr" || raw === "low_rank" || raw === "low_ranks" || raw === "enlisted" || raw === "fr" || raw === "flat_rank") {
    return Boolean(memberMeta.isLR || (typeof memberMeta.mainRank === "number" && memberMeta.mainRank >= 1 && memberMeta.mainRank <= 26));
  }

  // 7. Specific named ranks
  const normalizedTitle = String(memberMeta.primaryRankTitle || "").toLowerCase();
  const normalizedMainRole = String(memberMeta.mainRole || "").toLowerCase();
  const normalizedDcRole = String(memberMeta.dcRole || "").toLowerCase();
  const cleanFilter = raw.replace(/_/g, " ");

  if (normalizedTitle.includes(cleanFilter) || normalizedMainRole.includes(cleanFilter) || normalizedDcRole.includes(cleanFilter)) {
    return true;
  }

  for (const d of (memberMeta.divisionRoles || [])) {
    if (d.role?.toLowerCase().includes(cleanFilter)) return true;
  }

  return false;
}

export function computeRankBracketStatistics(activeUsers = [], rankIndex, rankFilter = "all_hr", timeframeLabel = "This Week") {
  const allMembersList = rankIndex?.allMembers ? Array.from(rankIndex.allMembers.values()) : [];
  const fullRosterMembers = allMembersList.filter(m => matchesRankFilter(m, rankFilter));
  const totalRosterCount = fullRosterMembers.length;

  const activeMap = new Map();
  for (const u of activeUsers) {
    const key = String(u.robloxId || u.robloxUsername || u.name || u.userId || "").toLowerCase();
    if (key) activeMap.set(key, u);
  }

  const activeRosterList = [];
  const inactiveRosterList = [];
  let totalHours = 0;
  let totalMinutes = 0;
  let onDutyCount = 0;
  const onDutyOfficers = [];

  const mainHRBreakdown = { totalHours: 0, activeCount: 0, rosterCount: 0, topMembers: [] };
  const divHRBreakdown = {
    totalHours: 0,
    activeCount: 0,
    rosterCount: 0,
    byDivision: {
      reavers: { hours: 0, activeCount: 0, rosterCount: 0, members: [] },
      dhg: { hours: 0, activeCount: 0, rosterCount: 0, members: [] },
      inquisitors: { hours: 0, activeCount: 0, rosterCount: 0, members: [] },
      dreadmasters: { hours: 0, activeCount: 0, rosterCount: 0, members: [] }
    }
  };

  for (const member of fullRosterMembers) {
    if (member.isMainHR) mainHRBreakdown.rosterCount++;
    if (member.isDivHR) {
      divHRBreakdown.rosterCount++;
      for (const d of member.divisionRoles) {
        if (d.isDivHR && divHRBreakdown.byDivision[d.division]) {
          divHRBreakdown.byDivision[d.division].rosterCount++;
        }
      }
    }

    const matchedActive = (
      (member.robloxId && activeMap.get(member.robloxId.toLowerCase())) ||
      (member.robloxUsername && activeMap.get(member.robloxUsername.toLowerCase())) ||
      (member.displayName && activeMap.get(member.displayName.toLowerCase())) ||
      null
    );

    if (matchedActive && matchedActive.totalHours > 0) {
      totalHours += matchedActive.totalHours;
      totalMinutes += matchedActive.totalMinutes || (matchedActive.totalHours * 60);
      if (matchedActive.onDutyNow) {
        onDutyCount++;
        onDutyOfficers.push({
          name: member.displayName || member.robloxUsername,
          username: member.robloxUsername,
          rankTitle: member.primaryRankTitle,
          bracket: member.bracketLabel
        });
      }

      const activeRecord = {
        name: member.displayName || member.robloxUsername,
        username: member.robloxUsername,
        rankTitle: member.primaryRankTitle,
        bracket: member.bracketLabel,
        hours: matchedActive.totalHours,
        minutes: matchedActive.totalMinutes || (matchedActive.totalHours * 60),
        shiftCount: matchedActive.shiftCount || 1,
        onDutyNow: Boolean(matchedActive.onDutyNow)
      };
      activeRosterList.push(activeRecord);

      if (member.isMainHR) {
        mainHRBreakdown.activeCount++;
        mainHRBreakdown.totalHours += matchedActive.totalHours;
        mainHRBreakdown.topMembers.push(activeRecord);
      }

      if (member.isDivHR) {
        divHRBreakdown.activeCount++;
        divHRBreakdown.totalHours += matchedActive.totalHours;
        for (const d of member.divisionRoles) {
          if (d.isDivHR && divHRBreakdown.byDivision[d.division]) {
            divHRBreakdown.byDivision[d.division].activeCount++;
            divHRBreakdown.byDivision[d.division].hours += matchedActive.totalHours;
            divHRBreakdown.byDivision[d.division].members.push(activeRecord);
          }
        }
      }
    } else {
      inactiveRosterList.push({
        name: member.displayName || member.robloxUsername,
        username: member.robloxUsername,
        rankTitle: member.primaryRankTitle,
        bracket: member.bracketLabel
      });
    }
  }

  activeRosterList.sort((a, b) => b.hours - a.hours);
  mainHRBreakdown.topMembers.sort((a, b) => b.hours - a.hours);
  const streamlinedDivisions = {};
  for (const divKey of Object.keys(divHRBreakdown.byDivision)) {
    const divData = divHRBreakdown.byDivision[divKey];
    divData.members.sort((a, b) => b.hours - a.hours);
    streamlinedDivisions[divKey] = {
      hours: Math.round(divData.hours * 10) / 10,
      activeCount: divData.activeCount,
      rosterCount: divData.rosterCount,
      topOfficers: divData.members.slice(0, 3).map(m => `${m.name} (${m.hours}h)`)
    };
  }

  mainHRBreakdown.totalHours = Math.round(mainHRBreakdown.totalHours * 10) / 10;
  divHRBreakdown.totalHours = Math.round(divHRBreakdown.totalHours * 10) / 10;
  totalHours = Math.round(totalHours * 10) / 10;

  const activeCount = activeRosterList.length;
  const activityRate = totalRosterCount > 0
    ? `${Math.round((activeCount / totalRosterCount) * 1000) / 10}%`
    : "0%";
  const avgHours = activeCount > 0 ? Math.round((totalHours / activeCount) * 10) / 10 : 0;

  return {
    rankFilter,
    timeframe: timeframeLabel,
    totalRosterCount,
    activeCount,
    inactiveCount: inactiveRosterList.length,
    activityRate,
    totalHoursLogged: totalHours,
    totalMinutesLogged: totalMinutes,
    averageHoursPerActiveMember: avgHours,
    currentlyOnDutyCount: onDutyCount,
    currentlyOnDutyOfficers: onDutyOfficers.slice(0, 6).map(o => `${o.name} (${o.rankTitle})`),
    mainHighRanks: {
      totalHours: mainHRBreakdown.totalHours,
      activeCount: mainHRBreakdown.activeCount,
      rosterCount: mainHRBreakdown.rosterCount,
      topOfficers: mainHRBreakdown.topMembers.slice(0, 5).map(m => `${m.name} (${m.rankTitle || "HR"}) - ${m.hours}h`)
    },
    divisionHighRanks: {
      totalHours: divHRBreakdown.totalHours,
      activeCount: divHRBreakdown.activeCount,
      rosterCount: divHRBreakdown.rosterCount,
      byDivision: streamlinedDivisions
    },
    inactiveOfficersSummary: {
      count: inactiveRosterList.length,
      sample: inactiveRosterList.slice(0, 8).map(m => `${m.name} (${m.rankTitle || m.bracket})`)
    },
    inactiveOfficers: inactiveRosterList
  };
}
