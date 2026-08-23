import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, ModalBuilder, RoleSelectMenuBuilder, SlashCommandBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } from "discord.js";
import { getVerifiedProfile } from "../services/roles.js";
import { config } from "../config/index.js";
import { ephemeral, componentsV2Message, containerV2, textDisplayV2, separatorV2, mediaGalleryV2 } from "../services/discord-ui.js";
import { fetchPowerbases, getPowerbase, recordKaggathResult, syncImperialPowerbaseData } from "../services/powerbase-api.js";
import { hasAnyOverseer, hasDarkCouncilRank } from "./shift.js";
import { postActivityLog } from "../services/activity-log.js";
import { ROBLOX_GROUPS } from "../../modules/data/roblox-config.js";

const LOG_CHANNEL_ID = "1534165352756285450";

export async function getPowerbaseMemberDetails(pb) {
  if (!pb) return { totalCount: 0, defaultUserIds: [] };

  const isImperial = Boolean(pb.is_imperial || pb.tier === 10 || pb.tier === "X" || pb.name?.toLowerCase().includes("imperial powerbase"));
  const memberIds = (pb.powerbase_members || [])
    .map(m => String(m.user_id || m.discord_user_id || ""))
    .filter(Boolean);

  if (isImperial) {
    const { emperorId, voiceId, wrathId, shadowGuardIds } = await syncImperialPowerbaseData(pb);
    const imperialIds = [emperorId || pb.leader_id, voiceId, wrathId, ...(shadowGuardIds || [])].filter(Boolean);
    const allIds = Array.from(new Set([...imperialIds, ...memberIds].map(id => String(id))));
    return {
      isImperial: true,
      totalCount: allIds.length,
      defaultUserIds: allIds
    };
  }

  const allIds = Array.from(new Set([pb.leader_id, ...memberIds].filter(Boolean).map(id => String(id))));
  return {
    isImperial: false,
    totalCount: allIds.length,
    defaultUserIds: allIds
  };
}

function renderKaggathParticipantSelection(cached, challenger, defender) {
  const challUsers = (cached.challengerParticipants || []).map(id => `<@${id}>`);
  const defUsers = (cached.defenderParticipants || []).map(id => `<@${id}>`);

  const challDisplay = challUsers.length > 0 ? challUsers.join(", ") : "*None selected*";
  const defDisplay = defUsers.length > 0 ? defUsers.join(", ") : "*None selected*";

  const challSelect = new UserSelectMenuBuilder()
    .setCustomId("kaggath_dom_chall_parts")
    .setPlaceholder(`Select Challenger Participants (${challenger.name})`)
    .setMinValues(1)
    .setMaxValues(25);

  if (typeof challSelect.setDefaultUsers === "function" && cached.challengerParticipants?.length > 0) {
    challSelect.setDefaultUsers(cached.challengerParticipants.slice(0, 25));
  }

  const defSelect = new UserSelectMenuBuilder()
    .setCustomId("kaggath_dom_def_parts")
    .setPlaceholder(`Select Defender Participants (${defender.name})`)
    .setMinValues(1)
    .setMaxValues(25);

  if (typeof defSelect.setDefaultUsers === "function" && cached.defenderParticipants?.length > 0) {
    defSelect.setDefaultUsers(cached.defenderParticipants.slice(0, 25));
  }

  const saveBtn = new ButtonBuilder()
    .setCustomId("kaggath_dom_parts_save")
    .setLabel("Save Participants & Set Score")
    .setStyle(ButtonStyle.Success);

  const container = containerV2([
    textDisplayV2(`### Kaggath of Domination: Select Participants`),
    textDisplayV2(`**Challenger:** ${challenger.name}\n**Defender:** ${defender.name}`),
    separatorV2(),
    textDisplayV2(`**Challenger Participants:**\n${challDisplay}`),
    separatorV2(),
    textDisplayV2(`**Defender Participants:**\n${defDisplay}`),
    separatorV2(),
    new ActionRowBuilder().addComponents(challSelect),
    new ActionRowBuilder().addComponents(defSelect),
    new ActionRowBuilder().addComponents(saveBtn)
  ], 0xc90705);

  return ephemeral(componentsV2Message([container]));
}
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

const DIVISION_TIERS = ["none", "member", "nco", "hr", "2ic", "1ic", "overseer"];

export function canWriteEventDeployment(profile, divisionScope = null) {
  if (!profile) return false;

  if (
    profile.isSuperUser ||
    profile.hasFullAccess ||
    profile.authorityRoles?.emperor ||
    profile.authorityRoles?.groupOwner ||
    profile.authorityRoles?.projectManager ||
    profile.authorityRoles?.highCommand
  ) {
    return true;
  }

  const mainGroupRank = Number(profile.groupRanks?.[ROBLOX_GROUPS.MAIN_GROUP.groupId] || 0);
  if (mainGroupRank >= 44 || hasAnyOverseer(profile) || hasDarkCouncilRank(profile, 44)) {
    return true;
  }

  const perms = Array.isArray(profile.permissions) ? profile.permissions : [];
  if (perms.includes("events:write") || perms.includes("reports:write:all") || perms.includes("pages:view:all")) {
    return true;
  }

  if (divisionScope) {
    const div = String(divisionScope).toLowerCase();
    const tier = profile.divisions?.[div] || "none";
    const isHRInDiv = DIVISION_TIERS.indexOf(tier) >= DIVISION_TIERS.indexOf("hr");
    const hasDivPerm = perms.includes(`reports:write:${div}`);
    return isHRInDiv || hasDivPerm;
  }

  const isHRInAnyDiv = Object.keys(profile.divisions || {}).some(div => {
    const tier = profile.divisions[div];
    return DIVISION_TIERS.indexOf(tier) >= DIVISION_TIERS.indexOf("hr") || perms.includes(`reports:write:${div}`);
  });

  return isHRInAnyDiv || perms.some(p => p.startsWith("reports:write:"));
}

async function handleWriteEventDeployment(interaction) {
  const verified = await getVerifiedProfile(interaction.user.id).catch(() => null);
  if (!verified) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2(VERIFY_INSTRUCTIONS)])])));
  }

  if (!canWriteEventDeployment(verified.profile)) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You do not have permission to write deployment events. Requires Divisional HR+ or Sith Overseer+.")])])));
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

    const verified = await getVerifiedProfile(interaction.user.id).catch(() => null);
    if (!verified || !canWriteEventDeployment(verified.profile)) {
      return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("You do not have clearance to post deployment events.")])])));
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

  if (interaction.customId === "kaggath_dom_parts_save") {
    const cached = globalThis.__kaggathCache?.get(interaction.user.id);
    if (!cached || !cached.challengerId || !cached.defenderId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Session expired.")])])));
    }

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

    const [challenger, defender] = await Promise.all([
      getPowerbase(cached.challengerId),
      getPowerbase(cached.defenderId)
    ]);

    if (!challenger || !defender) {
      return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("One or both Powerbases no longer exist.")])])));
    }

    const [challDetails, defDetails] = await Promise.all([
      getPowerbaseMemberDetails(challenger),
      getPowerbaseMemberDetails(defender)
    ]);

    cached.challengerParticipants = challDetails.defaultUserIds;
    cached.defenderParticipants = defDetails.defaultUserIds;

    return interaction.update(renderKaggathParticipantSelection(cached, challenger, defender));
  }

  if (interaction.customId === "kaggath_dom_chall_parts") {
    const cached = globalThis.__kaggathCache?.get(interaction.user.id);
    if (!cached || !cached.challengerId || !cached.defenderId) {
      return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Session expired.")])])));
    }
    cached.challengerParticipants = interaction.values || [];

    const [challenger, defender] = await Promise.all([
      getPowerbase(cached.challengerId),
      getPowerbase(cached.defenderId)
    ]);

    return interaction.update(renderKaggathParticipantSelection(cached, challenger, defender));
  }

  if (interaction.customId === "kaggath_dom_def_parts") {
    const cached = globalThis.__kaggathCache?.get(interaction.user.id);
    if (!cached || !cached.challengerId || !cached.defenderId) {
      return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Session expired.")])])));
    }
    cached.defenderParticipants = interaction.values || [];

    const [challenger, defender] = await Promise.all([
      getPowerbase(cached.challengerId),
      getPowerbase(cached.defenderId)
    ]);

    return interaction.update(renderKaggathParticipantSelection(cached, challenger, defender));
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

    const [challDetails, defDetails] = await Promise.all([
      getPowerbaseMemberDetails(challenger),
      getPowerbaseMemberDetails(defender)
    ]);

    const challSize = challDetails.totalCount;
    const defSize = defDetails.totalCount;

    const winnerSize = winner === "challenger" ? challSize : defSize;
    const loserSize = winner === "challenger" ? defSize : challSize;

    let winnerGain = 0;
    let loserGain = 0;

    if (winnerSize < loserSize) {
      // Victory against a LARGER Powerbase (+4), Defeat against a SMALLER Powerbase (-4)
      winnerGain = +4;
      loserGain = -4;
    } else if (winnerSize > loserSize) {
      // Victory against a SMALLER Powerbase (+2), Defeat against a LARGER Powerbase (-2)
      winnerGain = +2;
      loserGain = -2;
    } else {
      // Victory against an EQUAL Powerbase (+3), Defeat against an EQUAL Powerbase (-3)
      winnerGain = +3;
      loserGain = -3;
    }

    const challGain = winner === "challenger" ? winnerGain : loserGain;
    const defGain = winner === "challenger" ? loserGain : winnerGain;

    const winnerId = winner === "challenger" ? challenger.id : defender.id;
    const loserId = winner === "challenger" ? defender.id : challenger.id;

    const res = await recordKaggathResult(winnerId, loserId, winnerGain, loserGain, interaction.client);
    const newChallenger = winner === "challenger" ? res?.winner : res?.loser;
    const newDefender = winner === "challenger" ? res?.loser : res?.winner;

    const challParticipants = (cached.challengerParticipants && cached.challengerParticipants.length > 0)
      ? cached.challengerParticipants.map(id => `<@${id}>`).join(", ")
      : `<@${challenger.leader_id}>`;
    const defParticipants = (cached.defenderParticipants && cached.defenderParticipants.length > 0)
      ? cached.defenderParticipants.map(id => `<@${id}>`).join(", ")
      : `<@${defender.leader_id}>`;

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
