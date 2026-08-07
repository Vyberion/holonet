import { config } from "../config/index.js";

const DISCORD_API_URL = "https://discord.com/api/v10";

export const HOLONET_METADATA_SCHEMA = [
  {
    key: "holonet_operator",
    name: "Holonet Operator",
    description: "Superuser status for Holonet Network",
    type: 7 // BOOLEAN_EQUAL
  },
  {
    key: "main_group_rank",
    name: "Main Group Rank",
    description: "Main Group Rank level",
    type: 2 // INTEGER_GREATER_THAN_OR_EQUAL
  }
];

export async function registerRoleConnectionMetadata() {
  const clientId = process.env.DISCORD_CLIENT_ID || config.discord?.clientId;
  const botToken = process.env.DISCORD_TOKEN;

  if (!clientId || !botToken) {
    throw new Error("DISCORD_CLIENT_ID and DISCORD_TOKEN environment variables are required.");
  }

  const url = `${DISCORD_API_URL}/applications/${clientId}/role-connections/metadata`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${botToken}`
    },
    body: JSON.stringify(HOLONET_METADATA_SCHEMA)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to register role connection metadata: ${JSON.stringify(data)}`);
  }

  return data;
}

export async function getDiscordOAuthTokens(code, redirectUri) {
  const clientId = process.env.DISCORD_CLIENT_ID || config.discord?.clientId;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET are required for OAuth2 token exchange.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri
  });

  const response = await fetch(`${DISCORD_API_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  const tokenData = await response.json();
  if (!response.ok) {
    throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange Discord OAuth2 code");
  }

  return tokenData;
}

export async function getDiscordUser(accessToken) {
  const response = await fetch(`${DISCORD_API_URL}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const userData = await response.json();
  if (!response.ok) {
    throw new Error("Failed to fetch Discord user identity");
  }

  return userData;
}

export async function pushRoleConnectionData(accessToken, platformUsername, metadata) {
  const clientId = process.env.DISCORD_CLIENT_ID || config.discord?.clientId;
  if (!clientId) throw new Error("DISCORD_CLIENT_ID is missing.");

  const url = `${DISCORD_API_URL}/users/@me/applications/${clientId}/role-connection`;

  const body = {
    platform_name: "H.O.L.O",
    platform_username: platformUsername || "Holonet User",
    metadata: metadata
  };

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to push role connection metadata: ${JSON.stringify(data)}`);
  }

  return data;
}
