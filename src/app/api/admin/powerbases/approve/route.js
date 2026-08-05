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

      if (req.method === "POST") {
        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const id = body.id;
        if (!id) return res.status(400).json({ ok: false, reason: "ID_REQUIRED" });

        const [pb] = await supabaseRest(`powerbases?id=eq.${encodeURIComponent(id)}&select=*`);
        if (!pb) return res.status(404).json({ ok: false, reason: "POWERBASE_NOT_FOUND" });

        let newStatus = "ACTIVE";
        if (pb.status === "PENDING_DISSOLVE" || pb.status === "PENDING_DISSOLUTION") {
            newStatus = "DISSOLVED";
        }

        await supabaseRest(`powerbases?id=eq.${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: newStatus })
        });

        // Log approval
        await supabaseRest("bot_audit_logs", {
          method: "POST",
          body: JSON.stringify({
            action: "admin.powerbase.approve",
            roblox_user_id: String(auth.user.roblox_id),
            metadata: { powerbaseId: id, newStatus }
          })
        }).catch(() => null);

        return res.status(200).json({ ok: true });
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
};

export function POST(request) { return executeLegacyHandler(handler, request); }
