import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from "discord.js";
import { config } from "../config/index.js";
import { botErrorPayload } from "../services/bot-errors.js";
import { createLinkToken, isLinkTokenConsumed, unlinkDiscordUser } from "../services/verification.js";
import { embed, ephemeral, errorEmbed, successEmbed } from "../services/discord-ui.js";
import { postVerificationLog } from "../services/activity-log.js";
import { canManageBot, canUpdateMemberRoles, getVerifiedProfile, syncMemberRoles } from "../services/roles.js";
import { loadGroupRoles, loadRobloxProfileSummary, loadRobloxUser, personnelLookupWarnings } from "../services/roblox.js";
import { ROBLOX_GROUPS } from "../../modules/auth/roblox-groups.js";

const DISABLED_COMMANDS = new Set();
const DISABLED_BUTTONS = new Set();
const POST_LINK_ROLE_SYNC_POLL_MS = 5 * 1000;
const POST_LINK_ROLE_SYNC_GRACE_MS = 30 * 1000;
const VERIFICATION_WARNING_COLOR = 0x8f1d2c;
const VERIFICATION_WARNING_ROLE_IDS = [
  "1046451376236003359",
  "1046451364965920848",
  "1302790774458552331"
];
const pendingPostLinkRoleSyncs = new Map();

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
    .addUserOption(option => option.setName("user").setDescription("Discord user").setRequired(false))
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

function roleSyncLogReason(error) {
  return error?.message || error?.rawError?.message || String(error);
}

async function syncLinkedDiscordMemberRoles(client, guildId, discordUserId) {
  const guild = await client.guilds.fetch(guildId);
  const member = await guild.members.fetch({ user: discordUserId, force: true });
  const result = await syncMemberRoles(member, discordUserId);
  const robloxId = result.link?.roblox_user_id || "Unknown";
  const robloxUser = robloxId !== "Unknown" ? await loadRobloxUser(robloxId).catch(() => null) : null;
  const robloxName = robloxUser?.name || robloxUser?.displayName || robloxId;
  const robloxLabel = robloxName && robloxName !== robloxId ? `${robloxName} (${robloxId})` : robloxId;

  console.log(`Post-link role sync updated ${discordUserId}: added ${result.added.length}, removed ${result.removed.length}.`);

  await postVerificationLog(client, {
    title: "User Verified",
    description: `<@${discordUserId}> linked Discord to Roblox.`,
    fields: [
      { name: "Discord", value: `<@${discordUserId}>`, inline: true },
      { name: "Roblox", value: robloxLabel, inline: true },
      { name: "Web Link", value: lookupUrl(robloxName), inline: false }
    ].filter(Boolean)
  });

  const warningSummary = robloxId !== "Unknown"
    ? await loadRobloxProfileSummary(robloxId)
      .then(summary => ({
        ...summary,
        warnings: personnelLookupWarnings(summary)
      }))
      .catch(error => {
        console.warn("Post-link warning lookup failed", {
          discordUserId,
          robloxId,
          reason: roleSyncLogReason(error)
        });
        return null;
      })
    : null;

  if (warningSummary?.warnings?.length) {
    const warningMentions = VERIFICATION_WARNING_ROLE_IDS.map(roleId => `<@&${roleId}>`).join(" ");
    await postVerificationLog(client, {
      title: "Discord Linked to Roblox - Warning",
      description: `<@${discordUserId}> linked Discord to Roblox with personnel lookup warnings.`,
      color: VERIFICATION_WARNING_COLOR,
      content: warningMentions,
      allowedRoleIds: VERIFICATION_WARNING_ROLE_IDS,
      fields: [
        { name: "Discord", value: `<@${discordUserId}>`, inline: true },
        { name: "Roblox", value: robloxLabel, inline: true },
        { name: "Warnings", value: warningSummary.warnings.map(item => `**${item.label}:** ${item.detail}`).join("\n"), inline: false },
        { name: "Web Link", value: lookupUrl(robloxName), inline: false }
      ]
    });
  }
}

function schedulePostLinkRoleSync(interaction, link) {
  const token = link?.token;
  const discordUserId = interaction.user?.id;
  const guildId = interaction.guildId || config.discord?.guildId;
  if (!token || !discordUserId || !guildId) return;

  const key = `${discordUserId}:${token}`;
  const expiresAt = new Date(link.expiresAt).getTime();
  const deadline = Number.isFinite(expiresAt)
    ? expiresAt + POST_LINK_ROLE_SYNC_GRACE_MS
    : Date.now() + 15 * 60 * 1000 + POST_LINK_ROLE_SYNC_GRACE_MS;

  const clearPending = () => {
    const timeout = pendingPostLinkRoleSyncs.get(key);
    if (timeout) clearTimeout(timeout);
    pendingPostLinkRoleSyncs.delete(key);
  };

  const queueCheck = () => {
    const waitMs = Math.min(POST_LINK_ROLE_SYNC_POLL_MS, Math.max(1000, deadline - Date.now()));
    const timeout = setTimeout(checkLinkToken, waitMs);
    pendingPostLinkRoleSyncs.set(key, timeout);
  };

  const checkLinkToken = async () => {
    if (Date.now() > deadline) {
      pendingPostLinkRoleSyncs.delete(key);
      return;
    }

    try {
      if (await isLinkTokenConsumed(token, discordUserId)) {
        pendingPostLinkRoleSyncs.delete(key);
        try {
          await syncLinkedDiscordMemberRoles(interaction.client, guildId, discordUserId);
        } catch (error) {
          console.warn("Post-link role sync failed", {
            discordUserId,
            reason: roleSyncLogReason(error)
          });
        }
        return;
      }
    } catch (error) {
      console.warn("Post-link role sync check failed", {
        discordUserId,
        reason: roleSyncLogReason(error)
      });
    }

    queueCheck();
  };

  clearPending();
  queueCheck();
}

async function replyLink(interaction) {
  const link = await createLinkToken(interaction.user);
  await interaction.reply(ephemeral({
    embeds: [embed("Holonet Verification", `Open the Holonet Account page and log in with Roblox to finish linking.\n\n${link.url}`)]
  }));
  schedulePostLinkRoleSync(interaction, link);
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
      await postVerificationLog(interaction.client, {
        title: "Roles Updated",
        description: `<@${interaction.user.id}> updated roles${targetLabel}.`,
        fields: [
          { name: "Target", value: `<@${targetUser.id}>`, inline: true },
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
    const user = interaction.options.getUser("user", false) || interaction.user;
    const selfUnlink = user.id === interaction.user.id;
    if (!selfUnlink) {
      const actor = await getVerifiedProfile(interaction.user.id);
      if (!canManageBot(actor?.profile, interaction.member)) {
        await interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have clearance to unlink users.")] }));
        return true;
      }
    }

    await unlinkDiscordUser(user.id, interaction.user.id);
    await interaction.reply(ephemeral({ embeds: [successEmbed("Unlinked", selfUnlink ? "Your Discord account has been unlinked." : `<@${user.id}> has been unlinked.`)] }));
    await postVerificationLog(interaction.client, {
      title: "Discord Unlinked",
      description: selfUnlink ? `<@${interaction.user.id}> unlinked their Discord account.` : `<@${interaction.user.id}> unlinked <@${user.id}>.`,
      fields: [
        { name: "Actor", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Target", value: `<@${user.id}>`, inline: true }
      ]
    });
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
      await postVerificationLog(interaction.client, {
        title: "Roles Updated",
        description: `<@${interaction.user.id}> updated their roles from the verification panel.`,
        fields: [
          { name: "Target", value: `<@${interaction.user.id}>`, inline: true },
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

  return false;
}
