import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { config } from "../config/index.js";
import { createLinkToken, unlinkDiscordUser } from "../services/verification.js";
import { embed, ephemeral, errorEmbed, successEmbed } from "../services/discord-ui.js";
import { canManageBot, canUpdateMemberRoles, getVerifiedProfile, syncMemberRoles } from "../services/roles.js";
import { loadGroupRoles, loadRobloxUser } from "../services/roblox.js";
import { ROBLOX_GROUPS } from "../../modules/auth/roblox-groups.js";

const DISABLED_COMMANDS = new Set();
const DISABLED_BUTTONS = new Set();

const allCommands = [
  new SlashCommandBuilder()
    .setName("verification")
    .setDescription("Verification tools")
    .addSubcommand(subcommand => subcommand.setName("panel").setDescription("Post the verification panel")),
  new SlashCommandBuilder().setName("verify").setDescription("Link your Discord account to your Holonet Roblox account"),
  new SlashCommandBuilder()
    .setName("update-roles")
    .setDescription("Re-check Roblox ranks and update Discord roles")
    .addUserOption(option => option.setName("user").setDescription("Discord user").setRequired(false)),
  new SlashCommandBuilder()
    .setName("lookup")
    .setDescription("Look up a linked Discord user")
    .addUserOption(option => option.setName("user").setDescription("Discord user").setRequired(true)),
  new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Remove a Discord user's Holonet verification link")
    .addUserOption(option => option.setName("user").setDescription("Discord user").setRequired(true))
];

export const commands = allCommands.filter(command => !DISABLED_COMMANDS.has(command.name));

async function replyDisabled(interaction) {
  await interaction.reply(ephemeral({ embeds: [errorEmbed("This bot feature is currently disabled.")] }));
}

function verifyRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("verify:start").setLabel("Verify").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("verify:update").setLabel("Update Roles").setStyle(ButtonStyle.Secondary)
  );
}

function divisionLabel(key) {
  return {
    reavers: "Reavers",
    dhg: "Dark Honor Guard",
    inquisitors: "Inquisitors",
    dreadmasters: "Dread Masters"
  }[key] || key;
}

function membershipFor(groupRoles, groupId) {
  return groupRoles.find(item => item?.group?.id === groupId) || null;
}

function lookupUrl(username) {
  const base = config.holonet.baseUrl.replace(/\/$/, "");
  return `${base}/lookup?username=${encodeURIComponent(username)}`;
}

async function replyLink(interaction) {
  const link = await createLinkToken(interaction.user);
  await interaction.reply(ephemeral({
    embeds: [embed("Holonet Verification", `Open the Holonet Account page and log in with Roblox to finish linking.\n\n${link.url}`)]
  }));
}

export async function handleCommand(interaction) {
  if (DISABLED_COMMANDS.has(interaction.commandName)) {
    await replyDisabled(interaction);
    return true;
  }

  if (interaction.commandName === "verification") {
    const verified = await getVerifiedProfile(interaction.user.id);
    if (!canManageBot(verified?.profile, interaction.member)) {
      await interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have clearance to post verification panels.")] }));
      return true;
    }

    await interaction.channel.send({
      embeds: [embed("Holonet Verification", "Link your Discord account to your Holonet Roblox account, then sync your roles.")],
      components: [verifyRow()]
    });
    await interaction.reply(ephemeral({ embeds: [successEmbed("Verification Panel Posted", "The verification panel is live.")] }));
    return true;
  }

  if (interaction.commandName === "verify") {
    await replyLink(interaction);
    return true;
  }

  if (interaction.commandName === "update-roles") {
    try {
      const user = interaction.options.getUser("user", false);
      const targetUser = user || interaction.user;
      const sameUser = targetUser.id === interaction.user.id;
      const targetMember = sameUser
        ? interaction.member
        : await interaction.guild.members.fetch(targetUser.id);

      if (!sameUser) {
        const [actor, target] = await Promise.all([
          getVerifiedProfile(interaction.user.id),
          getVerifiedProfile(targetUser.id)
        ]);

        if (!actor) throw new Error("YOUR_DISCORD_NOT_LINKED");

        if (!canUpdateMemberRoles(actor.profile, target?.profile, interaction.member, interaction.user.id)) {
          throw new Error("You do not have clearance to update that user's roles.");
        }
      }

      const result = await syncMemberRoles(targetMember, interaction.user.id);
      const targetLabel = sameUser ? "" : ` for <@${targetUser.id}>`;
      await interaction.reply(ephemeral({ embeds: [successEmbed("Roles Updated", `Updated roles${targetLabel}. Added ${result.added.length} role(s), removed ${result.removed.length} role(s).${result.nickname ? `\nNickname: ${result.nicknameUpdated ? result.nickname : `${result.nickname} (unchanged or not manageable)`}` : ""}`)] }));
    } catch (error) {
      await interaction.reply(ephemeral({ embeds: [errorEmbed(error.message)] }));
    }
    return true;
  }

  if (interaction.commandName === "lookup") {
    const user = interaction.options.getUser("user", true);
    const verified = await getVerifiedProfile(user.id);
    if (!verified) {
      await interaction.reply(ephemeral({ embeds: [errorEmbed("That Discord user is not linked.")] }));
      return true;
    }
    const groupRoles = await loadGroupRoles(verified.link.roblox_user_id);
    const robloxUser = await loadRobloxUser(verified.link.roblox_user_id).catch(() => null);
    const mainGroup = membershipFor(groupRoles, ROBLOX_GROUPS.HIGH_RANKS.groupId);
    const divisionLines = Object.entries(ROBLOX_GROUPS.DIVISIONS)
      .map(([key, definition]) => {
        const membership = membershipFor(groupRoles, definition.groupId);
        return membership ? `${divisionLabel(key)}: ${membership.role?.name || "Unknown"} (${membership.role?.rank || 0})` : "";
      })
      .filter(Boolean);
    const username = robloxUser?.name || robloxUser?.displayName || verified.link.roblox_user_id;

    await interaction.reply(ephemeral({
      embeds: [embed("Holonet Lookup", [
        `Discord: <@${user.id}>`,
        `Roblox: ${username} (${verified.link.roblox_user_id})`,
        `Main Group: ${mainGroup ? `${mainGroup.role?.name || "Unknown"} (${mainGroup.role?.rank || 0})` : "Not in group"}`,
        ...(divisionLines.length ? [`Divisions: ${divisionLines.join(", ")}`] : []),
        `Lookup: ${lookupUrl(username)}`
      ].join("\n"))]
    }));
    return true;
  }

  if (interaction.commandName === "unlink") {
    const actor = await getVerifiedProfile(interaction.user.id);
    if (!canManageBot(actor?.profile, interaction.member)) {
      await interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have clearance to unlink users.")] }));
      return true;
    }
    const user = interaction.options.getUser("user", true);
    await unlinkDiscordUser(user.id, interaction.user.id);
    await interaction.reply(ephemeral({ embeds: [successEmbed("Unlinked", `<@${user.id}> has been unlinked.`)] }));
    return true;
  }

  return false;
}

export async function handleButton(interaction) {
  if (DISABLED_BUTTONS.has(interaction.customId)) {
    await replyDisabled(interaction);
    return true;
  }

  if (interaction.customId === "verify:start") {
    await replyLink(interaction);
    return true;
  }

  if (interaction.customId === "verify:update") {
    try {
      const result = await syncMemberRoles(interaction.member);
      await interaction.reply(ephemeral({ embeds: [successEmbed("Roles Updated", `Added ${result.added.length} role(s), removed ${result.removed.length} role(s).${result.nickname ? `\nNickname: ${result.nicknameUpdated ? result.nickname : `${result.nickname} (unchanged or not manageable)`}` : ""}`)] }));
    } catch (error) {
      await interaction.reply(ephemeral({ embeds: [errorEmbed(error.message)] }));
    }
    return true;
  }

  return false;
}
