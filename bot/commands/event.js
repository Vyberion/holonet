import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, ModalBuilder, RoleSelectMenuBuilder, SlashCommandBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } from "discord.js";
import { getVerifiedProfile } from "../services/roles.js";
import { config } from "../config/index.js";
import { ephemeral, componentsV2Message, containerV2, textDisplayV2, separatorV2, mediaGalleryV2 } from "../services/discord-ui.js";
import { fetchPowerbases, getPowerbase, recordKaggathResult, syncImperialPowerbaseData } from "../services/powerbase-api.js";
import { hasAnyOverseer, hasDarkCouncilRank } from "./shift.js";
import { postActivityLog } from "../services/activity-log.js";
import { ROBLOX_GROUPS } from "../../modules/data/roblox-config.js";
import { supabase } from "../services/supabase.js";

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
        .setName("announce")
        .setDescription("Announce an event notification")
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
            .addChoices(
              { name: "Kaggath", value: "kaggath" },
              { name: "Divisional Inspections", value: "inspections" }
            )
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

const DEFAULT_INSP_IMG1 = "https://cdn.discordapp.com/attachments/718208238146814063/1220657826431762463/newDHGgfx.png?ex=6a9e7cb0&is=6a9d2b30&hm=c3e41f922c2ac339602bfb7c229745ef2da85b422fc664fbda4e814540027856&";
const DEFAULT_INSP_IMG2 = "https://cdn.discordapp.com/attachments/1211868414415470602/1229274239803330660/gfxHRs2.png?ex=6a9eda19&is=6a9d8899&hm=3a244aac4a1d8adf775c19046f732759925c930e65b16e064ef05e091f32e7ee&";

const INSPECTION_DIVISIONS = [
  {
    key: "dhg",
    name: "Dark Honor Guard",
    signet: "<:SignetDarkHonorGuard:1344016887868293220>",
    sections: [
      { name: "Activity", defaultOutOf: 100, weight: 10, prefillOutOf: true },
      { name: "Codex", defaultOutOf: 0, weight: 20 },
      { name: "Enforcement", defaultOutOf: 0, weight: 20 },
      { name: "Guarding", defaultOutOf: 0, weight: 20 },
      { name: "Combat", defaultOutOf: 0, weight: 20 },
      { name: "Formations", defaultOutOf: 40, weight: 10, prefillOutOf: true }
    ]
  },
  {
    key: "reavers",
    name: "Reavers",
    signet: "<:SignetReaver:1344017589835403284>",
    sections: [
      { name: "Activity", defaultOutOf: 100, weight: 10, prefillOutOf: true },
      { name: "Codex", defaultOutOf: 0, weight: 10 },
      { name: "Assassinations", defaultOutOf: 0, weight: 30 },
      { name: "Combat", defaultOutOf: 0, weight: 30 },
      { name: "Formations", defaultOutOf: 40, weight: 20, prefillOutOf: true }
    ]
  },
  {
    key: "dreadmasters",
    name: "Dread Masters",
    signet: "<:SignetDreadMasters:1344020119428403210>",
    sections: [
      { name: "Activity", defaultOutOf: 100, weight: 10, prefillOutOf: true },
      { name: "Codex", defaultOutOf: 0, weight: 20 },
      { name: "Lore", defaultOutOf: 0, weight: 20 },
      { name: "Dread Lore", defaultOutOf: 0, weight: 20 },
      { name: "Combat", defaultOutOf: 0, weight: 10 },
      { name: "Formations", defaultOutOf: 40, weight: 20, prefillOutOf: true }
    ]
  },
  {
    key: "inquisitors",
    name: "Inquisitorius",
    signet: "<:SignetInquisitor:1344440346284916818>",
    classified: true,
    redactedLink: "https://discord.com/channels/1058209353515139263/1058213293178753024",
    sections: [
      { name: "Activity", defaultOutOf: 100, weight: 10, prefillOutOf: true },
      { name: "Combat", defaultOutOf: 0, weight: 10 },
      { name: "Mocks", defaultOutOf: 100, weight: 40, prefillOutOf: true },
      { name: "Codex", defaultOutOf: 0, weight: 30 },
      { name: "Formations", defaultOutOf: 40, weight: 10, prefillOutOf: true }
    ]
  }
];

export function canLogDivisionalInspections(profile) {
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
  if (perms.includes("inspections:write") || perms.includes("admin:access") || perms.includes("reports:write:all") || perms.includes("pages:view:all")) {
    return true;
  }
  return false;
}

export function calculateInspectionGrade(score) {
  const num = Math.round(score);
  if (num >= 97) return "A+";
  if (num >= 93) return "A";
  if (num >= 90) return "A-";
  if (num >= 87) return "B+";
  if (num >= 83) return "B";
  if (num >= 80) return "B-";
  if (num >= 77) return "C+";
  if (num >= 73) return "C";
  if (num >= 70) return "C-";
  if (num >= 67) return "D+";
  if (num >= 63) return "D";
  if (num >= 60) return "D-";
  return "F";
}

export function parseDivisionScores(divDef, text) {
  const lines = (text || "").split("\n").map(l => l.trim()).filter(Boolean);
  const sections = [];

  for (const sec of divDef.sections) {
    let achieved = 0;
    let outOf = sec.defaultOutOf || 0;

    for (const line of lines) {
      const escaped = sec.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const reg = new RegExp(`^${escaped}\\s*[:\\-]?\\s*(.*)$`, "i");
      const match = line.match(reg);
      if (match) {
        const valStr = match[1].trim();
        const slashMatch = valStr.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
        if (slashMatch) {
          achieved = parseFloat(slashMatch[1]) || 0;
          outOf = parseFloat(slashMatch[2]) || outOf;
        } else {
          const numMatch = valStr.match(/^(\d+(?:\.\d+)?)/);
          if (numMatch) {
            achieved = parseFloat(numMatch[1]) || 0;
          }
        }
        break;
      }
    }

    if (!outOf || outOf <= 0) outOf = 100;
    const contribution = outOf > 0 ? Math.round((achieved / outOf) * sec.weight) : 0;
    sections.push({
      name: sec.name,
      achievedScore: achieved,
      outOf,
      weightedPercentage: sec.weight,
      contribution
    });
  }

  const rawSum = sections.reduce((sum, s) => sum + s.contribution, 0);
  const totalScore = Math.min(100, Math.max(0, rawSum));
  const grade = calculateInspectionGrade(totalScore);

  return { sections, totalScore, grade };
}

function buildDivisionModal(divDef, sessionId, existingData = null) {
  const modal = new ModalBuilder()
    .setCustomId(`insp_modal:${divDef.key}:${sessionId}`)
    .setTitle(`${divDef.name} Scores`);

  let prefillScores = "";
  if (existingData?.rawScoresText) {
    prefillScores = existingData.rawScoresText;
  } else {
    prefillScores = divDef.sections.map(s => {
      if (s.prefillOutOf) {
        return `${s.name}: /${s.defaultOutOf}`;
      }
      return `${s.name}: `;
    }).join("\n");
  }

  const scoresInput = new TextInputBuilder()
    .setCustomId("insp_scores_input")
    .setLabel("Scores (achieved/total)")
    .setStyle(TextInputStyle.Paragraph)
    .setValue(prefillScores)
    .setRequired(true);

  const notesInput = new TextInputBuilder()
    .setCustomId("insp_notes_input")
    .setLabel("Notes (Optional)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);

  if (existingData?.notes) {
    notesInput.setValue(existingData.notes);
  }

  modal.addComponents(
    new ActionRowBuilder().addComponents(scoresInput),
    new ActionRowBuilder().addComponents(notesInput)
  );

  return modal;
}

function buildInspectionContainers(session, unixTimestamp = null) {
  const timestamp = unixTimestamp || Math.floor(Date.now() / 1000);
  const containers = [];

  // Container 1: Results
  const resultsComponents = [];
  resultsComponents.push(textDisplayV2("# [Divisional Inspections](https://www.thesithorder.org/reports)"));
  resultsComponents.push(separatorV2());
  resultsComponents.push(textDisplayV2(
    "### <:SignetEmperor:1344015526191562864> Results\n" +
    ">>> - 90 - 100% - A\n" +
    "- 80-90% - B\n" +
    "- 70-80% - C\n" +
    "- 60-70% - D\n" +
    "- 0-60% - F"
  ));
  resultsComponents.push(separatorV2());

  for (const divDef of INSPECTION_DIVISIONS) {
    const data = session.divisions[divDef.key];
    if (divDef.classified) {
      resultsComponents.push(textDisplayV2(
        `### ${divDef.signet} ${divDef.name} - [REDACTED]\n` +
        `>>> - [REDACTED]\n`
      ));
    } else {
      const totalScore = data?.totalScore ?? 0;
      const grade = data?.grade ?? "F";
      const sectionLines = (data?.sections || []).map(s => `- ${s.name} - ${s.contribution}%`).join("\n");
      resultsComponents.push(textDisplayV2(
        `### ${divDef.signet} ${divDef.name} - ${totalScore}% - ${grade}\n` +
        `>>> ${sectionLines}`
      ));
    }
    resultsComponents.push(separatorV2());
  }

  // Image 1
  resultsComponents.push(mediaGalleryV2(session.image1Url));
  // Timestamp
  resultsComponents.push(textDisplayV2(`-# \\- The Emperor's Wrath • <t:${timestamp}:S>`));

  containers.push(containerV2(resultsComponents, 10813440));

  // Container 2: Notes
  const hasAnyNotes = INSPECTION_DIVISIONS.some(d => !d.classified && Boolean((session.divisions[d.key]?.notes || "").trim()));
  if (hasAnyNotes) {
    const notesComponents = [];
    notesComponents.push(textDisplayV2("# Notes"));
    notesComponents.push(separatorV2());

    for (const divDef of INSPECTION_DIVISIONS) {
      const notesText = (session.divisions[divDef.key]?.notes || "").trim();
      if (divDef.classified) {
        notesComponents.push(textDisplayV2(
          `### ${divDef.signet} ${divDef.name}\n` +
          `>>> - [[REDACTED]](${divDef.redactedLink})`
        ));
        notesComponents.push(separatorV2());
      } else if (notesText) {
        notesComponents.push(textDisplayV2(
          `### ${divDef.signet} ${divDef.name}\n` +
          `>>> - ${notesText}`
        ));
        notesComponents.push(separatorV2());
      }
    }

    notesComponents.push(mediaGalleryV2(session.image2Url));
    notesComponents.push(textDisplayV2(`-# \\- The Emperor's Wrath • <t:${timestamp}:S>`));

    containers.push(containerV2(notesComponents, 10813440));
  }

  return containers;
}

function renderInspectionSummaryPreview(sessionId, session) {
  const containers = buildInspectionContainers(session);

  const targetChannelId = session.targetChannelId || "1046538242788438067";
  const rolePingsText = session.selectedRoleIds?.length > 0
    ? session.selectedRoleIds.map(id => `<@&${id}>`).join(", ")
    : "None";

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`insp_channel:${sessionId}`)
    .setPlaceholder("Select Target Channel")
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(1)
    .setMaxValues(1);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId(`insp_roles:${sessionId}`)
    .setPlaceholder("Select Role Pings (Optional)")
    .setMinValues(0)
    .setMaxValues(5);

  if (session.selectedRoleIds?.length > 0) {
    roleSelect.setDefaultRoles(session.selectedRoleIds);
  }

  const redoSelect = new StringSelectMenuBuilder()
    .setCustomId(`insp_redo:${sessionId}`)
    .setPlaceholder("Redo a Division...")
    .addOptions(INSPECTION_DIVISIONS.map(d => ({
      label: `Redo ${d.name}`,
      value: d.key,
      description: `Re-enter scores/notes for ${d.name}`
    })));

  const everyoneBtn = new ButtonBuilder()
    .setCustomId(`insp_everyone:${sessionId}`)
    .setLabel(session.pingEveryone ? "Ping @everyone: ON" : "Ping @everyone: OFF")
    .setStyle(session.pingEveryone ? ButtonStyle.Primary : ButtonStyle.Secondary);

  const editImagesBtn = new ButtonBuilder()
    .setCustomId(`insp_images:${sessionId}`)
    .setLabel("Edit Images")
    .setStyle(ButtonStyle.Secondary);

  const postBtn = new ButtonBuilder()
    .setCustomId(`insp_post:${sessionId}`)
    .setLabel("Post Inspection")
    .setStyle(ButtonStyle.Success);

  const cancelBtn = new ButtonBuilder()
    .setCustomId(`insp_cancel:${sessionId}`)
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Danger);

  const controlsContainer = containerV2([
    textDisplayV2(`### Inspection Review & Controls\n**Target Channel:** <#${targetChannelId}>\n**Pings:** ${rolePingsText}`),
    new ActionRowBuilder().addComponents(channelSelect),
    new ActionRowBuilder().addComponents(roleSelect),
    new ActionRowBuilder().addComponents(redoSelect),
    new ActionRowBuilder().addComponents(everyoneBtn, editImagesBtn, postBtn, cancelBtn)
  ]);

  return ephemeral(componentsV2Message([...containers, controlsContainer]));
}

async function handleLogInspections(interaction) {
  const verified = await getVerifiedProfile(interaction.user.id).catch(() => null);
  if (!verified) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2(VERIFY_INSTRUCTIONS)])])));
  }

  if (!canLogDivisionalInspections(verified.profile)) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You do not have permission to log Divisional Inspections.")])])));
  }

  const sessionId = `${interaction.user.id}_${Date.now()}`;
  const session = {
    sessionId,
    userId: interaction.user.id,
    targetChannelId: "1046538242788438067",
    selectedRoleIds: [],
    pingEveryone: false,
    image1Url: DEFAULT_INSP_IMG1,
    image2Url: DEFAULT_INSP_IMG2,
    divisions: {},
    status: "wizard"
  };

  globalThis.__inspectionSessionCache = globalThis.__inspectionSessionCache || new Map();
  globalThis.__inspectionSessionCache.set(sessionId, session);

  const dhgDef = INSPECTION_DIVISIONS[0];
  const modal = buildDivisionModal(dhgDef, sessionId);
  await interaction.showModal(modal);
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

  if (subcommand === "announce" || subcommand === "write") {
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
    if (type === "inspections") {
      await handleLogInspections(interaction);
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
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Event setup session expired. Please run `/event announce deployment` again.")])])));
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
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Event setup session expired. Please run `/event announce deployment` again.")])])));
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
      return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Event setup session expired. Please run `/event announce deployment` again.")])])));
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

  if (interaction.customId.startsWith("insp_open:")) {
    const [, divKey, sessionId] = interaction.customId.split(":");
    const session = globalThis.__inspectionSessionCache?.get(sessionId);
    if (!session) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Inspection setup session expired. Please run `/event log type:Divisional Inspections` again.")])])));
    }
    if (interaction.user.id !== session.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this inspection can input scores.")])])));
    }

    const divDef = INSPECTION_DIVISIONS.find(d => d.key === divKey);
    if (!divDef) return false;

    const modal = buildDivisionModal(divDef, sessionId, session.divisions[divKey]);
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.customId.startsWith("insp_everyone:")) {
    const sessionId = interaction.customId.split(":")[1];
    const session = globalThis.__inspectionSessionCache?.get(sessionId);
    if (!session) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Inspection setup session expired. Please run `/event log type:Divisional Inspections` again.")])])));
    }
    if (interaction.user.id !== session.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can toggle pings.")])])));
    }

    session.pingEveryone = !session.pingEveryone;
    return interaction.update(renderInspectionSummaryPreview(sessionId, session));
  }

  if (interaction.customId.startsWith("insp_images:")) {
    const sessionId = interaction.customId.split(":")[1];
    const session = globalThis.__inspectionSessionCache?.get(sessionId);
    if (!session) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Inspection setup session expired. Please run `/event log type:Divisional Inspections` again.")])])));
    }
    if (interaction.user.id !== session.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can edit images.")])])));
    }

    const modal = new ModalBuilder()
      .setCustomId(`insp_img_modal:${sessionId}`)
      .setTitle("Edit Banner Images");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("insp_img1")
          .setLabel("Results Image URL")
          .setStyle(TextInputStyle.Short)
          .setValue(session.image1Url || DEFAULT_INSP_IMG1)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("insp_img2")
          .setLabel("Notes Image URL")
          .setStyle(TextInputStyle.Short)
          .setValue(session.image2Url || DEFAULT_INSP_IMG2)
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
    return true;
  }

  if (interaction.customId.startsWith("insp_cancel:")) {
    const sessionId = interaction.customId.split(":")[1];
    if (globalThis.__inspectionSessionCache) globalThis.__inspectionSessionCache.delete(sessionId);
    return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Divisional inspection setup cancelled.")])])));
  }

  if (interaction.customId.startsWith("insp_post:")) {
    const sessionId = interaction.customId.split(":")[1];
    const session = globalThis.__inspectionSessionCache?.get(sessionId);
    if (!session) {
      return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Inspection setup session expired. Please run `/event log type:Divisional Inspections` again.")])])));
    }
    if (interaction.user.id !== session.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can post it.")])])));
    }

    const verified = await getVerifiedProfile(interaction.user.id).catch(() => null);
    if (!verified || !canLogDivisionalInspections(verified.profile)) {
      return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("You do not have clearance to post Divisional Inspections.")])])));
    }

    const channelId = session.targetChannelId || "1046538242788438067";
    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.() || typeof channel.send !== "function") {
      return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2(`Could not access target channel <#${channelId}>.`)])])));
    }

    const pings = [];
    if (session.pingEveryone) pings.push("@everyone");
    if (session.selectedRoleIds?.length > 0) {
      pings.push(...session.selectedRoleIds.map(id => `<@&${id}>`));
    }
    const rolePingContent = pings.join(" ");

    const postTimestamp = Math.floor(Date.now() / 1000);
    const containers = buildInspectionContainers(session, postTimestamp);
    const messageComponents = [];
    if (rolePingContent) {
      messageComponents.push(textDisplayV2(rolePingContent));
    }
    messageComponents.push(...containers);

    const allowedParse = [];
    if (session.pingEveryone) allowedParse.push("everyone");

    await channel.send({
      flags: 32768,
      components: messageComponents,
      allowedMentions: {
        parse: allowedParse,
        roles: session.selectedRoleIds || []
      }
    });

    for (const divDef of INSPECTION_DIVISIONS) {
      const divData = session.divisions[divDef.key];
      if (!divData) continue;

      const payload = {
        division_key: divDef.key,
        held_on: new Date().toISOString().slice(0, 10),
        cadence: "weekly",
        author_id: String(verified.profile?.robloxId || interaction.user.id),
        author_name: verified.profile?.robloxUsername || verified.profile?.robloxDisplayName || interaction.user.username,
        bonus_percentage: 0,
        overall_score: divData.totalScore,
        notes: divData.notes || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      try {
        const { data: created, error: inspErr } = await supabase
          .from("division_inspections")
          .insert(payload)
          .select();

        if (inspErr) {
          console.error(`Error saving division_inspections for ${divDef.key}:`, inspErr);
        } else {
          const inspectionId = created?.[0]?.id;
          if (inspectionId && Array.isArray(divData.sections) && divData.sections.length > 0) {
            const sectionRows = divData.sections.map((s, idx) => ({
              inspection_id: inspectionId,
              name: s.name,
              out_of: Number(s.outOf) || 0,
              weighted_percentage: Number(s.weightedPercentage) || 0,
              achieved_score: Number(s.achievedScore) || 0,
              display_order: idx
            }));

            const { error: secErr } = await supabase
              .from("division_inspection_sections")
              .insert(sectionRows);

            if (secErr) {
              console.error(`Error saving division_inspection_sections for ${divDef.key}:`, secErr);
            }
          }
        }
      } catch (dbErr) {
        console.error(`Exception writing inspection to Supabase for ${divDef.key}:`, dbErr);
      }
    }

    await postActivityLog(interaction.client, {
      title: "Divisional Inspections Posted",
      description: `<@${interaction.user.id}> posted **Divisional Inspections** to <#${channelId}>.`,
      fields: [
        { name: "Channel", value: `<#${channelId}>`, inline: true },
        { name: "Pings", value: rolePingContent || "None", inline: true },
        {
          name: "Divisions",
          value: INSPECTION_DIVISIONS.map(d => {
            const sc = session.divisions[d.key];
            return `**${d.name}:** ${sc ? `${sc.totalScore}% (${sc.grade})` : "N/A"}`;
          }).join("\n"),
          inline: false
        }
      ]
    });

    if (globalThis.__inspectionSessionCache) globalThis.__inspectionSessionCache.delete(sessionId);
    return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2(`Divisional Inspections successfully posted to <#${channelId}> and saved to Holonet database!`)])])));
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
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Event setup session expired. Please run `/event announce deployment` again.")])])));
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
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Event setup session expired. Please run `/event announce deployment` again.")])])));
    }
    if (interaction.user.id !== draft.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can select roles.")])])));
    }

    draft.selectedRoleIds = interaction.values || [];
    return interaction.update(renderEventWritePreview(sessionId, draft));
  }

  if (interaction.customId.startsWith("insp_channel:")) {
    const sessionId = interaction.customId.split(":")[1];
    const session = globalThis.__inspectionSessionCache?.get(sessionId);
    if (!session) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Inspection setup session expired. Please run `/event log type:Divisional Inspections` again.")])])));
    }
    if (interaction.user.id !== session.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can select target channel.")])])));
    }

    session.targetChannelId = interaction.values?.[0] || "1046538242788438067";
    return interaction.update(renderInspectionSummaryPreview(sessionId, session));
  }

  if (interaction.customId.startsWith("insp_roles:")) {
    const sessionId = interaction.customId.split(":")[1];
    const session = globalThis.__inspectionSessionCache?.get(sessionId);
    if (!session) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Inspection setup session expired. Please run `/event log type:Divisional Inspections` again.")])])));
    }
    if (interaction.user.id !== session.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can select roles.")])])));
    }

    session.selectedRoleIds = interaction.values || [];
    return interaction.update(renderInspectionSummaryPreview(sessionId, session));
  }

  if (interaction.customId.startsWith("insp_redo:")) {
    const sessionId = interaction.customId.split(":")[1];
    const session = globalThis.__inspectionSessionCache?.get(sessionId);
    if (!session) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Inspection setup session expired. Please run `/event log type:Divisional Inspections` again.")])])));
    }
    if (interaction.user.id !== session.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can redo divisions.")])])));
    }

    const divKey = interaction.values?.[0];
    const divDef = INSPECTION_DIVISIONS.find(d => d.key === divKey);
    if (!divDef) return false;

    const modal = buildDivisionModal(divDef, sessionId, session.divisions[divKey]);
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
        textDisplayV2(`**${challenger.name}**\nTier: ${romanize(newChallenger.tier)}\n${formatPrestigeLine(challenger.prestige, newChallenger.prestige)}${challNote}`),
        separatorV2(),
        textDisplayV2(`**${defender.name}**\nTier: ${romanize(newDefender.tier)}\n${formatPrestigeLine(defender.prestige, newDefender.prestige)}${defNote}`)
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
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Event setup session expired. Please run `/event announce deployment` again.")])])));
    }
    if (interaction.user.id !== draft.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can submit edits.")])])));
    }

    draft.title = interaction.fields.getTextInputValue("we_title");
    draft.description = interaction.fields.getTextInputValue("we_desc") || "";

    return interaction.update(renderEventWritePreview(sessionId, draft));
  }

  if (interaction.customId.startsWith("insp_modal:")) {
    const [, divKey, sessionId] = interaction.customId.split(":");
    const session = globalThis.__inspectionSessionCache?.get(sessionId);
    if (!session) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Inspection setup session expired. Please run `/event log type:Divisional Inspections` again.")])])));
    }
    if (interaction.user.id !== session.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this inspection can submit scores.")])])));
    }

    const divDef = INSPECTION_DIVISIONS.find(d => d.key === divKey);
    if (!divDef) return false;

    const scoresRaw = interaction.fields.getTextInputValue("insp_scores_input");
    const notes = interaction.fields.getTextInputValue("insp_notes_input") || "";
    const parsed = parseDivisionScores(divDef, scoresRaw);

    session.divisions[divKey] = {
      ...parsed,
      notes,
      rawScoresText: scoresRaw
    };

    if (session.status === "summary") {
      return interaction.update(renderInspectionSummaryPreview(sessionId, session));
    }

    const currIdx = INSPECTION_DIVISIONS.findIndex(d => d.key === divKey);
    const nextDef = INSPECTION_DIVISIONS[currIdx + 1];

    if (nextDef) {
      const nextBtn = new ButtonBuilder()
        .setCustomId(`insp_open:${nextDef.key}:${sessionId}`)
        .setLabel(`Enter ${nextDef.name} Scores & Notes ➔`)
        .setStyle(ButtonStyle.Primary);

      const cancelBtn = new ButtonBuilder()
        .setCustomId(`insp_cancel:${sessionId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger);

      const card = containerV2([
        textDisplayV2(`### ${divDef.signet} ${divDef.name} Saved!\n**Score:** ${parsed.totalScore}% (${parsed.grade})`),
        separatorV2(),
        textDisplayV2(`Next up: **${nextDef.name}**`),
        new ActionRowBuilder().addComponents(nextBtn, cancelBtn)
      ], 10813440);

      return interaction.update(ephemeral(componentsV2Message([card])));
    }

    session.status = "summary";
    return interaction.update(renderInspectionSummaryPreview(sessionId, session));
  }

  if (interaction.customId.startsWith("insp_img_modal:")) {
    const sessionId = interaction.customId.split(":")[1];
    const session = globalThis.__inspectionSessionCache?.get(sessionId);
    if (!session) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Inspection setup session expired. Please run `/event log type:Divisional Inspections` again.")])])));
    }
    if (interaction.user.id !== session.userId) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Only the user who started this setup can edit images.")])])));
    }

    session.image1Url = interaction.fields.getTextInputValue("insp_img1")?.trim() || DEFAULT_INSP_IMG1;
    session.image2Url = interaction.fields.getTextInputValue("insp_img2")?.trim() || DEFAULT_INSP_IMG2;

    return interaction.update(renderInspectionSummaryPreview(sessionId, session));
  }

  return false;
}

function romanize(num) {
  return ["I", "II", "III", "IV"][num - 1] || "I";
}

function formatPrestigeLine(oldPrestige, newPrestige) {
  const oldVal = Number(oldPrestige || 0);
  const newVal = Number(newPrestige || 0);
  if (oldVal === newVal) {
    return `Prestige: ${newVal}`;
  }
  const diff = newVal - oldVal;
  return `Prestige: ${oldVal} ➔ ${newVal} (${diff >= 0 ? "+" : ""}${diff})`;
}

function formatSuddenDeathNote(status) {
  if (status === "ENTERED") return "\n⚠️ **ENTERED SUDDEN DEATH** (Next Kaggath is Grace Match)";
  if (status === "CLEARED") return "\n✅ **SUDDEN DEATH CLEARED** (Grace Match Victory)";
  if (status === "RELEGATED") return "\n☠️ **RELEGATED FROM SUDDEN DEATH** (Grace Match Defeat - Leader must restructure roster)";
  return "";
}
