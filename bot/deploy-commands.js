import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { commandData } from "./commands/index.js";
import { SAY_COMMAND_ROLE_ID } from "./commands/say.js";
import { config, requireEnv } from "./config/index.js";

const rest = new REST({ version: "10" }).setToken(requireEnv("DISCORD_TOKEN"));

const deployed = await rest.put(
  Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
  { body: commandData }
);

async function restrictSayCommand(commands) {
  const sayCommand = Array.isArray(commands) ? commands.find(command => command.name === "say") : null;
  if (!sayCommand?.id) {
    console.warn("Could not find deployed /say command to restrict.");
    return;
  }

  await rest.put(
    Routes.applicationCommandPermissions(config.discord.clientId, config.discord.guildId, sayCommand.id),
    {
      body: {
        permissions: [
          { id: config.discord.guildId, type: 1, permission: false },
          { id: SAY_COMMAND_ROLE_ID, type: 1, permission: true }
        ]
      }
    }
  );

  console.log(`Restricted /say visibility to role ${SAY_COMMAND_ROLE_ID}.`);
}

async function deleteCommandByName(route, deleteRoute, name) {
  const commands = await rest.get(route);
  const matches = Array.isArray(commands) ? commands.filter(command => command.name === name) : [];

  for (const command of matches) {
    await rest.delete(deleteRoute(command.id));
    console.log(`Deleted stale /${name} command (${command.id}).`);
  }
}

await restrictSayCommand(deployed);

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
