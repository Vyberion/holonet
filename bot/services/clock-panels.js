import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { embed } from "./discord-ui.js";
import { supabase } from "./supabase.js";

const PANEL_DESCRIPTION = "Use the buttons below to clock in, clock in late, clock out, clock out late, check your current shift or view the leaderboard.";

function scopeLabel(scope) {
  return {
    reavers: "Reavers",
    dhg: "DHG",
    inquisitors: "Inquisitors",
    dreadmasters: "Dread Masters",
    highranks: "High Ranks",
    darkCouncil: "Dark Council",
    all: "All"
  }[scope] || scope;
}

function panelRows(scope) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`clock:in:${scope}:0`).setLabel("Clock In").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`clock:in:${scope}:1`).setLabel("Clock In Late").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`clock:out:${scope}:0`).setLabel("Clock Out").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`clock:out:${scope}:1`).setLabel("Clock Out Late").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`clock:shift:${scope}:0`).setLabel("My Shift").setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`clock:leaderboard:${scope}:0`).setLabel("Leaderboard").setStyle(ButtonStyle.Primary)
    )
  ];
}

function clockPanelPayload(scope) {
  return {
    embeds: [embed(`${scopeLabel(scope)} Clock Panel`, PANEL_DESCRIPTION)],
    components: panelRows(scope)
  };
}

async function loadClockPanels() {
  const { data, error } = await supabase
    .from("clock_panels")
    .select("scope,channel_id,message_id")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function syncClockPanels(client) {
  const panels = await loadClockPanels();
  let updated = 0;
  let failed = 0;

  for (const panel of panels) {
    const scope = String(panel.scope || "").trim();
    const channelId = String(panel.channel_id || "").trim();
    const messageId = String(panel.message_id || "").trim();

    if (!scope || !channelId || !messageId) {
      failed += 1;
      continue;
    }

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased?.() || !channel.messages?.fetch) throw new Error("CLOCK_PANEL_CHANNEL_UNAVAILABLE");
      const message = await channel.messages.fetch(messageId);
      await message.edit(clockPanelPayload(scope));
      updated += 1;
    } catch (error) {
      failed += 1;
      console.warn("Clock panel sync failed", { scope, channelId, messageId, reason: error?.message || String(error) });
    }
  }

  return { checked: panels.length, updated, failed };
}
