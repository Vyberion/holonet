import { SlashCommandBuilder } from "discord.js";
import { botErrorPayload } from "../services/bot-errors.js";
import { ephemeral, successEmbed } from "../services/discord-ui.js";
import { syncMemberRoles } from "../services/roles.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("getroles")
    .setDescription("Re-check your Roblox ranks and update your Discord roles")
];

export async function handleCommand(interaction) {
  if (interaction.commandName !== "getroles") return false;

  try {
    const result = await syncMemberRoles(interaction.member, interaction.user.id);
    await interaction.reply(ephemeral({
      embeds: [successEmbed("Roles Updated", `Updated your roles. Added ${result.added.length} role(s), removed ${result.removed.length} role(s).${result.nickname ? `\nNickname: ${result.nicknameUpdated ? result.nickname : `${result.nickname} (unchanged or not manageable)`}` : ""}`)]
    }));
  } catch (error) {
    await interaction.reply(botErrorPayload(error, { interaction, fallback: "Role update failed." }));
  }

  return true;
}
