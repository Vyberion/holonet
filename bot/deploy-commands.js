import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { commandData } from "./commands/index.js";
import { config, requireEnv } from "./config/index.js";

const rest = new REST({ version: "10" }).setToken(requireEnv("DISCORD_TOKEN"));

const deployed = await rest.put(
  Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
  { body: commandData }
);

console.log(`Deployed ${commandData.length} Holonet bot commands to guild ${config.discord.guildId}.`);
console.log(`Discord returned ${Array.isArray(deployed) ? deployed.length : 0} commands: ${Array.isArray(deployed) ? deployed.map(command => command.name).join(", ") : "unknown"}`);
