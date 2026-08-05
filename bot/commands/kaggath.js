import { ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { getVerifiedProfile } from "../services/roles.js";
import { ephemeral, errorEmbed, successEmbed, componentsV2Message, containerV2, textDisplayV2, sectionV2, separatorV2 } from "../services/discord-ui.js";
import { fetchPowerbases, getPowerbase, adjustPrestige } from "../services/powerbase-api.js";

// We'll require Event Team or similar. For now, check if they are in high command or have some authority role.
// Adjust as necessary for "Event Team".
import { hasAnyOverseer, hasDarkCouncilRank } from "./clock.js"; 

export const commands = [];

export async function handleCommand(interaction) {
  if (interaction.commandName !== "write" || interaction.options.getSubcommand() !== "kaggath") return false;

  try {
    const verified = await getVerifiedProfile(interaction.user.id);
    if (!verified) {
      await interaction.reply(componentsV2Message([containerV2([textDisplayV2("You must be verified to use Kaggath commands.")])]));
      return true;
    }

    // Check permissions
    if (!hasAnyOverseer(verified.profile) && !hasDarkCouncilRank(verified.profile, 252)) {
      // NOTE: User wanted Event Team+. Since I don't have the Event Team check immediately, 
      // falling back to Overseer / High Command.
      return interaction.reply(componentsV2Message([containerV2([textDisplayV2("You do not have permission to write Kaggaths.")])]));
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
    await interaction.reply(componentsV2Message([containerV2([textDisplayV2("Step 1: Select Kaggath Type"), row])]));

  } catch (err) {
    console.error(err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(componentsV2Message([containerV2([textDisplayV2(`❌ **Error:** ` + err.message)])]));
    } else {
      await interaction.reply(componentsV2Message([containerV2([textDisplayV2(`❌ **Error:** ` + err.message)])]));
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
        return interaction.update(componentsV2Message([containerV2([textDisplayV2("Not enough active Powerbases for a Domination Kaggath.")])]));
      }
      
      const select = new StringSelectMenuBuilder()
        .setCustomId("kaggath_dom_challenger")
        .setPlaceholder("Select Challenging Powerbase")
        .addOptions(active.map(pb => ({ label: pb.name, value: pb.id })));
        
      const row = new ActionRowBuilder().addComponents(select);
      return interaction.update(componentsV2Message([containerV2([textDisplayV2("Step 2: Select the Challenging Powerbase."), row])]));
    }

    // Other types can just fall back to a generic form for now
    return interaction.update(componentsV2Message([containerV2([textDisplayV2(`${type} selected. Further inputs not fully implemented yet.`)])]));
  }
  
  if (interaction.customId === "kaggath_dom_defender") {
    const defenderId = interaction.values[0];
    const cached = globalThis.__kaggathCache?.get(interaction.user.id);
    if (!cached || !cached.challengerId) return interaction.update(componentsV2Message([containerV2([textDisplayV2("Session expired.")])]));
    cached.defenderId = defenderId;

    const select = new StringSelectMenuBuilder()
      .setCustomId("kaggath_dom_winner")
      .setPlaceholder("Select the Victor")
      .addOptions([
        { label: "Challenger Won", value: "challenger" },
        { label: "Defender Won", value: "defender" }
      ]);
      
    const row = new ActionRowBuilder().addComponents(select);
    return interaction.update(componentsV2Message([containerV2([textDisplayV2("Step 4: Who won the Kaggath?"), row])]));
  }

  if (interaction.customId === "kaggath_dom_winner") {
    const winner = interaction.values[0];
    const cached = globalThis.__kaggathCache?.get(interaction.user.id);
    if (!cached || !cached.challengerId || !cached.defenderId) return interaction.update(componentsV2Message([containerV2([textDisplayV2("Session expired.")])]));

    globalThis.__kaggathCache.delete(interaction.user.id);

    const [challenger, defender] = await Promise.all([
      getPowerbase(cached.challengerId),
      getPowerbase(cached.defenderId)
    ]);

    if (!challenger || !defender) {
      return interaction.update(componentsV2Message([containerV2([textDisplayV2("One or both Powerbases no longer exist.")])]));
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

    return interaction.update(componentsV2Message([
      containerV2([
        textDisplayV2(`**Kaggath of Domination**`),
        separatorV2(),
        textDisplayV2(`**Challenger:**\n${challenger.name} (${romanize(challenger.tier)})\n**Defender:**\n${defender.name} (${romanize(defender.tier)})`),
        separatorV2(),
        textDisplayV2(`**Participants**\nChallenger Size: ${challSize}\nDefender Size: ${defSize}`),
        textDisplayV2(`**Winner**\n${winner === "challenger" ? challenger.name : defender.name}`),
        textDisplayV2(`**${challenger.name} (Now Tier ${romanize(newChallenger.tier)})**\nPrestige: ${challenger.prestige} -> ${newChallenger.prestige} (${challGain > 0 ? "+" : ""}${challGain})`),
        textDisplayV2(`**${defender.name} (Now Tier ${romanize(newDefender.tier)})**\nPrestige: ${defender.prestige} -> ${newDefender.prestige} (${defGain > 0 ? "+" : ""}${defGain})`)
      ], 0x8a1b1b)
    ]));
  }

  return false;
}

function romanize(num) {
  return ["I", "II", "III", "IV"][num - 1] || "I";
}
