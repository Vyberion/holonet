import { SlashCommandBuilder } from "discord.js";
import { botErrorPayload } from "../services/bot-errors.js";
import { ephemeral, successEmbed } from "../services/discord-ui.js";
import { postVerificationLog } from "../services/activity-log.js";
import { canUpdateMemberRoles, getVerifiedProfile, syncMemberRoles } from "../services/roles.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("role")
    .setDescription("Manage and update Roblox role sync")
    .addSubcommand(subcommand =>
      subcommand
        .setName("get")
        .setDescription("Re-check your Roblox ranks and update your Discord roles")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("update")
        .setDescription("Re-check Roblox ranks and update Discord roles for a target user")
        .addUserOption(option =>
          option.setName("user").setDescription("Discord user").setRequired(false)
        )
    )
];

export async function handleCommand(interaction) {
  if (interaction.commandName !== "role") return false;

  const subcommand = interaction.options.getSubcommand(false);

  if (subcommand === "get") {
    try {
      const result = await syncMemberRoles(interaction.member, interaction.user.id);
      await interaction.reply({
        embeds: [successEmbed("Roles Updated", `Updated your roles. Added ${result.added.length} role(s), removed ${result.removed.length} role(s).${result.nickname ? `\nNickname: ${result.nicknameUpdated ? result.nickname : `${result.nickname} (unchanged or not manageable)`}` : ""}`)]
      });
      await postVerificationLog(interaction.client, {
        title: "Roles Updated",
        description: `<@${interaction.user.id}> used /role get.`,
        fields: [
          { name: "Added", value: String(result.added.length), inline: true },
          { name: "Removed", value: String(result.removed.length), inline: true },
          result.nickname ? { name: "Nickname", value: result.nicknameUpdated ? result.nickname : `${result.nickname} (unchanged or not manageable)`, inline: false } : null
        ].filter(Boolean)
      });
    } catch (error) {
      await interaction.reply(botErrorPayload(error, { interaction, fallback: "Role update failed." }));
    }
    return true;
  }

  if (subcommand === "update") {
    try {
      const targetUser = interaction.options.getUser("user") || interaction.user;
      const verified = await getVerifiedProfile(interaction.user.id);

      if (targetUser.id !== interaction.user.id && !canUpdateMemberRoles(verified?.profile, interaction.member)) {
        await interaction.reply(ephemeral({ embeds: [successEmbed("Permission Denied", "You do not have permission to update roles for other users.")] }));
        return true;
      }

      const targetMember = targetUser.id === interaction.user.id
        ? interaction.member
        : await interaction.guild.members.fetch(targetUser.id);

      const result = await syncMemberRoles(targetMember, targetUser.id);

      await interaction.reply(ephemeral({
        embeds: [successEmbed("Roles Updated", `Updated roles for <@${targetUser.id}>. Added ${result.added.length} role(s), removed ${result.removed.length} role(s).${result.nickname ? `\nNickname: ${result.nicknameUpdated ? result.nickname : `${result.nickname} (unchanged or not manageable)`}` : ""}`)]
      }));

      await postVerificationLog(interaction.client, {
        title: "User Roles Updated",
        description: `<@${interaction.user.id}> updated roles for <@${targetUser.id}>.`,
        fields: [
          { name: "Updated User", value: `<@${targetUser.id}>`, inline: true },
          { name: "Updated By", value: `<@${interaction.user.id}>`, inline: true },
          { name: "Added", value: String(result.added.length), inline: true },
          { name: "Removed", value: String(result.removed.length), inline: true }
        ]
      });
    } catch (error) {
      await interaction.reply(botErrorPayload(error, { interaction, fallback: "Role update failed." }));
    }
    return true;
  }

  return false;
}
