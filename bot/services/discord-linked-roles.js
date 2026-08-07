import fs from "node:fs";
import path from "node:path";

const DISCORD_API_URL = "https://discord.com/api/v10";

function getEnvValue(keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
  }

  const candidates = [
    path.join(process.cwd(), "bot", ".env"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env.oci")
  ];

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const text = fs.readFileSync(file, "utf8");
        for (const key of keys) {
          const regex = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=\\s*(.*)$`, "m");
          const match = text.match(regex);
          if (match && match[1]) {
            const val = match[1].trim().replace(/^['"]|['"]$/g, "");
            if (val) return val;
          }
        }
      }
    } catch (_) {}
  }
  return "";
}

export function getDiscordClientId() {
  return getEnvValue(["DISCORD_CLIENT_ID"]);
}

export function getDiscordClientSecret() {
  return getEnvValue(["DISCORD_CLIENT_SECRET"]);
}

export function getDiscordBotToken() {
  return getEnvValue(["DISCORD_TOKEN"]);
}

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
  const clientId = getDiscordClientId();
  const botToken = getDiscordBotToken();

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
  const clientId = getDiscordClientId();
  const clientSecret = getDiscordClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET environment variables are required.");
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
  const clientId = getDiscordClientId();
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
