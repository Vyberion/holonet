import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { activeShift, adjustShiftTime, clockIn, clockOut, formatDuration, saveClockPanel, shiftTotals } from "../services/clock.js";
import { config } from "../config/index.js";
import { postActivityLog } from "../services/activity-log.js";
import { botErrorMessage } from "../services/bot-errors.js";
import { embed, ephemeral, errorEmbed, successEmbed, textModal } from "../services/discord-ui.js";
import { canAdjustTime, canManageBot, getVerifiedProfile, inferScope } from "../services/roles.js";
import { setShiftRemindersEnabled } from "../services/shift-reminders.js";
import { supabase } from "../services/supabase.js";
import { ROBLOX_GROUPS } from "../../modules/auth/roblox-groups.js";

const VERIFY_INSTRUCTIONS = "You are not linked yet. Use `/verify` or the verification panel.";
const LEADERBOARD_PAGE_SIZE = 5;
const PANEL_DESCRIPTION = "Use the buttons below to clock in, clock in late, clock out, clock out late, check your current shift or view the leaderboard.";
const SCOPE_CHOICES = [
  { name: "Reavers", value: "reavers" },
  { name: "DHG", value: "dhg" },
  { name: "Inquisitors", value: "inquisitors" },
  { name: "Dread Masters", value: "dreadmasters" },
  { name: "High Ranks", value: "highranks" },
  { name: "Dark Council", value: "darkCouncil" }
];
const DIVISION_TIERS = ["none", "member", "nco", "co", "2ic", "1ic", "overseer"];
const OVERSEER_ROLE_KEYS = [
  "highRankOverseer",
  "darkHonorGuardOverseer",
  "reaverOverseer",
  "dreadMasterOverseer",
  "inquisitoriusOverseer"
];
const OVERSEER_VISIBLE_SCOPES = ["reavers", "dhg", "dreadmasters", "highranks"];

export const commands = [
  new SlashCommandBuilder().setName("clockin").setDescription("Start a shift").addBooleanOption(option => option.setName("late").setDescription("Clock in late")),
  new SlashCommandBuilder().setName("clockout").setDescription("End your active shift").addBooleanOption(option => option.setName("late").setDescription("Clock out late")),
  new SlashCommandBuilder().setName("shift").setDescription("Shift tools")
    .addSubcommand(subcommand => subcommand.setName("status").setDescription("Show your active shift"))
    .addSubcommand(subcommand => subcommand.setName("reminders").setDescription("Enable or disable hourly shift reminders").addBooleanOption(option => option.setName("enable").setDescription("Whether hourly shift reminders are enabled").setRequired(true))),
  new SlashCommandBuilder().setName("clockpanel").setDescription("Clock panel tools").addSubcommand(subcommand => subcommand.setName("create").setDescription("Create a clock panel").addStringOption(option => addScopeChoices(option.setName("scope").setDescription("Clock scope").setRequired(true)))),
  new SlashCommandBuilder().setName("shifts").setDescription("Shift reports")
    .addSubcommand(subcommand => subcommand.setName("active").setDescription("Show active shifts"))
    .addSubcommand(subcommand => subcommand.setName("weekly").setDescription("Show this week's shifts").addStringOption(option => addScopeChoices(option.setName("scope").setDescription("Clock scope").setRequired(true))))
    .addSubcommand(subcommand => subcommand.setName("user").setDescription("Show a user's shifts").addUserOption(option => option.setName("user").setDescription("User").setRequired(true))),
  new SlashCommandBuilder().setName("add").setDescription("Add time").addSubcommand(subcommand => subcommand.setName("time").setDescription("Add minutes to a shift").addUserOption(option => option.setName("user").setDescription("User to adjust"))),
  new SlashCommandBuilder().setName("remove").setDescription("Remove time").addSubcommand(subcommand => subcommand.setName("time").setDescription("Remove minutes from a shift").addUserOption(option => option.setName("user").setDescription("User to adjust"))),
  new SlashCommandBuilder().setName("view").setDescription("View Holonet records")
    .addSubcommand(subcommand => subcommand.setName("scopes").setDescription("List all clock scopes and who is eligible for each one"))
    .addSubcommand(subcommand => subcommand.setName("time").setDescription("View user time or a scope leaderboard").addUserOption(option => option.setName("user").setDescription("Discord user")).addStringOption(option => addScopeChoices(option.addChoices({ name: "All", value: "all" }).setName("scope").setDescription("Leaderboard scope"))))
];

function addScopeChoices(option) { return option.addChoices(...SCOPE_CHOICES); }

function panelRows(scope) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`clock:in:${scope}:0`).setLabel("Clock In").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`clock:in:${scope}:1`).setLabel("Clock In Late").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`clock:out:${scope}:0`).setLabel("Clock Out").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`clock:out:${scope}:1`).setLabel("Clock Out Late").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`clock:shift:${scope}:0`).setLabel("My Shift").setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`clock:leaderboard:${scope}:0`).setLabel("Leaderboard").setStyle(ButtonStyle.Primary))
  ];
}

function scopeLabel(scope) {
  return { reavers: "Reavers", dhg: "DHG", inquisitors: "Inquisitors", dreadmasters: "Dread Masters", highranks: "High Ranks", darkCouncil: "Dark Council", all: "All" }[scope] || scope;
}

function clockPanelPayload(scope) {
  return { embeds: [embed(`${scopeLabel(scope)} Clock Panel`, PANEL_DESCRIPTION)], components: panelRows(scope) };
}

function divisionTierAtLeast(profile, division, requiredTier) {
  return DIVISION_TIERS.indexOf(profile?.divisions?.[division] || "none") >= DIVISION_TIERS.indexOf(requiredTier);
}

function hasDarkCouncilRank(profile, roleKey) {
  const rank = Number(profile?.groupRanks?.[ROBLOX_GROUPS.DARK_COUNCIL.groupId] || 0);
  const allowedRanks = ROBLOX_GROUPS.DARK_COUNCIL.ranks?.[roleKey] || [];
  return Boolean(profile?.authorityRoles?.[roleKey] || allowedRanks.includes(rank));
}

function hasAnyOverseer(profile) {
  return OVERSEER_ROLE_KEYS.some(roleKey => hasDarkCouncilRank(profile, roleKey));
}

function hasInquisitoriusOverseer(profile) {
  return hasDarkCouncilRank(profile, "inquisitoriusOverseer");
}

function hasHighRankAccess(profile) {
  return Number(profile?.groupRanks?.[ROBLOX_GROUPS.HIGH_RANKS.groupId] || 0) > 0;
}

function hasDarkCouncilAccess(profile) {
  return Number(profile?.groupRanks?.[ROBLOX_GROUPS.DARK_COUNCIL.groupId] || 0) > 0;
}

function hasHighCommandTimeAccess(profile, member = null) {
  return canManageBot(profile, member);
}

function canViewScopeTime(profile, scope, member = null) {
  if (hasHighCommandTimeAccess(profile, member)) return true;
  if (scope === "all") return false;
  if (scope === "darkCouncil") return hasDarkCouncilAccess(profile);
  if (scope === "highranks") return Boolean(hasHighRankAccess(profile) || hasAnyOverseer(profile));

  if (OVERSEER_VISIBLE_SCOPES.includes(scope)) {
    return Boolean(hasAnyOverseer(profile) || divisionTierAtLeast(profile, scope, "member"));
  }

  if (scope === "inquisitors") {
    return Boolean(hasInquisitoriusOverseer(profile) || divisionTierAtLeast(profile, "inquisitors", "member"));
  }

  return false;
}

async function requireScopeTimeAccess(interaction, scope) {
  const verified = await getVerifiedProfile(interaction.user.id).catch(() => null);
  if (canViewScopeTime(verified?.profile, scope, interaction.member)) return { allowed: true, profile: verified?.profile || null };

  await interaction.reply(ephemeral({ embeds: [errorEmbed(`You do not have clearance to view ${scopeLabel(scope)} time.`)] }));
  return { allowed: false, profile: verified?.profile || null };
}

function rankName(section, rank) { return section?.ranks?.[String(rank)]?.value || `Rank ${rank}`; }

function eligibleRanks(ranks, keys, section) {
  return keys.flatMap(key => (ranks?.[key] || []).map(rank => `${rankName(section, rank)} [${rank}]`)).join(", ");
}

function scopeEligibilityLines() {
  const nicknameRanks = config.nicknames?.managed || {};
  return [
    `- Reavers: ${eligibleRanks(ROBLOX_GROUPS.DIVISIONS.reavers.ranks, ["1ic", "co", "nco", "member"], nicknameRanks.DIVISIONS?.reavers)}`,
    `- DHG: ${eligibleRanks(ROBLOX_GROUPS.DIVISIONS.dhg.ranks, ["1ic", "2ic", "co", "nco", "member"], nicknameRanks.DIVISIONS?.dhg)}`,
    `- Inquisitors: ${eligibleRanks(ROBLOX_GROUPS.DIVISIONS.inquisitors.ranks, ["1ic", "co", "nco", "member"], nicknameRanks.DIVISIONS?.inquisitors)}`,
    `- Dread Masters: ${eligibleRanks(ROBLOX_GROUPS.DIVISIONS.dreadmasters.ranks, ["1ic", "2ic", "member"], nicknameRanks.DIVISIONS?.dreadmasters)}`,
    `- High Ranks: ${eligibleRanks(ROBLOX_GROUPS.HIGH_RANKS.ranks, ["upper", "lower"], nicknameRanks.HIGH_RANKS)}`,
    `- Dark Council: ${eligibleRanks(ROBLOX_GROUPS.DARK_COUNCIL.ranks, Object.keys(ROBLOX_GROUPS.DARK_COUNCIL.ranks), nicknameRanks.DARK_COUNCIL)}`
  ];
}

function formatDurationLong(seconds = 0) {
  const total = Math.max(0, Math.trunc(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  return `${hours} hour${hours === 1 ? "" : "s"}, ${minutes} minute${minutes === 1 ? "" : "s"}, ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"}`;
}

function shiftTotalSeconds(shift, now = Date.now()) {
  const liveSeconds = shift.status === "active" ? Math.max(0, Math.floor((now - new Date(shift.started_at).getTime()) / 1000)) : Number(shift.duration_seconds || 0);
  return Math.max(0, liveSeconds + Number(shift.adjustment_seconds || 0));
}

async function loadScopeLeaderboard(scope) {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    let query = supabase.from("clock_shifts").select("discord_user_id,scope,status,started_at,duration_seconds,adjustment_seconds").not("discord_user_id", "is", null).range(from, from + pageSize - 1);
    if (scope !== "all") query = query.eq("scope", scope);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  const now = Date.now();
  const totals = new Map();
  for (const shift of rows) {
    const userId = String(shift.discord_user_id || "");
    if (userId) totals.set(userId, (totals.get(userId) || 0) + shiftTotalSeconds(shift, now));
  }

  return [...totals.entries()]
    .map(([discordUserId, totalSeconds]) => ({ discordUserId, totalSeconds }))
    .filter(item => item.totalSeconds > 0)
    .sort((a, b) => b.totalSeconds - a.totalSeconds);
}

function leaderboardRow(scope, page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`viewtime:${scope}:prev:${Math.max(0, page - 1)}`).setLabel("Previous").setStyle(ButtonStyle.Danger).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId(`viewtime:${scope}:next:${Math.min(totalPages - 1, page + 1)}`).setLabel("Next").setStyle(ButtonStyle.Success).setDisabled(page >= totalPages - 1)
  );
}

function leaderboardEmbed(scope, rows, page) {
  const totalPages = Math.max(1, Math.ceil(rows.length / LEADERBOARD_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const pageRows = rows.slice(safePage * LEADERBOARD_PAGE_SIZE, (safePage + 1) * LEADERBOARD_PAGE_SIZE);
  return {
    embeds: [embed(`${scopeLabel(scope)} Leaderboard`, pageRows.length ? pageRows.map((row, index) => `**Rank:** ${safePage * LEADERBOARD_PAGE_SIZE + index + 1}\n**User:** <@${row.discordUserId}>\n**Total time:** ${formatDurationLong(row.totalSeconds)}`).join("\n\n") : "No time recorded.")],
    components: [leaderboardRow(scope, safePage, totalPages)]
  };
}

async function replyScopeLeaderboard(interaction, scope, page = 0, update = false) {
  const access = await requireScopeTimeAccess(interaction, scope);
  if (!access.allowed) return;

  const payload = leaderboardEmbed(scope, await loadScopeLeaderboard(scope), page);
  if (update) await interaction.update(payload);
  else await interaction.reply(ephemeral(payload));
}

async function loadClockScopesForUser(discordUserId) {
  const { data, error } = await supabase
    .from("clock_shifts")
    .select("scope")
    .eq("discord_user_id", discordUserId);
  if (error) throw error;
  return [...new Set((data || []).map(row => row.scope).filter(Boolean))];
}

async function allowedClockScopesForTarget(interaction, targetUser) {
  if (targetUser.id === interaction.user.id) return null;
  const actor = await getVerifiedProfile(interaction.user.id).catch(() => null);
  const targetScopes = await loadClockScopesForUser(targetUser.id);
  return targetScopes.filter(scope => canViewScopeTime(actor?.profile, scope, interaction.member));
}

async function replyUserTime(interaction, user) {
  const verified = await getVerifiedProfile(user.id).catch(() => null);
  const scope = verified?.profile ? inferScope(verified.profile) : "";
  let visibleScopes = null;
  if (user.id !== interaction.user.id) {
    visibleScopes = await allowedClockScopesForTarget(interaction, user);
    if (!visibleScopes.length) {
      await interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have clearance to view that user's time.")] }));
      return;
    }
  }

  const totals = await shiftTotals(user.id, visibleScopes);
  await interaction.reply(ephemeral({ embeds: [embed("Shift Time", [
    `User: <@${user.id}>`,
    visibleScopes ? `Scopes: ${visibleScopes.map(scopeLabel).join(", ")}` : `Scope: ${scope ? scopeLabel(scope) : "Unassigned"}`,
    `Total Time: ${formatDurationLong(totals.totalSeconds)}`,
    totals.adjustmentSeconds ? `Adjustments: ${totals.adjustmentSeconds >= 0 ? "+" : "-"}${formatDurationLong(Math.abs(totals.adjustmentSeconds))}` : "",
    totals.hasActiveShift ? "Current Shift: active" : "Current Shift: none"
  ].filter(Boolean).join("\n"))] }));
}

async function requireManager(interaction) {
  const verified = await getVerifiedProfile(interaction.user.id);
  return canManageBot(verified?.profile, interaction.member);
}

async function doClockIn(interaction, options = {}) {
  const shift = await clockIn(interaction.user.id, options);
  await interaction.reply(ephemeral({ embeds: [successEmbed("Clocked In", `Scope: ${shift.scope}${shift.late ? `\nLate: ${shift.late_minutes || 0} minutes` : ""}`)] }));
  await postActivityLog(interaction.client, {
    title: "Clock In",
    description: `<@${interaction.user.id}> clocked in${shift.late ? " late" : ""}.`,
    fields: [
      { name: "Scope", value: scopeLabel(shift.scope), inline: true },
      shift.late ? { name: "Late", value: `${shift.late_minutes || 0} minute(s)`, inline: true } : null
    ].filter(Boolean)
  });
}

async function doClockOut(interaction, options = {}) {
  const shift = await clockOut(interaction.user.id, options);
  const total = Math.max(0, Number(shift.duration_seconds || 0) + Number(shift.adjustment_seconds || 0));
  await interaction.reply(ephemeral({ embeds: [successEmbed("Clocked Out", `Duration: ${formatDuration(total)}${shift.adjustment_seconds ? `\nAdjustment: ${formatDuration(Math.abs(shift.adjustment_seconds))} ${shift.adjustment_seconds > 0 ? "added" : "removed"}` : ""}${shift.clockout_late ? `\nLate clock-out: ${shift.clockout_late_minutes || 0} minutes` : ""}`)] }));
  await postActivityLog(interaction.client, {
    title: "Clock Out",
    description: `<@${interaction.user.id}> clocked out${shift.clockout_late ? " late" : ""}.`,
    fields: [
      { name: "Scope", value: scopeLabel(shift.scope), inline: true },
      { name: "Duration", value: formatDuration(total), inline: true },
      shift.clockout_late ? { name: "Late Clock-Out", value: `${shift.clockout_late_minutes || 0} minute(s)`, inline: true } : null
    ].filter(Boolean)
  });
}

async function replyClockError(interaction, error) {
  const message = error?.message === "DISCORD_NOT_LINKED"
    ? VERIFY_INSTRUCTIONS
    : botErrorMessage(error, { interaction, fallback: "Unexpected clock error." });
  await interaction.reply(ephemeral({ embeds: [errorEmbed(message)] }));
}

async function replyShiftSummary(interaction) {
  const [shift, totals] = await Promise.all([activeShift(interaction.user.id), shiftTotals(interaction.user.id)]);
  const activeLines = shift ? [
    `Scope: ${scopeLabel(shift.scope)}`,
    `Current Shift: ${formatDuration(shiftTotalSeconds(shift))}`,
    `Started: <t:${Math.floor(new Date(shift.started_at).getTime() / 1000)}:R>`
  ] : [
    "Scope: none",
    "Current Shift: none",
    "Started: none"
  ];
  const adjustmentText = totals.adjustmentSeconds ? `\nAdjustments: ${totals.adjustmentSeconds >= 0 ? "+" : "-"}${formatDuration(Math.abs(totals.adjustmentSeconds))}` : "";
  await interaction.reply(ephemeral({ embeds: [embed("Shift Time", `${activeLines.join("\n")}\nTotal Time: ${formatDuration(totals.totalSeconds)}${adjustmentText}`)] }));
}

async function canAdjustTarget(interaction, targetUser) {
  if (targetUser.id === interaction.user.id) return { allowed: true };
  const [actor, target] = await Promise.all([getVerifiedProfile(interaction.user.id), getVerifiedProfile(targetUser.id)]);
  if (!actor || !target) return { allowed: false, reason: "Both users must be linked." };

  const targetScope = inferScope(target.profile);
  if (!targetScope) return { allowed: false, reason: "Target user has no clock scope." };

  return canAdjustTime(actor.profile, target.profile, targetScope, false)
    ? { allowed: true }
    : { allowed: false, reason: "You do not have clearance to adjust that user's time." };
}

async function handleShiftReminderButton(interaction) {
  const [, action, targetId] = interaction.customId.split(":");
  if (action !== "disable") return false;

  if (targetId && targetId !== interaction.user.id) {
    await interaction.reply(ephemeral({ embeds: [errorEmbed("Only the reminded user can change this reminder setting.")] }));
    return true;
  }

  await setShiftRemindersEnabled(interaction.user.id, false);
  await interaction.update({
    embeds: [successEmbed("Shift Reminders Disabled", "Hourly shift reminders are now disabled. Use `/shift reminders enable: true` to turn them back on.")],
    components: []
  });
  return true;
}

async function canViewTargetUserTime(interaction, targetUser) {
  if (targetUser.id === interaction.user.id) return true;
  const allowedScopes = await allowedClockScopesForTarget(interaction, targetUser);
  if (allowedScopes.length) return true;
  await interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have clearance to view that user's time.")] }));
  return false;
}

export async function handleCommand(interaction) {
  const commandName = interaction.commandName;
  const subcommand = interaction.options?.getSubcommand(false) || "";

  if (interaction.commandName === "clockin") {
    if (interaction.options.getBoolean("late")) await interaction.showModal(textModal("clockmodal:in:auto", "Late Clock-In", [{ id: "minutes", label: "How late are you? (minutes)", placeholder: "10" }]));
    else try { await doClockIn(interaction); } catch (error) { await replyClockError(interaction, error); }
    return true;
  }

  if (interaction.commandName === "clockout") {
    if (interaction.options.getBoolean("late")) await interaction.showModal(textModal("clockmodal:out:auto", "Late Clock-Out", [{ id: "minutes", label: "How late is this clock-out?", placeholder: "10" }]));
    else try { await doClockOut(interaction); } catch (error) { await replyClockError(interaction, error); }
    return true;
  }

  if (interaction.commandName === "shift") {
    if (subcommand === "reminders") {
      const enabled = interaction.options.getBoolean("enable", true);
      await setShiftRemindersEnabled(interaction.user.id, enabled);
      await interaction.reply(ephemeral({ embeds: [successEmbed("Shift Reminders", `Hourly shift reminders are now ${enabled ? "enabled" : "disabled"}.`)] }));
    } else {
      await replyShiftSummary(interaction);
    }
    return true;
  }

  if (interaction.commandName === "view") {
    const sub = interaction.options.getSubcommand();
    if (sub === "scopes") await interaction.reply(ephemeral({ embeds: [embed("Clock Scopes", scopeEligibilityLines().join("\n"))] }));
    if (sub === "time") {
      const user = interaction.options.getUser("user", false);
      const scope = interaction.options.getString("scope", false);
      if (user && scope) await interaction.reply(ephemeral({ embeds: [errorEmbed("Choose either a user or a scope, not both.")] }));
      else if (scope) await replyScopeLeaderboard(interaction, scope);
      else await replyUserTime(interaction, user || interaction.user);
    }
    return true;
  }

  if (interaction.commandName === "clockpanel") {
    if (!(await requireManager(interaction))) {
      await interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have clearance to create clock panels.")] }));
      return true;
    }
    const scope = interaction.options.getString("scope", true);
    const message = await interaction.channel.send(clockPanelPayload(scope));
    await saveClockPanel({ scope, channelId: message.channelId, messageId: message.id, createdBy: interaction.user.id });
    await interaction.reply(ephemeral({ embeds: [successEmbed("Clock Panel Created", `Scope: ${scope}`)] }));
    return true;
  }

  if (((commandName === "add" || commandName === "remove") && (!subcommand || subcommand === "time")) || commandName === "addtime" || commandName === "removetime") {
    const action = commandName === "remove" || commandName === "removetime" ? "remove" : "add";
    const target = interaction.options.getUser("user") || interaction.user;
    const decision = await canAdjustTarget(interaction, target);
    if (!decision.allowed) {
      await interaction.reply(ephemeral({ embeds: [errorEmbed(decision.reason)] }));
      return true;
    }
    await interaction.showModal(textModal(`timeadjust:${action}:${target.id}`, `${action === "add" ? "Add" : "Remove"} Time`, [{ id: "minutes", label: "How many minutes?", placeholder: "10" }]));
    return true;
  }

  if (interaction.commandName === "shifts") {
    const sub = interaction.options.getSubcommand();
    let query = supabase.from("clock_shifts").select("*").order("started_at", { ascending: false }).limit(10);

    if (sub === "weekly") {
      const scope = interaction.options.getString("scope", true);
      const access = await requireScopeTimeAccess(interaction, scope);
      if (!access.allowed) return true;
      query = query.gte("started_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).eq("scope", scope);
    } else if (sub === "user") {
      const targetUser = interaction.options.getUser("user", true);
      if (!(await canViewTargetUserTime(interaction, targetUser))) return true;
      query = query.eq("discord_user_id", targetUser.id);
      if (targetUser.id !== interaction.user.id) {
        const allowedScopes = await allowedClockScopesForTarget(interaction, targetUser);
        query = query.in("scope", allowedScopes);
      }
    } else {
      if (!(await requireManager(interaction))) {
        await interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have clearance to view shift reports.")] }));
        return true;
      }
      if (sub === "active") query = query.eq("status", "active");
    }

    const { data, error } = await query;
    if (error) throw error;
    const lines = (data || []).map(row => `<@${row.discord_user_id}> ${row.scope} ${row.status} ${row.duration_seconds ? formatDuration(row.duration_seconds) : ""}`);
    await interaction.reply(ephemeral({ embeds: [embed("Shift Report", lines.join("\n") || "No shifts found.")] }));
    return true;
  }

  return false;
}

export async function handleButton(interaction) {
  if (interaction.customId.startsWith("shiftreminder:")) return handleShiftReminderButton(interaction);

  if (interaction.customId.startsWith("viewtime:")) {
    const [, scope, , page] = interaction.customId.split(":");
    await replyScopeLeaderboard(interaction, scope, Number(page) || 0, true);
    return true;
  }

  if (!interaction.customId.startsWith("clock:")) return false;
  const [, action, scope, late] = interaction.customId.split(":");
  await interaction.message?.edit(clockPanelPayload(scope)).catch(() => {});

  if (action === "shift") {
    await replyShiftSummary(interaction);
    return true;
  }

  if (action === "leaderboard") {
    await replyScopeLeaderboard(interaction, scope);
    return true;
  }

  if (late === "1") {
    await interaction.showModal(textModal(`clockmodal:${action}:${scope}`, action === "in" ? "Late Clock-In" : "Late Clock-Out", [{ id: "minutes", label: "How late? (minutes)", placeholder: "10" }]));
    return true;
  }

  try {
    if (action === "in") await doClockIn(interaction, { scope });
    if (action === "out") await doClockOut(interaction);
  } catch (error) {
    await replyClockError(interaction, error);
  }
  return true;
}

export async function handleModal(interaction) {
  if (interaction.customId.startsWith("timeadjust:")) {
    const [, action, targetId] = interaction.customId.split(":");
    const minutes = Math.max(0, Number(interaction.fields.getTextInputValue("minutes")) || 0);
    try {
      const shift = await adjustShiftTime(targetId, action === "add" ? minutes : -minutes);
      const shiftTotal = Math.max(0, Number(shift.duration_seconds || 0) + Number(shift.adjustment_seconds || 0));
      await interaction.reply(ephemeral({ embeds: [successEmbed("Time Adjusted", `${action === "add" ? "Added" : "Removed"} ${minutes} minute(s) ${targetId === interaction.user.id ? "from your shift" : `for <@${targetId}>`}.\nShift total: ${formatDuration(shiftTotal)}.`)] }));
      if (minutes > 0) {
        await postActivityLog(interaction.client, {
          title: action === "add" ? "Time Added" : "Time Removed",
          description: `<@${interaction.user.id}> ${action === "add" ? "added time to" : "removed time from"} ${targetId === interaction.user.id ? "their own shift" : `<@${targetId}>'s shift`}.`,
          fields: [
            { name: "Scope", value: scopeLabel(shift.scope), inline: true },
            { name: "Amount", value: formatDuration(minutes * 60), inline: true },
            { name: "Shift Total", value: formatDuration(shiftTotal), inline: true }
          ]
        });
      }
    } catch (error) {
      await replyClockError(interaction, error);
    }
    return true;
  }

  if (!interaction.customId.startsWith("clockmodal:")) return false;
  const [, action, scope] = interaction.customId.split(":");
  const minutes = Math.max(0, Number(interaction.fields.getTextInputValue("minutes")) || 0);
  try {
    if (action === "in") await doClockIn(interaction, { scope: scope === "auto" ? "" : scope, late: true, lateMinutes: minutes });
    if (action === "out") await doClockOut(interaction, { late: true, lateMinutes: minutes });
  } catch (error) {
    await replyClockError(interaction, error);
  }
  return true;
}
