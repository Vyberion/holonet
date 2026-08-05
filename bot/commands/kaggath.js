import { ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { getVerifiedProfile } from "../services/roles.js";
import { ephemeral, errorEmbed, successEmbed } from "../services/discord-ui.js";
import { fetchPowerbases, getPowerbase, adjustPrestige } from "../services/powerbase-api.js";
import { hasAnyOverseer, hasDarkCouncilRank } from "./clock.js"; 

export const commands = [];

export async function handleCommand(interaction) {
  if (interaction.commandName !== "write" || interaction.options.getSubcommand() !== "kaggath") return false;

  try {
    const verified = await getVerifiedProfile(interaction.user.id);
    if (!verified) {
      await interaction.reply(ephemeral({ embeds: [errorEmbed("You must be verified to use Kaggath commands.")] }));
      return true;
    }

    if (!hasAnyOverseer(verified.profile) && !hasDarkCouncilRank(verified.profile, 251)) {
      return interaction.reply(ephemeral({ embeds: [errorEmbed("You do not have permission to write Kaggaths.")] }));
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId("kaggath_type_select")
      .setPlaceholder("Select Kaggath Type")
      .addOptions([
        { label: "Domination", value: "Domination" },
        { label: "Ascension", value: "Ascension" },
        { label: "Severance", value: "Severance" },
        { label: "Allegiance", value: "Allegiance" },
        { label: "Usurpation", value: "Usurpation" },
        { label: "Humiliation", value: "Humiliation" }
      ]);

    const row = new ActionRowBuilder().addComponents(select);
    await interaction.reply(ephemeral({ content: "Step 1: Select Kaggath Type", components: [row] }));

  } catch (err) {
    console.error(err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(ephemeral({ embeds: [errorEmbed(`❌ **Error:** ` + err.message)] }));
    } else {
      await interaction.reply(ephemeral({ embeds: [errorEmbed(`❌ **Error:** ` + err.message)] }));
    }
  }

  return true;
}

export async function handleSelectMenu(interaction) {
  if (interaction.customId === "kaggath_type_select") {
    const type = interaction.values[0];
    
    globalThis.__kaggathCache = globalThis.__kaggathCache || new Map();
    globalThis.__kaggathCache.set(interaction.user.id, { type });

    if (type === "Domination") {
      const powerbases = await fetchPowerbases();
      const active = powerbases.filter(pb => pb.status === "ACTIVE");
      
      if (active.length < 2) {
        return interaction.update(ephemeral({ embeds: [errorEmbed("Not enough active Powerbases for a Domination Kaggath.")] }));
      }
      
      const select = new StringSelectMenuBuilder()
        .setCustomId("kaggath_dom_challenger")
        .setPlaceholder("Select Challenging Powerbase")
        .addOptions(active.map(pb => ({ label: pb.name, value: pb.id })));
        
      const row = new ActionRowBuilder().addComponents(select);
      return interaction.update(ephemeral({ content: "Step 2: Select the Challenging Powerbase.", components: [row] }));
    }

    return interaction.update(ephemeral({ embeds: [successEmbed(`${type} Selected`, "Further inputs not fully implemented yet.")] }));
  }
  
  if (interaction.customId === "kaggath_dom_challenger") {
    const challengerId = interaction.values[0];
    const cached = globalThis.__kaggathCache?.get(interaction.user.id);
    if (!cached) return interaction.update(ephemeral({ embeds: [errorEmbed("Session expired.")] }));
    cached.challengerId = challengerId;

    const powerbases = await fetchPowerbases();
    const active = powerbases.filter(pb => pb.status === "ACTIVE" && pb.id !== challengerId);
    
    if (active.length === 0) {
      return interaction.update(ephemeral({ embeds: [errorEmbed("No eligible defending Powerbases found.")] }));
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId("kaggath_dom_defender")
      .setPlaceholder("Select Defending Powerbase")
      .addOptions(active.map(pb => ({ label: pb.name, value: pb.id })));
      
    const row = new ActionRowBuilder().addComponents(select);
    return interaction.update(ephemeral({ content: "Step 3: Select the Defending Powerbase.", components: [row] }));
  }

  if (interaction.customId === "kaggath_dom_defender") {
    const defenderId = interaction.values[0];
    const cached = globalThis.__kaggathCache?.get(interaction.user.id);
    if (!cached || !cached.challengerId) return interaction.update(ephemeral({ embeds: [errorEmbed("Session expired.")] }));
    cached.defenderId = defenderId;

    const select = new StringSelectMenuBuilder()
      .setCustomId("kaggath_dom_winner")
      .setPlaceholder("Select the Victor")
      .addOptions([
        { label: "Challenger Won", value: "challenger" },
        { label: "Defender Won", value: "defender" }
      ]);
      
    const row = new ActionRowBuilder().addComponents(select);
    return interaction.update(ephemeral({ content: "Step 4: Who won the Kaggath?", components: [row] }));
  }

  if (interaction.customId === "kaggath_dom_winner") {
    const winner = interaction.values[0];
    const cached = globalThis.__kaggathCache?.get(interaction.user.id);
    if (!cached || !cached.challengerId || !cached.defenderId) return interaction.update(ephemeral({ embeds: [errorEmbed("Session expired.")] }));

    globalThis.__kaggathCache.delete(interaction.user.id);

    const [challenger, defender] = await Promise.all([
      getPowerbase(cached.challengerId),
      getPowerbase(cached.defenderId)
    ]);

    if (!challenger || !defender) {
      return interaction.update(ephemeral({ embeds: [errorEmbed("One or both Powerbases no longer exist.")] }));
    }

    const challSize = (challenger.powerbase_members?.length || 0) + 1;
    const defSize = (defender.powerbase_members?.length || 0) + 1;
    const diff = challSize - defSize;

    let relativeToChallenger;
    if (diff > 1) relativeToChallenger = "LARGER";
    else if (diff < -1) relativeToChallenger = "SMALLER";
    else relativeToChallenger = "EQUAL";

    let challGain = 0, defGain = 0;

    if (winner === "challenger") {
      if (relativeToChallenger === "LARGER") { challGain = +2; defGain = -2; }
      else if (relativeToChallenger === "EQUAL") { challGain = +3; defGain = -3; }
      else if (relativeToChallenger === "SMALLER") { challGain = +4; defGain = -4; }
    } else {
      if (relativeToChallenger === "LARGER") { defGain = +4; challGain = -4; }
      else if (relativeToChallenger === "EQUAL") { defGain = +3; challGain = -3; }
      else if (relativeToChallenger === "SMALLER") { defGain = +2; challGain = -2; }
    }

    const newChallenger = await adjustPrestige(challenger.id, challGain);
    const newDefender = await adjustPrestige(defender.id, defGain);

    const resultEmbed = successEmbed(
      "Kaggath of Domination",
      `**Challenger:** ${challenger.name} (${romanize(challenger.tier)})\n` +
      `**Defender:** ${defender.name} (${romanize(defender.tier)})\n\n` +
      `**Participants**\nChallenger Size: ${challSize} | Defender Size: ${defSize}\n\n` +
      `**Winner:** ${winner === "challenger" ? challenger.name : defender.name}\n\n` +
      `**${challenger.name} (Now Tier ${romanize(newChallenger.tier)})**\nPrestige: ${challenger.prestige} ➔ ${newChallenger.prestige} (${challGain > 0 ? "+" : ""}${challGain})\n\n` +
      `**${defender.name} (Now Tier ${romanize(newDefender.tier)})**\nPrestige: ${defender.prestige} ➔ ${newDefender.prestige} (${defGain > 0 ? "+" : ""}${defGain})`
    );

    return interaction.update(ephemeral({ embeds: [resultEmbed], components: [] }));
  }

  return false;
}

function romanize(num) {
  return ["I", "II", "III", "IV"][num - 1] || "I";
}
