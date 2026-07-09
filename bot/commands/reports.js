import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { canViewDivisionReports, canWriteDivisionReport } from "../../modules/auth/permissions.js";
import { ROBLOX_GROUPS } from "../../modules/auth/roblox-groups.js";
import { postActivityLog } from "../services/activity-log.js";
import { botErrorMessage } from "../services/bot-errors.js";
import { embed, ephemeral, errorEmbed, successEmbed } from "../services/discord-ui.js";
import { loadRobloxUser } from "../services/roblox.js";
import { divisionTierWeight, getVerifiedProfile } from "../services/roles.js";
import { supabase } from "../services/supabase.js";

const VERIFY_INSTRUCTIONS = "You are not linked yet. Go to <#1046452180074381403> and click the verify button, or use `/verify`.";
const REPORT_PREVIEW_LIMIT = 12;
const RESET_USER_OPTION_NAMES = ["user", "user2", "user3"];

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
    .setName("write")
    .setDescription("Write Holonet records")
    .addSubcommand(subcommand => subcommand
      .setName("report")
      .setDescription("Write this scope's weekly website report and reset its clock time")
      .addStringOption(option => addReportScopeChoices(option.setName("scope").setDescription("Report scope").setRequired(true)))
      .addStringOption(option => option.setName("date").setDescription("Week start date, YYYY-MM-DD"))),
  new SlashCommandBuilder()
    .setName("reset")
    .setDescription("Reset clock time for a report scope")
    .addStringOption(option => addReportScopeChoices(option.setName("scope").setDescription("Scope to reset").setRequired(true)))
    .addUserOption(option => option.setName("user").setDescription("Optional user to wipe instead of the whole scope"))
    .addUserOption(option => option.setName("user2").setDescription("Optional second user to wipe"))
    .addUserOption(option => option.setName("user3").setDescription("Optional third user to wipe")),
  new SlashCommandBuilder()
    .setName("view")
    .setDescription("View Holonet records")
    .addSubcommand(subcommand => subcommand
      .setName("scopes")
      .setDescription("List all clock scopes and who is eligible for each one"))
    .addSubcommand(subcommand => subcommand
      .setName("time")
      .setDescription("View user time or a scope leaderboard")
      .addUserOption(option => option.setName("user").setDescription("Discord user"))
      .addStringOption(option => addLeaderboardScopeChoices(option.setName("scope").setDescription("Leaderboard scope"))))
    .addSubcommand(subcommand => subcommand
      .setName("report")
      .setDescription("View a saved report or preview current entries")
      .addStringOption(option => addReportScopeChoices(option.setName("scope").setDescription("Report scope").setRequired(true)))
      .addStringOption(option => option.setName("date").setDescription("Week start date, YYYY-MM-DD"))
      .addBooleanOption(option => option.setName("prefill-entries").setDescription("Preview current roster and clock entries instead of a saved report")))
];

function addReportScopeChoices(option) {
  return option.addChoices(...REPORT_SCOPE_CHOICES);
}

function addLeaderboardScopeChoices(option) {
  return option.addChoices(
    { name: "All", value: "all" },
    { name: "Reavers", value: "reavers" },
    { name: "DHG", value: "dhg" },
    { name: "Inquisitors", value: "inquisitors" },
    { name: "Dread Masters", value: "dreadmasters" },
    { name: "High Ranks", value: "highranks" },
    { name: "Dark Council", value: "darkCouncil" }
  );
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
  const discordToRoblox = new Map([...linkMap.entries()].map(([robloxId, discordId]) => [discordId, robloxId]));
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

  const now = Date.now();
  return [...rowMap.values()].reduce((totals, row) => {
    const robloxId = String(row.roblox_user_id || "") || discordToRoblox.get(String(row.discord_user_id || "")) || "";
    if (!robloxId) return totals;
    totals.set(robloxId, (totals.get(robloxId) || 0) + shiftTotalSeconds(row, now));
    return totals;
  }, new Map());
}

async function buildWeeklyReportRoster(scope) {
  const roster = await fetchDivisionRoster(scope);
  const shiftTotals = await loadClockShiftTotalsForRoster(scope, roster);
  return sortedMembers(roster.map(member => ({
    ...member,
    ...formatMemberShift(shiftTotals.get(String(member.robloxId || "")) || 0)
  })));
}

function resetShiftPayload(resetAt = new Date().toISOString()) {
  return {
    started_at: resetAt,
    duration_seconds: null,
    adjustment_seconds: 0,
    late: false,
    late_minutes: null,
    clockout_late: false,
    clockout_late_minutes: null
  };
}

async function resetClockShiftsForScope(scope, resetAt = new Date().toISOString()) {
  assertReportScope(scope);

  const { error: deleteError } = await supabase
    .from("clock_shifts")
    .delete()
    .eq("scope", scope)
    .eq("status", "completed");
  if (deleteError) throw deleteError;

  const { error: updateError } = await supabase
    .from("clock_shifts")
    .update(resetShiftPayload(resetAt))
    .eq("scope", scope)
    .eq("status", "active");
  if (updateError) throw updateError;
}

async function linkedRobloxIdsForDiscordIds(discordIds = []) {
  const ids = [...new Set(discordIds.map(String).filter(Boolean))];
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("verification_links")
    .select("roblox_user_id")
    .in("discord_user_id", ids);
  if (error) throw error;

  return [...new Set((data || []).map(row => String(row.roblox_user_id || "")).filter(Boolean))];
}

async function deleteCompletedForIdentities(scope, column, values = []) {
  if (!values.length) return;
  const { error } = await supabase
    .from("clock_shifts")
    .delete()
    .eq("scope", scope)
    .eq("status", "completed")
    .in(column, values);
  if (error) throw error;
}

async function resetActiveForIdentities(scope, column, values = [], resetAt = new Date().toISOString()) {
  if (!values.length) return;
  const { error } = await supabase
    .from("clock_shifts")
    .update(resetShiftPayload(resetAt))
    .eq("scope", scope)
    .eq("status", "active")
    .in(column, values);
  if (error) throw error;
}

async function resetClockShiftsForUsers(scope, discordIds = [], resetAt = new Date().toISOString()) {
  assertReportScope(scope);
  const safeDiscordIds = [...new Set(discordIds.map(String).filter(Boolean))];
  const robloxIds = await linkedRobloxIdsForDiscordIds(safeDiscordIds);

  await deleteCompletedForIdentities(scope, "discord_user_id", safeDiscordIds);
  await deleteCompletedForIdentities(scope, "roblox_user_id", robloxIds);
  await resetActiveForIdentities(scope, "discord_user_id", safeDiscordIds, resetAt);
  await resetActiveForIdentities(scope, "roblox_user_id", robloxIds, resetAt);
}

async function authorNameFor(actor) {
  const robloxId = String(actor?.link?.roblox_user_id || "");
  if (!robloxId) return "Discord Report Command";
  const robloxUser = await loadRobloxUser(robloxId).catch(() => null);
  return robloxUser?.name || robloxUser?.displayName || robloxId;
}

async function resetClockShiftsForReport(scope, members = [], reportAt = new Date().toISOString()) {
  assertReportScope(scope);
  const robloxIds = [...new Set(members.map(member => String(member.robloxId || "")).filter(Boolean))];
  if (!robloxIds.length) return;

  const linkMap = await loadVerificationLinksForRobloxIds(robloxIds);
  const discordIds = [...new Set([...linkMap.values()])];

  if (robloxIds.length) {
    const { error: deleteError } = await supabase
      .from("clock_shifts")
      .delete()
      .eq("scope", scope)
      .eq("status", "completed")
      .in("roblox_user_id", robloxIds);
    if (deleteError) throw deleteError;
  }

  if (discordIds.length) {
    const { error: deleteError } = await supabase
      .from("clock_shifts")
      .delete()
      .eq("scope", scope)
      .eq("status", "completed")
      .in("discord_user_id", discordIds);
    if (deleteError) throw deleteError;
  }

  if (robloxIds.length) {
    const { error: updateError } = await supabase
      .from("clock_shifts")
      .update(resetShiftPayload(reportAt))
      .eq("scope", scope)
      .eq("status", "active")
      .in("roblox_user_id", robloxIds);
    if (updateError) throw updateError;
  }

  if (discordIds.length) {
    const { error: updateError } = await supabase
      .from("clock_shifts")
      .update(resetShiftPayload(reportAt))
      .eq("scope", scope)
      .eq("status", "active")
      .in("discord_user_id", discordIds);
    if (updateError) throw updateError;
  }
}

async function saveWeeklyReportForScope(interaction, scope, date = "") {
  assertReportScope(scope);
  const actor = await getVerifiedProfile(interaction.user.id);
  if (!actor) throw new Error("DISCORD_NOT_LINKED");

  const access = canWriteDivisionReport(actor.profile, scope);
  if (!access.authorized) throw new Error(access.reason || "INSUFFICIENT_WRITE_CLEARANCE");

  const members = await buildWeeklyReportRoster(scope);
  const reportAt = new Date().toISOString();
  const weekStart = date ? date.trim() : weekStartValue();
  const authorName = await authorNameFor(actor);

  const { data: created, error: reportError } = await supabase
    .from("division_weekly_reports")
    .insert({
      division_key: scope,
      week_start: weekStart,
      author_id: String(actor.link.roblox_user_id || interaction.user.id),
      author_name: authorName,
      status: "published",
      updated_at: reportAt
    })
    .select("id")
    .single();
  if (reportError) throw reportError;

  const rows = reportMemberRows(created?.id, members);
  if (rows.length) {
    const { error: memberError } = await supabase.from("division_weekly_report_members").insert(rows);
    if (memberError) throw memberError;
  }

  await resetClockShiftsForReport(scope, members, reportAt);
  return { id: created?.id, scope, weekStart, authorName, members };
}

async function loadSavedWeeklyReport(scope, weekStart = "") {
  assertReportScope(scope);
  let query = supabase
    .from("division_weekly_reports")
    .select("id,division_key,week_start,author_name,status,created_at,updated_at")
    .eq("division_key", scope)
    .eq("status", "published")
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (weekStart) query = query.eq("week_start", weekStart);

  const { data: report, error } = await query.maybeSingle();
  if (error) throw error;
  if (!report?.id) return null;

  const { data: rows, error: memberError } = await supabase
    .from("division_weekly_report_members")
    .select("*")
    .eq("report_id", report.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (memberError) throw memberError;

  return {
    id: report.id,
    scope,
    weekStart: report.week_start,
    authorName: report.author_name,
    members: (rows || []).map(normalizeReportMember)
  };
}

async function ensureReportWriteAccess(interaction, scope) {
  assertReportScope(scope);
  const actor = await getVerifiedProfile(interaction.user.id);
  if (!actor) throw new Error("DISCORD_NOT_LINKED");
  const access = canWriteDivisionReport(actor.profile, scope);
  if (!access.authorized) throw new Error(access.reason || "INSUFFICIENT_WRITE_CLEARANCE");
  return actor;
}

async function ensureReportViewAccess(interaction, scope, prefill = false) {
  assertReportScope(scope);
  const actor = await getVerifiedProfile(interaction.user.id);
  if (!actor) throw new Error("DISCORD_NOT_LINKED");
  const access = prefill ? canWriteDivisionReport(actor.profile, scope) : canViewDivisionReports(actor.profile, scope);
  if (!access.authorized) throw new Error(access.reason || "INSUFFICIENT_CLEARANCE_LEVEL");
  return actor;
}

async function ensureResetAccess(interaction, scope) {
  assertReportScope(scope);
  const actor = await getVerifiedProfile(interaction.user.id);
  if (!actor) throw new Error("DISCORD_NOT_LINKED");
  const actorTier = divisionTierWeight(actor.profile?.divisions?.[scope] || "none");
  const allowed = Boolean(actor.profile?.isSuperUser || actorTier >= divisionTierWeight("co"));
  if (!allowed) throw new Error("DIVISION_CO_REQUIRED");
  return actor;
}

function confirmButtons(confirmId, danger = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(confirmId)
      .setLabel("Confirm")
      .setStyle(danger ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("rptcancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
  )];
}

function targetUsersFromOptions(interaction) {
  const users = RESET_USER_OPTION_NAMES
    .map(name => interaction.options.getUser(name, false))
    .filter(Boolean);
  return [...new Map(users.map(user => [user.id, user])).values()];
}

async function handleWriteReportCommand(interaction) {
  const scope = interaction.options.getString("scope", true);
  const date = (interaction.options.getString("date", false) || "").trim();
  await ensureReportWriteAccess(interaction, scope);
  await interaction.reply(ephemeral({
    embeds: [embed("Confirm Weekly Report", `Are you sure you want to write the **${scopeLabel(scope)}** weekly report${date ? ` for **${date}**` : ""}? This will save the current scope logs to the website report system and reset **${scopeLabel(scope)}** clock time.`)],
    components: confirmButtons(`rptwrite:${scope}:${date}`)
  }));
}

async function handleViewReportCommand(interaction) {
  const scope = interaction.options.getString("scope", true);
  const date = String(interaction.options.getString("date", false) || "").trim();
  const prefill = Boolean(interaction.options.getBoolean("prefill-entries", false));
  await ensureReportViewAccess(interaction, scope, prefill);

  if (prefill) {
    const members = await buildWeeklyReportRoster(scope);
    await interaction.reply(ephemeral({
      embeds: [reportPreviewEmbed({
        title: `${scopeLabel(scope)} Report Preview`,
        scope,
        weekStart: date || weekStartValue(),
        members,
        prefilled: true
      })]
    }));
    return;
  }

  const report = await loadSavedWeeklyReport(scope, date);
  if (!report) {
    await interaction.reply(ephemeral({ embeds: [errorEmbed(date ? `No ${scopeLabel(scope)} report found for ${date}.` : `No ${scopeLabel(scope)} reports found.`)] }));
    return;
  }

  await interaction.reply(ephemeral({
    embeds: [reportPreviewEmbed({
      title: `${scopeLabel(scope)} Weekly Report`,
      scope,
      weekStart: report.weekStart,
      authorName: report.authorName,
      members: report.members
    })]
  }));
}

async function handleResetCommand(interaction) {
  const scope = interaction.options.getString("scope", true);
  const users = targetUsersFromOptions(interaction);
  await ensureResetAccess(interaction, scope);

  if (users.length) {
    await interaction.reply(ephemeral({
      embeds: [embed("Reset Confirmation", `Are you sure you want to wipe **${users.map(user => `<@${user.id}>`).join(", ")}** time in **${scopeLabel(scope)}**? This is a dangerous command.`)],
      components: confirmButtons(`rptreset:users:${scope}:${users.map(user => user.id).join(",")}`, true)
    }));
    return;
  }

  await interaction.reply(ephemeral({
    embeds: [embed("Dangerous Reset Confirmation", `Are you sure you want to reset the entire **${scopeLabel(scope)}** scope? This is a dangerous command and will wipe completed time for that scope.`)],
    components: confirmButtons(`rptreset:scope:${scope}`, true)
  }));
}

async function confirmWriteReport(interaction, scope, date = "") {
  await interaction.deferUpdate();
  try {
    const report = await saveWeeklyReportForScope(interaction, scope, date);
    const totals = reportTotals(report.members);
    await interaction.editReply({
      embeds: [reportPreviewEmbed({
        title: `${scopeLabel(scope)} Weekly Report Saved`,
        scope,
        weekStart: report.weekStart,
        authorName: report.authorName,
        members: report.members
      })],
      components: []
    });
    await postActivityLog(interaction.client, {
      title: "Report Written",
      description: `<@${interaction.user.id}> wrote the **${scopeLabel(scope)}** weekly report and reset that scope's clock time.`,
      fields: [
        { name: "Week Start", value: report.weekStart || "Unknown", inline: true },
        { name: "Author", value: report.authorName || "Unknown", inline: true },
        { name: "Total Time", value: formatHoursMinutesFromMinutes(totals.minutes), inline: true },
        { name: "Members", value: String(report.members?.length || 0), inline: true }
      ]
    });
  } catch (error) {
    await interaction.editReply({ embeds: [errorEmbed(reportErrorMessage(error, interaction))], components: [] });
  }
}

async function confirmReset(interaction, parts) {
  await interaction.deferUpdate();
  try {
    const [, mode, scope, userList = ""] = parts;
    await ensureResetAccess(interaction, scope);
    const resetAt = new Date().toISOString();

    if (mode === "scope") {
      await resetClockShiftsForScope(scope, resetAt);
      await interaction.editReply({ embeds: [successEmbed("Scope Reset", `${scopeLabel(scope)} time has been reset.`)], components: [] });
      await postActivityLog(interaction.client, {
        title: "Time Reset",
        description: `<@${interaction.user.id}> reset clock time for **${scopeLabel(scope)}**.`,
        fields: [
          { name: "Scope", value: scopeLabel(scope), inline: true },
          { name: "Reset At", value: `<t:${Math.floor(new Date(resetAt).getTime() / 1000)}:F>`, inline: true }
        ]
      });
      return;
    }

    const discordIds = userList.split(",").map(value => value.trim()).filter(Boolean);
    await resetClockShiftsForUsers(scope, discordIds, resetAt);
    await interaction.editReply({ embeds: [successEmbed("User Time Reset", `${discordIds.map(id => `<@${id}>`).join(", ")} time has been reset in ${scopeLabel(scope)}.`)], components: [] });
    await postActivityLog(interaction.client, {
      title: "Time Reset",
      description: `<@${interaction.user.id}> reset user clock time in **${scopeLabel(scope)}**.`,
      fields: [
        { name: "Scope", value: scopeLabel(scope), inline: true },
        { name: "Users", value: discordIds.map(id => `<@${id}>`).join(", ") || "None", inline: false },
        { name: "Reset At", value: `<t:${Math.floor(new Date(resetAt).getTime() / 1000)}:F>`, inline: true }
      ]
    });
  } catch (error) {
    await interaction.editReply({ embeds: [errorEmbed(reportErrorMessage(error, interaction))], components: [] });
  }
}

export async function handleCommand(interaction) {
  const commandName = interaction.commandName;
  const subcommand = interaction.options?.getSubcommand(false) || "";

  try {
    if (commandName === "write" && subcommand === "report") {
      await handleWriteReportCommand(interaction);
      return true;
    }

    if (commandName === "view" && subcommand === "report") {
      await handleViewReportCommand(interaction);
      return true;
    }

    if (commandName === "reset") {
      await handleResetCommand(interaction);
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
    await interaction.update({ embeds: [embed("Cancelled", "No report or reset action was taken.")], components: [] });
    return true;
  }

  if (interaction.customId.startsWith("rptwrite:")) {
    const [, scope, date = ""] = interaction.customId.split(":");
    await confirmWriteReport(interaction, scope, date);
    return true;
  }

  if (interaction.customId.startsWith("rptreset:")) {
    await confirmReset(interaction, interaction.customId.split(":"));
    return true;
  }

  return false;
}
