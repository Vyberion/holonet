import { nicknameRuleForProfile } from "../../modules/auth/role-permissions.js";

const DISCORD_API_URL = "https://discord.com/api/v10";

export function getDiscordClientId() {
  return process.env.DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "";
}

export function getDiscordClientSecret() {
  return process.env.DISCORD_CLIENT_SECRET || "";
}

export function getDiscordBotToken() {
  return process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || "";
}

export const HOLONET_METADATA_SCHEMA = [
  {
    key: "holonet_operator",
    name: "Holonet Operator",
    description: "Superuser status for the Holonet",
    type: 7 // BOOLEAN_EQUAL
  },
  {
    key: "rank_low",
    name: "Low Rank",
    description: "Low Rank",
    type: 7 // BOOLEAN_EQUAL
  },
  {
    key: "rank_mid",
    name: "Mid Rank",
    description: "Mid Rank",
    type: 7 // BOOLEAN_EQUAL
  },
  {
    key: "rank_high",
    name: "High Rank",
    description: "High Rank",
    type: 7 // BOOLEAN_EQUAL
  },
  {
    key: "dc_council",
    name: "Dark Council",
    description: "Dark Council",
    type: 7 // BOOLEAN_EQUAL
  },
  {
    key: "dc_command",
    name: "High Command",
    description: "High Command",
    type: 7 // BOOLEAN_EQUAL
  },
  {
    key: "dc_emperor",
    name: "Sith Emperor",
    description: "Sith Emperor",
    type: 7 // BOOLEAN_EQUAL
  },
  {
    key: "dc_admin",
    name: "Group Administration",
    description: "Group Administration",
    type: 7 // BOOLEAN_EQUAL
  },
  {
    key: "div_reavers",
    name: "Reaver",
    description: "Reaver Division",
    type: 7 // BOOLEAN_EQUAL
  },
  {
    key: "div_dhg",
    name: "Dark Honor Guard",
    description: "Dark Honor Guard Division",
    type: 7 // BOOLEAN_EQUAL
  },
  {
    key: "div_inq",
    name: "Inquisitor",
    description: "Inquisitorius Division",
    type: 7 // BOOLEAN_EQUAL
  },
  {
    key: "div_dread",
    name: "Dread Master",
    description: "Dread Master Division",
    type: 7 // BOOLEAN_EQUAL
  }
];

export function getRankMetadataForProfile(profile) {
  if (!profile) return {};

  const metadata = {
    rank_low: 0,
    rank_mid: 0,
    rank_high: 0,
    dc_council: 0,
    dc_command: 0,
    dc_emperor: 0,
    dc_admin: 0,
    div_reavers: 0,
    div_dhg: 0,
    div_inq: 0,
    div_dread: 0
  };

  const groupRoles = profile.groupRoles || [];

  let coreRankAssigned = false;

  // Evaluate Dark Council Group (3199126) first (highest priority)
  const dcRole = groupRoles.find(r => r.groupId === 3199126);
  if (dcRole) {
    const r = Number(dcRole.rank);
    if (r >= 254) { metadata.dc_admin = 1; coreRankAssigned = true; }
    else if (r === 253) { metadata.dc_emperor = 1; coreRankAssigned = true; }
    else if (r === 251 || r === 252) { metadata.dc_command = 1; coreRankAssigned = true; }
    else if (r >= 15) { metadata.dc_council = 1; coreRankAssigned = true; }
  }

  // Evaluate Main Group (3197893) only if no Dark Council rank was assigned
  if (!coreRankAssigned) {
    const mainRole = groupRoles.find(r => r.groupId === 3197893 || r.isMainGroup);
    if (mainRole) {
      const r = Number(mainRole.rank);
      if (r >= 44) metadata.rank_high = 1;
      else if (r >= 27) metadata.rank_mid = 1;
      else if (r >= 1) metadata.rank_low = 1;
    }
  }

  // Evaluate Divisions (Can be held simultaneously with a core rank)
  if (groupRoles.some(r => r.groupId === 3219802)) metadata.div_reavers = 1;
  if (groupRoles.some(r => r.groupId === 4364250)) metadata.div_dhg = 1;
  if (groupRoles.some(r => r.groupId === 3356831)) metadata.div_inq = 1;
  if (groupRoles.some(r => r.groupId === 3215895)) metadata.div_dread = 1;

  return metadata;
}

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
    platform_name: "The Sith Order",
    platform_username: platformUsername || "Sith Order Member",
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
