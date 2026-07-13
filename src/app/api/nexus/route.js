import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  isMissingSchemaError, requestRootOrigin, getAuthContext, canAccessNexus, hasHighCommandAccess, loadNexusOverview
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
