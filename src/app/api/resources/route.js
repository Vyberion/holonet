import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  VERIFICATION_LOG_COLOR, VERIFICATION_WARNING_COLOR, VERIFICATION_WARNING_ROLE_IDS, DEFAULT_SITE_ORIGIN, OAUTH_STATE_MAX_AGE_SECONDS, COUNCIL_RANKS, COUNCIL_COUNTING_RANKS, COUNCIL_VOTING_RANKS, COUNCIL_VETO_RANKS, cachedDiscordToken, cachedVerificationLogChannelId, getQueryParam, requireString, authAuthorName, readTextFileIfExists, escapeRegExp, candidateRepoRoots, candidateBotFiles, readEnvValue, readEnvValueFromCandidates, discordToken, parseVerificationLogChannelId, verificationLogChannelId, warnVerificationLog, tokenFingerprint, logVerificationConfirm, slugify, toRoman, fromRoman, articleOrderFrom, regulationOrderFrom, regulationAnchor, withIncrementedOrder, insertAtDisplayOrder, resolveEntryDisplayOrders, isMissingSchemaError, councilRank, councilRoleForRank, councilPermissions, canViewInquisitorOverview, hasDarkCouncilPlus, canWriteDivisionWeeklyReport, canWriteBoardBroadcast, boardChannelsFor, clampDurationHours, publicImageUrl, isLocalHostname, normalizeSiteUrl, headerFirstValue, requestRootOrigin, canonicalOAuthOrigin, oauthRedirectUri, normalizeOauthRedirectUri, encodeOAuthStateCookie, decodeOAuthStateCookie, statesMatch, lookupUrlForRequest, encodeInList, detailTableFor, normalizeSubClauses, readJsonBody, canonicalDivisionId, rosterDefinitionForDivision, normalizeReportMember, normalizeWeeklyReport, clockScopeForDivision, shiftTotalSeconds, formatMemberShift, inFilter, reportTotals, reportMemberRows, normalizeIncomingReportMember, inspectionSectionsFor, calculateInspectionOverall, normalizeInspectionSection, normalizeInspection, inspectionSectionRows, personnelLookupWarnings, activityItem, pagedActivity, normalizeCouncilVote, voteCounts, derivedCouncilStatus, normalizeTimelineEntry, getAuthContext, timingSafeEqual, existsSync, readFileSync, path, canAccessAdmin, canAccessNexus, canAccessPersonnelLookup, canAccessRegistry, canEditLibrary, canViewDivisionReports, canWriteDivisionReport, checkPageAccess, checkResourceWriteAccess, hasCoreAccess, hasHighCommandAccess, clearCookie, cleanupExpiredSessions, createRandomToken, createSessionForUser, createSignedStorageUrl, deleteSessionToken, getCookie, getSessionUser, removeStorageObjects, serializeCookie, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, STATE_COOKIE, supabaseRest, ROBLOX_GROUPS, tierAtLeast, ARCHIVE_SEED, LIBRARY_SEED, getHandbookSlot, getHandbookSlots, divisionLockedHref, getDivision, listDivisions, extractGoogleFileId, extractGoogleTabId, googleWorkspaceKindFromUrl
} from "../../../lib/api-helpers.js";

const handler = async (req, res) => {
    try {
      const division = getQueryParam(req, "division");
      const requestedType = getQueryParam(req, "type");
      const resourceType = {
        handbooks: "handbook",
        documents: "handbook",
        transmissions: "transmission",
        activity: "tracker",
        trackers: "tracker",
        reports: "report"
      }[requestedType];
      const detailTable = detailTableFor(resourceType);

      if (!division || !resourceType || !detailTable) {
        return res.status(400).json({ ok: false, reason: "UNKNOWN_RESOURCE_TYPE" });
      }

      await cleanupRetiredHandbooks();

      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason });
      }

      const pageKey = `${division}_${{
        handbooks: "handbooks",
        documents: "handbooks",
        transmissions: "transmissions",
        activity: "activity",
        trackers: "activity",
        reports: "reports"
      }[requestedType]}`;
      const access = checkPageAccess(auth.profile, pageKey);
      if (!access.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: access.reason || "ACCESS_DENIED" });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        if (resourceType === "handbook") {
          return res.status(405).json({ ok: false, reason: "HANDBOOK_UPLOADS_DISABLED" });
        }

        const writeAccess = checkResourceWriteAccess(auth.profile, { division, resourceType });
        if (!writeAccess.authorized) {
          return res.status(200).json({ ok: false, authorized: false, reason: writeAccess.reason });
        }

        const result = await writeResource({
          division,
          resourceType,
          detailTable,
          body: resourceType === "transmission"
            ? { ...(typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})), status: "published", visibility: "restricted" }
            : req.body || {},
          authorName: authAuthorName(auth)
        });

        return res.status(result.status).json(result.payload);
      }

      if (req.method === "DELETE") {
        if (resourceType === "handbook") {
          return res.status(405).json({ ok: false, reason: "HANDBOOK_UPLOADS_DISABLED" });
        }

        const writeAccess = checkResourceWriteAccess(auth.profile, { division, resourceType });
        if (!writeAccess.authorized) {
          return res.status(200).json({ ok: false, authorized: false, reason: writeAccess.reason });
        }

        const result = await deleteResource({
          division,
          resourceType,
          detailTable,
          id: getQueryParam(req, "id")
        });

        return res.status(result.status).json(result.payload);
      }

      if (req.method !== "GET") {
        return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
      }

      const resources = await loadPublishedResources(division, resourceType);
      const rows = resources?.length
        ? await normalizeRows(resources, await loadDetailRows(detailTable, resources.map(resource => resource.id)), resourceType)
        : [];

      if (resourceType === "handbook") {
        const slotCatalog = getHandbookSlots(division);
        const sortedRows = rows.slice().sort((left, right) => {
          const leftSlot = getHandbookSlot(division, left.slotKey || "");
          const rightSlot = getHandbookSlot(division, right.slotKey || "");
          return (leftSlot?.order || left.displayOrder || 0) - (rightSlot?.order || right.displayOrder || 0);
        });

        return res.status(200).json({
          ok: true,
          authorized: true,
          canWrite: false,
          canUpload: false,
          slotCatalog,
          resources: sortedRows
        });
      }

      return res.status(200).json({
        ok: true,
        authorized: true,
        canWrite: checkResourceWriteAccess(auth.profile, { division, resourceType }).authorized,
        resources: rows
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
