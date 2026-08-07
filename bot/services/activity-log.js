import { config } from "../config/index.js";
import { embed } from "./discord-ui.js";

const DEFAULT_ACTIVITY_LOG_CHANNEL_ID = "1455303713701757138";
export const POWERBASE_LOG_CHANNEL_ID = "1535350213747675226";
export const HIGH_COMMAND_ROLE_ID = "1046451364965920848";

function activityLogChannelId(channelKey = "activityLog") {
  if (channelKey === "powerbaseLog") {
    return POWERBASE_LOG_CHANNEL_ID;
  }
  if (channelKey === "verificationLog") {
    const channelId = String(config.channels?.verificationLog || "").trim();
    return channelId && !channelId.includes("CHANNEL_ID") ? channelId : "";
  }

  return String(config.channels?.[channelKey] || config.channels?.activityLog || DEFAULT_ACTIVITY_LOG_CHANNEL_ID).trim();
}

export async function postActivityLog(client, { title, description, fields = [], channelKey = "activityLog", color = null, content = "", allowedRoleIds = [] }) {
  const channelId = activityLogChannelId(channelKey);
  if (!client || !channelId) return false;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased?.() || typeof channel.send !== "function") throw new Error("ACTIVITY_LOG_CHANNEL_UNAVAILABLE");

    const messageEmbed = embed(title, description, color ? { color } : {});
    fields
      .filter(field => field?.name && field?.value !== undefined && field?.value !== null && String(field.value).trim())
      .forEach(field => messageEmbed.addFields({
        name: String(field.name),
        value: String(field.value),
        inline: Boolean(field.inline)
      }));

    const finalAllowedRoles = [...allowedRoleIds];
    if (content.includes(HIGH_COMMAND_ROLE_ID) && !finalAllowedRoles.includes(HIGH_COMMAND_ROLE_ID)) {
      finalAllowedRoles.push(HIGH_COMMAND_ROLE_ID);
    }

    await channel.send({
      content,
      embeds: [messageEmbed],
      allowedMentions: finalAllowedRoles.length
        ? { parse: [], roles: finalAllowedRoles.map(String) }
        : { parse: [] }
    });
    return true;
  } catch (error) {
    console.warn("Activity log post failed", { channelId, error: error?.message || error });
    return false;
  }
}

export async function postPowerbaseLog(client, payload) {
  return postActivityLog(client, { ...payload, channelKey: "powerbaseLog" });
}

export async function postVerificationLog(client, payload) {
  return postActivityLog(client, { ...payload, channelKey: "verificationLog" });
}
