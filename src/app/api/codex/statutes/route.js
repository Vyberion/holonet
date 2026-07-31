import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import { getAuthContext } from "../../../../lib/api-helpers.js";
import { supabaseRest } from "../../../../../modules/auth/session-store.js";
import { canEditStatutes } from "../../../../../modules/auth/permissions.js";
const handler = async (req, res) => {
  try {
    const { method } = req;

    if (method === "GET") {
      const auth = await getAuthContext(req);
      let canViewDrafts = false;
      if (auth.authenticated) {
        const profile = auth.profile;
        canViewDrafts = Boolean(
          profile?.isSuperUser || 
          profile?.hasFullAccess || 
          Object.values(profile?.authorityRoles || {}).some(Boolean) ||
          (profile?.divisions?.darkCouncil && profile.divisions.darkCouncil !== "none")
        );
      }

      let query = "codex_statutes?select=*&order=created_at.asc";
      if (!canViewDrafts) {
        query += "&is_published=eq.true";
      }

      const statutes = await supabaseRest(query);
      return res.status(200).json({ ok: true, data: statutes || [] });
    }

    const auth = await getAuthContext(req);
    if (!auth.authenticated) {
      return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
    }

    const permission = canEditStatutes(auth.profile);
    if (!permission.authorized) {
      return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
    }

    if (method === "POST") {
      const { title, summary, sections, is_published } = req.body;
      if (!title) return res.status(400).json({ ok: false, error: "Title is required" });

      const newStatute = await supabaseRest("codex_statutes", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          title,
          summary: summary || "",
          sections: sections || [],
          is_published: !!is_published,
          created_by: auth.profile.robloxUsername,
          updated_by: auth.profile.robloxUsername
        })
      });

      return res.status(200).json({ ok: true, data: newStatute?.[0] });
    }

    if (method === "PUT") {
      const { id, title, summary, sections, is_published } = req.body;
      if (!id) return res.status(400).json({ ok: false, error: "ID is required" });


      const bodyData = {
        title,
        summary: summary || "",
        sections: sections || [],
        updated_at: new Date().toISOString(),
        updated_by: auth.profile.robloxUsername
      };
      
      if (typeof is_published === "boolean") {
        bodyData.is_published = is_published;
      }

      const updatedStatute = await supabaseRest(`codex_statutes?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(bodyData)
      });


      return res.status(200).json({ ok: true, data: updatedStatute?.[0] });
    }

    if (method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ ok: false, error: "ID is required" });

      await supabaseRest(`codex_statutes?id=eq.${id}`, {
        method: "DELETE"
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (error) {
    console.error("Failed to process statutes request:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
