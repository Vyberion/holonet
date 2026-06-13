import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { config } from "../config/index.js";

export function embed(title, description, options = {}) {
  return new EmbedBuilder()
    .setColor(options.color || config.theme.color)
    .setTitle(title)
    .setDescription(description || "")
    .setTimestamp(new Date());
}

export function errorEmbed(message) {
  return embed("Request Failed", message, { color: config.theme.errorColor });
}

export function successEmbed(title, message) {
  return embed(title, message, { color: config.theme.successColor });
}

export function ephemeral(payload = {}) {
  return { ...payload, flags: MessageFlags.Ephemeral };
}

export function buttonRow(buttons) {
  return new ActionRowBuilder().addComponents(buttons);
}

export function button(customId, label, style = ButtonStyle.Secondary) {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
}

export function textModal(customId, title, fields) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  fields.forEach(field => {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(field.id)
        .setLabel(field.label)
        .setStyle(field.style || TextInputStyle.Short)
        .setRequired(field.required !== false)
        .setPlaceholder(field.placeholder || "")
    ));
  });
  return modal;
}
