import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  VERIFICATION_LOG_COLOR, VERIFICATION_WARNING_COLOR, VERIFICATION_WARNING_ROLE_IDS, DEFAULT_SITE_ORIGIN, OAUTH_STATE_MAX_AGE_SECONDS, COUNCIL_RANKS, COUNCIL_COUNTING_RANKS, COUNCIL_VOTING_RANKS, COUNCIL_VETO_RANKS, cachedDiscordToken, cachedVerificationLogChannelId, getQueryParam, requireString, authAuthorName, readTextFileIfExists, escapeRegExp, candidateRepoRoots, candidateBotFiles, readEnvValue, readEnvValueFromCandidates, discordToken, parseVerificationLogChannelId, verificationLogChannelId, warnVerificationLog, tokenFingerprint, logVerificationConfirm, slugify, toRoman, fromRoman, articleOrderFrom, regulationOrderFrom, regulationAnchor, withIncrementedOrder, insertAtDisplayOrder, resolveEntryDisplayOrders, isMissingSchemaError, councilRank, councilRoleForRank, councilPermissions, canViewInquisitorOverview, hasDarkCouncilPlus, canWriteDivisionWeeklyReport, canWriteBoardBroadcast, boardChannelsFor, clampDurationHours, publicImageUrl, isLocalHostname, normalizeSiteUrl, headerFirstValue, requestRootOrigin, canonicalOAuthOrigin, oauthRedirectUri, normalizeOauthRedirectUri, encodeOAuthStateCookie, decodeOAuthStateCookie, statesMatch, lookupUrlForRequest, encodeInList, detailTableFor, normalizeSubClauses, readJsonBody, canonicalDivisionId, rosterDefinitionForDivision, normalizeReportMember, normalizeWeeklyReport, clockScopeForDivision, shiftTotalSeconds, formatMemberShift, inFilter, reportTotals, reportMemberRows, normalizeIncomingReportMember, inspectionSectionsFor, calculateInspectionOverall, normalizeInspectionSection, normalizeInspection, inspectionSectionRows, personnelLookupWarnings, activityItem, pagedActivity, normalizeCouncilVote, voteCounts, derivedCouncilStatus, normalizeTimelineEntry, getAuthContext, timingSafeEqual, existsSync, readFileSync, path, canAccessAdmin, canAccessNexus, canAccessPersonnelLookup, canAccessRegistry, canEditLibrary, canViewDivisionReports, canWriteDivisionReport, checkPageAccess, checkResourceWriteAccess, hasCoreAccess, hasHighCommandAccess, clearCookie, cleanupExpiredSessions, createRandomToken, createSessionForUser, createSignedStorageUrl, deleteSessionToken, getCookie, getSessionUser, removeStorageObjects, serializeCookie, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, STATE_COOKIE, supabaseRest, ROBLOX_GROUPS, tierAtLeast, ARCHIVE_SEED, LIBRARY_SEED, getHandbookSlot, getHandbookSlots, divisionLockedHref, getDivision, listDivisions, extractGoogleFileId, extractGoogleTabId, googleWorkspaceKindFromUrl
} from "../../../lib/api-helpers.js";

const handler = async (req, res) => {
    try {
      const username = requireString(req.method === "POST" ? req.body?.username : getQueryParam(req, "username"));
      if (!username) {
        return res.status(400).json({ ok: false, reason: "USERNAME_REQUIRED" });
      }

      const resolved = await resolveUserByUsername(username);
      if (!resolved?.id) {
        return res.status(200).json({ ok: false, reason: "USER_NOT_FOUND" });
      }

      const { user, groups, accountAgeDays, friendsCount, badgeCount } = await loadRobloxProfileSummary(resolved.id);
      const mainGroupMembership = (groups.data || []).find(
        membership => membership?.group?.id === ROBLOX_GROUPS.HIGH_RANKS.groupId
      );
      const divisionMemberships = Object.entries(ROBLOX_GROUPS.DIVISIONS)
        .map(([divisionKey, definition]) => {
          const membership = (groups.data || []).find(item => item?.group?.id === definition.groupId);
          if (!membership) return null;
          return {
            divisionKey,
            label: divisionKey === "dhg" ? "Dark Honor Guard" : divisionKey === "inquisitors" ? "Inquisitors" : divisionKey.charAt(0).toUpperCase() + divisionKey.slice(1),
            rankName: membership.role?.name || "Unknown",
            rank: membership.role?.rank || 0,
            joinedAt: membership.joinedAt || membership.joined_at || null
          };
        })
        .filter(Boolean);
      const warnings = personnelLookupWarnings({ accountAgeDays, friendsCount, badgeCount });

      return res.status(200).json({
        ok: true,
        authorized: true,
        user: {
          robloxId: String(resolved.id),
          username: resolved.name || username,
          displayName: resolved.displayName || user.displayName || resolved.name || username,
          created: user.created || null,
          accountAgeDays,
          friendsCount,
          badgeCount,
          profileUrl: `https://www.roblox.com/users/${resolved.id}/profile`,
          mainGroup: mainGroupMembership ? {
            inGroup: true,
            rankName: mainGroupMembership.role?.name || "Unknown",
            rank: mainGroupMembership.role?.rank || 0,
            joinedAt: mainGroupMembership.joinedAt || mainGroupMembership.joined_at || null
          } : {
            inGroup: false,
            rankName: "",
            rank: 0,
            joinedAt: null
          },
          divisionMemberships,
          warnings
        }
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
