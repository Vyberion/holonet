import { ActivityType, Client, GatewayIntentBits, MessageFlags, Partials } from "discord.js";
import { config, requireEnv } from "./config/index.js";
import { routeInteraction } from "./commands/index.js";
import { botErrorPayload } from "./services/bot-errors.js";
import { ephemeral, errorEmbed } from "./services/discord-ui.js";
import { syncClockPanels } from "./services/clock-panels.js";
import { startShiftReminderLoop } from "./services/shift-reminders.js";
import { syncStoredPowerbaseRosters } from "./services/powerbase-api.js";
import { registerRoleConnectionMetadata } from "./services/discord-linked-roles.js";

``` const holonetPresence = {
  status: "dnd",
  activities: [
    {
      name: "Custom Status",
      state: "well",
      type: ActivityType.Custom
    }
  ]
};```

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

async function syncPowerbaseRostersOnStartup() {
  try {
    const result = await syncStoredPowerbaseRosters(client);
    console.log(`Powerbase roster sync checked ${result.checked} powerbase(s), synced ${result.synced}.`);
  } catch (error) {
    console.error("Powerbase roster sync failed", error);
  }
}

client.once("clientReady", () => {
  console.log(`Holonet bot online as ${client.user.tag}`);
  client.user.setPresence(holonetPresence);
  syncStoredClockPanels();
  syncPowerbaseRostersOnStartup();
  startShiftReminderLoop(client);
  registerRoleConnectionMetadata().catch(err => {
    console.warn("Linked role metadata registration on startup warning:", err?.message || err);
  });
});

client.on("interactionCreate", async interaction => {
  try {
    const isAppContextMenu = interaction.isMessageContextMenuCommand?.() || interaction.isUserContextMenuCommand?.();
    const isButton = interaction.isButton?.();

    if (isAppContextMenu || isButton) {
      const originalReply = interaction.reply.bind(interaction);
      interaction.reply = async (options) => {
        if (typeof options === "string") options = { content: options };
        const flags = (options?.flags || 0) | MessageFlags.Ephemeral;
        return originalReply({ ...options, flags });
      };

      const originalDeferReply = interaction.deferReply.bind(interaction);
      interaction.deferReply = async (options = {}) => {
        const flags = (options?.flags || 0) | MessageFlags.Ephemeral;
        return originalDeferReply({ ...options, flags });
      };

      const originalFollowUp = interaction.followUp.bind(interaction);
      interaction.followUp = async (options) => {
        if (typeof options === "string") options = { content: options };
        const flags = (options?.flags || 0) | MessageFlags.Ephemeral;
        return originalFollowUp({ ...options, flags });
      };
    }

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
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => { });
      else await interaction.reply(payload).catch(() => { });
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

client.on("guildMemberAdd", async member => {
  try {
    const unverifiedRoleId = "1340850135680155674";
    await member.roles.add(unverifiedRoleId, "Immediate unverified assignment on join").catch(err => {
      console.error("Failed to immediately assign unverified role", err);
    });

    const { syncMemberRoles } = await import("./services/roles.js");
    syncMemberRoles(member, client.user.id).catch(error => {
      console.error("Failed to sync new member roles in background", error);
    });
  } catch (error) {
    console.error("Failed to handle new member join", error);
  }
});

const tokenEnvName = ["DISCORD", "TOKEN"].join("_");
await client.login(requireEnv(tokenEnvName));
