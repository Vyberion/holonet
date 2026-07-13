import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  getQueryParam, requireString, isMissingSchemaError, getAuthContext, hasHighCommandAccess, loadInspections, writeInspection
} from "../../../lib/api-helpers.js";




const handler = async (req, res) => {
    try {
      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const division = requireString(getQueryParam(req, "division")).toLowerCase();
      if (req.method === "GET") {
        return res.status(200).json({
          ok: true,
          authorized: true,
          canWrite: hasHighCommandAccess(auth.profile),
          inspections: await loadInspections(division)
        });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const result = await writeInspection(auth, body);
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
