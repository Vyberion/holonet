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
    this.user = original.user;
    this.member = original.member;
    this.targetUser = user;
    this.type = original.type;
    this.client = original.client;
    this.channel = original.channel;
    this.id = original.id;
    this.token = original.token;
    
    this.options = {
      getUser: (name) => name === "user" ? this.targetUser : null,
      getString: () => null,
      getBoolean: () => null,
      getSubcommand: (required = false) => this.subcommand,
      getInteger: () => null
    };
  }

  isChatInputCommand() { return true; }
  isButton() { return false; }
  isModalSubmit() { return false; }
  isMessageContextMenuCommand() { return false; }
  isUserContextMenuCommand() { return false; }

  async reply(options) { return this.original.reply(options); }
  async editReply(options) { return this.original.editReply(options); }
  async deferReply(options) { return this.original.deferReply(options); }
  async followUp(options) { return this.original.followUp(options); }
  async showModal(modal) { return this.original.showModal(modal); }
  async update(options) { return this.original.update(options); }
}

export async function handleContextMenu(interaction) {
  if (!interaction.isUserContextMenuCommand()) return false;

  const targetUser = interaction.targetUser;

  if (interaction.commandName === "Update Roles") {
    const proxy = new ProxyInteraction(interaction, "update-roles", null, targetUser);
    return handleVerification(proxy);
  }

  if (interaction.commandName === "Lookup") {
    const proxy = new ProxyInteraction(interaction, "lookup", null, targetUser);
    return handleLookup(proxy);
  }

  if (interaction.commandName === "Add Time") {
    const proxy = new ProxyInteraction(interaction, "add", "time", targetUser);
    return handleClock(proxy);
  }

  if (interaction.commandName === "Remove Time") {
    const proxy = new ProxyInteraction(interaction, "remove", "time", targetUser);
    return handleClock(proxy);
  }

  if (interaction.commandName === "View Shifts") {
    const proxy = new ProxyInteraction(interaction, "shifts", "user", targetUser);
    return handleClock(proxy);
  }

  if (interaction.commandName === "View Time") {
    const proxy = new ProxyInteraction(interaction, "view", "time", targetUser);
    return handleClock(proxy);
  }

  return false;
}
