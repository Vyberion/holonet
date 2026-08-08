import * as lookup from "./lookup.js";
import * as roles from "./role.js";
import * as verification from "./verification.js";
import * as panel from "./panel.js";
import * as shift from "./shift.js";
import * as report from "./report.js";
import * as event from "./event.js";

import * as purge from "./purge.js";
import * as userApps from "./userApps.js";
import * as powerbase from "./powerbase.js";

export const modules = [lookup, roles, verification, panel, shift, report, event, purge, userApps, powerbase];

export const commandData = (() => {
  const commandsByName = new Map();

  modules.flatMap(module => module.commands || []).forEach(command => {
    const data = command.toJSON();
    if (!commandsByName.has(data.name)) {
      commandsByName.set(data.name, data);
    }
  });

  return [...commandsByName.values()];
})();

export async function routeInteraction(interaction) {
  const method = interaction.isChatInputCommand()
    ? "handleCommand"
    : interaction.isButton()
      ? "handleButton"
      : interaction.isModalSubmit()
        ? "handleModal"
        : interaction.isAnySelectMenu()
          ? "handleSelectMenu"
          : interaction.isMessageContextMenuCommand() || interaction.isUserContextMenuCommand()
            ? "handleContextMenu"
            : "";

  if (!method) {
    console.warn("Unhandled interaction type", {
      type: interaction.type,
      commandName: interaction.commandName || null,
      customId: interaction.customId || null
    });
    return false;
  }

  for (const module of modules) {
    if (typeof module[method] === "function" && await module[method](interaction)) return true;
  }

  console.warn("No bot module handled interaction", {
    method,
    type: interaction.type,
    commandName: interaction.commandName || null,
    subcommand: interaction.isChatInputCommand?.() ? interaction.options?.getSubcommand(false) : null,
    customId: interaction.customId || null
  });

  return false;
}
