import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { activeShift, adjustShiftTime, clockIn, clockOut, formatDuration, saveClockPanel, shiftTotals } from "../services/clock.js";
import { config } from "../config/index.js";
import { postActivityLog } from "../services/activity-log.js";
import { botErrorMessage } from "../services/bot-errors.js";
import { embed, ephemeral, errorEmbed, successEmbed, textModal } from "../services/discord-ui.js";
import { canAdjustTime, canManageBot, divisionTierWeight, getVerifiedProfile, inferScope, isMemberInScope } from "../services/roles.js";
import { setShiftRemindersEnabled } from "../services/shift-reminders.js";
import { supabase } from "../services/supabase.js";
import { ROBLOX_GROUPS } from "../../modules/data/roblox-config.js";
import { checkResourceWriteAccess } from "../../modules/auth/permissions.js";

const VERIFY_INSTRUCTIONS = "You are not linked yet. Use `/verify` or the verification panel.";
const LEADERBOARD_PAGE_SIZE = 5;
const PANEL_DESCRIPTION = "Use the buttons below to clock in, clock in late, clock out, clock out late, check your current shift or view the leaderboard.";

function unique(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}
const SCOPE_CHOICES = [
  { name: "Reavers", value: "reavers" },
  { name: "DHG", value: "dhg" },
  { name: "Inquisitors", value: "inquisitors" },
  { name: "Dread Masters", value: "dreadmasters" },
  { name: "High Ranks", value: "highranks" },
  { name: "Dark Council", value: "darkCouncil" }
];
const DIVISION_TIERS = ["none", "member", "nco", "hr", "2ic", "1ic", "overseer"];
const OVERSEER_ROLE_KEYS = [
  "highRankOverseer",
  "darkHonorGuardOverseer",
  "reaverOverseer",
  "dreadMasterOverseer",
  "inquisitoriusOverseer"
];
const OVERSEER_VISIBLE_SCOPES = ["reavers", "dhg", "dreadmasters", "highranks"];

export const commands = [
  new SlashCommandBuilder()
    .setName("clock")
    .setDescription("Clock in and clock out tools")
    .addSubcommand(subcommand =>
      subcommand
        .setName("in")
        .setDescription("Start a shift")
        .addBooleanOption(option => option.setName("late").setDescription("Clock in late"))
        .addUserOption(option => option.setName("user").setDescription("Optional target user to clock in (Requires permission)"))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("out")
        .setDescription("End an active shift")
        .addBooleanOption(option => option.setName("late").setDescription("Clock out late"))
        .addUserOption(option => option.setName("user").setDescription("Optional target user to clock out (Requires permission)"))
    ),
  new SlashCommandBuilder()
    .setName("shift")
    .setDescription("Shift management tools")
    .addSubcommand(subcommand => subcommand.setName("status").setDescription("Show your active shift"))
    .addSubcommand(subcommand => subcommand.setName("reminders").setDescription("Enable or disable hourly shift reminders").addBooleanOption(option => option.setName("enable").setDescription("Whether hourly shift reminders are enabled").setRequired(true)))
    .addSubcommand(subcommand => subcommand.setName("active").setDescription("Show active shifts"))
    .addSubcommand(subcommand => subcommand.setName("reset")
      .setDescription("Reset clock time for a report scope or user(s)")
      .addStringOption(option => addScopeChoices(option.setName("scope").setDescription("Scope to reset").setRequired(true)))
      .addUserOption(option => option.setName("user").setDescription("Optional user to wipe instead of the whole scope"))
      .addUserOption(option => option.setName("user2").setDescription("Optional second user to wipe"))
      .addUserOption(option => option.setName("user3").setDescription("Optional third user to wipe")))
    .addSubcommand(subcommand => subcommand.setName("time")
      .setDescription("Add or remove shift time for a user")
      .addStringOption(option => option.setName("type").setDescription("Add or remove time").setRequired(true).addChoices({ name: "Add", value: "add" }, { name: "Remove", value: "remove" }))
      .addUserOption(option => option.setName("user").setDescription("User to adjust").setRequired(true))
      .addIntegerOption(option => option.setName("minutes").setDescription("Number of minutes (leave empty for popup modal)").setRequired(false)))
    .addSubcommand(subcommand => subcommand.setName("view")
      .setDescription("View shift time for a scope leaderboard or specific user")
      .addStringOption(option => addScopeChoices(option.setName("scope").setDescription("Leaderboard scope")))
      .addUserOption(option => option.setName("user").setDescription("Discord user")))
];

function addScopeChoices(option) { return option.addChoices(...SCOPE_CHOICES); }

function scopeLabel(scope) {
  return { reavers: "Reavers", dhg: "DHG", inquisitors: "Inquisitors", dreadmasters: "Dread Masters", highranks: "High Ranks", darkCouncil: "Dark Council", all: "All" }[scope] || scope;
}

function divisionTierAtLeast(profile, division, requiredTier) {
  return DIVISION_TIERS.indexOf(profile?.divisions?.[division] || "none") >= DIVISION_TIERS.indexOf(requiredTier);
}

export function hasDarkCouncilRank(profile, roleKey) {
  const rank = Number(profile?.groupRanks?.[ROBLOX_GROUPS.DARK_COUNCIL.groupId] || 0);
  if (typeof roleKey === "number") {
    return rank >= roleKey;
  }
  const allowedRanks = ROBLOX_GROUPS.DARK_COUNCIL.tiers?.[roleKey] || [];
  return Boolean(profile?.authorityRoles?.[roleKey] || allowedRanks.includes(rank));
}

export function hasAnyOverseer(profile) {
  return OVERSEER_ROLE_KEYS.some(roleKey => hasDarkCouncilRank(profile, roleKey));
}

function hasInquisitoriusOverseer(profile) {
  return hasDarkCouncilRank(profile, "inquisitoriusOverseer");
}

function hasHighRankAccess(profile) {
  return Number(profile?.groupRanks?.[ROBLOX_GROUPS.MAIN_GROUP.groupId] || 0) > 0;
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
  if (member && isMemberInScope(member, scope)) return true;
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

  const content = { embeds: [errorEmbed(`You do not have clearance to view ${scopeLabel(scope)} time.`)] };
  if (interaction.deferred || interaction.replied) await interaction.editReply(content);
  else await interaction.reply(ephemeral(content));
  return { allowed: false, profile: verified?.profile || null };
}

function formatDurationLong(seconds = 0) {
  const total = Math.max(0, Math.trunc(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  return `${hours} hour${hours === 1 ? "" : "s"}, ${minutes} minute${minutes === 1 ? "" : "s"}, ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"}`;
}

function shiftTotalSeconds(shift, now = Date.now()) {
  let liveSeconds = 0;
  if (shift.status === "active") {
    liveSeconds = Math.max(0, Math.floor((now - new Date(shift.started_at).getTime()) / 1000));
  } else if (shift.duration_seconds && Number(shift.duration_seconds) > 0) {
    liveSeconds = Number(shift.duration_seconds);
  } else if (shift.ended_at && shift.started_at) {
    liveSeconds = Math.max(0, Math.floor((new Date(shift.ended_at).getTime() - new Date(shift.started_at).getTime()) / 1000));
  }
  return liveSeconds + Number(shift.adjustment_seconds || 0);
}

async function loadScopeLeaderboard(scope) {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    let query = supabase.from("clock_shifts").select("discord_user_id,scope,status,started_at,ended_at,duration_seconds,adjustment_seconds").not("discord_user_id", "is", null).range(from, from + pageSize - 1);
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

async function replyScopeLeaderboard(interaction, scope, page = 0, update = false) {
  if (update) {
    await interaction.deferUpdate().catch(() => null);
  } else if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => null);
  }

  const access = await requireScopeTimeAccess(interaction, scope);
  if (!access.allowed) return;

  const rawRows = await loadScopeLeaderboard(scope);

  let validRows = rawRows;
  if (scope !== "all" && interaction.guild) {
    validRows = [];
    const missingIds = rawRows.map(r => r.discordUserId).filter(id => !interaction.guild.members.cache.has(id));
    if (missingIds.length > 0) {
      await interaction.guild.members.fetch({ user: missingIds }).catch(() => null);
    }
    for (const row of rawRows) {
      const member = interaction.guild.members.cache.get(row.discordUserId);
      if (member && isMemberInScope(member, scope)) {
        validRows.push(row);
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(validRows.length / LEADERBOARD_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const pageRows = validRows.slice(safePage * LEADERBOARD_PAGE_SIZE, (safePage + 1) * LEADERBOARD_PAGE_SIZE);

  const payload = {
    embeds: [embed(`${scopeLabel(scope)} Leaderboard`, pageRows.length ? pageRows.map((row, index) => `**Rank:** ${safePage * LEADERBOARD_PAGE_SIZE + index + 1}\n**User:** <@${row.discordUserId}>\n**Total time:** ${formatDurationLong(row.totalSeconds)}`).join("\n\n") : "No shifts recorded.")],
    components: [leaderboardRow(scope, safePage, totalPages)]
  };

  await interaction.editReply(payload);
}

async function allowedClockScopesForTarget(interaction, targetUser, verified = null) {
  const actor = await getVerifiedProfile(interaction.user.id).catch(() => null);
  if (canManageBot(actor?.profile, interaction.member)) return Object.keys(ROBLOX_GROUPS.DIVISIONS).concat(["highranks", "darkCouncil"]);

  const targetVerified = verified || await getVerifiedProfile(targetUser.id).catch(() => null);
  const targetScope = targetVerified?.profile ? inferScope(targetVerified.profile) : "";
  const targetScopes = unique([
    targetScope,
    ...(targetVerified?.profile?.authorityRoles?.highRankOverseer ? ["highranks"] : []),
    ...(targetVerified?.profile?.authorityRoles?.darkHonorGuardOverseer ? ["dhg"] : []),
    ...(targetVerified?.profile?.authorityRoles?.reaverOverseer ? ["reavers"] : []),
    ...(targetVerified?.profile?.authorityRoles?.dreadMasterOverseer ? ["dreadmasters"] : []),
    ...(targetVerified?.profile?.authorityRoles?.inquisitoriusOverseer ? ["inquisitors"] : [])
  ]);
  return targetScopes.filter(scope => canViewScopeTime(actor?.profile, scope, interaction.member));
}

async function replyUserTime(interaction, user) {
  const verified = await getVerifiedProfile(user.id).catch(() => null);
  const scope = verified?.profile ? inferScope(verified.profile) : "";
  let visibleScopes = null;
  if (user.id !== interaction.user.id) {
    visibleScopes = await allowedClockScopesForTarget(interaction, user, verified);
    if (!visibleScopes.length) {
      await interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have clearance to view that user's time.")] }));
      return;
    }
  }

  const totals = await shiftTotals(user.id, visibleScopes);
  await interaction.reply(ephemeral({ embeds: [embed("Shift Time", [
    `User: <@${user.id}>`,
    `Scope: ${scope ? scopeLabel(scope) : "Unassigned"}`,
    `Total Time: ${formatDurationLong(totals.totalSeconds)}`,
    totals.hasActiveShift ? "Current Shift: active" : "Current Shift: none"
  ].filter(Boolean).join("\n"))] }));
}

async function requireManager(interaction) {
  const verified = await getVerifiedProfile(interaction.user.id);
  return canManageBot(verified?.profile, interaction.member);
}

async function doClockIn(interaction, options = {}, targetUser = null) {
  const user = targetUser || interaction.user;
  const shift = await clockIn(user, options);
  const isForced = user.id !== interaction.user.id;

  await interaction.reply(ephemeral({ embeds: [successEmbed("Clocked In", `${isForced ? `Clocked in <@${user.id}>\n` : ""}Scope: ${shift.scope}${shift.late ? `\nLate: ${shift.late_minutes || 0} minutes` : ""}`)] }));
  await postActivityLog(interaction.client, {
    title: "Clock In",
    description: isForced ? `<@${interaction.user.id}> clocked in <@${user.id}>${shift.late ? " late" : ""}.` : `<@${user.id}> clocked in${shift.late ? " late" : ""}.`,
    channelKey: shift.scope === "darkCouncil" ? "highCommandLog" : "activityLog",
    fields: [
      { name: "User", value: `<@${user.id}>`, inline: true },
      { name: "Scope", value: scopeLabel(shift.scope), inline: true },
      shift.late ? { name: "Late", value: `${shift.late_minutes || 0} minute(s)`, inline: true } : null
    ].filter(Boolean)
  });
}

async function doClockOut(interaction, options = {}, targetUser = null) {
  const user = targetUser || interaction.user;
  const shift = await clockOut(user, options);
  const isForced = user.id !== interaction.user.id;
  const total = Math.max(0, Number(shift.duration_seconds || 0) + Number(shift.adjustment_seconds || 0));

  await interaction.reply(ephemeral({ embeds: [successEmbed("Clocked Out", `${isForced ? `Clocked out <@${user.id}>\n` : ""}Duration: ${formatDuration(total)}${shift.clockout_late ? `\nLate clock-out: ${shift.clockout_late_minutes || 0} minutes` : ""}`)] }));
  await postActivityLog(interaction.client, {
    title: "Clock Out",
    description: isForced ? `<@${interaction.user.id}> clocked out <@${user.id}>${shift.clockout_late ? " late" : ""}.` : `<@${user.id}> clocked out${shift.clockout_late ? " late" : ""}.`,
    channelKey: shift.scope === "darkCouncil" ? "highCommandLog" : "activityLog",
    fields: [
      { name: "User", value: `<@${user.id}>`, inline: true },
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
  await interaction.reply(ephemeral({ embeds: [embed("Shift Time", `${activeLines.join("\n")}\nTotal Time: ${formatDuration(totals.totalSeconds)}`)] }));
}

async function canAdjustTarget(interaction, targetUser) {
  if (targetUser.id === interaction.user.id) return { allowed: true };
  const actor = await getVerifiedProfile(interaction.user.id).catch(() => null);
  if (canManageBot(actor?.profile, interaction.member)) return { allowed: true };

  const target = await getVerifiedProfile(targetUser.id).catch(() => null);
  if (!actor || !target) return { allowed: false, reason: "Both users must be linked." };

  const targetScope = inferScope(target.profile) || "reavers";
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

export async function handleCommand(interaction) {
  const commandName = interaction.commandName;
  const subcommand = interaction.options?.getSubcommand(false) || "";

  if (commandName === "clock") {
    const targetUser = interaction.options.getUser("user", false);
    if (targetUser && targetUser.id !== interaction.user.id) {
      const decision = await canAdjustTarget(interaction, targetUser);
      if (!decision.allowed) {
        await interaction.reply(ephemeral({ embeds: [errorEmbed(decision.reason)] }));
        return true;
      }
    }

    if (subcommand === "in") {
      if (interaction.options.getBoolean("late")) {
        await interaction.showModal(textModal(`clockmodal:in:auto:${targetUser?.id || ""}`, "Late Clock-In", [{ id: "minutes", label: "How late? (minutes)", placeholder: "10" }]));
      } else {
        try { await doClockIn(interaction, {}, targetUser); } catch (error) { await replyClockError(interaction, error); }
      }
      return true;
    }

    if (subcommand === "out") {
      if (interaction.options.getBoolean("late")) {
        await interaction.showModal(textModal(`clockmodal:out:auto:${targetUser?.id || ""}`, "Late Clock-Out", [{ id: "minutes", label: "How late? (minutes)", placeholder: "10" }]));
      } else {
        try { await doClockOut(interaction, {}, targetUser); } catch (error) { await replyClockError(interaction, error); }
      }
      return true;
    }
  }

  if (commandName === "shift") {
    if (subcommand === "status") {
      await replyShiftSummary(interaction);
      return true;
    }

    if (subcommand === "reminders") {
      const enabled = interaction.options.getBoolean("enable", true);
      await setShiftRemindersEnabled(interaction.user.id, enabled);
      await interaction.reply(ephemeral({ embeds: [successEmbed("Shift Reminders", `Hourly shift reminders are now ${enabled ? "enabled" : "disabled"}.`)] }));
      return true;
    }

    if (subcommand === "active") {
      if (!(await requireManager(interaction))) {
        await interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have clearance to view active shifts.")] }));
        return true;
      }
      const { data, error } = await supabase.from("clock_shifts").select("*").eq("status", "active").order("started_at", { ascending: false }).limit(20);
      if (error) throw error;
      const lines = (data || []).map(row => `<@${row.discord_user_id}> ${row.scope} active duration: ${formatDuration(shiftTotalSeconds(row))}`);
      await interaction.reply(ephemeral({ embeds: [embed("Active Shifts", lines.join("\n") || "No active shifts.")] }));
      return true;
    }

    if (subcommand === "reset") {
      const scope = interaction.options.getString("scope", true);
      const verified = await getVerifiedProfile(interaction.user.id);
      const isHighCommand = canManageBot(verified?.profile, interaction.member);
      const tierWeight = divisionTierWeight(verified?.profile?.divisions?.[scope] || "none");
      const canReset = isHighCommand || tierWeight >= 4 || checkResourceWriteAccess(verified?.profile, { division: scope, resourceType: "report" })?.authorized;

      if (!canReset) {
        await interaction.reply(ephemeral({ embeds: [errorEmbed(`You do not have clearance to reset clock times for ${scopeLabel(scope)}.`)] }));
        return true;
      }
      const user = interaction.options.getUser("user");
      const user2 = interaction.options.getUser("user2");
      const user3 = interaction.options.getUser("user3");
      const usersToWipe = [user, user2, user3].filter(Boolean);

      let query = supabase.from("clock_shifts").delete();
      if (usersToWipe.length > 0) {
        query = query.in("discord_user_id", usersToWipe.map(u => u.id));
      } else {
        query = query.eq("scope", scope);
      }

      const { error } = await query;
      if (error) throw error;

      await interaction.reply(ephemeral({
        embeds: [successEmbed("Clock Time Reset", usersToWipe.length > 0 ? `Reset clock time for ${usersToWipe.map(u => `<@${u.id}>`).join(", ")}.` : `Reset all clock time for scope ${scopeLabel(scope)}.`)]
      }));
      return true;
    }

    if (subcommand === "time") {
      const type = interaction.options.getString("type", true);
      const target = interaction.options.getUser("user", true);
      const explicitMinutes = interaction.options.getInteger("minutes");

      const decision = await canAdjustTarget(interaction, target);
      if (!decision.allowed) {
        await interaction.reply(ephemeral({ embeds: [errorEmbed(decision.reason)] }));
        return true;
      }

      if (explicitMinutes !== null && explicitMinutes !== undefined) {
        const minutes = Math.max(0, explicitMinutes);
        const shift = await adjustShiftTime(target, type === "add" ? minutes : -minutes);
        const totals = await shiftTotals(target.id);

        await interaction.reply(ephemeral({ embeds: [successEmbed("Time Adjusted", `${type === "add" ? "Added" : "Removed"} ${minutes} minute(s) ${target.id === interaction.user.id ? "from your total time" : `for <@${target.id}>`}.\nNew total time: ${formatDuration(totals.totalSeconds)}.`)] }));
        if (minutes > 0) {
          await postActivityLog(interaction.client, {
            title: type === "add" ? "Time Added" : "Time Removed",
            description: `<@${interaction.user.id}> ${type === "add" ? "added time to" : "removed time from"} ${target.id === interaction.user.id ? "their own total time" : `<@${target.id}>'s total time`}.`,
            channelKey: shift.scope === "darkCouncil" ? "highCommandLog" : "activityLog",
            fields: [
              { name: "Scope", value: scopeLabel(shift.scope), inline: true },
              { name: "Amount", value: formatDuration(minutes * 60), inline: true },
              { name: "New Total Time", value: formatDuration(totals.totalSeconds), inline: true }
            ]
          });
        }
      } else {
        await interaction.showModal(textModal(`timeadjust:${type}:${target.id}`, `${type === "add" ? "Add" : "Remove"} Time`, [{ id: "minutes", label: "How many minutes?", placeholder: "10" }]));
      }
      return true;
    }

    if (subcommand === "view") {
      const user = interaction.options.getUser("user", false);
      const scope = interaction.options.getString("scope", false);
      if (user && scope) await interaction.reply(ephemeral({ embeds: [errorEmbed("Choose either a user or a scope, not both.")] }));
      else if (scope) await replyScopeLeaderboard(interaction, scope);
      else await replyUserTime(interaction, user || interaction.user);
      return true;
    }
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
      const targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
      const shift = await adjustShiftTime(targetUser || targetId, action === "add" ? minutes : -minutes);
      const totals = await shiftTotals(targetId);
      
      await interaction.reply(ephemeral({ embeds: [successEmbed("Time Adjusted", `${action === "add" ? "Added" : "Removed"} ${minutes} minute(s) ${targetId === interaction.user.id ? "from your total time" : `for <@${targetId}>`}.\nNew total time: ${formatDuration(totals.totalSeconds)}.`)] }));
      if (minutes > 0) {
        await postActivityLog(interaction.client, {
          title: action === "add" ? "Time Added" : "Time Removed",
          description: `<@${interaction.user.id}> ${action === "add" ? "added time to" : "removed time from"} ${targetId === interaction.user.id ? "their own total time" : `<@${targetId}>'s total time`}.`,
          channelKey: shift.scope === "darkCouncil" ? "highCommandLog" : "activityLog",
          fields: [
            { name: "Scope", value: scopeLabel(shift.scope), inline: true },
            { name: "Amount", value: formatDuration(minutes * 60), inline: true },
            { name: "New Total Time", value: formatDuration(totals.totalSeconds), inline: true }
          ]
        });
      }
    } catch (error) {
      await replyClockError(interaction, error);
    }
    return true;
  }

  if (!interaction.customId.startsWith("clockmodal:")) return false;
  const [, action, scope, targetId] = interaction.customId.split(":");
  const minutes = Math.max(0, Number(interaction.fields.getTextInputValue("minutes")) || 0);
  const targetUser = targetId ? await interaction.client.users.fetch(targetId).catch(() => null) : null;
  try {
    if (action === "in") await doClockIn(interaction, { scope: scope === "auto" ? "" : scope, late: true, lateMinutes: minutes }, targetUser);
    if (action === "out") await doClockOut(interaction, { late: true, lateMinutes: minutes }, targetUser);
  } catch (error) {
    await replyClockError(interaction, error);
  }
  return true;
}
