import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  getQueryParam, requireString, isMissingSchemaError, getAuthContext, canAccessAdmin, supabaseRest, loadTimelineEntries, writeTimelineEntry
} from "../../../lib/api-helpers.js";




const handler = async (req, res) => {
    try {
      const auth = await getAuthContext(req, { optional: true });
      const canEdit = auth.authenticated ? canAccessAdmin(auth.profile).authorized : false;

      if (req.method === "GET") {
        return res.status(200).json({
          ok: true,
          canEdit,
          entries: await loadTimelineEntries(canEdit)
        });
      }

      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const result = await writeTimelineEntry(auth, body);
        return res.status(result.status).json(result.payload);
      }

      if (req.method === "DELETE") {
        const permission = canAccessAdmin(auth.profile);
        if (!permission.authorized) {
          return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
        }

        const id = requireString(getQueryParam(req, "id"));
        if (!id) {
          return res.status(400).json({ ok: false, reason: "TIMELINE_ID_REQUIRED" });
        }

        await supabaseRest(`group_timeline_entries?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
        return res.status(200).json({ ok: true, entries: await loadTimelineEntries(true) });
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: true, migrationRequired: true, canEdit: false, entries: [] });
      }

      return res.status(500).json({ ok: false, error: error.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
