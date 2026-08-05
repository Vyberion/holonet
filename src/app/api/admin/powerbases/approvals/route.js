import { executeLegacyHandler } from "../../../../../lib/legacy-api-adapter.js";
import { supabaseRest } from "../../../../../../modules/auth/session-store.js";
import { canAccessAdmin } from "../../../../../../modules/auth/permissions.js";
import { getAuthContext } from "../../../../../../modules/auth/auth-context.js";

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
        const approvals = await supabaseRest("powerbases?or=(status.eq.PENDING_CREATE,status.eq.PENDING_DISSOLVE)&select=*");
        return res.status(200).json({ ok: true, approvals });
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
};

export function GET(request) { return executeLegacyHandler(handler, request); }
