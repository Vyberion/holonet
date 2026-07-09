import { ApplicationCommandType, ContextMenuCommandBuilder } from "discord.js";
import { handleCommand as handleLookup } from "./lookup.js";
import { handleCommand as handleVerification } from "./verification.js";
import { handleCommand as handleClock } from "./clock.js";

export const commands = [
  new ContextMenuCommandBuilder().setName("Update Roles").setType(ApplicationCommandType.User),
  new ContextMenuCommandBuilder().setName("Lookup").setType(ApplicationCommandType.User),
  new ContextMenuCommandBuilder().setName("Add Time").setType(ApplicationCommandType.User),
  new ContextMenuCommandBuilder().setName("Remove Time").setType(ApplicationCommandType.User),
  new ContextMenuCommandBuilder().setName("View Shifts").setType(ApplicationCommandType.User),
  new ContextMenuCommandBuilder().setName("View Time").setType(ApplicationCommandType.User)
];

class ProxyInteraction {
  constructor(original, commandName, subcommand, user) {
    this.original = original;
    this.commandName = commandName;
    this.subcommand = subcommand;
    this.targetUser = user;
    
    this.options = {
      getUser: (name) => name === "user" ? this.targetUser : null,
      getString: () => null,
      getBoolean: () => null,
      getSubcommand: (required = false) => this.subcommand,
      getInteger: () => null
    };

    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop in target) {
          return target[prop];
        }
        const val = target.original[prop];
        if (typeof val === "function") {
          return val.bind(target.original);
        }
        return val;
      }
    });
  }

  isChatInputCommand() { return true; }
  isButton() { return false; }
  isModalSubmit() { return false; }
  isMessageContextMenuCommand() { return false; }
  isUserContextMenuCommand() { return false; }
}

export async function handleContextMenu(interaction) {
  console.log(`[userApps] handleContextMenu called for command: "${interaction.commandName}"`);
  if (!interaction.isUserContextMenuCommand()) {
    console.log(`[userApps] interaction is not a user context menu command.`);
    return false;
  }

  const targetUser = interaction.targetUser;
  console.log(`[userApps] targetUser: ${targetUser?.tag} (${targetUser?.id})`);

  if (interaction.commandName === "Update Roles") {
    console.log(`[userApps] Routing to handleVerification`);
    const proxy = new ProxyInteraction(interaction, "update-roles", null, targetUser);
    const result = await handleVerification(proxy);
    console.log(`[userApps] handleVerification result: ${result}`);
    return result;
  }

  if (interaction.commandName === "Lookup") {
    console.log(`[userApps] Routing to handleLookup`);
    const proxy = new ProxyInteraction(interaction, "lookup", null, targetUser);
    const result = await handleLookup(proxy);
    console.log(`[userApps] handleLookup result: ${result}`);
    return result;
  }

  if (interaction.commandName === "Add Time") {
    console.log(`[userApps] Routing to handleClock (Add Time)`);
    const proxy = new ProxyInteraction(interaction, "add", "time", targetUser);
    const result = await handleClock(proxy);
    console.log(`[userApps] handleClock (Add Time) result: ${result}`);
    return result;
  }

  if (interaction.commandName === "Remove Time") {
    console.log(`[userApps] Routing to handleClock (Remove Time)`);
    const proxy = new ProxyInteraction(interaction, "remove", "time", targetUser);
    const result = await handleClock(proxy);
    console.log(`[userApps] handleClock (Remove Time) result: ${result}`);
    return result;
  }

  if (interaction.commandName === "View Shifts") {
    console.log(`[userApps] Routing to handleClock (View Shifts)`);
    const proxy = new ProxyInteraction(interaction, "shifts", "user", targetUser);
    const result = await handleClock(proxy);
    console.log(`[userApps] handleClock (View Shifts) result: ${result}`);
    return result;
  }

  if (interaction.commandName === "View Time") {
    console.log(`[userApps] Routing to handleClock (View Time)`);
    const proxy = new ProxyInteraction(interaction, "view", "time", targetUser);
    const result = await handleClock(proxy);
    console.log(`[userApps] handleClock (View Time) result: ${result}`);
    return result;
  }

  console.log(`[userApps] commandName "${interaction.commandName}" did not match any expected context menu commands.`);
  return false;
}
