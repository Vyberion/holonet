import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import {
  getQueryParam, requireString, isMissingSchemaError, getAuthContext, canAccessAdmin, loadRecentActivity
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

      const activity = await loadRecentActivity({
        page: Number(getQueryParam(req, "page")) || 1,
        pageSize: Number(getQueryParam(req, "pageSize")) || 20,
        source: requireString(getQueryParam(req, "source"), "all") || "all"
      });

      return res.status(200).json({ ok: true, activity });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: true, activity: { items: [], page: 1, pageSize: 20, totalApprox: 0, hasNext: false, filters: ["all"] } });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
