import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  VERIFICATION_LOG_COLOR, VERIFICATION_WARNING_COLOR, VERIFICATION_WARNING_ROLE_IDS, DEFAULT_SITE_ORIGIN, OAUTH_STATE_MAX_AGE_SECONDS, cachedDiscordToken, cachedVerificationLogChannelId, getQueryParam, requireString, authAuthorName, readTextFileIfExists, escapeRegExp, candidateRepoRoots, candidateBotFiles, readEnvValue, readEnvValueFromCandidates, discordToken, parseVerificationLogChannelId, verificationLogChannelId, warnVerificationLog, tokenFingerprint, logVerificationConfirm, postVerificationLog, postVerificationLogSafely, slugify, toRoman, fromRoman, articleOrderFrom, regulationOrderFrom, regulationAnchor, withIncrementedOrder, shiftDisplayOrders, shiftLibraryDocumentOrders, insertAtDisplayOrder, resolveEntryDisplayOrders, isMissingSchemaError, COUNCIL_RANKS, COUNCIL_COUNTING_RANKS, COUNCIL_VOTING_RANKS, COUNCIL_VETO_RANKS, councilRank, councilRoleForRank, councilPermissions, canViewInquisitorOverview, hasDarkCouncilPlus, canWriteDivisionWeeklyReport, canWriteBoardBroadcast, boardChannelsFor, clampDurationHours, publicImageUrl, isLocalHostname, normalizeSiteUrl, headerFirstValue, requestRootOrigin, canonicalOAuthOrigin, oauthRedirectUri, normalizeOauthRedirectUri, encodeOAuthStateCookie, decodeOAuthStateCookie, statesMatch, lookupUrlForRequest, encodeInList, detailTableFor, normalizeSubClauses, resolveRobloxId, confirmDiscordLink, readJsonBody, cleanupRetiredHandbooks, loadArchiveArticles, seedArchives, ensureArchivesSeeded, writeArchiveArticle, deleteArchiveArticle, loadLibraryDocuments, seedLibrary, ensureLibrarySeeded, writeLibraryDocument, deleteLibraryDocument, loadPublishedResources, loadDetailRows, normalizeRows, loadBoardTransmissions, loadNexusOverview, canonicalDivisionId, rosterDefinitionForDivision, fetchDivisionRoster, normalizeReportMember, normalizeWeeklyReport, loadWeeklyReportMembers, loadWeeklyReports, clockScopeForDivision, shiftTotalSeconds, formatMemberShift, inFilter, loadVerificationLinksForRobloxIds, loadClockShiftTotalsForRoster, buildWeeklyReportRoster, resetClockShiftsForReport, reportTotals, reportMemberRows, normalizeIncomingReportMember, replaceWeeklyReportMembers, writeWeeklyReport, inspectionSectionsFor, calculateInspectionOverall, normalizeInspectionSection, normalizeInspection, loadInspectionSections, loadInspections, inspectionSectionRows, replaceInspectionSections, writeInspection, writeResource, deleteResource, resolveUserByUsername, loadRobloxProfileSummary, personnelLookupWarnings, fetchBadgeCount, loadCounts, loadPendingRetirements, activityItem, pagedActivity, loadRecentActivity, loadAdminHealth, loadOverrides, restoreHandbookRetirement, fetchCouncilEligibleSnapshot, normalizeCouncilVote, voteCounts, derivedCouncilStatus, loadCouncilProposals, createCouncilProposal, writeCouncilVote, vetoCouncilProposal, reopenCouncilProposal, normalizeTimelineEntry, loadTimelineEntries, writeTimelineEntry
} from "../../../lib/api-helpers.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}

function publicProfile(profile) {
  return {
    robloxId: profile.robloxId,
    isSuperUser: Boolean(profile.isSuperUser),
    isMachine: Boolean(profile.isMachine),
    machineName: profile.machineName || "",
    hasFullAccess: Boolean(profile.hasFullAccess),
    highRank: profile.highRank,
    divisions: profile.divisions,
    authorityRoles: profile.authorityRoles
  };
}

export async function GET(request) {
  const auth = await getAuthContext(request, { optional: true });
  if (!auth.machine || !auth.profile?.isSuperUser) {
    return json({ ok: false, authorized: false, reason: "DARTH_MANAR_TOKEN_REQUIRED" }, 401);
  }

  const url = new URL(request.url);
  const page = String(url.searchParams.get("page") || "").trim();
  const pageAccess = page ? checkPageAccess(auth.profile, page) : null;

  return json({
    ok: true,
    authorized: true,
    identity: "darth-manar",
    profile: publicProfile(auth.profile),
    pageAccess,
    permissions: {
      canAccessAdmin: canAccessAdmin(auth.profile).authorized,
      canAccessNexus: canAccessNexus(auth.profile).authorized,
      canAccessRegistry: canAccessRegistry(auth.profile).authorized,
      canAccessPersonnelLookup: canAccessPersonnelLookup(auth.profile).authorized
    }
  });
}
