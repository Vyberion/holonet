import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { config } from "../config/index.js";
import { ephemeral, errorEmbed, successEmbed, embed } from "../services/discord-ui.js";
import { canManageBot, getVerifiedProfile } from "../services/roles.js";
import { saveClockPanel } from "../services/clock.js";

const SCOPE_CHOICES = [
  { name: "Reavers", value: "reavers" },
  { name: "DHG", value: "dhg" },
  { name: "Inquisitors", value: "inquisitors" },
  { name: "Dread Masters", value: "dreadmasters" },
  { name: "High Ranks", value: "highranks" },
  { name: "Dark Council", value: "darkCouncil" }
];

const PANEL_DESCRIPTION = "Use the buttons below to clock in, clock in late, clock out, clock out late, check your current shift or view the leaderboard.";

function scopeLabel(scope) {
  return { reavers: "Reavers", dhg: "DHG", inquisitors: "Inquisitors", dreadmasters: "Dread Masters", highranks: "High Ranks", darkCouncil: "Dark Council", all: "All" }[scope] || scope;
}

function clockPanelRows(scope) {
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

function verifyRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("verify:start").setLabel("Verify").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("verify:update").setLabel("Update Roles").setStyle(ButtonStyle.Secondary)
  );
}

export const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Panel tools for posting interactive UI components")
    .addSubcommand(subcommand =>
      subcommand
        .setName("verification")
        .setDescription("Post the verification panel")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("clockin")
        .setDescription("Post a clock panel for a scope")
        .addStringOption(option =>
          option
            .setName("scope")
            .setDescription("Clock scope")
            .setRequired(true)
            .addChoices(...SCOPE_CHOICES)
        )
    )
];

export async function handleCommand(interaction) {
  if (interaction.commandName !== "panel") return false;

  const subcommand = interaction.options.getSubcommand(false);

  const actor = await getVerifiedProfile(interaction.user.id);
  if (!canManageBot(actor?.profile, interaction.member)) {
    await interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have clearance to manage panels.")] }));
    return true;
  }

  if (subcommand === "verification") {
    const channel = interaction.channel;
    const payload = {
      embeds: [embed("Verification", "Link your Discord account to your Holonet Roblox account by clicking the verify button below.")],
      components: [verifyRow()]
    };
    await channel.send(payload);
    await interaction.reply(ephemeral({ embeds: [successEmbed("Panel Created", "Posted verification panel in this channel.")] }));
    return true;
  }

  if (subcommand === "clockin") {
    const scope = interaction.options.getString("scope", true);
    const channel = interaction.channel;
    const payload = {
      embeds: [embed(`${scopeLabel(scope)} Clock Panel`, PANEL_DESCRIPTION)],
      components: clockPanelRows(scope)
    };
    const message = await channel.send(payload);
    await saveClockPanel(scope, channel.id, message.id, interaction.user.id);
    await interaction.reply(ephemeral({ embeds: [successEmbed("Panel Created", `Posted ${scopeLabel(scope)} clock panel in this channel.`)] }));
    return true;
  }

  return false;
}
