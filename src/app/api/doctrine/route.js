import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import { getAuthContext } from "../../../../modules/auth/auth-context.js";
import { supabaseRest } from "../../../../modules/auth/session-store.js";
import { canEditDoctrine } from "../../../../modules/auth/permissions.js";

const handler = async (req, res) => {
  try {
    const { method } = req;

    if (method === "GET") {
      try {
        const dbData = await supabaseRest("holonet_doctrines?select=*&order=created_at.asc");
        return res.status(200).json({ ok: true, data: Array.isArray(dbData) ? dbData : [] });
      } catch (e) {
        console.error("Failed to fetch holonet_doctrines from Supabase:", e);
        return res.status(200).json({ ok: true, data: [] });
      }
    }

    const auth = await getAuthContext(req);
    if (!auth.authenticated) {
      return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
    }

    const canEdit = canEditDoctrine(auth.profile);
    if (!canEdit) {
      return res.status(403).json({ ok: false, authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" });
    }

    if (method === "POST") {
      const { title, section, tag, summary, content, is_published } = req.body;
      if (!title || !content) {
        return res.status(400).json({ ok: false, error: "Title and content are required" });
      }

      const newDirective = {
        id: `dir-${Date.now()}`,
        title: String(title).toUpperCase(),
        section: section || "HOLONET",
        tag: tag || "AUTHENTICATION",
        summary: summary || "",
        content: content || "",
        is_published: is_published !== false,
        created_at: new Date().toISOString(),
        author: auth.profile.robloxUsername || "Sith High Command"
      };

      try {
        const created = await supabaseRest("holonet_doctrines", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(newDirective)
        });
        return res.status(200).json({ ok: true, data: created?.[0] || newDirective });
      } catch (e) {
        console.error("Failed to insert directive into Supabase:", e);
        return res.status(500).json({ ok: false, error: e.message || "Failed to persist to Supabase" });
      }
    }

    if (method === "PUT") {
      const { id, title, section, tag, summary, content, is_published } = req.body;
      if (!id) {
        return res.status(400).json({ ok: false, error: "ID is required" });
      }

      const updatedData = {
        title: String(title).toUpperCase(),
        section: section || "HOLONET",
        tag: tag || "AUTHENTICATION",
        summary: summary || "",
        content: content || "",
        is_published: is_published !== false,
        updated_at: new Date().toISOString()
      };

      try {
        const updated = await supabaseRest(`holonet_doctrines?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(updatedData)
        });
        return res.status(200).json({ ok: true, data: updated?.[0] || { id, ...updatedData } });
      } catch (e) {
        console.error("Failed to update directive in Supabase:", e);
        return res.status(500).json({ ok: false, error: e.message || "Failed to update in Supabase" });
      }
    }

    if (method === "DELETE") {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ ok: false, error: "ID is required" });
      }

      try {
        await supabaseRest(`holonet_doctrines?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
        return res.status(200).json({ ok: true });
      } catch (e) {
        console.error("Failed to delete directive from Supabase:", e);
        return res.status(500).json({ ok: false, error: e.message || "Failed to delete from Supabase" });
      }
    }

    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
