import { executeLegacyHandler } from "../../../../../lib/legacy-api-adapter.js";
import { supabaseRest } from "../../../../../../modules/auth/session-store.js";
import { canAccessAdmin } from "../../../../../../modules/auth/permissions.js";
import { getAuthContext } from "../../../../../../modules/auth/auth-context.js";
import fs from "node:fs";
import path from "node:path";

function getDiscordBotToken() {
  if (process.env.DISCORD_TOKEN) return process.env.DISCORD_TOKEN;
  if (process.env.DISCORD_BOT_TOKEN) return process.env.DISCORD_BOT_TOKEN;

  const candidates = [
    path.join(process.cwd(), "bot", ".env"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), ".env.local")
  ];

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const text = fs.readFileSync(file, "utf8");
        const match = text.match(/^\s*(?:export\s+)?DISCORD_TOKEN\s*=\s*(.*)$/m);
        if (match && match[1]) {
          return match[1].trim().replace(/^['"]|['"]$/g, "");
        }
      }
    } catch (_) {}
  }
  return "";
}

async function syncRosterViaRest(powerbaseId, forceDelete = false, cachedPb = null) {
  try {
    const token = getDiscordBotToken();
    if (!token) {
      console.error("syncRosterViaRest: No DISCORD_TOKEN found in process env or bot/.env");
      return;
    }

    const ROSTER_CHANNEL_ID = "1046537270150299720";
    let pb = cachedPb;

    if (!pb) {
      const [fetched] = await supabaseRest(`powerbases?id=eq.${encodeURIComponent(powerbaseId)}&select=*,powerbase_members(*)`);
      pb = fetched;
    }

    if (!pb) {
      console.error(`syncRosterViaRest: Powerbase ${powerbaseId} not found in DB`);
      return;
    }

    if (forceDelete || pb.status === "DELETED" || pb.status === "DISSOLVED") {
      if (pb.roster_message_id) {
        const delRes = await fetch(`https://discord.com/api/v10/channels/${ROSTER_CHANNEL_ID}/messages/${pb.roster_message_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bot ${token}` }
        }).catch((err) => {
          console.error("syncRosterViaRest: Error deleting message:", err);
          return null;
        });
        if (delRes && delRes.ok) {
          console.log(`syncRosterViaRest: Deleted message ${pb.roster_message_id} for powerbase ${pb.name}`);
        }
      }
      return;
    }

    const memberIds = (pb.powerbase_members || [])
      .map(m => String(m.user_id || m.discord_user_id || ""))
      .filter(Boolean);

    const leaderText = `<@${pb.leader_id}> *(Leader)*`;
    const apprenticeText = memberIds.length > 0
      ? memberIds.map(id => `<@${id}> *(Apprentice)*`).join("\n")
      : "*No apprentices assigned*";

    const romanize = (num) => ["I", "II", "III", "IV"][num - 1] || "I";
    const sdBadge = pb.is_sudden_death ? " ⚠️ **[SUDDEN DEATH]**" : "";

    const slug = String(pb.name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const pbUrl = `https://www.thesithorder.org/powerbases/${slug}`;

    const components = [
      { type: 10, content: `### [${pb.name}](${pbUrl})` },
      { type: 14, divider: true, spacing: 1 },
      { type: 10, content: `**Leader:** <@${pb.leader_id}>\n**Tier:** ${romanize(pb.tier)}${sdBadge}\n**Prestige:** ${pb.prestige}` }
    ];

    if (pb.description) {
      components.push({ type: 14, divider: true, spacing: 1 });
      components.push({ type: 10, content: `**Description:**\n${pb.description}` });
    }

    if (pb.roblox_group_id) {
      components.push({ type: 14, divider: true, spacing: 1 });
      components.push({ type: 10, content: `**Roblox Group ID:** ${pb.roblox_group_id}` });
    }

    components.push({ type: 14, divider: true, spacing: 1 });
    components.push({ type: 10, content: `**Roster (${memberIds.length + 1} Total):**\n${leaderText}\n${apprenticeText}` });

    const payload = {
      flags: 32768,
      components: [{
        type: 17,
        accent_color: 0x8a1b1b,
        components
      }],
      allowed_mentions: { parse: [] }
    };

    if (pb.roster_message_id) {
      const editRes = await fetch(`https://discord.com/api/v10/channels/${ROSTER_CHANNEL_ID}/messages/${pb.roster_message_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (editRes.ok) return;
    }

    const sendRes = await fetch(`https://discord.com/api/v10/channels/${ROSTER_CHANNEL_ID}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (sendRes.ok) {
      const msgData = await sendRes.json();
      if (msgData?.id) {
        await supabaseRest(`powerbases?id=eq.${encodeURIComponent(pb.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ roster_message_id: msgData.id })
        }).catch(() => null);
      }
    } else {
      const errorText = await sendRes.text().catch(() => "");
      console.error(`syncRosterViaRest: Discord API returned status ${sendRes.status}: ${errorText}`);
    }
  } catch (err) {
    console.error("Failed to sync roster via REST:", err);
  }
}

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
            // Delete roster message from Discord BEFORE deleting row from database
            await syncRosterViaRest(id, true, pb);

            // Delete members & powerbase completely from database
            await supabaseRest(`powerbase_members?powerbase_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
            await supabaseRest(`powerbases?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
            newStatus = "DELETED";
        } else {
            await supabaseRest(`powerbases?id=eq.${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "ACTIVE" })
            });
            await syncRosterViaRest(id, false);
        }

        // Log approval
        await supabaseRest("bot_audit_logs", {
          method: "POST",
          body: JSON.stringify({
            action: "admin.powerbase.approve",
            roblox_user_id: auth.user?.roblox_id ? String(auth.user.roblox_id) : null,
            metadata: { powerbaseId: id, newStatus }
          })
        }).catch(() => null);

        return res.status(200).json({ ok: true });
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      console.error("Admin powerbases approve endpoint error:", error);
      return res.status(500).json({ ok: false, reason: "INTERNAL_ERROR" });
    }
};

export function POST(request) {
    return executeLegacyHandler(handler, request);
}
