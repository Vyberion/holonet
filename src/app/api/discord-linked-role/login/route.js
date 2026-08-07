import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import { createRandomToken, serializeCookie, STATE_COOKIE } from "../../../../../modules/auth/session-store.js";
import { OAUTH_STATE_MAX_AGE_SECONDS, encodeOAuthStateCookie } from "../../../../lib/api-helpers.js";
import { getDiscordClientId } from "../../../../../bot/services/discord-linked-roles.js";

const handler = async (req, res) => {
  const clientId = getDiscordClientId();
  if (!clientId) {
    return res.status(500).send("DISCORD_CLIENT_ID environment variable is missing.");
  }

  const host = req?.headers?.host || "www.thesithorder.org";
  const protocol = req?.headers?.["x-forwarded-proto"] || "https";
  const redirectUri = `${protocol}://${host}/api/discord-linked-role/callback`;

  const state = createRandomToken();
  const scope = encodeURIComponent("identify role_connections.write");
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${encodeURIComponent(state)}`;

  res.setHeader("Set-Cookie", serializeCookie(STATE_COOKIE, encodeOAuthStateCookie({ state, redirectUri }), {
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS
  }));

  return res.redirect(discordAuthUrl);
};

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
