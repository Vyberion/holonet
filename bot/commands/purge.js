import { SlashCommandBuilder } from "discord.js";
import { ephemeral, errorEmbed, successEmbed } from "../services/discord-ui.js";
import { canManageBot, getVerifiedProfile } from "../services/roles.js";

const DEFAULT_DELETE_COUNT = 1;
const MAX_DELETE_COUNT = 100;
const FETCH_BATCH_SIZE = 100;
const MAX_FETCH_BATCHES = 10;

export const commands = [
  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete recent Holonet bot messages")
    .addIntegerOption(option => option
      .setName("number")
      .setDescription("Number of bot messages to delete")
      .setMinValue(1)
      .setMaxValue(MAX_DELETE_COUNT)
      .setRequired(false))
];

async function requireManager(interaction) {
  const verified = await getVerifiedProfile(interaction.user.id).catch(() => null);
  return canManageBot(verified?.profile, interaction.member);
}

async function collectBotMessages(channel, botUserId, wantedCount) {
  const messages = [];
  let before;

  for (let batch = 0; messages.length < wantedCount && batch < MAX_FETCH_BATCHES; batch += 1) {
    const fetched = await channel.messages.fetch({ limit: FETCH_BATCH_SIZE, before });
    if (!fetched.size) break;

    for (const message of fetched.values()) {
      if (message.author?.id === botUserId) {
        messages.push(message);
        if (messages.length >= wantedCount) break;
      }
    }

    before = fetched.last()?.id;
    if (!before || fetched.size < FETCH_BATCH_SIZE) break;
  }

  return messages;
}

async function deleteMessages(messages) {
  let deleted = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      await message.delete();
      deleted += 1;
    } catch (error) {
      failed += 1;
      console.warn("Failed to purge bot message", {
        channelId: message.channelId,
        messageId: message.id,
        reason: error?.message || String(error)
      });
    }
  }

  return { deleted, failed };
}

export async function handleCommand(interaction) {
  if (interaction.commandName !== "purge") return false;

  if (!(await requireManager(interaction))) {
    await interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have clearance to purge bot messages.")] }));
    return true;
  }

  if (!interaction.channel?.messages?.fetch) {
    await interaction.reply(ephemeral({ embeds: [errorEmbed("This channel does not support message purging.")] }));
    return true;
  }

  const requestedCount = interaction.options.getInteger("number", false) || DEFAULT_DELETE_COUNT;
  await interaction.deferReply(ephemeral());

  const messages = await collectBotMessages(interaction.channel, interaction.client.user.id, requestedCount);
  const result = await deleteMessages(messages);
  const skippedText = result.failed ? ` ${result.failed} bot message(s) could not be deleted.` : "";

  await interaction.editReply({
    embeds: [successEmbed("Purge Complete", `Deleted ${result.deleted} bot message(s).${skippedText}`)]
  });
  return true;
}
