import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  getQueryParam, canonicalDivisionId, rosterDefinitionForDivision, getAuthContext, checkPageAccess, getDivision, buildWeeklyReportRoster
} from "../../../lib/api-helpers.js";




const handler = async (req, res) => {
    try {
      if (req.method !== "GET") {
        return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
      }

      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const division = canonicalDivisionId(getQueryParam(req, "division"));
      const divisionConfig = getDivision(division);
      if (!divisionConfig || !rosterDefinitionForDivision(division)) {
        return res.status(400).json({ ok: false, reason: "UNKNOWN_DIVISION" });
      }

      const accessKey = divisionConfig.access?.activity || divisionConfig.access?.trackers || `${division}_activity`;
      const access = checkPageAccess(auth.profile, accessKey);
      if (!access.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: access.reason || "ACCESS_DENIED" });
      }

      const members = (await buildWeeklyReportRoster(division))
        .sort((left, right) => (
          Number(right.rank || 0) - Number(left.rank || 0)
          || String(left.username || left.displayName || "").localeCompare(String(right.username || right.displayName || ""))
        ));

      return res.status(200).json({
        ok: true,
        authorized: true,
        members
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
