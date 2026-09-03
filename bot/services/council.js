import { config } from "../config/index.js";
import { embed } from "./discord-ui.js";

const COUNCIL_THEME_COLOR = 0xa89786;

function councilAnnouncementChannelId() {
  const custom = config.channels?.announcements?.darkCouncil;
  if (custom && !custom.includes("CHANNEL_ID")) return custom;
  return config.channels?.activityLog || "1455303713701757138";
}

export async function announceMeetingDocket(client, { meetingTime = "Upcoming Session", items = [], hostName = "High Command" } = {}) {
  if (!client) return false;
  const channelId = councilAnnouncementChannelId();
  if (!channelId) return false;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased?.() || typeof channel.send !== "function") return false;

    const messageEmbed = embed(
      "DARK COUNCIL - MEETING DOCKET",
      `The Dark Council meeting agenda has been set by **${hostName}**.\n\n**Scheduled Time:** ${meetingTime}\n**Total Agenda Items:** ${items.length}`,
      { color: COUNCIL_THEME_COLOR }
    );

    items.forEach((item, index) => {
      const typeTag = String(item.type || item.proposalType || "LEGISLATION").toUpperCase();
      messageEmbed.addFields({
        name: `${index + 1}. [${typeTag}] ${item.title || "Untitled Agenda Item"}`,
        value: `Sponsor: ${item.createdByName || "Councilor"} | Status: ${item.status || "DOCKET"}`,
        inline: false
      });
    });

    const holonetUrl = `${config.holonet?.baseUrl || "https://www.thesithorder.org"}/council/docket`;
    messageEmbed.addFields({
      name: "Access Council Hub",
      value: `[View Full Docket & Proposals on Holonet](${holonetUrl})`,
      inline: false
    });

    await channel.send({ embeds: [messageEmbed] });
    return true;
  } catch (err) {
    console.warn("Failed to announce Council docket:", err?.message || err);
    return false;
  }
}

export async function summonHearingParty(client, { targetDiscordId, targetRobloxName, hearingType = "HEARING", meetingTime = "Council Meeting", details = "" } = {}) {
  if (!client) return false;
  const channelId = councilAnnouncementChannelId();
  if (!channelId) return false;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased?.() || typeof channel.send !== "function") return false;

    const mention = targetDiscordId ? `<@${targetDiscordId}>` : `**${targetRobloxName || "The Accused"}**`;
    const messageEmbed = embed(
      `DARK COUNCIL SUMMONS - ${String(hearingType).toUpperCase()}`,
      `${mention}, you are hereby commanded to appear before the Dark Council for formal proceedings.`,
      { color: COUNCIL_THEME_COLOR }
    );

    messageEmbed.addFields(
      { name: "Hearing Designation", value: String(hearingType).toUpperCase(), inline: true },
      { name: "Scheduled Meeting", value: String(meetingTime), inline: true },
      { name: "Subject / Terms", value: details || "Formal Council Hearing.", inline: false }
    );

    await channel.send({
      content: targetDiscordId ? `<@${targetDiscordId}>` : undefined,
      embeds: [messageEmbed],
      allowedMentions: targetDiscordId ? { users: [String(targetDiscordId)] } : { parse: [] }
    });
    return true;
  } catch (err) {
    console.warn("Failed to dispatch council summons:", err?.message || err);
    return false;
  }
}

export async function broadcastVoteResult(client, { title, proposalType = "LEGISLATION", status = "RATIFIED", yesCount = 0, noCount = 0, abstainCount = 0, notes = "" } = {}) {
  if (!client) return false;
  const channelId = councilAnnouncementChannelId();
  if (!channelId) return false;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased?.() || typeof channel.send !== "function") return false;

    const isPassed = status.toLowerCase() === "passed" || status.toLowerCase() === "ratified";
    const statusColor = isPassed ? 0x35c46f : 0xc90705;

    const messageEmbed = embed(
      `COUNCIL FLOOR RESOLUTION: ${title}`,
      `Deliberations have concluded on this motion.\n\n**Final Status:** ${status.toUpperCase()}`,
      { color: statusColor }
    );

    messageEmbed.addFields(
      { name: "Motion Type", value: String(proposalType).toUpperCase(), inline: true },
      { name: "Aye Ballots", value: String(yesCount), inline: true },
      { name: "Nay Ballots", value: String(noCount), inline: true },
      { name: "Abstentions", value: String(abstainCount), inline: true }
    );

    if (notes) {
      messageEmbed.addFields({ name: "Council Decision / Sanction", value: notes, inline: false });
    }

    await channel.send({ embeds: [messageEmbed] });
    return true;
  } catch (err) {
    console.warn("Failed to broadcast vote result:", err?.message || err);
    return false;
  }
}
