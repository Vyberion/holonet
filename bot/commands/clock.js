import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { activeShift, adjustShiftTime, clockIn, clockOut, formatDuration, saveClockPanel, shiftTotals } from "../services/clock.js";
import { embed, ephemeral, errorEmbed, successEmbed, textModal } from "../services/discord-ui.js";
import { canAdjustTime, canManageBot, getVerifiedProfile, inferScope } from "../services/roles.js";
import { supabase } from "../services/supabase.js";

const VERIFY_INSTRUCTIONS = "You are not linked yet. Go to <#1046452180074381403> and click the verify button, or use `/verify`.";

export const commands = [
  new SlashCommandBuilder()
    .setName("clockin")
    .setDescription("Start a shift")
    .addBooleanOption(option => option.setName("late").setDescription("Clock in late")),
  new SlashCommandBuilder()
    .setName("clockout")
    .setDescription("End your active shift")
    .addBooleanOption(option => option.setName("late").setDescription("Clock out late")),
  new SlashCommandBuilder().setName("shift").setDescription("Show your active shift"),
  new SlashCommandBuilder()
    .setName("clockpanel")
    .setDescription("Clock panel tools")
    .addSubcommand(subcommand => subcommand
      .setName("create")
      .setDescription("Create a clock panel")
      .addStringOption(option => option.setName("scope").setDescription("Clock scope").setRequired(true)
        .addChoices(
          { name: "Reavers", value: "reavers" },
          { name: "DHG", value: "dhg" },
          { name: "Inquisitors", value: "inquisitors" },
          { name: "Dread Masters", value: "dreadmasters" },
          { name: "High Ranks", value: "highranks" },
          { name: "Dark Council", value: "darkCouncil" }
        ))),
  new SlashCommandBuilder()
    .setName("shifts")
    .setDescription("Shift reports")
    .addSubcommand(subcommand => subcommand.setName("active").setDescription("Show active shifts"))
    .addSubcommand(subcommand => subcommand
      .setName("weekly")
      .setDescription("Show this week's shifts")
      .addStringOption(option => addScopeChoices(option.setName("scope").setDescription("Clock scope").setRequired(true))))
    .addSubcommand(subcommand => subcommand.setName("user").setDescription("Show a user's shifts").addUserOption(option => option.setName("user").setDescription("User").setRequired(true))),
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add time")
    .addSubcommand(subcommand => subcommand
      .setName("time")
      .setDescription("Add minutes to a shift")
      .addUserOption(option => option.setName("user").setDescription("User to adjust"))),
  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove time")
    .addSubcommand(subcommand => subcommand
      .setName("time")
      .setDescription("Remove minutes from a shift")
      .addUserOption(option => option.setName("user").setDescription("User to adjust")))
];

function addScopeChoices(option) {
  return option.addChoices(
    { name: "Reavers", value: "reavers" },
    { name: "DHG", value: "dhg" },
    { name: "Inquisitors", value: "inquisitors" },
    { name: "Dread Masters", value: "dreadmasters" },
    { name: "High Ranks", value: "highranks" },
    { name: "Dark Council", value: "darkCouncil" }
  );
}

function panelRow(scope) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`clock:in:${scope}:0`).setLabel("Clock In").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`clock:in:${scope}:1`).setLabel("Clock In Late").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`clock:out:${scope}:0`).setLabel("Clock Out").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`clock:out:${scope}:1`).setLabel("Clock Out Late").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`clock:shift:${scope}:0`).setLabel("My Shift").setStyle(ButtonStyle.Primary)
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

async function requireManager(interaction) {
  const verified = await getVerifiedProfile(interaction.user.id);
  return canManageBot(verified?.profile, interaction.member);
}

async function doClockIn(interaction, options = {}) {
  const shift = await clockIn(interaction.user.id, options);
  await interaction.reply(ephemeral({ embeds: [successEmbed("Clocked In", `Scope: ${shift.scope}${shift.late ? `\nLate: ${shift.late_minutes || 0} minutes` : ""}`)] }));
}

async function doClockOut(interaction, options = {}) {
  const shift = await clockOut(interaction.user.id, options);
  const total = Number(shift.duration_seconds || 0) + Number(shift.adjustment_seconds || 0);
  await interaction.reply(ephemeral({ embeds: [successEmbed("Clocked Out", `Duration: ${formatDuration(total)}${shift.adjustment_seconds ? `\nAdjustment: ${formatDuration(Math.abs(shift.adjustment_seconds))} ${shift.adjustment_seconds > 0 ? "added" : "removed"}` : ""}${shift.clockout_late ? `\nLate clock-out: ${shift.clockout_late_minutes || 0} minutes` : ""}`)] }));
}

function clockErrorMessage(error) {
  return error?.message === "DISCORD_NOT_LINKED" ? VERIFY_INSTRUCTIONS : error?.message || "Unexpected clock error.";
}

async function replyClockError(interaction, error) {
  await interaction.reply(ephemeral({ embeds: [errorEmbed(clockErrorMessage(error))] }));
}

async function replyShiftSummary(interaction) {
  const [shift, totals] = await Promise.all([
    activeShift(interaction.user.id),
    shiftTotals(interaction.user.id)
  ]);
  const activeText = shift
    ? `Current Shift: ${shift.scope}, started <t:${Math.floor(new Date(shift.started_at).getTime() / 1000)}:R>`
    : "Current Shift: none";
  const adjustmentText = totals.adjustmentSeconds
    ? `\nAdjustments: ${totals.adjustmentSeconds >= 0 ? "+" : "-"}${formatDuration(Math.abs(totals.adjustmentSeconds))}`
    : "";

  await interaction.reply(ephemeral({
    embeds: [embed("Shift Time", `${activeText}\nTotal Time: ${formatDuration(totals.totalSeconds)}${adjustmentText}`)]
  }));
}

async function canAdjustTarget(interaction, targetUser) {
  if (targetUser.id === interaction.user.id) return { allowed: true };

  const [actor, target] = await Promise.all([
    getVerifiedProfile(interaction.user.id),
    getVerifiedProfile(targetUser.id)
  ]);
  if (!actor || !target) return { allowed: false, reason: "Both users must be linked." };

  const targetScope = inferScope(target.profile);
  if (!targetScope) return { allowed: false, reason: "Target user has no clock scope." };

  return canAdjustTime(actor.profile, target.profile, targetScope, false)
    ? { allowed: true }
    : { allowed: false, reason: "You do not have clearance to adjust that user's time." };
}

export async function handleCommand(interaction) {
  const commandName = interaction.commandName;
  const subcommand = interaction.options?.getSubcommand(false) || "";

  if (interaction.commandName === "clockin") {
    if (interaction.options.getBoolean("late")) {
      await interaction.showModal(textModal("clockmodal:in:auto", "Late Clock-In", [{ id: "minutes", label: "How late are you? (minutes)", placeholder: "10" }]));
    } else {
      try { await doClockIn(interaction); } catch (error) { await replyClockError(interaction, error); }
    }
    return true;
  }

  if (interaction.commandName === "clockout") {
    if (interaction.options.getBoolean("late")) {
      await interaction.showModal(textModal("clockmodal:out:auto", "Late Clock-Out", [{ id: "minutes", label: "How late is this clock-out? (minutes)", placeholder: "10" }]));
    } else {
      try { await doClockOut(interaction); } catch (error) { await replyClockError(interaction, error); }
    }
    return true;
  }

  if (interaction.commandName === "shift") {
    await replyShiftSummary(interaction);
    return true;
  }

  if (interaction.commandName === "clockpanel") {
    if (!(await requireManager(interaction))) {
      await interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have clearance to create clock panels.")] }));
      return true;
    }
    const scope = interaction.options.getString("scope", true);
    const message = await interaction.channel.send({
      embeds: [embed(`${scopeLabel(scope)} Clock Panel`, "Use the buttons below to clock in, clock in late, clock out, clock out late or check your current shift.")],
      components: [panelRow(scope)]
    });
    await saveClockPanel({ scope, channelId: message.channelId, messageId: message.id, createdBy: interaction.user.id });
    await interaction.reply(ephemeral({ embeds: [successEmbed("Clock Panel Created", `Scope: ${scope}`)] }));
    return true;
  }

  if (
    ((commandName === "add" || commandName === "remove") && (!subcommand || subcommand === "time")) ||
    commandName === "addtime" ||
    commandName === "removetime"
  ) {
    const action = commandName === "remove" || commandName === "removetime" ? "remove" : "add";
    const target = interaction.options.getUser("user") || interaction.user;
    const decision = await canAdjustTarget(interaction, target);
    if (!decision.allowed) {
      await interaction.reply(ephemeral({ embeds: [errorEmbed(decision.reason)] }));
      return true;
    }
    await interaction.showModal(textModal(`timeadjust:${action}:${target.id}`, `${action === "add" ? "Add" : "Remove"} Time`, [
      { id: "minutes", label: "How many minutes?", placeholder: "10" }
    ]));
    return true;
  }

  if (interaction.commandName === "shifts") {
    if (!(await requireManager(interaction))) {
      await interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have clearance to view shift reports.")] }));
      return true;
    }
    const sub = interaction.options.getSubcommand();
    let query = supabase.from("clock_shifts").select("*").order("started_at", { ascending: false }).limit(10);
    if (sub === "active") query = query.eq("status", "active");
    if (sub === "user") query = query.eq("discord_user_id", interaction.options.getUser("user", true).id);
    if (sub === "weekly") {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const scope = interaction.options.getString("scope", true);
      query = query.gte("started_at", since).eq("scope", scope);
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
  if (!interaction.customId.startsWith("clock:")) return false;
  const [, action, scope, late] = interaction.customId.split(":");
  if (action === "shift") {
    await replyShiftSummary(interaction);
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
    const signedMinutes = action === "add" ? minutes : -minutes;
    try {
      const shift = await adjustShiftTime(targetId, signedMinutes);
      const shiftTotal = Math.max(0, Number(shift.duration_seconds || 0) + Number(shift.adjustment_seconds || 0));
      await interaction.reply(ephemeral({ embeds: [successEmbed("Time Adjusted", `${action === "add" ? "Added" : "Removed"} ${minutes} minute(s) ${targetId === interaction.user.id ? "from your shift" : `for <@${targetId}>`}.\nShift total: ${formatDuration(shiftTotal)}.`)] }));
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
