import { ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { getVerifiedProfile } from "../services/roles.js";
import { ephemeral, componentsV2Message, containerV2, textDisplayV2, separatorV2 } from "../services/discord-ui.js";
import { fetchPowerbases, getPowerbase, adjustPrestige, recordKaggathResult } from "../services/powerbase-api.js";
import { hasAnyOverseer, hasDarkCouncilRank } from "./clock.js"; 

export const commands = [];

const LOG_CHANNEL_ID = "1534165352756285450";

export async function handleCommand(interaction) {
  if (interaction.commandName !== "write" || interaction.options.getSubcommand() !== "kaggath") return false;

  try {
    const verified = await getVerifiedProfile(interaction.user.id);
    if (!verified) {
      await interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You must be verified to use Kaggath commands.")])])));
      return true;
    }

    if (!hasAnyOverseer(verified.profile) && !hasDarkCouncilRank(verified.profile, 251)) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You do not have permission to write Kaggaths.")])])));
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

    await interaction.reply(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2("Select Kaggath Type:"),
        row
      ])
    ])));

  } catch (err) {
    console.error(err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(ephemeral(componentsV2Message([containerV2([textDisplayV2(`❌ **Error:** ` + err.message)])])));
    } else {
      await interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2(`❌ **Error:** ` + err.message)])])));
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
        return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Not enough active Powerbases for a Domination Kaggath.")])])));
      }
      
      const select = new StringSelectMenuBuilder()
        .setCustomId("kaggath_dom_challenger")
        .setPlaceholder("Select Challenging Powerbase")
        .addOptions(active.map(pb => ({ label: pb.name, value: pb.id })));
        
      const row = new ActionRowBuilder().addComponents(select);

      return interaction.update(ephemeral(componentsV2Message([
        containerV2([
          textDisplayV2("Select the Challenging Powerbase:"),
          row
        ])
      ])));
    }

    return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2(`${type} selected. Further inputs not fully implemented yet.`)])])));
  }
  
  if (interaction.customId === "kaggath_dom_challenger") {
    const challengerId = interaction.values[0];
    const cached = globalThis.__kaggathCache?.get(interaction.user.id);
    if (!cached) return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Session expired.")])])));
    cached.challengerId = challengerId;

    const powerbases = await fetchPowerbases();
    const active = powerbases.filter(pb => pb.status === "ACTIVE" && pb.id !== challengerId);
    
    if (active.length === 0) {
      return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("No eligible defending Powerbases found.")])])));
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId("kaggath_dom_defender")
      .setPlaceholder("Select Defending Powerbase")
      .addOptions(active.map(pb => ({ label: pb.name, value: pb.id })));
      
    const row = new ActionRowBuilder().addComponents(select);

    return interaction.update(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2("Select the Defending Powerbase:"),
        row
      ])
    ])));
  }

  if (interaction.customId === "kaggath_dom_defender") {
    const defenderId = interaction.values[0];
    const cached = globalThis.__kaggathCache?.get(interaction.user.id);
    if (!cached || !cached.challengerId) return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Session expired.")])])));
    cached.defenderId = defenderId;

    const modal = new ModalBuilder()
      .setCustomId("kaggath_dom_score_modal")
      .setTitle("Enter Kaggath Score");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("challenger_score")
          .setLabel("Challenger Score")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("defender_score")
          .setLabel("Defender Score")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
    return true;
  }

  return false;
}

export async function handleModal(interaction) {
  if (interaction.customId === "kaggath_dom_score_modal") {
    const cached = globalThis.__kaggathCache?.get(interaction.user.id);
    if (!cached || !cached.challengerId || !cached.defenderId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Session expired.")])])));
    }

    const challScoreInput = interaction.fields.getTextInputValue("challenger_score");
    const defScoreInput = interaction.fields.getTextInputValue("defender_score");

    const challScore = parseInt(challScoreInput, 10);
    const defScore = parseInt(defScoreInput, 10);

    if (isNaN(challScore) || isNaN(defScore)) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Scores must be valid numbers.")])])));
    }

    if (challScore === defScore) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Ties are not allowed in Kaggaths.")])])));
    }

    globalThis.__kaggathCache.delete(interaction.user.id);

    const winner = challScore > defScore ? "challenger" : "defender";

    const [challenger, defender] = await Promise.all([
      getPowerbase(cached.challengerId),
      getPowerbase(cached.defenderId)
    ]);

    if (!challenger || !defender) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("One or both Powerbases no longer exist.")])])));
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

    const winnerId = winner === "challenger" ? challenger.id : defender.id;
    const loserId = winner === "challenger" ? defender.id : challenger.id;
    const winnerGain = winner === "challenger" ? challGain : defGain;
    const loserGain = winner === "challenger" ? defGain : challGain;

    const res = await recordKaggathResult(winnerId, loserId, winnerGain, loserGain);
    const newChallenger = winner === "challenger" ? res?.winner : res?.loser;
    const newDefender = winner === "challenger" ? res?.loser : res?.winner;

    const challParticipants = [`<@${challenger.leader_id}>`, ...(challenger.powerbase_members || []).map(m => `<@${m.discord_user_id}>`)].join(", ");
    const defParticipants = [`<@${defender.leader_id}>`, ...(defender.powerbase_members || []).map(m => `<@${m.discord_user_id}>`)].join(", ");

    const winnerName = winner === "challenger" ? challenger.name : defender.name;

    const challNote = formatSuddenDeathNote(newChallenger?.suddenDeathStatus);
    const defNote = formatSuddenDeathNote(newDefender?.suddenDeathStatus);

    const v2Payload = componentsV2Message([
      containerV2([
        textDisplayV2(`### Kaggath of Domination`),
        textDisplayV2(`**Challenger:** ${challenger.name} (${romanize(challenger.tier)})\n**Defender:** ${defender.name} (${romanize(defender.tier)})`),
        separatorV2(),
        textDisplayV2(`**Participants**\n**Challenger:** ${challParticipants}\n**Defender:** ${defParticipants}`),
        separatorV2(),
        textDisplayV2(`**Score:**\n${challScore} - ${defScore}\n**Winner:** ${winnerName}`),
        separatorV2(),
        textDisplayV2(`**${challenger.name}**\nTier: ${romanize(newChallenger.tier)}\nPrestige: ${challenger.prestige} ➔ ${newChallenger.prestige} (${challGain >= 0 ? "+" : ""}${challGain})${challNote}`),
        separatorV2(),
        textDisplayV2(`**${defender.name}**\nTier: ${romanize(newDefender.tier)}\nPrestige: ${defender.prestige} ➔ ${newDefender.prestige} (${defGain >= 0 ? "+" : ""}${defGain})${defNote}`)
      ], 0x8a1b1b)
    ]);

    const targetChannel = await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (targetChannel && targetChannel.isTextBased()) {
      await targetChannel.send(v2Payload);
      await interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2(`Kaggath log successfully submitted to <#${LOG_CHANNEL_ID}>.`)])])));
    } else {
      await interaction.reply(ephemeral(v2Payload));
    }

    return true;
  }

  return false;
}

function romanize(num) {
  return ["I", "II", "III", "IV"][num - 1] || "I";
}

function formatSuddenDeathNote(status) {
  if (status === "ENTERED") return "\n⚠️ **ENTERED SUDDEN DEATH** (Next Kaggath is Grace Match)";
  if (status === "CLEARED") return "\n✅ **SUDDEN DEATH CLEARED** (Grace Match Victory)";
  if (status === "RELEGATED") return "\n☠️ **RELEGATED FROM SUDDEN DEATH** (Grace Match Defeat - Leader must restructure roster)";
  return "";
}
