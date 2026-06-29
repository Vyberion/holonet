import * as lookup from "./lookup.js";
import * as verification from "./verification.js";
import * as reports from "./reports.js";
import * as clock from "./clock.js";

export const modules = [lookup, verification, reports, clock];

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
