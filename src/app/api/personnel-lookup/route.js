import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  VERIFICATION_LOG_COLOR, VERIFICATION_WARNING_COLOR, VERIFICATION_WARNING_ROLE_IDS, DEFAULT_SITE_ORIGIN, OAUTH_STATE_MAX_AGE_SECONDS, cachedDiscordToken, cachedVerificationLogChannelId, getQueryParam, requireString, authAuthorName, readTextFileIfExists, escapeRegExp, candidateRepoRoots, candidateBotFiles, readEnvValue, readEnvValueFromCandidates, discordToken, parseVerificationLogChannelId, verificationLogChannelId, warnVerificationLog, tokenFingerprint, logVerificationConfirm, postVerificationLog, postVerificationLogSafely, slugify, toRoman, fromRoman, articleOrderFrom, regulationOrderFrom, regulationAnchor, withIncrementedOrder, shiftDisplayOrders, shiftLibraryDocumentOrders, insertAtDisplayOrder, resolveEntryDisplayOrders, isMissingSchemaError, COUNCIL_RANKS, COUNCIL_COUNTING_RANKS, COUNCIL_VOTING_RANKS, COUNCIL_VETO_RANKS, councilRank, councilRoleForRank, councilPermissions, canViewInquisitorOverview, hasDarkCouncilPlus, canWriteDivisionWeeklyReport, canWriteBoardBroadcast, boardChannelsFor, clampDurationHours, publicImageUrl, isLocalHostname, normalizeSiteUrl, headerFirstValue, requestRootOrigin, canonicalOAuthOrigin, oauthRedirectUri, normalizeOauthRedirectUri, encodeOAuthStateCookie, decodeOAuthStateCookie, statesMatch, lookupUrlForRequest, encodeInList, detailTableFor, normalizeSubClauses, resolveRobloxId, confirmDiscordLink, readJsonBody, cleanupRetiredHandbooks, loadArchiveArticles, seedArchives, ensureArchivesSeeded, writeArchiveArticle, deleteArchiveArticle, loadLibraryDocuments, seedLibrary, ensureLibrarySeeded, writeLibraryDocument, deleteLibraryDocument, loadPublishedResources, loadDetailRows, normalizeRows, loadBoardTransmissions, loadNexusOverview, canonicalDivisionId, rosterDefinitionForDivision, fetchDivisionRoster, normalizeReportMember, normalizeWeeklyReport, loadWeeklyReportMembers, loadWeeklyReports, clockScopeForDivision, shiftTotalSeconds, formatMemberShift, inFilter, loadVerificationLinksForRobloxIds, loadClockShiftTotalsForRoster, buildWeeklyReportRoster, resetClockShiftsForReport, reportTotals, reportMemberRows, normalizeIncomingReportMember, replaceWeeklyReportMembers, writeWeeklyReport, inspectionSectionsFor, calculateInspectionOverall, normalizeInspectionSection, normalizeInspection, loadInspectionSections, loadInspections, inspectionSectionRows, replaceInspectionSections, writeInspection, writeResource, deleteResource, resolveUserByUsername, loadRobloxProfileSummary, personnelLookupWarnings, fetchBadgeCount, loadCounts, loadPendingRetirements, activityItem, pagedActivity, loadRecentActivity, loadAdminHealth, loadOverrides, restoreHandbookRetirement, fetchCouncilEligibleSnapshot, normalizeCouncilVote, voteCounts, derivedCouncilStatus, loadCouncilProposals, createCouncilProposal, writeCouncilVote, vetoCouncilProposal, reopenCouncilProposal, normalizeTimelineEntry, loadTimelineEntries, writeTimelineEntry
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
