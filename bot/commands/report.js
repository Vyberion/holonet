import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { config } from "../config/index.js";
import { checkResourceWriteAccess } from "../../modules/auth/permissions.js";
import { ROBLOX_GROUPS } from "../../modules/data/roblox-config.js";
import { postActivityLog } from "../services/activity-log.js";
import { botErrorMessage } from "../services/bot-errors.js";
import { componentsV2Message, containerV2, embed, ephemeral, errorEmbed, successEmbed, textDisplayV2 } from "../services/discord-ui.js";
import { divisionTierWeight, getVerifiedProfile, canManageBot } from "../services/roles.js";
import { supabase } from "../services/supabase.js";

const VERIFY_INSTRUCTIONS = "You are not linked yet. Go to <#1046452180074381403> and click the verify button, or use `/verify`.";
const REPORT_PREVIEW_LIMIT = 12;

const REPORT_SCOPE_CHOICES = [
  { name: "Reavers", value: "reavers" },
  { name: "DHG", value: "dhg" },
  { name: "Inquisitors", value: "inquisitors" },
  { name: "Dread Masters", value: "dreadmasters" },
  { name: "High Ranks", value: "highranks" },
  { name: "Dark Council", value: "darkCouncil" }
];

export const commands = [
  new SlashCommandBuilder()
    .setName("report")
    .setDescription("Report management tools")
    .addSubcommand(subcommand => subcommand
      .setName("write")
      .setDescription("Write this scope's weekly website report and reset its clock time")
      .addStringOption(option => addReportScopeChoices(option.setName("scope").setDescription("Report scope").setRequired(true)))
      .addStringOption(option => option.setName("start_date").setDescription("Week start date, YYYY-MM-DD").setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName("view")
      .setDescription("View a saved report or preview current entries")
      .addStringOption(option => addReportScopeChoices(option.setName("scope").setDescription("Report scope").setRequired(true)))
      .addStringOption(option => option.setName("start_date").setDescription("Week start date, YYYY-MM-DD").setRequired(true))
      .addBooleanOption(option => option.setName("prefill-entries").setDescription("Preview current roster and clock entries instead of a saved report")))
];

function addReportScopeChoices(option) {
  return option.addChoices(...REPORT_SCOPE_CHOICES);
}

function scopeLabel(scope) {
  return {
    reavers: "Reavers",
    dhg: "DHG",
    inquisitors: "Inquisitors",
    dreadmasters: "Dread Masters",
    highranks: "High Ranks",
    darkCouncil: "Dark Council"
  }[scope] || scope;
}

function assertReportScope(scope) {
  if (!ROBLOX_GROUPS.DIVISIONS[scope]) throw new Error("UNKNOWN_REPORT_SCOPE");
}

function reportErrorMessage(error, interaction = null) {
  if (error?.message === "DISCORD_NOT_LINKED") return VERIFY_INSTRUCTIONS;
  return botErrorMessage(error, { interaction, fallback: "Unexpected report error." }).replace(/_/g, " ");
}

async function replyReportError(interaction, error) {
  await interaction.reply(ephemeral({ embeds: [errorEmbed(reportErrorMessage(error, interaction))] }));
}

function weekStartValue(date = new Date()) {
  const working = new Date(date);
  const day = working.getDay() || 7;
  working.setDate(working.getDate() - day + 1);
  return working.toISOString().slice(0, 10);
}

function shiftTotalSeconds(row, now = Date.now()) {
  const baseSeconds = row.status === "active"
    ? Math.max(0, Math.floor((now - new Date(row.started_at).getTime()) / 1000))
    : Number(row.duration_seconds || 0);

  return Math.max(0, baseSeconds + Number(row.adjustment_seconds || 0));
}

function formatMemberShift(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60)
  };
}

function normalizeMemberMinutes(member = {}) {
  return Math.max(0, Math.floor(Number(member.hours) || 0) * 60 + Math.floor(Number(member.minutes) || 0));
}

function formatHoursMinutesFromMinutes(totalMinutes = 0) {
  const safeMinutes = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  return `${Math.floor(safeMinutes / 60)}h ${safeMinutes % 60}m`;
}

function memberName(member = {}) {
  if (member.displayName && member.username && member.displayName !== member.username) return `${member.displayName} (@${member.username})`;
  return member.username || member.displayName || member.robloxId || "Unknown";
}

function reportTotals(members = []) {
  return members.reduce((totals, member) => {
    totals.minutes += normalizeMemberMinutes(member);
    totals.eventsHosted += Number(member.eventsHosted || 0);
    totals.eventsAttended += Number(member.eventsAttended || 0);
    return totals;
  }, { minutes: 0, eventsHosted: 0, eventsAttended: 0 });
}

function sortedMembers(members = []) {
  return members.slice().sort((left, right) => (
    Number(right.rank || 0) - Number(left.rank || 0)
    || memberName(left).localeCompare(memberName(right))
  ));
}

function reportPreviewEmbed({ title, scope, weekStart, authorName = "", members = [], prefilled = false }) {
  const totals = reportTotals(members);
  const rows = sortedMembers(members);
  const visibleRows = rows.slice(0, REPORT_PREVIEW_LIMIT).map(member => {
    const events = [];
    if (Number(member.eventsHosted || 0)) events.push(`${Number(member.eventsHosted || 0)} hosted`);
    if (Number(member.eventsAttended || 0)) events.push(`${Number(member.eventsAttended || 0)} attended`);
    return `• **${memberName(member)}** — ${formatHoursMinutesFromMinutes(normalizeMemberMinutes(member))}${events.length ? ` (${events.join(", ")})` : ""}`;
  });

  if (rows.length > REPORT_PREVIEW_LIMIT) {
    visibleRows.push(`…and ${rows.length - REPORT_PREVIEW_LIMIT} more.`);
  }

  return embed(title, [
    `Scope: **${scopeLabel(scope)}**`,
    `Week Start: **${weekStart || "Unknown"}**`,
    authorName ? `Author: **${authorName}**` : "",
    prefilled ? "Mode: **Prefilled preview, not saved**" : "",
    `Totals: **${formatHoursMinutesFromMinutes(totals.minutes)}**, **${totals.eventsHosted}** hosted, **${totals.eventsAttended}** attended`,
    "",
    visibleRows.join("\n") || "No report entries."
  ].filter(line => line !== "").join("\n"));
}

function reportMemberRows(reportId, members = []) {
  return members.filter(Boolean).map((member, index) => ({
    report_id: reportId,
    roblox_id: String(member.robloxId || ""),
    username: String(member.username || ""),
    display_name: String(member.displayName || ""),
    rank: Number(member.rank) || 0,
    role: String(member.role || ""),
    hours: Math.max(0, Number(member.hours) || 0),
    minutes: Math.max(0, Number(member.minutes) || 0),
    events_hosted: Math.max(0, Number(member.eventsHosted) || 0),
    events_attended: Math.max(0, Number(member.eventsAttended) || 0),
    display_order: index
  })).filter(row => row.roblox_id);
}

function normalizeReportMember(row, index = 0) {
  return {
    robloxId: String(row.roblox_id || ""),
    username: row.username || "",
    displayName: row.display_name || "",
    rank: Number(row.rank) || 0,
    role: row.role || "",
    hours: Number(row.hours) || 0,
    minutes: Number(row.minutes) || 0,
    eventsHosted: Number(row.events_hosted) || 0,
    eventsAttended: Number(row.events_attended) || 0,
    displayOrder: Number(row.display_order ?? index) || 0
  };
}

async function fetchDivisionRoster(scope) {
  assertReportScope(scope);
  const definition = ROBLOX_GROUPS.DIVISIONS[scope];
  const maxRank = Math.max(...Object.values(definition.ranks || {}).flat().map(Number).filter(Boolean));
  let cursor = "";
  const members = [];

  do {
    const url = new URL(`https://groups.roblox.com/v1/groups/${definition.groupId}/users`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("sortOrder", "Asc");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url);
    if (!response.ok) throw new Error("ROBLOX_ROSTER_LOOKUP_FAILED");
    const payload = await response.json();

    (payload.data || []).forEach(item => {
      const rank = Number(item.role?.rank || 0);
      if (rank <= maxRank) {
        members.push({
          robloxId: String(item.user?.userId || item.user?.id || ""),
          username: item.user?.username || "",
          displayName: item.user?.displayName || "",
          rank,
          role: item.role?.name || ""
        });
      }
    });

    cursor = payload.nextPageCursor || "";
  } while (cursor);

  return members.filter(member => member.robloxId);
}

async function loadVerificationLinksForRobloxIds(robloxIds = []) {
  const ids = [...new Set(robloxIds.map(value => String(value || "")).filter(Boolean))];
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from("verification_links")
    .select("discord_user_id,roblox_user_id")
    .in("roblox_user_id", ids);
  if (error) throw error;

  return (data || []).reduce((links, row) => {
    if (row.roblox_user_id && row.discord_user_id) links.set(String(row.roblox_user_id), String(row.discord_user_id));
    return links;
  }, new Map());
}

async function loadClockShiftTotalsForRoster(scope, members = []) {
  const robloxIds = [...new Set(members.map(member => String(member.robloxId || "")).filter(Boolean))];
  if (!robloxIds.length) return new Map();

  const linkMap = await loadVerificationLinksForRobloxIds(robloxIds);
  const discordIds = [...new Set([...linkMap.values()])];
  const rowMap = new Map();
  const select = "id,scope,discord_user_id,roblox_user_id,status,started_at,duration_seconds,adjustment_seconds";

  const { data: robloxRows, error: robloxError } = await supabase
    .from("clock_shifts")
    .select(select)
    .eq("scope", scope)
    .in("roblox_user_id", robloxIds);
  if (robloxError) throw robloxError;
  (robloxRows || []).forEach(row => rowMap.set(row.id, row));

  if (discordIds.length) {
    const { data: discordRows, error: discordError } = await supabase
      .from("clock_shifts")
      .select(select)
      .eq("scope", scope)
      .in("discord_user_id", discordIds);
    if (discordError) throw discordError;
    (discordRows || []).forEach(row => rowMap.set(row.id, row));
  }

  const totals = new Map();
  const now = Date.now();

  for (const shift of rowMap.values()) {
    let targetRobloxId = String(shift.roblox_user_id || "");
    if (!targetRobloxId && shift.discord_user_id) {
      targetRobloxId = String(linkMap.get(String(shift.discord_user_id)) || "");
    }
    if (!targetRobloxId) continue;

    const seconds = shiftTotalSeconds(shift, now);
    totals.set(targetRobloxId, (totals.get(targetRobloxId) || 0) + seconds);
  }

  return totals;
}

async function generatePrefilledReportMembers(scope) {
  assertReportScope(scope);
  const members = await fetchDivisionRoster(scope);
  const shiftTotals = await loadClockShiftTotalsForRoster(scope, members);

  return members.map((member, index) => {
    const totalSeconds = shiftTotals.get(String(member.robloxId || "")) || 0;
    const { hours, minutes } = formatMemberShift(totalSeconds);
    return {
      robloxId: member.robloxId,
      username: member.username,
      displayName: member.displayName,
      rank: member.rank,
      role: member.role,
      hours,
      minutes,
      eventsHosted: 0,
      eventsAttended: 0,
      displayOrder: index
    };
  });
}

async function requireScopeReportWriteAccess(interaction, scope) {
  const verified = await getVerifiedProfile(interaction.user.id).catch(() => null);
  if (!verified?.profile) throw new Error("DISCORD_NOT_LINKED");

  assertReportScope(scope);
  const isHighCommand = canManageBot(verified.profile, interaction.member);
  const tierWeight = divisionTierWeight(verified.profile, scope);
  const canWrite = isHighCommand || tierWeight >= 4 || checkResourceWriteAccess(verified.profile, `reports/${scope}`);

  if (!canWrite) {
    throw new Error(`PERMISSIONS_DENIED_REPORT_WRITE_${scope.toUpperCase()}`);
  }

  return verified;
}

async function wipeClockShiftsForScope(scope) {
  const { error } = await supabase
    .from("clock_shifts")
    .delete()
    .eq("scope", scope);
  if (error) throw error;
}

async function handleWriteReportCommand(interaction) {
  const scope = interaction.options.getString("scope", true);
  const weekStart = interaction.options.getString("start_date", true);
  const verified = await requireScopeReportWriteAccess(interaction, scope);

  const payload = {
    embeds: [embed("Confirm Weekly Report Write", [
      `Scope: **${scopeLabel(scope)}**`,
      `Week Start: **${weekStart}**`,
      `Author: **${verified.profile.name}**`,
      "",
      "Writing this report will compile the current roster and clock times, save the report to Holonet, and **reset all clock shifts** for this scope.",
      "Are you sure you want to proceed?"
    ].join("\n"))],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rptwrite:${scope}:${weekStart}`).setLabel("Write Report & Reset Clock").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("rptcancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
    )]
  };

  await interaction.reply(ephemeral(payload));
}

async function confirmWriteReport(interaction, scope, dateInput) {
  const verified = await requireScopeReportWriteAccess(interaction, scope);
  const weekStart = dateInput || weekStartValue();
  const members = await generatePrefilledReportMembers(scope);

  const { data: report, error: reportError } = await supabase
    .from("weekly_reports")
    .upsert({
      scope,
      week_start: weekStart,
      status: "published",
      author_roblox_id: String(verified.profile.robloxId || ""),
      author_name: String(verified.profile.name || "")
    }, { onConflict: "scope,week_start" })
    .select("id")
    .single();
  if (reportError) throw reportError;

  const { error: deleteError } = await supabase
    .from("weekly_report_members")
    .delete()
    .eq("report_id", report.id);
  if (deleteError) throw deleteError;

  const memberRows = reportMemberRows(report.id, members);
  if (memberRows.length) {
    const { error: insertError } = await supabase
      .from("weekly_report_members")
      .insert(memberRows);
    if (insertError) throw insertError;
  }

  await wipeClockShiftsForScope(scope);

  const previewEmbed = reportPreviewEmbed({
    title: "Weekly Report Published",
    scope,
    weekStart,
    authorName: verified.profile.name,
    members
  });

  await interaction.update({
    embeds: [previewEmbed],
    components: []
  });

  await postActivityLog(interaction.client, {
    title: "Weekly Report Published",
    description: `<@${interaction.user.id}> published the weekly report for **${scopeLabel(scope)}** (${weekStart}).`,
    fields: [
      { name: "Scope", value: scopeLabel(scope), inline: true },
      { name: "Week Start", value: weekStart, inline: true },
      { name: "Author", value: verified.profile.name, inline: true }
    ]
  });
}

async function handleViewReportCommand(interaction) {
  const scope = interaction.options.getString("scope", true);
  const weekStart = interaction.options.getString("start_date", true);
  const prefillEntries = interaction.options.getBoolean("prefill-entries", false);

  if (prefillEntries) {
    const members = await generatePrefilledReportMembers(scope);
    const previewEmbed = reportPreviewEmbed({
      title: "Weekly Report Preview",
      scope,
      weekStart,
      members,
      prefilled: true
    });
    await interaction.reply(ephemeral({ embeds: [previewEmbed] }));
    return;
  }

  const { data: report, error } = await supabase
    .from("weekly_reports")
    .select("id,author_name,weekly_report_members(*)")
    .eq("scope", scope)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw error;

  if (!report) {
    await interaction.reply(ephemeral({ embeds: [errorEmbed(`No report found for ${scopeLabel(scope)} on ${weekStart}. Use prefill-entries: true to preview standard entries.`)] }));
    return;
  }

  const members = (report.weekly_report_members || []).map(normalizeReportMember);
  const previewEmbed = reportPreviewEmbed({
    title: "Weekly Report",
    scope,
    weekStart,
    authorName: report.author_name,
    members
  });

  await interaction.reply(ephemeral({ embeds: [previewEmbed] }));
}

export async function handleCommand(interaction) {
  if (interaction.commandName !== "report") return false;

  const subcommand = interaction.options?.getSubcommand(false) || "";

  try {
    if (subcommand === "write") {
      await handleWriteReportCommand(interaction);
      return true;
    }

    if (subcommand === "view") {
      await handleViewReportCommand(interaction);
      return true;
    }
  } catch (error) {
    await replyReportError(interaction, error);
    return true;
  }

  return false;
}

export async function handleButton(interaction) {
  if (interaction.customId === "rptcancel") {
    await interaction.update({ embeds: [embed("Cancelled", "No report action was taken.")], components: [] });
    return true;
  }

  if (interaction.customId.startsWith("rptwrite:")) {
    const [, scope, date = ""] = interaction.customId.split(":");
    await confirmWriteReport(interaction, scope, date);
    return true;
  }

  return false;
}
