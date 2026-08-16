import { ActivityType, Client, GatewayIntentBits, MessageFlags, Partials } from "discord.js";
import { config, requireEnv } from "./config/index.js";
import { routeInteraction } from "./commands/index.js";
import { botErrorPayload } from "./services/bot-errors.js";
import { componentsV2Message, containerV2, ephemeral, errorEmbed, textDisplayV2 } from "./services/discord-ui.js";
import { syncClockPanels } from "./services/clock-panels.js";
import { startShiftReminderLoop } from "./services/shift-reminders.js";
import { syncStoredPowerbaseRosters } from "./services/powerbase-api.js";
import { registerRoleConnectionMetadata } from "./services/discord-linked-roles.js";
import { queryHoloAi } from "./services/ai.js";
import { getVerifiedProfile } from "./services/roles.js";
const OLD_BOT_REDIRECT_CHANNEL_ID = "1046841602519343164";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.GuildMember],
  presence: {
    status: "dnd"
  }
});

let lastCheekyResponseAt = 0;
const OLD_BOT_IDS = new Set(["242385236259405824", "1536841658149376100", "426537812993638400"]);
const LEGACY_TEXT_TRIGGERS = [";getrole", "!getrole", "/getrole", ";verify", "!verify", ";update-roles", "!update-roles"];

async function maybeHandleHoloAiResponse(message) {
  if (message.author?.bot) return;

  const content = message.content || "";
  const isMentioned = Boolean(
    (client.user && message.mentions?.has?.(client.user.id)) ||
    (client.user && content.includes(`<@${client.user.id}>`)) ||
    (client.user && content.includes(`<@!${client.user.id}>`))
  );

  const isExactHoloName = /\bH\.O\.L\.O\b/i.test(content);

  if (!isMentioned && !isExactHoloName) return;

  const verified = await getVerifiedProfile(message.author.id).catch(() => null);
  const isSuperUser = Boolean(verified?.profile?.isSuperUser);

  if (!isSuperUser) return;

  let cleanPrompt = content;
  if (client.user) {
    cleanPrompt = cleanPrompt.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "");
  }
  cleanPrompt = cleanPrompt.replace(/\bH\.O\.L\.O\b/gi, "").trim();

  if (!cleanPrompt) cleanPrompt = "Awaiting command, Overseer.";

  await message.channel.sendTyping().catch(() => { });

  try {
    const verified = await getVerifiedProfile(message.author.id).catch(() => null);
    const aiReply = await queryHoloAi({
      prompt: cleanPrompt,
      userTag: message.author.tag || message.author.username,
      robloxName: verified?.profile?.name || "",
      isSuperUser: true
    });

    await message.reply(aiReply);
  } catch (error) {
    console.error("H.O.L.O AI response failed:", error);
    const errText = String(error?.message || "");
    if (errText.includes("429") || errText.includes("rate_limit")) {
      const secondsMatch = errText.match(/try again in ([\d\.]+\s*s(?:econds)?|[\d\.]+\s*m(?:inutes)?)/i);
      const timeStr = secondsMatch ? secondsMatch[1] : "a few seconds";
      await message.reply(`Transmission rate limit reached. Try again in ${timeStr}.`).catch(() => { });
    } else {
      await message.reply("Holonet sub-processor offline or unavailable.").catch(() => { });
    }
  }
}

async function maybeSendOldBotRedirectNotice(message) {
  if (message.channel?.id !== OLD_BOT_REDIRECT_CHANNEL_ID) return;

  const isOldBotMsg = OLD_BOT_IDS.has(message.author?.id);
  const contentLower = message.content?.toLowerCase() || "";
  const isLegacyUserTrigger =
    !message.author?.bot &&
    LEGACY_TEXT_TRIGGERS.some(trigger => contentLower.startsWith(trigger));

  if (!isOldBotMsg && !isLegacyUserTrigger) return;

  const payload = componentsV2Message([
    containerV2([
      textDisplayV2("### Incorrect Bot"),
      textDisplayV2(
        "Bloxlink is no longer in use. Please use **H.O.L.O** commands to manage your verification & roles:\n\n" +
        "- </verify:0> — Link your Roblox account\n" +
        "- </role get:0> — Sync your Roblox ranks & roles\n" +
        "- </role update:0> — Sync roles for another member"
      )
    ], 0xc90705)
  ]);

  await message.reply(payload).catch(() => {});
}

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
  client.user.setPresence({ status: "dnd" });
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
    await maybeSendOldBotRedirectNotice(message);
    await maybeHandleHoloAiResponse(message);
    await maybeSendCheekyResponse(message);
  } catch (error) {
    console.error("Message handler failed", error);
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
