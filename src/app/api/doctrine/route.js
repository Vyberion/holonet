import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import { getAuthContext } from "../../../../modules/auth/auth-context.js";
import { supabaseRest } from "../../../../modules/auth/session-store.js";
import { canEditDoctrine } from "../../../../modules/auth/permissions.js";

const DEFAULT_DIRECTIVES = [
  {
    id: "dir-1",
    title: "COMMUNICATIONS SERVER BINDING & VERIFICATION",
    section: "SECTION I: IDENTITY & AUTHENTICATION",
    tag: "AUTHENTICATION",
    summary: "Mandatory bio-metric link between Imperial personnel records and the official Communications Server.",
    content: "### IDENTITY AUTHENTICATION DIRECTIVE\n\nAll Sith initiates, apprentices, and officers must establish an authorized link between their Imperial Holonet profile and their identity on the primary Communications Server.\n\n#### EXECUTION STEPS:\n1. Access the <#1046452180074381403> frequency within the Communications Server.\n2. Initiate the `/verify` command or activate the bio-metric verification terminal.\n3. Complete identity synchronization to receive role clearance across all Imperial channels.",
    is_published: true,
    created_at: new Date().toISOString()
  },
  {
    id: "dir-2",
    title: "INITIATE ADVANCEMENT & ASCENSION CRITERIA",
    section: "SECTION II: ASCENSION & TRIAL PROTOCOLS",
    tag: "ACADEMY",
    summary: "Requirements for Grotthu and Hopefuls seeking elevation to Neophyte and Academy Acolyte.",
    content: "### SITH ACADEMY ASCENSION PROTOCOL\n\nProgression through the Sith Academy is governed by strict merit and martial competence.\n\n#### QUALIFICATION STANDARDS:\n- **Grotthu -> Hopeful**: Demonstration of total obedience and baseline physical conditioning.\n- **Hopeful -> Tyro**: Attendance at official Academy drills and completion of fundamental trials.\n- **Acolyte Elevation**: Endorsement by an Overseer or Dark Council member following duel evaluation.",
    is_published: true,
    created_at: new Date().toISOString()
  },
  {
    id: "dir-3",
    title: "COMBAT DECREES & DUELING ETIQUETTE",
    section: "SECTION III: DOMINION & COMBAT DECREES",
    tag: "PROCEDURE",
    summary: "Martial conduct, saber engagement rules, and formal duel challenge protocols.",
    content: "### IMPERIAL COMBAT ETIQUETTE\n\nCombat within Imperial territory is bound by Sith honor and ancient duel regulations.\n\n#### DECREES:\n1. **Salute & Activation**: Blades are ignited only after mutual acknowledgment.\n2. **Non-Interference**: External interference in a sanctioned duel warrants immediate disciplinary action.\n3. **Yielding**: A fallen combatant yielding in accordance with tradition must be spared unless an execution match is formally declared.",
    is_published: true,
    created_at: new Date().toISOString()
  },
  {
    id: "dir-4",
    title: "DUTY ROSTER SHIFT LOGGING",
    section: "SECTION IV: HOLONET INFRASTRUCTURE",
    tag: "DUTY",
    summary: "Standard procedures for clocking in/out during active Sith patrol duties.",
    content: "### PATROL & SHIFT LOGGING PROTOCOL\n\nActive duty hours are recorded via the Holonet shift tracking system.\n\n#### INSTRUCTIONS:\n- Utilize designated scope clock panels located within designated Communications Server channels.\n- Select **Clock In** prior to initiating patrol or guard duties.\n- Select **Clock Out** immediately upon conclusion of duty. Unlogged shifts will not be counted toward weekly quotas.",
    is_published: true,
    created_at: new Date().toISOString()
  },
  {
    id: "dir-5",
    title: "POWERBASE PRESTIGE & KAGGATH RULEBOOK",
    section: "SECTION IV: HOLONET INFRASTRUCTURE",
    tag: "POWERBASE",
    summary: "Governance of Sith Lords' Spheres of Influence, roster caps, and ancient Kaggath challenges.",
    content: "### POWERBASE GOVERNANCE DECREE\n\nSith Lords seeking to establish a Sphere of Influence must adhere to Holonet Powerbase regulations.\n\n#### REGULATIONS:\n- **Roster Bounds**: Apprentice quotas are strictly determined by Powerbase Tier.\n- **Kaggaths**: Formal challenges between Powerbases must be logged via `/event log type:Kaggath` by an Overseer or Dark Council Lord.",
    is_published: true,
    created_at: new Date().toISOString()
  }
];

let inMemoryDirectives = [...DEFAULT_DIRECTIVES];

const handler = async (req, res) => {
  try {
    const { method } = req;

    if (method === "GET") {
      try {
        const dbData = await supabaseRest("holonet_doctrines?select=*&order=created_at.asc");
        if (dbData && dbData.length > 0) {
          return res.status(200).json({ ok: true, data: dbData });
        }
      } catch (e) {
        // Fallback to in-memory store
      }
      return res.status(200).json({ ok: true, data: inMemoryDirectives });
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
      if (!title || !content) return res.status(400).json({ ok: false, error: "Title and content are required" });

      const newDirective = {
        id: `dir-${Date.now()}`,
        title: String(title).toUpperCase(),
        section: section || "SECTION I: IDENTITY & AUTHENTICATION",
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
        if (created?.[0]) {
          return res.status(200).json({ ok: true, data: created[0] });
        }
      } catch (e) {
        // Fallback
      }

      inMemoryDirectives.push(newDirective);
      return res.status(200).json({ ok: true, data: newDirective });
    }

    if (method === "PUT") {
      const { id, title, section, tag, summary, content, is_published } = req.body;
      if (!id) return res.status(400).json({ ok: false, error: "ID is required" });

      const updatedData = {
        title: String(title).toUpperCase(),
        section: section || "SECTION I: IDENTITY & AUTHENTICATION",
        tag: tag || "AUTHENTICATION",
        summary: summary || "",
        content: content || "",
        is_published: is_published !== false,
        updated_at: new Date().toISOString()
      };

      try {
        const updated = await supabaseRest(`holonet_doctrines?id=eq.${id}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(updatedData)
        });
        if (updated?.[0]) {
          return res.status(200).json({ ok: true, data: updated[0] });
        }
      } catch (e) {
        // Fallback
      }

      const idx = inMemoryDirectives.findIndex(d => d.id === id);
      if (idx !== -1) {
        inMemoryDirectives[idx] = { ...inMemoryDirectives[idx], ...updatedData };
      }
      return res.status(200).json({ ok: true, data: inMemoryDirectives[idx] || updatedData });
    }

    if (method === "DELETE") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ ok: false, error: "ID is required" });

      try {
        await supabaseRest(`holonet_doctrines?id=eq.${id}`, { method: "DELETE" });
      } catch (e) {
        // Fallback
      }

      inMemoryDirectives = inMemoryDirectives.filter(d => d.id !== id);
      return res.status(200).json({ ok: true });
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
