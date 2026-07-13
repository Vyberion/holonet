import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import {
  requireString, isMissingSchemaError, getAuthContext, canAccessAdmin, loadPendingRetirements, restoreHandbookRetirement
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
        return res.status(200).json({ ok: true, retirements: await loadPendingRetirements() });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const action = requireString(body.action).toLowerCase();
        const id = requireString(body.id);

        if (action !== "restore" || !id) {
          return res.status(400).json({ ok: false, reason: "RETIREMENT_ACTION_REQUIRED" });
        }

        const result = await restoreHandbookRetirement(id, auth);
        return res.status(result.status).json(result.payload);
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
