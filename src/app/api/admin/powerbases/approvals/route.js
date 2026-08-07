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
        const approvals = await supabaseRest("powerbases?status=in.(PENDING_CREATE,PENDING_DISSOLVE,PENDING_APPROVAL,PENDING_DISSOLUTION)&select=*").catch(() => []);

        const links = await supabaseRest("verification_links?select=discord_user_id,roblox_username,roblox_user_id").catch(() => []);
        const linkMapByDiscord = new Map(links.map(l => [String(l.discord_user_id), l]));
        const linkMapByRoblox = new Map(links.map(l => [String(l.roblox_user_id), l]));

        const enriched = approvals.map(item => {
          const leaderIdStr = String(item.leader_id || "");
          const link = linkMapByDiscord.get(leaderIdStr) || linkMapByRoblox.get(leaderIdStr);
          const leaderUsername = link?.roblox_username || item.leader_name || item.leader_id || "Unknown";
          return {
            ...item,
            leader_username: leaderUsername
          };
        });

        return res.status(200).json({ ok: true, approvals: enriched });
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      console.log("SupabaseRest Error:", error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }
};

export function GET(request) { return executeLegacyHandler(handler, request); }
