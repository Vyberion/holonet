import { SlashCommandBuilder } from "discord.js";
import { config } from "../config/index.js";
import { botErrorPayload } from "../services/bot-errors.js";
import { embed, ephemeral, errorEmbed, componentsV2Message, containerV2, sectionV2, textDisplayV2, separatorV2 } from "../services/discord-ui.js";
import { loadGroupRoles, loadRobloxUser, loadRobloxAvatarBust } from "../services/roblox.js";
import { supabase } from "../services/supabase.js";
import { ROBLOX_GROUPS } from "../../modules/auth/roblox-groups.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("lookup")
    .setDescription("Look up a linked Discord or Roblox user")
    .addUserOption(option => option.setName("user").setDescription("Discord user").setRequired(false))
    .addStringOption(option => option.setName("roblox").setDescription("Roblox username or user ID").setRequired(false))
];

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
  return `${config.holonet.baseUrl.replace(/\/$/, "")}/lookup?username=${encodeURIComponent(username)}`;
}

async function loadLinkByDiscordUserId(discordUserId) {
  const { data, error } = await supabase
    .from("verification_links")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function loadLinkByRobloxUserId(robloxUserId) {
  const { data, error } = await supabase
    .from("verification_links")
    .select("*")
    .eq("roblox_user_id", robloxUserId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function loadRobloxUserByInput(value) {
  const query = String(value || "").trim().replace(/^@/, "");
  if (!query) return null;
  if (/^\d+$/.test(query)) return loadRobloxUser(query).catch(() => null);

  const response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [query], excludeBannedUsers: false })
  });

  if (!response.ok) throw new Error("ROBLOX_USER_LOOKUP_FAILED");

  const payload = await response.json();
  const match = payload.data?.find(item => item?.name?.toLowerCase() === query.toLowerCase()) || payload.data?.[0];
  return match?.id ? loadRobloxUser(match.id).catch(() => match) : null;
}

async function replyLookup(interaction, { discordUser, link, robloxUser }) {
  const containers = [];

  // Roblox Container
  const robloxUserId = robloxUser?.id || link?.roblox_user_id;
  if (!robloxUserId) {
    containers.push(containerV2([
      sectionV2(null, [textDisplayV2(`# Roblox Information\n*Not linked to any Roblox account.*`)])
    ]));
  } else {
    const [groupRoles, loadedRobloxUser, avatarBustUrl] = await Promise.all([
      loadGroupRoles(robloxUserId),
      robloxUser?.name ? robloxUser : loadRobloxUser(robloxUserId).catch(() => robloxUser),
      loadRobloxAvatarBust(robloxUserId)
    ]);

    if (!loadedRobloxUser) {
      containers.push(containerV2([
        sectionV2(null, [textDisplayV2(`# Roblox Information\n*Failed to load Roblox account (${robloxUserId}).*`)])
      ]));
    } else {
      const username = loadedRobloxUser.name || loadedRobloxUser.displayName || link?.roblox_user_id || loadedRobloxUser.id;
      const displayName = loadedRobloxUser.displayName || loadedRobloxUser.name || username;

      const mainGroup = membershipFor(groupRoles, ROBLOX_GROUPS.HIGH_RANKS.groupId);
      const divisionLines = Object.entries(ROBLOX_GROUPS.DIVISIONS)
        .map(([key, definition]) => {
          const membership = membershipFor(groupRoles, definition.groupId);
          return membership ? `\\- ${divisionLabel(key)}: ${membership.role?.name || "Unknown"} (${membership.role?.rank || 0})` : "";
        })
        .filter(Boolean);

      const robloxUnixTimestamp = loadedRobloxUser.created ? Math.floor(new Date(loadedRobloxUser.created).getTime() / 1000) : 0;

      const robloxText = `**[${displayName}](${lookupUrl(username)}) (${robloxUserId})**\n## Roblox Information\n**@${username}**\nAccount Created: ${robloxUnixTimestamp ? `<t:${robloxUnixTimestamp}:F>` : "Unknown"}\nMain Group: ${mainGroup ? `${mainGroup.role?.name || "Unknown"} (${mainGroup.role?.rank || 0})` : "Not in group"}${divisionLines.length ? `\nDivisions:\n${divisionLines.join("\n")}` : ""}`;

      containers.push(containerV2([
        sectionV2(avatarBustUrl, [textDisplayV2(robloxText)]),
        separatorV2(),
        textDisplayV2(`## Description\n${loadedRobloxUser.description || "*No description*"}`)
      ]));
    }
  }

  // Discord Container
  let discordUserInfo = discordUser;
  if (!discordUserInfo && link?.discord_user_id) {
    try {
      discordUserInfo = await interaction.client.users.fetch(link.discord_user_id);
    } catch (e) { }
  }

  if (!discordUserInfo) {
    containers.push(containerV2([
      sectionV2(null, [textDisplayV2(`## Discord Information\n*Not linked to any Discord account.*`)])
    ]));
  } else {
    const discordUnixTimestamp = Math.floor(discordUserInfo.createdTimestamp / 1000);
    const discordAvatarUrl = discordUserInfo.displayAvatarURL({ size: 4096 });

    containers.push(containerV2([
      sectionV2(discordAvatarUrl, [
        textDisplayV2(`## Discord Information\n**<@${discordUserInfo.id}>**\nAccount Created: <t:${discordUnixTimestamp}:F>`)
      ])
    ]));
  }

  await interaction.reply(componentsV2Message(containers));
}

export async function handleCommand(interaction) {
  if (interaction.commandName !== "lookup") return false;

  try {
    const discordUser = interaction.options.getUser("user", false);
    const robloxInput = interaction.options.getString("roblox", false);

    if ((discordUser && robloxInput) || (!discordUser && !robloxInput)) {
      await interaction.reply({ embeds: [errorEmbed("Choose either a Discord user or a Roblox username/ID.")] });
      return true;
    }

    if (discordUser) {
      const link = await loadLinkByDiscordUserId(discordUser.id);
      await replyLookup(interaction, { discordUser, link, robloxUser: null });
      return true;
    }

    const robloxUser = await loadRobloxUserByInput(robloxInput);
    if (!robloxUser?.id) {
      await interaction.reply({ embeds: [errorEmbed("That Roblox user was not found.")] });
      return true;
    }

    const link = await loadLinkByRobloxUserId(robloxUser.id);
    await replyLookup(interaction, { discordUser: null, link, robloxUser });
  } catch (error) {
    await interaction.reply(botErrorPayload(error, { interaction, fallback: "Lookup failed." }));
  }

  return true;
}
