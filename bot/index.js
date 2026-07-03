import { ActivityType, Client, GatewayIntentBits, Partials } from "discord.js";
import { config, requireEnv } from "./config/index.js";
import { routeInteraction } from "./commands/index.js";
import { botErrorPayload } from "./services/bot-errors.js";
import { ephemeral, errorEmbed } from "./services/discord-ui.js";
import { syncClockPanels } from "./services/clock-panels.js";
import { startShiftReminderLoop } from "./services/shift-reminders.js";

const holonetPresence = {
  status: "online",
  activities: [{ name: "Torreto do his Hell Jacks", type: ActivityType.Watching }]
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.GuildMember],
  presence: holonetPresence
});

let lastCheekyResponseAt = 0;

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function maybeSendCheekyResponse(message) {
  const responder = config.cheekyResponder;
  if (!responder?.enabled) return;
  if (message.author?.bot) return;
  if (message.channelId !== responder.channelId) return;

  const now = Date.now();
  if (now - lastCheekyResponseAt < responder.cooldownMs) return;
  if (Math.random() >= responder.chance) return;

  const phrase = pickRandom(responder.phrases || []);
  if (!phrase || !message.channel?.send) return;

  lastCheekyResponseAt = now;
  await message.channel.send(phrase);
}

async function syncStoredClockPanels() {
  try {
    const result = await syncClockPanels(client);
    console.log(`Clock panel sync checked ${result.checked} panel(s), updated ${result.updated}, failed ${result.failed}.`);
  } catch (error) {
    console.error("Clock panel sync failed", error);
  }
}

client.once("clientReady", () => {
  console.log(`Holonet bot online as ${client.user.tag}`);
  client.user.setPresence({
    status: "online",
    activities: [{ name: "Sith Temple on Korriban", type: ActivityType.Playing }]
  });
  syncStoredClockPanels();
  startShiftReminderLoop(client);
});

client.on("interactionCreate", async interaction => {
  try {
    const handled = await routeInteraction(interaction);
    if (!handled && interaction.isRepliable()) {
      const subcommand = interaction.isChatInputCommand?.() ? interaction.options?.getSubcommand(false) : "";
      const detail = interaction.commandName
        ? `Unknown bot interaction: /${interaction.commandName}${subcommand ? ` ${subcommand}` : ""}.`
        : `Unknown bot interaction: ${interaction.customId || interaction.type}.`;
      await interaction.reply(ephemeral({ embeds: [errorEmbed(detail)] }));
    }
  } catch (error) {
    console.error(error);
    if (interaction.isRepliable()) {
      const payload = botErrorPayload(error, { interaction, fallback: "Unexpected bot error." });
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
  }
});

client.on("messageCreate", async message => {
  try {
    await maybeSendCheekyResponse(message);
  } catch (error) {
    console.error("Cheeky responder failed", error);
  }
});

const tokenEnvName = ["DISCORD", "TOKEN"].join("_");
await client.login(requireEnv(tokenEnvName));
