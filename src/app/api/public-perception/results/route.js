import { executeLegacyHandler } from "../../../../../lib/legacy-api-adapter.js";
import { getAuthContext, canAccessAdmin } from "../../../../../lib/api-helpers.js";
import { supabaseRest } from "../../../../../modules/auth/session-store.js";

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

    // Fetch responses from supabase
    const responses = await supabaseRest("public_perception_responses?select=*&order=created_at.desc");

    return res.status(200).json({
      ok: true,
      data: responses || []
    });
  } catch (error) {
    console.error("Failed to fetch public perception results:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};

export function GET(request) { return executeLegacyHandler(handler, request); }
