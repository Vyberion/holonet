import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  VERIFICATION_LOG_COLOR, VERIFICATION_WARNING_COLOR, VERIFICATION_WARNING_ROLE_IDS, DEFAULT_SITE_ORIGIN, OAUTH_STATE_MAX_AGE_SECONDS, COUNCIL_RANKS, COUNCIL_COUNTING_RANKS, COUNCIL_VOTING_RANKS, COUNCIL_VETO_RANKS, cachedDiscordToken, cachedVerificationLogChannelId, getQueryParam, requireString, authAuthorName, readTextFileIfExists, escapeRegExp, candidateRepoRoots, candidateBotFiles, readEnvValue, readEnvValueFromCandidates, discordToken, parseVerificationLogChannelId, verificationLogChannelId, warnVerificationLog, tokenFingerprint, logVerificationConfirm, slugify, toRoman, fromRoman, articleOrderFrom, regulationOrderFrom, regulationAnchor, withIncrementedOrder, insertAtDisplayOrder, resolveEntryDisplayOrders, isMissingSchemaError, councilRank, councilRoleForRank, councilPermissions, canViewInquisitorOverview, hasDarkCouncilPlus, canWriteDivisionWeeklyReport, canWriteBoardBroadcast, boardChannelsFor, clampDurationHours, publicImageUrl, isLocalHostname, normalizeSiteUrl, headerFirstValue, requestRootOrigin, canonicalOAuthOrigin, oauthRedirectUri, normalizeOauthRedirectUri, encodeOAuthStateCookie, decodeOAuthStateCookie, statesMatch, lookupUrlForRequest, encodeInList, detailTableFor, normalizeSubClauses, readJsonBody, canonicalDivisionId, rosterDefinitionForDivision, normalizeReportMember, normalizeWeeklyReport, clockScopeForDivision, shiftTotalSeconds, formatMemberShift, inFilter, reportTotals, reportMemberRows, normalizeIncomingReportMember, inspectionSectionsFor, calculateInspectionOverall, normalizeInspectionSection, normalizeInspection, inspectionSectionRows, personnelLookupWarnings, activityItem, pagedActivity, normalizeCouncilVote, voteCounts, derivedCouncilStatus, normalizeTimelineEntry, getAuthContext, timingSafeEqual, existsSync, readFileSync, path, canAccessAdmin, canAccessNexus, canAccessPersonnelLookup, canAccessRegistry, canEditLibrary, canViewDivisionReports, canWriteDivisionReport, checkPageAccess, checkResourceWriteAccess, hasCoreAccess, hasHighCommandAccess, clearCookie, cleanupExpiredSessions, createRandomToken, createSessionForUser, createSignedStorageUrl, deleteSessionToken, getCookie, getSessionUser, removeStorageObjects, serializeCookie, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, STATE_COOKIE, supabaseRest, ROBLOX_GROUPS, tierAtLeast, ARCHIVE_SEED, LIBRARY_SEED, getHandbookSlot, getHandbookSlots, divisionLockedHref, getDivision, listDivisions, extractGoogleFileId, extractGoogleTabId, googleWorkspaceKindFromUrl
} from "../../../lib/api-helpers.js";

const handler = async (req, res) => {
    try {
      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const permission = canAccessNexus(auth.profile);
      if (!permission.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
      }

      if (req.method !== "GET") {
        return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
      }

      return res.status(200).json({
        ok: true,
        authorized: true,
        canInspect: hasHighCommandAccess(auth.profile),
        divisions: await loadNexusOverview(auth.profile, requestRootOrigin(req))
      });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: true, authorized: true, migrationRequired: true, divisions: [] });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
