import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  VERIFICATION_LOG_COLOR, VERIFICATION_WARNING_COLOR, VERIFICATION_WARNING_ROLE_IDS, DEFAULT_SITE_ORIGIN, OAUTH_STATE_MAX_AGE_SECONDS, cachedDiscordToken, cachedVerificationLogChannelId, getQueryParam, requireString, authAuthorName, readTextFileIfExists, escapeRegExp, candidateRepoRoots, candidateBotFiles, readEnvValue, readEnvValueFromCandidates, discordToken, parseVerificationLogChannelId, verificationLogChannelId, warnVerificationLog, tokenFingerprint, logVerificationConfirm, postVerificationLog, postVerificationLogSafely, slugify, toRoman, fromRoman, articleOrderFrom, regulationOrderFrom, regulationAnchor, withIncrementedOrder, shiftDisplayOrders, shiftLibraryDocumentOrders, insertAtDisplayOrder, resolveEntryDisplayOrders, isMissingSchemaError, COUNCIL_RANKS, COUNCIL_COUNTING_RANKS, COUNCIL_VOTING_RANKS, COUNCIL_VETO_RANKS, councilRank, councilRoleForRank, councilPermissions, canViewInquisitorOverview, hasDarkCouncilPlus, canWriteDivisionWeeklyReport, canWriteBoardBroadcast, boardChannelsFor, clampDurationHours, publicImageUrl, isLocalHostname, normalizeSiteUrl, headerFirstValue, requestRootOrigin, canonicalOAuthOrigin, oauthRedirectUri, normalizeOauthRedirectUri, encodeOAuthStateCookie, decodeOAuthStateCookie, statesMatch, lookupUrlForRequest, encodeInList, detailTableFor, normalizeSubClauses, resolveRobloxId, confirmDiscordLink, readJsonBody, cleanupRetiredHandbooks, loadArchiveArticles, seedArchives, ensureArchivesSeeded, writeArchiveArticle, deleteArchiveArticle, loadLibraryDocuments, seedLibrary, ensureLibrarySeeded, writeLibraryDocument, deleteLibraryDocument, loadPublishedResources, loadDetailRows, normalizeRows, loadBoardTransmissions, loadNexusOverview, canonicalDivisionId, rosterDefinitionForDivision, fetchDivisionRoster, normalizeReportMember, normalizeWeeklyReport, loadWeeklyReportMembers, loadWeeklyReports, clockScopeForDivision, shiftTotalSeconds, formatMemberShift, inFilter, loadVerificationLinksForRobloxIds, loadClockShiftTotalsForRoster, buildWeeklyReportRoster, resetClockShiftsForReport, reportTotals, reportMemberRows, normalizeIncomingReportMember, replaceWeeklyReportMembers, writeWeeklyReport, inspectionSectionsFor, calculateInspectionOverall, normalizeInspectionSection, normalizeInspection, loadInspectionSections, loadInspections, inspectionSectionRows, replaceInspectionSections, writeInspection, writeResource, deleteResource, resolveUserByUsername, loadRobloxProfileSummary, personnelLookupWarnings, fetchBadgeCount, loadCounts, loadPendingRetirements, activityItem, pagedActivity, loadRecentActivity, loadAdminHealth, loadOverrides, restoreHandbookRetirement, fetchCouncilEligibleSnapshot, normalizeCouncilVote, voteCounts, derivedCouncilStatus, loadCouncilProposals, createCouncilProposal, writeCouncilVote, vetoCouncilProposal, reopenCouncilProposal, normalizeTimelineEntry, loadTimelineEntries, writeTimelineEntry
} from "../../../lib/api-helpers.js";

const handler = async (req, res) => {
    try {
      if (req.method === "GET") {
        const auth = await getAuthContext(req, { optional: true });
        const canEdit = auth.authenticated ? canEditLibrary(auth.profile, "archives").authorized : false;
        const articles = await ensureArchivesSeeded();

        return res.status(200).json({
          ok: true,
          library: "archives",
          canEdit,
          articles,
          documents: articles
        });
      }

      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const permission = canEditLibrary(auth.profile, "archives");
      if (!permission.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const result = await writeArchiveArticle(body);
        return res.status(result.status).json(result.payload);
      }

      if (req.method === "DELETE") {
        const id = requireString(getQueryParam(req, "id"));
        if (!id) {
          return res.status(400).json({ ok: false, reason: "ARTICLE_ID_REQUIRED" });
        }

        await deleteArchiveArticle(id);
        return res.status(200).json({ ok: true });
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      if (req.method === "GET" && isMissingSchemaError(error)) {
        const articles = (ARCHIVE_SEED.articles || []).map(article => ({
          id: article.slug,
          slug: article.slug,
          articleNumber: article.articleNumber || "ARTICLE 1",
          title: article.title,
          body: article.body,
          imageBucket: article.imagePath ? "archives" : "",
          imagePath: article.imagePath || "",
          imageAlt: article.imageAlt || article.title,
          imageUrl: "",
          status: article.status || "published",
          displayOrder: article.displayOrder || 0
        }));

        return res.status(200).json({
          ok: true,
          library: "archives",
          canEdit: false,
          migrationRequired: true,
          articles,
          documents: articles
        });
      }

      return res.status(500).json({ ok: false, error: error.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
