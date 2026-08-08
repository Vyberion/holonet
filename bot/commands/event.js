import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, ModalBuilder, RoleSelectMenuBuilder, SlashCommandBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { getVerifiedProfile } from "../services/roles.js";
import { config } from "../config/index.js";
import { ephemeral, componentsV2Message, containerV2, textDisplayV2, separatorV2, mediaGalleryV2 } from "../services/discord-ui.js";
import { fetchPowerbases, getPowerbase, recordKaggathResult } from "../services/powerbase-api.js";
import { hasAnyOverseer, hasDarkCouncilRank } from "./shift.js";
import { postActivityLog } from "../services/activity-log.js";

const LOG_CHANNEL_ID = "1534165352756285450";
const VERIFY_INSTRUCTIONS = "You are not linked yet. Go to <#1046452180074381403> and click the verify button, or use `/verify`.";

export const commands = [
  new SlashCommandBuilder()
    .setName("event")
    .setDescription("Event management and logging tools")
    .addSubcommand(subcommand =>
      subcommand
        .setName("write")
        .setDescription("Write an event notification")
        .addStringOption(option =>
          option
            .setName("event")
            .setDescription("Event type")
            .setRequired(true)
            .addChoices({ name: "Deployment", value: "deployment" })
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("log")
        .setDescription("Log an event result")
        .addStringOption(option =>
          option
            .setName("type")
            .setDescription("Log type")
            .setRequired(true)
            .addChoices({ name: "Kaggath", value: "kaggath" })
        )
    )
];

function buildDeploymentEventContainer(title, description) {
  const components = [];
  const safeTitle = (title || "").trim();
  const safeDesc = (description || "").trim();

  components.push(textDisplayV2(safeTitle || "# SSU"));
  components.push(separatorV2());
  
  if (safeDesc) {
    components.push(textDisplayV2(safeDesc));
    components.push(separatorV2());
  }

  const bannerUrl = `${config.holonet.baseUrl || "https://www.thesithorder.org"}/assets/other/h.o.l.o-banner.png`;
  components.push(mediaGalleryV2(bannerUrl));

  components.push({
    type: 1,
    components: [
      {
        type: 2,
        style: 5,
        label: "Deploy",
        url: `${config.holonet.baseUrl || "https://www.thesithorder.org"}/galaxy?planet=Korriban`
      }
    ]
  });

  return containerV2(components, 0xc90705);
}

function renderEventWritePreview(sessionId, draft) {
  const previewContainer = buildDeploymentEventContainer(draft.title, draft.description);

  const targetChannelId = draft.targetChannelId || "1046469967744356474";
  const rolePingsText = draft.selectedRoleIds?.length > 0
    ? draft.selectedRoleIds.map(id => `<@&${id}>`).join(", ")
    : "None";

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`we_channel:${sessionId}`)
    .setPlaceholder("Select Target Channel")
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(1)
    .setMaxValues(1);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId(`we_roles:${sessionId}`)
    .setPlaceholder("Select Role Pings (Optional)")
    .setMinValues(0)
    .setMaxValues(5);

  if (draft.selectedRoleIds?.length > 0) {
    roleSelect.setDefaultRoles(draft.selectedRoleIds);
  }

  const everyoneBtn = new ButtonBuilder()
    .setCustomId(`we_everyone:${sessionId}`)
    .setLabel(draft.pingEveryone ? "Ping @everyone: ON" : "Ping @everyone: OFF")
    .setStyle(draft.pingEveryone ? ButtonStyle.Primary : ButtonStyle.Secondary);

  const editBtn = new ButtonBuilder()
    .setCustomId(`we_edit:${sessionId}`)
    .setLabel("Edit Title & Description")
    .setStyle(ButtonStyle.Secondary);

  const postBtn = new ButtonBuilder()
    .setCustomId(`we_post:${sessionId}`)
    .setLabel("Post Event")
    .setStyle(ButtonStyle.Success);

  const cancelBtn = new ButtonBuilder()
    .setCustomId(`we_cancel:${sessionId}`)
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Danger);

  const controlsContainer = containerV2([
    textDisplayV2(`### Deployment Event Setup\n**Target Channel:** <#${targetChannelId}>\n**Pings:** ${rolePingsText}`),
    new ActionRowBuilder().addComponents(channelSelect),
    new ActionRowBuilder().addComponents(roleSelect),
    new ActionRowBuilder().addComponents(everyoneBtn, editBtn, postBtn, cancelBtn)
  ]);

  return ephemeral(componentsV2Message([previewContainer, controlsContainer]));
}

async function handleWriteEventDeployment(interaction) {
  const verified = await getVerifiedProfile(interaction.user.id).catch(() => null);
  if (!verified) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2(VERIFY_INSTRUCTIONS)])])));
  }

  const sessionId = `${interaction.user.id}_${Date.now()}`;
  const draft = {
    userId: interaction.user.id,
    eventType: "deployment",
    title: "# SSU",
    description: "",
    selectedRoleIds: [],
    pingEveryone: false,
    targetChannelId: "1046469967744356474"
  };

  globalThis.__eventWriteCache = globalThis.__eventWriteCache || new Map();
  globalThis.__eventWriteCache.set(sessionId, draft);

  const payload = renderEventWritePreview(sessionId, draft);
  await interaction.reply(payload);
}

async function handleLogKaggath(interaction) {
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
  return true;
}

export async function handleCommand(interaction) {
  if (interaction.commandName !== "event") return false;

  const subcommand = interaction.options?.getSubcommand(false) || "";

  if (subcommand === "write") {
    const eventType = interaction.options?.getString("event") || "deployment";
    if (eventType === "deployment") {
      await handleWriteEventDeployment(interaction);
      return true;
    }
  }

  if (subcommand === "log") {
    const type = interaction.options?.getString("type") || "kaggath";
    if (type === "kaggath") {
      await handleLogKaggath(interaction);
      return true;
    }
  }

  return false;
}

export async function handleButton(interaction) {
  if (interaction.customId.startsWith("we_everyone:")) {
    const sessionId = interaction.customId.split(":")[1];
    const draft = globalThis.__eventWriteCache?.get(sessionId);
    if (!draft) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Event setup session expired. Please run `/event write deployment` again.")])])));
    }
    if (interaction.user.id !== draft.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can toggle pings.")])])));
    }

    draft.pingEveryone = !draft.pingEveryone;
    return interaction.update(renderEventWritePreview(sessionId, draft));
  }

  if (interaction.customId.startsWith("we_edit:")) {
    const sessionId = interaction.customId.split(":")[1];
    const draft = globalThis.__eventWriteCache?.get(sessionId);
    if (!draft) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Event setup session expired. Please run `/event write deployment` again.")])])));
    }
    if (interaction.user.id !== draft.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can edit it.")])])));
    }

    const modal = new ModalBuilder()
      .setCustomId(`we_modal:${sessionId}`)
      .setTitle("Edit Deployment Event");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("we_title")
          .setLabel("Title (Markdown)")
          .setStyle(TextInputStyle.Short)
          .setValue(draft.title || "# SSU")
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("we_desc")
          .setLabel("Description (Optional, Markdown)")
          .setStyle(TextInputStyle.Paragraph)
          .setValue(draft.description || "")
          .setRequired(false)
      )
    );

    await interaction.showModal(modal);
    return true;
  }

  if (interaction.customId.startsWith("we_cancel:")) {
    const sessionId = interaction.customId.split(":")[1];
    if (globalThis.__eventWriteCache) globalThis.__eventWriteCache.delete(sessionId);
    return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Deployment event setup cancelled.")])])));
  }

  if (interaction.customId.startsWith("we_post:")) {
    const sessionId = interaction.customId.split(":")[1];
    const draft = globalThis.__eventWriteCache?.get(sessionId);
    if (!draft) {
      return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Event setup session expired. Please run `/event write deployment` again.")])])));
    }
    if (interaction.user.id !== draft.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can post it.")])])));
    }

    const channelId = draft.targetChannelId || "1046469967744356474";
    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.() || typeof channel.send !== "function") {
      return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2(`Could not access target channel <#${channelId}>.`)])])));
    }

    const pings = [];
    if (draft.pingEveryone) pings.push("@everyone");
    if (draft.selectedRoleIds?.length > 0) {
      pings.push(...draft.selectedRoleIds.map(id => `<@&${id}>`));
    }
    const rolePingContent = pings.join(" ");

    const eventContainer = buildDeploymentEventContainer(draft.title, draft.description);
    const messageComponents = [];
    if (rolePingContent) {
      messageComponents.push(textDisplayV2(rolePingContent));
    }
    messageComponents.push(eventContainer);

    const allowedParse = [];
    if (draft.pingEveryone) allowedParse.push("everyone");

    await channel.send({
      flags: 32768,
      components: messageComponents,
      allowedMentions: {
        parse: allowedParse,
        roles: draft.selectedRoleIds || []
      }
    });

    await postActivityLog(interaction.client, {
      title: "Event Posted",
      description: `<@${interaction.user.id}> posted a **Deployment Event** to <#${channelId}>.`,
      fields: [
        { name: "Title", value: draft.title, inline: true },
        { name: "Channel", value: `<#${channelId}>`, inline: true },
        { name: "Pings", value: rolePingContent || "None", inline: false }
      ]
    });

    if (globalThis.__eventWriteCache) globalThis.__eventWriteCache.delete(sessionId);
    return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2(`Deployment event successfully posted to <#${channelId}>!`)])])));
  }

  return false;
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

  if (interaction.customId.startsWith("we_channel:")) {
    const sessionId = interaction.customId.split(":")[1];
    const draft = globalThis.__eventWriteCache?.get(sessionId);
    if (!draft) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Event setup session expired. Please run `/event write deployment` again.")])])));
    }
    if (interaction.user.id !== draft.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can select target channel.")])])));
    }

    draft.targetChannelId = interaction.values?.[0] || "1046469967744356474";
    return interaction.update(renderEventWritePreview(sessionId, draft));
  }

  if (interaction.customId.startsWith("we_roles:")) {
    const sessionId = interaction.customId.split(":")[1];
    const draft = globalThis.__eventWriteCache?.get(sessionId);
    if (!draft) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Event setup session expired. Please run `/event write deployment` again.")])])));
    }
    if (interaction.user.id !== draft.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can select roles.")])])));
    }

    draft.selectedRoleIds = interaction.values || [];
    return interaction.update(renderEventWritePreview(sessionId, draft));
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

    const res = await recordKaggathResult(winnerId, loserId, winnerGain, loserGain, interaction.client);
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
      ], 0xc90705)
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

  if (interaction.customId.startsWith("we_modal:")) {
    const sessionId = interaction.customId.split(":")[1];
    const draft = globalThis.__eventWriteCache?.get(sessionId);
    if (!draft) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Event setup session expired. Please run `/event write deployment` again.")])])));
    }
    if (interaction.user.id !== draft.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can submit edits.")])])));
    }

    draft.title = interaction.fields.getTextInputValue("we_title");
    draft.description = interaction.fields.getTextInputValue("we_desc") || "";

    return interaction.update(renderEventWritePreview(sessionId, draft));
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
