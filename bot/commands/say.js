import { SlashCommandBuilder } from "discord.js";
import { ephemeral } from "../services/discord-ui.js";

const SAY_USER_ID = "1455303713701757138";

export const commands = [
  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Send a plain bot message")
    .addStringOption(option => option
      .setName("input")
      .setDescription("Message to send")
      .setRequired(true)
      .setMaxLength(2000))
];

export async function handleCommand(interaction) {
  if (interaction.commandName !== "say") return false;

  if (String(interaction.user.id) !== SAY_USER_ID) {
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
