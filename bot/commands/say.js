import { SlashCommandBuilder } from "discord.js";
import { ephemeral } from "../services/discord-ui.js";

const ECHO_USER_IDS = new Set(["710574154226598049", "1467651749815914546"]);

export const commands = [
  new SlashCommandBuilder()
    .setName("echo")
    .setDescription("Send a plain bot message")
    .addStringOption(option => option
      .setName("input")
      .setDescription("Message to send")
      .setRequired(true)
      .setMaxLength(2000))
];

export async function handleCommand(interaction) {
  if (interaction.commandName !== "echo") return false;

  if (!ECHO_USER_IDS.has(String(interaction.user.id))) {
    await interaction.reply(ephemeral({ content: "You do not have clearance to use this command." }));
    return true;
  }

  const content = interaction.options.getString("input", true).trim();
  if (!content) {
    await interaction.reply(ephemeral({ content: "Message cannot be empty." }));
    return true;
  }

  await interaction.channel.send({ content, allowedMentions: { parse: [] } });
  await interaction.reply(ephemeral({ content: "Sent." }));
  return true;
}
