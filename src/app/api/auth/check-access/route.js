import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import {
  VERIFICATION_LOG_COLOR, VERIFICATION_WARNING_COLOR, VERIFICATION_WARNING_ROLE_IDS, DEFAULT_SITE_ORIGIN, OAUTH_STATE_MAX_AGE_SECONDS, cachedDiscordToken, cachedVerificationLogChannelId, getQueryParam, requireString, authAuthorName, readTextFileIfExists, escapeRegExp, candidateRepoRoots, candidateBotFiles, readEnvValue, readEnvValueFromCandidates, discordToken, parseVerificationLogChannelId, verificationLogChannelId, warnVerificationLog, tokenFingerprint, logVerificationConfirm, postVerificationLog, postVerificationLogSafely, slugify, toRoman, fromRoman, articleOrderFrom, regulationOrderFrom, regulationAnchor, withIncrementedOrder, shiftDisplayOrders, shiftLibraryDocumentOrders, insertAtDisplayOrder, resolveEntryDisplayOrders, isMissingSchemaError, COUNCIL_RANKS, COUNCIL_COUNTING_RANKS, COUNCIL_VOTING_RANKS, COUNCIL_VETO_RANKS, councilRank, councilRoleForRank, councilPermissions, canViewInquisitorOverview, hasDarkCouncilPlus, canWriteDivisionWeeklyReport, canWriteBoardBroadcast, boardChannelsFor, clampDurationHours, publicImageUrl, isLocalHostname, normalizeSiteUrl, headerFirstValue, requestRootOrigin, canonicalOAuthOrigin, oauthRedirectUri, normalizeOauthRedirectUri, encodeOAuthStateCookie, decodeOAuthStateCookie, statesMatch, lookupUrlForRequest, encodeInList, detailTableFor, normalizeSubClauses, resolveRobloxId, confirmDiscordLink, readJsonBody, cleanupRetiredHandbooks, loadArchiveArticles, seedArchives, ensureArchivesSeeded, writeArchiveArticle, deleteArchiveArticle, loadLibraryDocuments, seedLibrary, ensureLibrarySeeded, writeLibraryDocument, deleteLibraryDocument, loadPublishedResources, loadDetailRows, normalizeRows, loadBoardTransmissions, loadNexusOverview, canonicalDivisionId, rosterDefinitionForDivision, fetchDivisionRoster, normalizeReportMember, normalizeWeeklyReport, loadWeeklyReportMembers, loadWeeklyReports, clockScopeForDivision, shiftTotalSeconds, formatMemberShift, inFilter, loadVerificationLinksForRobloxIds, loadClockShiftTotalsForRoster, buildWeeklyReportRoster, resetClockShiftsForReport, reportTotals, reportMemberRows, normalizeIncomingReportMember, replaceWeeklyReportMembers, writeWeeklyReport, inspectionSectionsFor, calculateInspectionOverall, normalizeInspectionSection, normalizeInspection, loadInspectionSections, loadInspections, inspectionSectionRows, replaceInspectionSections, writeInspection, writeResource, deleteResource, resolveUserByUsername, loadRobloxProfileSummary, personnelLookupWarnings, fetchBadgeCount, loadCounts, loadPendingRetirements, activityItem, pagedActivity, loadRecentActivity, loadAdminHealth, loadOverrides, restoreHandbookRetirement, fetchCouncilEligibleSnapshot, normalizeCouncilVote, voteCounts, derivedCouncilStatus, loadCouncilProposals, createCouncilProposal, writeCouncilVote, vetoCouncilProposal, reopenCouncilProposal, normalizeTimelineEntry, loadTimelineEntries, writeTimelineEntry
} from "../../../../lib/api-helpers.js";

const handler = async (req, res) => {
    const page = getQueryParam(req, "page");
    let pageIsUnknown = false;

    try {
      if (page) {
        const unknownCheck = checkPageAccess({
          isSuperUser: false,
          hasFullAccess: false,
          divisions: {},
          highRank: "none"
        }, page);

        pageIsUnknown = unknownCheck.reason === "UNKNOWN_RESOURCE";

        if (unknownCheck.authorized) {
          return res.status(200).json(unknownCheck);
        }
      }

      const auth = await getAuthContext(req, { optional: true });
      if (!auth.authenticated) {
        if (pageIsUnknown) {
          return res.status(200).json({
            authorized: false,
            reason: "UNKNOWN_RESOURCE"
          });
        }

        return res.status(200).json({
          authorized: false,
          reason: auth.reason || "SESSION_REQUIRED"
        });
      }
      const profile = auth.profile;

      if (page) {
        const access = checkPageAccess(profile, page);
        return res.status(200).json({
          ...access,
          profile,
          permissions: {
            canAccessAdmin: canAccessAdmin(profile).authorized,
            canAccessPersonnelLookup: canAccessPersonnelLookup(profile).authorized,
            canAccessNexus: canAccessNexus(profile).authorized,
            canAccessRegistry: canAccessRegistry(profile).authorized
          }
        });
      }

      return res.status(200).json({
        authorized: true,
        profile,
        permissions: {
          canAccessAdmin: canAccessAdmin(profile).authorized,
          canAccessPersonnelLookup: canAccessPersonnelLookup(profile).authorized,
          canAccessNexus: canAccessNexus(profile).authorized,
          canAccessRegistry: canAccessRegistry(profile).authorized
        }
      });
    } catch (err) {
      return res.status(500).json({ authorized: false, error: err.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
