import crypto from "crypto";
import { config } from "../config/index.js";
import { audit, supabase } from "./supabase.js";

export async function createLinkToken(user) {
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await supabase.from("discord_link_tokens").insert({
    token,
    discord_user_id: user.id,
    discord_username: user.tag || user.username,
    expires_at: expiresAt
  });
  if (error) throw error;

  return {
    token,
    url: `${config.holonet.baseUrl.replace(/\/$/, "")}/account?discordLink=${encodeURIComponent(token)}`
  };
}

export async function unlinkDiscordUser(discordUserId, actorDiscordId) {
  const { error } = await supabase.from("verification_links").delete().eq("discord_user_id", discordUserId);
  if (error) throw error;

  await audit("verification.unlink", { actorDiscordId, targetDiscordId: discordUserId });
}
