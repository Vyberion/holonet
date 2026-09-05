import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPersonnelRankIndex,
  matchesRankFilter,
  computeRankBracketStatistics
} from "../../modules/data/rank-roster.js";

test("buildPersonnelRankIndex and matchesRankFilter", () => {
  const mockRosters = {
    darkCouncil: [
      { robloxId: "101", username: "DarthVitiate", displayName: "Vitiate", rank: 253, role: "Lord Emperor" },
      { robloxId: "102", username: "DarthMarr", displayName: "Marr", rank: 250, role: "Darth Marr" }
    ],
    highranks: [
      { robloxId: "103", username: "LordMalak", displayName: "Malak", rank: 50, role: "Lord" },
      { robloxId: "104", username: "OverseerHarkun", displayName: "Harkun", rank: 44, role: "Overseer" }
    ],
    reavers: [
      { robloxId: "105", username: "ReaverBoss", displayName: "ReaverBoss", rank: 200, role: "Reaver Commander" },
      { robloxId: "106", username: "ReaverLord1", displayName: "ReaverLord1", rank: 15, role: "Reaver Lord" },
      { robloxId: "107", username: "ReaverGrunt", displayName: "ReaverGrunt", rank: 5, role: "Reaver" }
    ],
    dhg: [
      { robloxId: "108", username: "GuardCapt", displayName: "GuardCapt", rank: 90, role: "Guard Captain" },
      { robloxId: "109", username: "GuardLt", displayName: "GuardLt", rank: 80, role: "Guard Lieutenant" },
      { robloxId: "110", username: "GuardTroop", displayName: "GuardTroop", rank: 50, role: "Guard" }
    ],
    inquisitors: [
      { robloxId: "111", username: "HighInq", displayName: "HighInq", rank: 155, role: "High Inquisitor" },
      { robloxId: "112", username: "InqAdept", displayName: "InqAdept", rank: 125, role: "Inquisitor" }
    ],
    dreadmasters: [
      { robloxId: "113", username: "RaptusMaster", displayName: "Raptus", rank: 36, role: "Dread Master Raptus" },
      { robloxId: "114", username: "BestiaMaster", displayName: "Bestia", rank: 10, role: "Dread Master Bestia" },
      { robloxId: "115", username: "DreadGuard1", displayName: "DreadGuard1", rank: 3, role: "Dread Guard" }
    ]
  };

  const rankIndex = buildPersonnelRankIndex(mockRosters);

  // 1. Dark Council
  const vitiate = rankIndex.byRobloxId.get("101");
  assert.ok(vitiate, "Vitiate should be in index");
  assert.equal(vitiate.isDarkCouncil, true);
  assert.equal(vitiate.isMainHR, true);
  assert.equal(vitiate.isAllHR, true);
  assert.equal(matchesRankFilter(vitiate, "all_hr"), true);
  assert.equal(matchesRankFilter(vitiate, "hr"), true);
  assert.equal(matchesRankFilter(vitiate, "dc"), true);
  assert.equal(matchesRankFilter(vitiate, "hc"), true);

  // 2. Main Group High Rank (Lord & Overseer)
  const malak = rankIndex.byRobloxId.get("103");
  assert.ok(malak);
  assert.equal(malak.isMainHR, true);
  assert.equal(malak.isAllHR, true);
  assert.equal(malak.isDivHR, false);
  assert.equal(matchesRankFilter(malak, "all_hr"), true);
  assert.equal(matchesRankFilter(malak, "hr"), true);
  assert.equal(matchesRankFilter(malak, "div_hr"), false);
  assert.equal(matchesRankFilter(malak, "lord"), true);

  const harkun = rankIndex.byRobloxId.get("104");
  assert.ok(harkun);
  assert.equal(matchesRankFilter(harkun, "overseer"), true);
  assert.equal(matchesRankFilter(harkun, "all_hr"), true);

  // 3. Division High Ranks (Reaver Commander, Guard Lieutenant, High Inquisitor, Dread Master)
  const reaverBoss = rankIndex.byRobloxId.get("105");
  assert.equal(reaverBoss.isDivHR, true);
  assert.equal(reaverBoss.isAllHR, true);
  assert.equal(matchesRankFilter(reaverBoss, "div_hr"), true);
  assert.equal(matchesRankFilter(reaverBoss, "all_hr"), true);
  assert.equal(matchesRankFilter(reaverBoss, "reavers_hr"), true);

  const guardLt = rankIndex.byRobloxId.get("109");
  assert.equal(guardLt.isDivHR, true);
  assert.equal(matchesRankFilter(guardLt, "div_hr"), true);
  assert.equal(matchesRankFilter(guardLt, "dhg_hr"), true);
  assert.equal(matchesRankFilter(guardLt, "guard lieutenant"), true);

  const highInq = rankIndex.byRobloxId.get("111");
  assert.equal(highInq.isDivHR, true);
  assert.equal(matchesRankFilter(highInq, "inquisitors_hr"), true);

  const raptus = rankIndex.byRobloxId.get("113");
  assert.equal(raptus.isDivHR, true);
  assert.equal(matchesRankFilter(raptus, "dreadmasters_hr"), true);

  // 4. Non-HR Division Members
  const reaverGrunt = rankIndex.byRobloxId.get("107");
  assert.equal(reaverGrunt.isDivHR, false);
  assert.equal(reaverGrunt.isAllHR, false);
  assert.equal(reaverGrunt.isLR, true);
  assert.equal(matchesRankFilter(reaverGrunt, "all_hr"), false);
  assert.equal(matchesRankFilter(reaverGrunt, "lr"), true);
});

test("computeRankBracketStatistics for all_hr", () => {
  const mockRosters = {
    darkCouncil: [
      { robloxId: "101", username: "DarthVitiate", displayName: "Vitiate", rank: 253, role: "Lord Emperor" },
      { robloxId: "102", username: "DarthMarr", displayName: "Marr", rank: 250, role: "Darth Marr" }
    ],
    highranks: [
      { robloxId: "103", username: "LordMalak", displayName: "Malak", rank: 50, role: "Lord" },
      { robloxId: "104", username: "OverseerHarkun", displayName: "Harkun", rank: 44, role: "Overseer" }
    ],
    reavers: [
      { robloxId: "105", username: "ReaverBoss", displayName: "ReaverBoss", rank: 200, role: "Reaver Commander" },
      { robloxId: "106", username: "ReaverLord1", displayName: "ReaverLord1", rank: 15, role: "Reaver Lord" }
    ],
    dhg: [
      { robloxId: "108", username: "GuardCapt", displayName: "GuardCapt", rank: 90, role: "Guard Captain" }
    ],
    inquisitors: [
      { robloxId: "111", username: "HighInq", displayName: "HighInq", rank: 155, role: "High Inquisitor" }
    ],
    dreadmasters: [
      { robloxId: "113", username: "RaptusMaster", displayName: "Raptus", rank: 36, role: "Dread Master Raptus" }
    ]
  };

  const rankIndex = buildPersonnelRankIndex(mockRosters);

  // Simulate active shift logs for some members
  const mockActiveUsers = [
    { robloxId: "101", robloxUsername: "DarthVitiate", name: "Vitiate", totalHours: 12.5, totalMinutes: 750, shiftCount: 3, onDutyNow: true },
    { robloxId: "103", robloxUsername: "LordMalak", name: "Malak", totalHours: 8.0, totalMinutes: 480, shiftCount: 2, onDutyNow: false },
    { robloxId: "105", robloxUsername: "ReaverBoss", name: "ReaverBoss", totalHours: 10.0, totalMinutes: 600, shiftCount: 4, onDutyNow: true },
    { robloxId: "108", robloxUsername: "GuardCapt", name: "GuardCapt", totalHours: 5.5, totalMinutes: 330, shiftCount: 1, onDutyNow: false }
  ];

  const stats = computeRankBracketStatistics(mockActiveUsers, rankIndex, "all_hr", "This Week");

  assert.equal(stats.totalRosterCount, 9, "Total HR & Div HR roster count should be 9");
  assert.equal(stats.activeCount, 4, "4 officers logged hours");
  assert.equal(stats.inactiveCount, 5, "5 officers have 0 hours");
  assert.equal(stats.activityRate, "44.4%");
  assert.equal(stats.totalHoursLogged, 36.0);
  assert.equal(stats.currentlyOnDutyCount, 2);
  assert.equal(stats.currentlyOnDutyOfficers.length, 2);

  // Main HR vs Div HR breakdowns
  assert.equal(stats.mainHighRanks.rosterCount, 4);
  assert.equal(stats.mainHighRanks.activeCount, 2);
  assert.equal(stats.mainHighRanks.totalHours, 20.5);

  assert.equal(stats.divisionHighRanks.rosterCount, 5);
  assert.equal(stats.divisionHighRanks.activeCount, 2);
  assert.equal(stats.divisionHighRanks.totalHours, 15.5);
  assert.equal(stats.divisionHighRanks.byDivision.reavers.hours, 10.0);
  assert.equal(stats.divisionHighRanks.byDivision.dhg.hours, 5.5);
  assert.equal(stats.divisionHighRanks.byDivision.inquisitors.hours, 0);

  // Inactive list should contain Marr, Harkun, ReaverLord1, HighInq, RaptusMaster
  assert.equal(stats.inactiveOfficers.length, 5);
  assert.ok(stats.inactiveOfficers.some(o => o.username === "DarthMarr"));
  assert.ok(stats.inactiveOfficers.some(o => o.username === "OverseerHarkun"));
});
