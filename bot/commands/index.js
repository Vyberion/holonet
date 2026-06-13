import * as verification from "./verification.js";
import * as clock from "./clock.js";

export const modules = [verification, clock];

export const commandData = modules.flatMap(module => module.commands || []).map(command => command.toJSON());

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
