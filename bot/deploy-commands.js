import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { commandData } from "./commands/index.js";
import { config, requireEnv } from "./config/index.js";
import { HOLONET_METADATA_SCHEMA } from "./services/discord-linked-roles.js";

const rest = new REST({ version: "10" }).setToken(requireEnv("DISCORD_TOKEN"));

const deployed = await rest.put(
  Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
  { body: commandData }
);

try {
  await rest.put(
    Routes.applicationRoleConnectionMetadata(config.discord.clientId),
    { body: HOLONET_METADATA_SCHEMA }
  );
  console.log("Registered Linked Role connection metadata schema.");
} catch (error) {
  console.warn("Failed to register Linked Role metadata:", error?.message || error);
}

async function deleteCommandByName(route, deleteRoute, name) {
  const commands = await rest.get(route);
  const matches = Array.isArray(commands) ? commands.filter(command => command.name === name) : [];

  for (const command of matches) {
    await rest.delete(deleteRoute(command.id));
    console.log(`Deleted stale /${name} command (${command.id}).`);
  }
}

await deleteCommandByName(
  Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
  commandId => Routes.applicationGuildCommand(config.discord.clientId, config.discord.guildId, commandId),
  "info"
);

await deleteCommandByName(
  Routes.applicationCommands(config.discord.clientId),
  commandId => Routes.applicationCommand(config.discord.clientId, commandId),
  "info"
);

console.log(`Deployed ${commandData.length} Holonet bot commands to guild ${config.discord.guildId}.`);
console.log(`Discord returned ${Array.isArray(deployed) ? deployed.length : 0} commands: ${Array.isArray(deployed) ? deployed.map(command => command.name).join(", ") : "unknown"}`);
