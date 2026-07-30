import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import { getAuthContext } from "../../../../lib/api-helpers.js";
import { supabaseRest } from "../../../../../modules/auth/session-store.js";
import { canEditStatutes } from "../../../../../modules/auth/permissions.js";
import { componentsV2Message, containerV2, textDisplayV2, separatorV2 } from "../../../../lib/discord-ui.js";

function getRomanNumeral(num) {
  const lookup = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  let roman = "";
  for (let i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman;
}

function getLetter(num) {
  return String.fromCharCode(96 + num); // 1 = a, 2 = b, 3 = c
}

async function publishToDiscord(statute) {
  const token = process.env.DISCORD_TOKEN;
  const channelId = process.env.DISCORD_STATUTES_CHANNEL_ID;
  if (!token || !channelId) {
    console.warn("DISCORD_TOKEN or DISCORD_STATUTES_CHANNEL_ID missing, cannot publish to Discord");
    return;
  }

  let components = [];
  components.push(textDisplayV2(`# ${statute.title}`));

  (statute.sections || []).forEach((section, sIndex) => {
    components.push(separatorV2());
    let sectionText = `### SECTION ${getRomanNumeral(sIndex + 1)}: ${section.text}\n`;
    
    (section.clauses || []).forEach((clause, cIndex) => {
      sectionText += `**(${getLetter(cIndex + 1)})** ${clause.text}\n`;
      (clause.subClauses || []).forEach((sc, scIndex) => {
        sectionText += `\u00A0\u00A0\u00A0\u00A0**${scIndex + 1}.** ${sc.text}\n`;
        (sc.subSubClauses || []).forEach((ssc, sscIndex) => {
           sectionText += `\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0**${getRomanNumeral(sscIndex + 1).toLowerCase()}.** ${ssc.text}\n`;
        });
      });
    });
    
    // Chunk by ~2000 chars safely avoiding cutting mid-word if possible, or just raw chunk
    const chunks = sectionText.match(/[\s\S]{1,2000}/g) || [];
    for (const chunk of chunks) {
      components.push(textDisplayV2(chunk));
    }
  });

  const payload = componentsV2Message([
    containerV2(components, 16711680)
  ]);

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to publish to Discord:", response.status, errorText);
  }
}

const handler = async (req, res) => {
  try {
    const { method } = req;

    if (method === "GET") {
      const statutes = await supabaseRest("codex_statutes?select=*&order=created_at.asc");
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
      const { title, sections, is_published } = req.body;
      if (!title) return res.status(400).json({ ok: false, error: "Title is required" });

      const newStatute = await supabaseRest("codex_statutes", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          title,
          sections: sections || [],
          is_published: !!is_published,
          created_by: auth.profile.robloxUsername,
          updated_by: auth.profile.robloxUsername
        })
      });

      if (is_published && newStatute?.[0]) {
        await publishToDiscord(newStatute[0]).catch(e => console.error("Discord publish error", e));
      }

      return res.status(200).json({ ok: true, data: newStatute?.[0] });
    }

    if (method === "PUT") {
      const { id, title, sections, is_published } = req.body;
      if (!id) return res.status(400).json({ ok: false, error: "ID is required" });

      // If we are publishing, we want to know if it wasn't already published
      let shouldPublish = false;
      if (is_published) {
        const existing = await supabaseRest(`codex_statutes?id=eq.${id}&select=is_published`);
        if (existing && existing[0] && !existing[0].is_published) {
          shouldPublish = true;
        }
      }

      const bodyData = {
        title,
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

      if (shouldPublish && updatedStatute?.[0]) {
        await publishToDiscord(updatedStatute[0]).catch(e => console.error("Discord publish error", e));
      }

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
