import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import {
  VERIFICATION_LOG_COLOR, VERIFICATION_WARNING_COLOR, VERIFICATION_WARNING_ROLE_IDS, DEFAULT_SITE_ORIGIN, OAUTH_STATE_MAX_AGE_SECONDS, cachedDiscordToken, cachedVerificationLogChannelId, getQueryParam, requireString, authAuthorName, readTextFileIfExists, escapeRegExp, candidateRepoRoots, candidateBotFiles, readEnvValue, readEnvValueFromCandidates, discordToken, parseVerificationLogChannelId, verificationLogChannelId, warnVerificationLog, tokenFingerprint, logVerificationConfirm, postVerificationLog, postVerificationLogSafely, slugify, toRoman, fromRoman, articleOrderFrom, regulationOrderFrom, regulationAnchor, withIncrementedOrder, shiftDisplayOrders, shiftLibraryDocumentOrders, insertAtDisplayOrder, resolveEntryDisplayOrders, isMissingSchemaError, COUNCIL_RANKS, COUNCIL_COUNTING_RANKS, COUNCIL_VOTING_RANKS, COUNCIL_VETO_RANKS, councilRank, councilRoleForRank, councilPermissions, canViewInquisitorOverview, hasDarkCouncilPlus, canWriteDivisionWeeklyReport, canWriteBoardBroadcast, boardChannelsFor, clampDurationHours, publicImageUrl, isLocalHostname, normalizeSiteUrl, headerFirstValue, requestRootOrigin, canonicalOAuthOrigin, oauthRedirectUri, normalizeOauthRedirectUri, encodeOAuthStateCookie, decodeOAuthStateCookie, statesMatch, lookupUrlForRequest, encodeInList, detailTableFor, normalizeSubClauses, resolveRobloxId, confirmDiscordLink, readJsonBody, cleanupRetiredHandbooks, loadArchiveArticles, seedArchives, ensureArchivesSeeded, writeArchiveArticle, deleteArchiveArticle, loadLibraryDocuments, seedLibrary, ensureLibrarySeeded, writeLibraryDocument, deleteLibraryDocument, loadPublishedResources, loadDetailRows, normalizeRows, loadBoardTransmissions, loadNexusOverview, canonicalDivisionId, rosterDefinitionForDivision, fetchDivisionRoster, normalizeReportMember, normalizeWeeklyReport, loadWeeklyReportMembers, loadWeeklyReports, clockScopeForDivision, shiftTotalSeconds, formatMemberShift, inFilter, loadVerificationLinksForRobloxIds, loadClockShiftTotalsForRoster, buildWeeklyReportRoster, resetClockShiftsForReport, reportTotals, reportMemberRows, normalizeIncomingReportMember, replaceWeeklyReportMembers, writeWeeklyReport, inspectionSectionsFor, calculateInspectionOverall, normalizeInspectionSection, normalizeInspection, loadInspectionSections, loadInspections, inspectionSectionRows, replaceInspectionSections, writeInspection, writeResource, deleteResource, resolveUserByUsername, loadRobloxProfileSummary, personnelLookupWarnings, fetchBadgeCount, loadCounts, loadPendingRetirements, activityItem, pagedActivity, loadRecentActivity, loadAdminHealth, loadOverrides, restoreHandbookRetirement, fetchCouncilEligibleSnapshot, normalizeCouncilVote, voteCounts, derivedCouncilStatus, loadCouncilProposals, createCouncilProposal, writeCouncilVote, vetoCouncilProposal, reopenCouncilProposal, normalizeTimelineEntry, loadTimelineEntries, writeTimelineEntry
} from "../../../../lib/api-helpers.js";

const handler = async (req, res) => {
    try {
      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const permission = canAccessAdmin(auth.profile);
      if (!permission.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
      }

      if (req.method === "GET") {
        return res.status(200).json({ ok: true, overrides: await loadOverrides() });
      }

      if (req.method === "POST") {
        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const robloxId = requireString(body.robloxId) || await resolveRobloxId(requireString(body.username));
        const effect = requireString(body.effect).toLowerCase();
        const scopeType = requireString(body.scopeType).toLowerCase();
        const scopeKey = requireString(body.scopeKey);
        const reason = requireString(body.reason);

        if (!robloxId || !["grant", "revoke"].includes(effect) || !["page", "division", "library", "capability"].includes(scopeType) || !scopeKey || !reason) {
          return res.status(400).json({ ok: false, reason: "OVERRIDE_FIELDS_REQUIRED" });
        }

        await supabaseRest("access_overrides", {
          method: "POST",
          body: JSON.stringify({
            roblox_id: robloxId,
            effect,
            scope_type: scopeType,
            scope_key: scopeKey,
            reason,
            created_by: String(auth.user.roblox_id),
            created_at: new Date().toISOString(),
            expires_at: body.expiresAt || null,
            active: true
          })
        });

        await supabaseRest("bot_audit_logs", {
          method: "POST",
          body: JSON.stringify({
            action: "admin.override.create",
            roblox_user_id: String(auth.user.roblox_id),
            metadata: { targetRobloxId: robloxId, effect, scopeType, scopeKey }
          })
        }).catch(() => null);

        return res.status(200).json({ ok: true, overrides: await loadOverrides() });
      }

      if (req.method === "DELETE") {
        const id = requireString(getQueryParam(req, "id"));
        if (!id) {
          return res.status(400).json({ ok: false, reason: "OVERRIDE_ID_REQUIRED" });
        }

        const [existing] = await supabaseRest(`access_overrides?id=eq.${encodeURIComponent(id)}&select=*`).catch(() => []);
        await supabaseRest(`access_overrides?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
        await supabaseRest("bot_audit_logs", {
          method: "POST",
          body: JSON.stringify({
            action: "admin.override.remove",
            roblox_user_id: String(auth.user.roblox_id),
            metadata: existing ? { targetRobloxId: existing.roblox_id, effect: existing.effect, scopeType: existing.scope_type, scopeKey: existing.scope_key } : { overrideId: id }
          })
        }).catch(() => null);

        return res.status(200).json({ ok: true, overrides: await loadOverrides() });
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: false, reason: "MIGRATION_REQUIRED" });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
