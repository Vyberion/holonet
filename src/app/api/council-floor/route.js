import { getAuthContext } from "../../../../modules/auth/auth-context.js";
import { checkPageAccess } from "../../../../modules/auth/permissions.js";
import { ROBLOX_GROUPS } from "../../../../modules/auth/roblox-groups.js";
import { supabaseRest } from "../../../../modules/auth/session-store.js";

const DARK_COUNCIL_RANKS = ROBLOX_GROUPS.DARK_COUNCIL.ranks;
const DARK_COUNCIL_ROLE_GROUPS = [
  { key: "groupOwner", label: "Owner", ranks: DARK_COUNCIL_RANKS.groupOwner, counts: false, veto: true },
  { key: "projectManager", label: "Project Manager", ranks: DARK_COUNCIL_RANKS.projectManager, counts: false, veto: true },
  { key: "emperor", label: "Emperor", ranks: DARK_COUNCIL_RANKS.emperor, counts: true, veto: true },
  { key: "emperorPowerbase", label: "High Command", ranks: DARK_COUNCIL_RANKS.emperorPowerbase, counts: true, veto: false },
  {
    key: "darkCouncil",
    label: "Dark Council",
    ranks: [
      ...DARK_COUNCIL_RANKS.highRankOverseer,
      ...DARK_COUNCIL_RANKS.darkHonorGuardOverseer,
      ...DARK_COUNCIL_RANKS.reaverOverseer,
      ...DARK_COUNCIL_RANKS.dreadMasterOverseer,
      ...DARK_COUNCIL_RANKS.inquisitoriusOverseer,
      ...DARK_COUNCIL_RANKS.warmaster
    ],
    counts: true,
    veto: false
  }
];
const COUNCIL_COUNTING_RANKS = DARK_COUNCIL_ROLE_GROUPS.filter(group => group.counts).flatMap(group => group.ranks);
const COUNCIL_VOTING_RANKS = DARK_COUNCIL_ROLE_GROUPS.flatMap(group => group.ranks);
const COUNCIL_VETO_RANKS = DARK_COUNCIL_ROLE_GROUPS.filter(group => group.veto).flatMap(group => group.ranks);

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function requestShim(request) {
  return {
    headers: {
      cookie: request.headers.get("cookie") || ""
    }
  };
}

function requireString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function encodeInList(values) {
  return `(${values.map(value => String(value).replace(/[(),]/g, "")).join(",")})`;
}

function isMissingSchemaError(error) {
  return /does not exist|Could not find the table|column .* does not exist/i.test(String(error?.message || ""));
}

function councilRank(profile) {
  return Number(profile?.groupRanks?.[ROBLOX_GROUPS.DARK_COUNCIL.groupId] || 0);
}

function councilRoleForRank(rank) {
  const matched = DARK_COUNCIL_ROLE_GROUPS.find(group => group.ranks.includes(Number(rank)));
  return matched?.label || "";
}

function councilPermissions(profile) {
  const rank = councilRank(profile);
  const isSuperUser = Boolean(profile?.isSuperUser);
  const floorAccess = profile ? checkPageAccess(profile, "dark-council/council-floor") : { authorized: false };
  const hasFloorOverride = floorAccess.reason === "OVERRIDE_GRANT";
  const canUseFloor = isSuperUser || COUNCIL_VOTING_RANKS.includes(rank) || hasFloorOverride;

  return {
    rank,
    role: isSuperUser ? "Super User" : councilRoleForRank(rank) || (hasFloorOverride ? "Override Authority" : ""),
    canView: floorAccess.authorized || canUseFloor,
    canPropose: canUseFloor,
    canVote: canUseFloor,
    canVeto: isSuperUser || COUNCIL_VETO_RANKS.includes(rank),
    canReopen: isSuperUser || COUNCIL_VETO_RANKS.includes(rank),
    countsTowardsMajority: COUNCIL_COUNTING_RANKS.includes(rank)
  };
}

function authRobloxId(auth) {
  return String(auth?.user?.roblox_id || auth?.profile?.robloxId || "0");
}

function authName(auth) {
  return requireString(
    auth?.user?.roblox_username || auth?.user?.roblox_display_name || auth?.user?.roblox_id,
    auth?.profile?.isSuperUser ? "Preview Operator" : "Unknown"
  );
}

async function fetchCouncilEligibleSnapshot() {
  const response = await fetch(`https://groups.roblox.com/v1/groups/${ROBLOX_GROUPS.DARK_COUNCIL.groupId}/roles`);
  if (!response.ok) throw new Error("COUNCIL_ROLE_SYNC_FAILED");

  const payload = await response.json();
  const roles = payload.roles || payload.data || [];
  const snapshot = DARK_COUNCIL_ROLE_GROUPS.map(group => {
    const matchedRoles = group.ranks.map(rank => roles.find(item => Number(item.rank) === Number(rank)) || { rank });
    return {
      key: group.key,
      rank: Math.max(...group.ranks.map(Number)),
      ranks: group.ranks,
      name: group.label,
      memberCount: matchedRoles.reduce((sum, role) => sum + Number(role.memberCount || role.member_count || 0), 0),
      countsTowardsMajority: group.counts
    };
  });
  const countingEligibleCount = snapshot
    .filter(item => item.countsTowardsMajority)
    .reduce((sum, item) => sum + item.memberCount, 0);

  return {
    snapshot,
    countingEligibleCount,
    majorityCount: Math.floor(countingEligibleCount / 2) + 1
  };
}

function normalizeCouncilVote(row) {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    robloxId: row.roblox_id,
    robloxUsername: row.roblox_username || "",
    vote: row.vote,
    voterRank: row.voter_rank || 0,
    voterRole: row.voter_role || "",
    countsTowardsMajority: Boolean(row.counts_towards_majority),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function voteCounts(votes = []) {
  return votes.reduce((counts, vote) => {
    if (vote.vote === "yes") counts.yes += 1;
    if (vote.vote === "no") counts.no += 1;
    if (vote.vote === "abstain") counts.abstain += 1;
    if (vote.countsTowardsMajority && vote.vote === "yes") counts.countingYes += 1;
    if (vote.countsTowardsMajority && vote.vote === "no") counts.countingNo += 1;
    if (vote.countsTowardsMajority && vote.vote === "abstain") counts.countingAbstain += 1;
    if (!vote.countsTowardsMajority && vote.vote === "yes") counts.advisoryYes += 1;
    if (!vote.countsTowardsMajority && vote.vote === "no") counts.advisoryNo += 1;
    if (!vote.countsTowardsMajority && vote.vote === "abstain") counts.advisoryAbstain += 1;
    return counts;
  }, {
    yes: 0,
    no: 0,
    abstain: 0,
    countingYes: 0,
    countingNo: 0,
    countingAbstain: 0,
    advisoryYes: 0,
    advisoryNo: 0,
    advisoryAbstain: 0
  });
}

function derivedCouncilStatus(proposal, votes = []) {
  if (["vetoed", "withdrawn", "passed", "failed"].includes(proposal.status)) return proposal.status;

  const openedAt = new Date(proposal.opens_at || proposal.created_at);
  const closesAt = new Date(proposal.closes_at);
  const now = new Date();
  const minimumCloseAt = new Date(openedAt.getTime() + 24 * 60 * 60 * 1000);
  const counts = voteCounts(votes);

  if (now >= minimumCloseAt && counts.countingYes >= Number(proposal.majority_count || 1)) return "passed";
  if (now >= closesAt) return "failed";
  return "open";
}

async function loadCouncilProposals() {
  const proposals = await supabaseRest("council_proposals?select=*&order=created_at.desc");
  if (!proposals?.length) return [];

  const ids = proposals.map(item => item.id);
  const votes = await supabaseRest(
    `council_votes?proposal_id=in.${encodeURIComponent(encodeInList(ids))}&select=*&order=created_at.asc`
  );
  const votesByProposal = new Map();
  (votes || []).forEach(row => {
    const list = votesByProposal.get(row.proposal_id) || [];
    list.push(normalizeCouncilVote(row));
    votesByProposal.set(row.proposal_id, list);
  });

  return proposals.map(row => {
    const proposalVotes = votesByProposal.get(row.id) || [];
    const counts = voteCounts(proposalVotes);
    return {
      id: row.id,
      proposalType: row.proposal_type,
      title: row.title,
      body: row.body,
      status: derivedCouncilStatus(row, proposalVotes),
      storedStatus: row.status,
      createdBy: row.created_by,
      createdByName: row.created_by_name || row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      durationHours: row.duration_hours,
      eligibleSnapshot: Array.isArray(row.eligible_snapshot) ? row.eligible_snapshot : [],
      majorityCount: row.majority_count || 0,
      countingEligibleCount: row.counting_eligible_count || 0,
      vetoedBy: row.vetoed_by || "",
      vetoedByName: row.vetoed_by_name || "",
      vetoedAt: row.vetoed_at || null,
      vetoReason: row.veto_reason || "",
      counts,
      votes: proposalVotes
    };
  });
}

function clampDurationHours(value) {
  const hours = Number(value) || 24;
  return Math.max(24, Math.min(168, Math.floor(hours)));
}

async function createCouncilProposal(auth, body) {
  const permissions = councilPermissions(auth.profile);
  if (!permissions.canPropose) return { ok: false, status: 200, payload: { ok: false, authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" } };

  const proposalType = requireString(body.proposalType || body.proposal_type || "motion");
  const title = requireString(body.title);
  const proposalBody = requireString(body.body);
  const durationHours = clampDurationHours(body.durationHours || body.duration_hours);
  if (!["legislation", "motion", "councillor_election"].includes(proposalType) || !title || !proposalBody) {
    return { ok: false, status: 400, payload: { ok: false, reason: "PROPOSAL_FIELDS_REQUIRED" } };
  }

  const roleSnapshot = await fetchCouncilEligibleSnapshot();
  const opensAt = new Date();
  const closesAt = new Date(opensAt.getTime() + durationHours * 60 * 60 * 1000);
  await supabaseRest("council_proposals", {
    method: "POST",
    body: JSON.stringify({
      proposal_type: proposalType,
      title,
      body: proposalBody,
      status: "open",
      created_by: authRobloxId(auth),
      created_by_name: authName(auth),
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
      duration_hours: durationHours,
      eligible_snapshot: roleSnapshot.snapshot,
      counting_eligible_count: roleSnapshot.countingEligibleCount,
      majority_count: roleSnapshot.majorityCount
    })
  });

  return { ok: true, status: 200, payload: { ok: true, proposals: await loadCouncilProposals() } };
}

async function writeCouncilVote(auth, body) {
  const permissions = councilPermissions(auth.profile);
  if (!permissions.canVote) return { ok: false, status: 200, payload: { ok: false, authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" } };

  const proposalId = requireString(body.proposalId || body.proposal_id);
  const vote = requireString(body.vote).toLowerCase();
  if (!proposalId || !["yes", "no", "abstain"].includes(vote)) {
    return { ok: false, status: 400, payload: { ok: false, reason: "VOTE_FIELDS_REQUIRED" } };
  }

  const [proposal] = await supabaseRest(`council_proposals?id=eq.${encodeURIComponent(proposalId)}&select=*`);
  if (!proposal || derivedCouncilStatus(proposal, []) !== "open") {
    return { ok: false, status: 200, payload: { ok: false, reason: "PROPOSAL_CLOSED" } };
  }

  await supabaseRest("council_votes?on_conflict=proposal_id,roblox_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      proposal_id: proposalId,
      roblox_id: authRobloxId(auth),
      roblox_username: authName(auth),
      vote,
      voter_rank: permissions.rank,
      voter_role: permissions.role,
      counts_towards_majority: permissions.countsTowardsMajority,
      updated_at: new Date().toISOString()
    })
  });

  return { ok: true, status: 200, payload: { ok: true, proposals: await loadCouncilProposals() } };
}

async function vetoCouncilProposal(auth, body) {
  const permissions = councilPermissions(auth.profile);
  if (!permissions.canVeto) return { ok: false, status: 200, payload: { ok: false, authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" } };

  const proposalId = requireString(body.proposalId || body.proposal_id);
  if (!proposalId) return { ok: false, status: 400, payload: { ok: false, reason: "PROPOSAL_ID_REQUIRED" } };

  await supabaseRest(`council_proposals?id=eq.${encodeURIComponent(proposalId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "vetoed",
      vetoed_by: authRobloxId(auth),
      vetoed_by_name: authName(auth),
      vetoed_at: new Date().toISOString(),
      veto_reason: requireString(body.reason)
    })
  });

  return { ok: true, status: 200, payload: { ok: true, proposals: await loadCouncilProposals() } };
}

async function reopenCouncilProposal(auth, body) {
  const permissions = councilPermissions(auth.profile);
  if (!permissions.canReopen) return { ok: false, status: 200, payload: { ok: false, authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" } };

  const proposalId = requireString(body.proposalId || body.proposal_id);
  const durationHours = clampDurationHours(body.durationHours || body.duration_hours);
  if (!proposalId) return { ok: false, status: 400, payload: { ok: false, reason: "PROPOSAL_ID_REQUIRED" } };

  const [proposal] = await supabaseRest(`council_proposals?id=eq.${encodeURIComponent(proposalId)}&select=*`);
  if (!proposal) return { ok: false, status: 404, payload: { ok: false, reason: "PROPOSAL_NOT_FOUND" } };

  const votes = await supabaseRest(`council_votes?proposal_id=eq.${encodeURIComponent(proposalId)}&select=*`).catch(() => []);
  if (votes?.length) {
    await supabaseRest("council_vote_history", {
      method: "POST",
      body: JSON.stringify(votes.map(vote => ({
        proposal_id: proposalId,
        roblox_id: vote.roblox_id,
        roblox_username: vote.roblox_username,
        vote: vote.vote,
        voter_rank: vote.voter_rank,
        voter_role: vote.voter_role,
        counts_towards_majority: vote.counts_towards_majority,
        original_created_at: vote.created_at,
        original_updated_at: vote.updated_at,
        archived_by: authRobloxId(auth),
        archived_by_name: authName(auth)
      })))
    });
    await supabaseRest(`council_votes?proposal_id=eq.${encodeURIComponent(proposalId)}`, { method: "DELETE" });
  }

  const roleSnapshot = await fetchCouncilEligibleSnapshot();
  const opensAt = new Date();
  const closesAt = new Date(opensAt.getTime() + durationHours * 60 * 60 * 1000);
  await supabaseRest(`council_proposals?id=eq.${encodeURIComponent(proposalId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "open",
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
      duration_hours: durationHours,
      eligible_snapshot: roleSnapshot.snapshot,
      counting_eligible_count: roleSnapshot.countingEligibleCount,
      majority_count: roleSnapshot.majorityCount,
      vetoed_by: null,
      vetoed_by_name: null,
      vetoed_at: null,
      veto_reason: null,
      updated_at: new Date().toISOString()
    })
  });

  return { ok: true, status: 200, payload: { ok: true, proposals: await loadCouncilProposals() } };
}

export async function GET(request) {
  const auth = await getAuthContext(requestShim(request));
  if (!auth.authenticated) return json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" }, 200);

  const permissions = councilPermissions(auth.profile);
  if (!permissions.canView) return json({ ok: false, authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" }, 200);

  try {
    const [roleSnapshot, proposals] = await Promise.all([
      fetchCouncilEligibleSnapshot(),
      loadCouncilProposals()
    ]);
    return json({ ok: true, permissions, roleSnapshot, proposals });
  } catch (error) {
    if (isMissingSchemaError(error)) return json({ ok: true, permissions, roleSnapshot: { snapshot: [], countingEligibleCount: 0, majorityCount: 1 }, proposals: [], migrationRequired: true });
    return json({ ok: false, reason: error.message || "COUNCIL_FLOOR_UNAVAILABLE" }, 500);
  }
}

export async function POST(request) {
  const auth = await getAuthContext(requestShim(request));
  if (!auth.authenticated) return json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" }, 200);

  const body = await request.json().catch(() => ({}));
  const action = requireString(body.action).toLowerCase();

  try {
    const result = action === "create"
      ? await createCouncilProposal(auth, body)
      : action === "vote"
        ? await writeCouncilVote(auth, body)
        : action === "veto"
          ? await vetoCouncilProposal(auth, body)
          : action === "reopen"
            ? await reopenCouncilProposal(auth, body)
            : { ok: false, status: 400, payload: { ok: false, reason: "UNKNOWN_ACTION" } };

    return json(result.payload, result.status || 200);
  } catch (error) {
    if (isMissingSchemaError(error)) return json({ ok: false, migrationRequired: true, reason: "COUNCIL_DATABASE_REQUIRED" }, 200);
    return json({ ok: false, reason: error.message || "COUNCIL_ACTION_FAILED" }, 500);
  }
}
