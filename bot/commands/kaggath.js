import { ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { getVerifiedProfile } from "../services/roles.js";
import { ephemeral, errorEmbed, successEmbed, componentsV2Message, containerV2, textDisplayV2, sectionV2, separatorV2 } from "../services/discord-ui.js";
import { fetchPowerbases, getPowerbase, adjustPrestige } from "../services/powerbase-api.js";

// We'll require Event Team or similar. For now, check if they are in high command or have some authority role.
// Adjust as necessary for "Event Team".
import { hasAnyOverseer, hasDarkCouncilRank } from "./clock.js"; 

export const commands = [
  new SlashCommandBuilder()
    .setName("kaggath")
    .setDescription("Write a Kaggath result")
];

export async function handleCommand(interaction) {
  if (interaction.commandName !== "kaggath") return false;

  try {
    const verified = await getVerifiedProfile(interaction.user.id);
    if (!verified) {
      await interaction.reply(ephemeral({ content: "You must be verified to use Kaggath commands." }));
      return true;
    }

    // Check permissions
    if (!hasAnyOverseer(verified.profile) && !hasDarkCouncilRank(verified.profile, 252)) {
      // NOTE: User wanted Event Team+. Since I don't have the Event Team check immediately, 
      // falling back to Overseer / High Command.
      return interaction.reply(ephemeral({ content: "You do not have permission to write Kaggaths." }));
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId("kaggath_type_select")
      .setPlaceholder("Select Kaggath Type")
      .addOptions([
        { label: "Domination (Powerbase vs Powerbase)", value: "Domination" },
        { label: "Ascension (Challenge for Rank)", value: "Ascension" },
        { label: "Severance (Forcefully Leave)", value: "Severance" },
        { label: "Allegiance (Join full PB / Fight Rejection)", value: "Allegiance" },
        { label: "Usurpation (Challenge Leader)", value: "Usurpation" },
        { label: "Humiliation", value: "Humiliation" }
      ]);

    const row = new ActionRowBuilder().addComponents(select);
    await interaction.reply(ephemeral({ components: [row] }));

  } catch (err) {
    console.error(err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(ephemeral({ embeds: [errorEmbed(err.message)] }));
    } else {
      await interaction.reply(ephemeral({ embeds: [errorEmbed(err.message)] }));
    }
  }

  return true;
}

export async function handleSelectMenu(interaction) {
  if (interaction.customId === "kaggath_type_select") {
    const type = interaction.values[0];
    
    // Store type in cache for multi-step
    globalThis.__kaggathCache = globalThis.__kaggathCache || new Map();
    globalThis.__kaggathCache.set(interaction.user.id, { type });

    if (type === "Domination") {
      const powerbases = await fetchPowerbases();
      const active = powerbases.filter(pb => pb.status === "ACTIVE");
      
      if (active.length < 2) {
        return interaction.update(ephemeral({ content: "Not enough active Powerbases for a Domination Kaggath.", components: [] }));
      }
      
      const select = new StringSelectMenuBuilder()
        .setCustomId("kaggath_dom_challenger")
        .setPlaceholder("Select Challenging Powerbase")
        .addOptions(active.map(pb => ({ label: pb.name, value: pb.id })));
        
      const row = new ActionRowBuilder().addComponents(select);
      return interaction.update(ephemeral({ content: "Step 2: Select the Challenging Powerbase.", components: [row] }));
    }

    // Other types can just fall back to a generic form for now
    return interaction.update(ephemeral({ content: `${type} selected. Further inputs not fully implemented yet.`, components: [] }));
  }
  
  if (interaction.customId === "kaggath_dom_defender") {
    const defenderId = interaction.values[0];
    const cached = globalThis.__kaggathCache?.get(interaction.user.id);
    if (!cached || !cached.challengerId) return interaction.update(ephemeral({ content: "Session expired.", components: [] }));
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
    if (!cached || !cached.challengerId || !cached.defenderId) return interaction.update(ephemeral({ content: "Session expired.", components: [] }));

    globalThis.__kaggathCache.delete(interaction.user.id);

    const [challenger, defender] = await Promise.all([
      getPowerbase(cached.challengerId),
      getPowerbase(cached.defenderId)
    ]);

    if (!challenger || !defender) {
      return interaction.update(ephemeral({ content: "One or both Powerbases no longer exist.", components: [] }));
    }

    const challSize = (challenger.powerbase_members?.length || 0) + 1;
    const defSize = (defender.powerbase_members?.length || 0) + 1;
    const diff = challSize - defSize;

    let relativeToChallenger;
    if (diff > 1) relativeToChallenger = "LARGER";
    else if (diff < -1) relativeToChallenger = "SMALLER";
    else relativeToChallenger = "EQUAL";

    // Prestige rules based on challenger perspective
    let challGain = 0, defGain = 0;

    if (winner === "challenger") {
      if (relativeToChallenger === "LARGER") { challGain = +2; defGain = -2; }
      else if (relativeToChallenger === "EQUAL") { challGain = +3; defGain = -3; }
      else if (relativeToChallenger === "SMALLER") { challGain = +4; defGain = -4; }
    } else { // defender won
      if (relativeToChallenger === "LARGER") { defGain = +4; challGain = -4; } // Defender is smaller, beats larger
      else if (relativeToChallenger === "EQUAL") { defGain = +3; challGain = -3; }
      else if (relativeToChallenger === "SMALLER") { defGain = +2; challGain = -2; } // Defender is larger, beats smaller
    }

    const newChallenger = await adjustPrestige(challenger.id, challGain);
    const newDefender = await adjustPrestige(defender.id, defGain);

    const embed = {
      title: `Kaggath of Domination`,
      description: `**Challenger:**\n${challenger.name} (${romanize(challenger.tier)})\n**Defender:**\n${defender.name} (${romanize(defender.tier)})`,
      fields: [
        { name: "Participants", value: `Challenger Size: ${challSize}\nDefender Size: ${defSize}` },
        { name: "Winner", value: winner === "challenger" ? challenger.name : defender.name },
        { name: `${challenger.name} (Now Tier ${romanize(newChallenger.tier)})`, value: `Prestige: ${challenger.prestige} -> ${newChallenger.prestige} (${challGain > 0 ? "+" : ""}${challGain})` },
        { name: `${defender.name} (Now Tier ${romanize(newDefender.tier)})`, value: `Prestige: ${defender.prestige} -> ${newDefender.prestige} (${defGain > 0 ? "+" : ""}${defGain})` }
      ],
      color: 0x8a1b1b
    };

    return interaction.update({ content: "", embeds: [embed], components: [], ephemeral: false });
  }

  return false;
}

function romanize(num) {
  return ["I", "II", "III", "IV"][num - 1] || "I";
}
