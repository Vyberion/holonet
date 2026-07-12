import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  VERIFICATION_LOG_COLOR, VERIFICATION_WARNING_COLOR, VERIFICATION_WARNING_ROLE_IDS, DEFAULT_SITE_ORIGIN, OAUTH_STATE_MAX_AGE_SECONDS, COUNCIL_RANKS, COUNCIL_COUNTING_RANKS, COUNCIL_VOTING_RANKS, COUNCIL_VETO_RANKS, cachedDiscordToken, cachedVerificationLogChannelId, getQueryParam, requireString, authAuthorName, readTextFileIfExists, escapeRegExp, candidateRepoRoots, candidateBotFiles, readEnvValue, readEnvValueFromCandidates, discordToken, parseVerificationLogChannelId, verificationLogChannelId, warnVerificationLog, tokenFingerprint, logVerificationConfirm, slugify, toRoman, fromRoman, articleOrderFrom, regulationOrderFrom, regulationAnchor, withIncrementedOrder, insertAtDisplayOrder, resolveEntryDisplayOrders, isMissingSchemaError, councilRank, councilRoleForRank, councilPermissions, canViewInquisitorOverview, hasDarkCouncilPlus, canWriteDivisionWeeklyReport, canWriteBoardBroadcast, boardChannelsFor, clampDurationHours, publicImageUrl, isLocalHostname, normalizeSiteUrl, headerFirstValue, requestRootOrigin, canonicalOAuthOrigin, oauthRedirectUri, normalizeOauthRedirectUri, encodeOAuthStateCookie, decodeOAuthStateCookie, statesMatch, lookupUrlForRequest, encodeInList, detailTableFor, normalizeSubClauses, readJsonBody, canonicalDivisionId, rosterDefinitionForDivision, normalizeReportMember, normalizeWeeklyReport, clockScopeForDivision, shiftTotalSeconds, formatMemberShift, inFilter, reportTotals, reportMemberRows, normalizeIncomingReportMember, inspectionSectionsFor, calculateInspectionOverall, normalizeInspectionSection, normalizeInspection, inspectionSectionRows, personnelLookupWarnings, activityItem, pagedActivity, normalizeCouncilVote, voteCounts, derivedCouncilStatus, normalizeTimelineEntry, getAuthContext, timingSafeEqual, existsSync, readFileSync, path, canAccessAdmin, canAccessNexus, canAccessPersonnelLookup, canAccessRegistry, canEditLibrary, canViewDivisionReports, canWriteDivisionReport, checkPageAccess, checkResourceWriteAccess, hasCoreAccess, hasHighCommandAccess, clearCookie, cleanupExpiredSessions, createRandomToken, createSessionForUser, createSignedStorageUrl, deleteSessionToken, getCookie, getSessionUser, removeStorageObjects, serializeCookie, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, STATE_COOKIE, supabaseRest, ROBLOX_GROUPS, tierAtLeast, ARCHIVE_SEED, LIBRARY_SEED, getHandbookSlot, getHandbookSlots, divisionLockedHref, getDivision, listDivisions, extractGoogleFileId, extractGoogleTabId, googleWorkspaceKindFromUrl
} from "../../../lib/api-helpers.js";

const handler = async (req, res) => {
    try {
      const auth = await getAuthContext(req, { optional: true });

      if (req.method === "GET") {
        const canWrite = auth.authenticated ? canWriteBoardBroadcast(auth.profile) : false;
        return res.status(200).json({
          ok: true,
          canWrite,
          channels: canWrite ? boardChannelsFor(auth.profile) : [],
          transmissions: await loadBoardTransmissions()
        });
      }

      if (req.method === "POST") {
        if (!auth.authenticated) {
          return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
        }

        if (!canWriteBoardBroadcast(auth.profile)) {
          return res.status(200).json({ ok: false, authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" });
        }

        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const channel = requireString(body.channel || "holonet");
        const allowedChannels = boardChannelsFor(auth.profile);
        if (!allowedChannels.includes(channel)) {
          return res.status(200).json({ ok: false, authorized: false, reason: "CHANNEL_NOT_AUTHORIZED" });
        }

        const result = await writeResource({
          division: channel,
          resourceType: "transmission",
          detailTable: "resource_transmissions",
          body: {
            ...body,
            status: "published",
            visibility: "public"
          },
          authorName: authAuthorName(auth)
        });

        return res.status(result.status).json({ ...result.payload, transmissions: await loadBoardTransmissions() });
      }

      if (req.method !== "GET") {
        return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
      }
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: true, migrationRequired: true, transmissions: [] });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
