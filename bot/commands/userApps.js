import { ApplicationCommandType, ContextMenuCommandBuilder } from "discord.js";
import { handleCommand as handleLookup } from "./lookup.js";
import { handleCommand as handleRoles } from "./role.js";
import { handleCommand as handleShift } from "./shift.js";

export const commands = [
  new ContextMenuCommandBuilder().setName("Update Roles").setType(ApplicationCommandType.User),
  new ContextMenuCommandBuilder().setName("Lookup").setType(ApplicationCommandType.User),
  new ContextMenuCommandBuilder().setName("Add Time").setType(ApplicationCommandType.User),
  new ContextMenuCommandBuilder().setName("Remove Time").setType(ApplicationCommandType.User),
  new ContextMenuCommandBuilder().setName("View Time").setType(ApplicationCommandType.User)
];

class ProxyInteraction {
  constructor(original, commandName, subcommand, user, extraOptions = {}) {
    this.original = original;
    this.commandName = commandName;
    this.subcommand = subcommand;
    this.targetUser = user;
    this.extraOptions = extraOptions;

    this.options = {
      getUser: (name) => name === "user" ? this.targetUser : null,
      getString: (name) => this.extraOptions[name] || null,
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
  if (!interaction.isUserContextMenuCommand()) {
    return false;
  }

  const targetUser = interaction.targetUser;

  if (interaction.commandName === "Update Roles") {
    const proxy = new ProxyInteraction(interaction, "roles", "update", targetUser);
    return await handleRoles(proxy);
  }

  if (interaction.commandName === "Lookup") {
    const proxy = new ProxyInteraction(interaction, "lookup", null, targetUser);
    return await handleLookup(proxy);
  }

  if (interaction.commandName === "Add Time") {
    const proxy = new ProxyInteraction(interaction, "shift", "time", targetUser, { type: "add" });
    return await handleShift(proxy);
  }

  if (interaction.commandName === "Remove Time") {
    const proxy = new ProxyInteraction(interaction, "shift", "time", targetUser, { type: "remove" });
    return await handleShift(proxy);
  }

  if (interaction.commandName === "View Time") {
    const proxy = new ProxyInteraction(interaction, "shift", "view", targetUser);
    return await handleShift(proxy);
  }

  return false;
}
