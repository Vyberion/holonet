import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env")
});

import exampleConfig from "./config.example.js";

let localConfig = {};

try {
  localConfig = (await import("./config.local.js")).default || {};
} catch {
  localConfig = {};
}

function mergeDeep(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return override ?? base;
  const merged = { ...(base || {}) };

  for (const [key, value] of Object.entries(override)) {
    merged[key] = mergeDeep(merged[key], value);
  }

  return merged;
}

export const config = mergeDeep(exampleConfig, {
  ...localConfig,
  discord: {
    ...localConfig.discord,
    clientId: process.env.DISCORD_CLIENT_ID || localConfig.discord?.clientId || exampleConfig.discord.clientId,
    guildId: process.env.DISCORD_GUILD_ID || localConfig.discord?.guildId || exampleConfig.discord.guildId
  },
  holonet: {
    ...localConfig.holonet,
    baseUrl: process.env.HOLONET_BASE_URL || localConfig.holonet?.baseUrl || exampleConfig.holonet.baseUrl
  }
});

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
