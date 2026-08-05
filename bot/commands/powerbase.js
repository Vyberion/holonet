import { ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { getVerifiedProfile } from "../services/roles.js";
import { hasAnyOverseer, hasDarkCouncilRank } from "./clock.js"; 
import { ephemeral, componentsV2Message, containerV2, textDisplayV2, separatorV2 } from "../services/discord-ui.js";
import { createPowerbase, fetchPowerbases, getPowerbase, getPowerbaseForUser, isHigherRank, logPowerbaseAction, updatePowerbase } from "../services/powerbase-api.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("powerbase")
    .setDescription("Powerbase management tools")
    .addSubcommand(subcommand =>
      subcommand
        .setName("create")
        .setDescription("Request the creation of a new Powerbase (Overseer+)")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("edit")
        .setDescription("Edit your Powerbase name, description, or members")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("manage")
        .setDescription("Manage your Powerbase (or others if Emperor+)")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("dissolve")
        .setDescription("Request dissolution of a Powerbase")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("info")
        .setDescription("View info for a specific Powerbase")
    )
];

export async function handleCommand(interaction) {
  if (interaction.commandName !== "powerbase") return false;

  const subcommand = interaction.options.getSubcommand(false);

  try {
    const verified = await getVerifiedProfile(interaction.user.id);
    if (!verified) {
      await interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You must be verified to use Powerbase commands.")])])));
      return true;
    }

    if (subcommand === "create") return await handleCreate(interaction, verified);
    if (subcommand === "edit") return await handleEdit(interaction, verified);
    if (subcommand === "manage") return await handleManage(interaction, verified);
    if (subcommand === "dissolve") return await handleDissolve(interaction, verified);
    if (subcommand === "info") return await handleInfo(interaction, verified);

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
  if (interaction.customId === "pb_create_members") return await handleCreateMembers(interaction);
  if (interaction.customId === "pb_edit_members") return await handleEditMembers(interaction);
  if (interaction.customId === "pb_edit_select") return await handleEditSelect(interaction);
  if (interaction.customId === "pb_dissolve_select") return await handleDissolveSelect(interaction);
  if (interaction.customId === "pb_manage_select") return await handleManageSelect(interaction);
  if (interaction.customId === "pb_info_select") return await handleInfoSelect(interaction);
  return false;
}

// --------------------------------------------------------------------------------------
// CREATION FLOW
// --------------------------------------------------------------------------------------

async function handleCreate(interaction, verified) {
  if (!hasAnyOverseer(verified.profile) && !hasDarkCouncilRank(verified.profile, 251)) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You must be a Sith Overseer or higher to create a Powerbase.")])])));
  }

  const existing = await getPowerbaseForUser(interaction.user.id);
  if (existing) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2(`You are already part of a Powerbase (${existing.name}).`)])])));
  }

  const modal = new ModalBuilder()
    .setCustomId("pb_create_modal")
    .setTitle("Powerbase Creation");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("name")
        .setLabel("Powerbase Name")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("description")
        .setLabel("Description")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("robloxGroupId")
        .setLabel("Roblox Group ID (Optional)")
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    )
  );

  await interaction.showModal(modal);
  return true;
}

export async function handleModal(interaction) {
  if (interaction.customId === "pb_create_modal") {
    const name = interaction.fields.getTextInputValue("name");
    const description = interaction.fields.getTextInputValue("description");
    const robloxGroupId = interaction.fields.getTextInputValue("robloxGroupId");

    globalThis.__pbCreateCache = globalThis.__pbCreateCache || new Map();
    globalThis.__pbCreateCache.set(interaction.user.id, { name, description, robloxGroupId });

    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId("pb_create_members")
      .setPlaceholder("Select Apprentices (Optional)")
      .setMinValues(0)
      .setMaxValues(10);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2(`### Powerbase: ${name}`),
        textDisplayV2("Please select the Apprentices you wish to include. Note that any member you select must be equal or lower in rank to you, and must not currently be in a Powerbase.\n\n*Click outside the menu when done to submit.*"),
        row
      ])
    ])));
    return true;
  }
  
  if (interaction.customId.startsWith("pb_edit_modal:")) {
    const pbId = interaction.customId.split(":")[1];
    const name = interaction.fields.getTextInputValue("name");
    const description = interaction.fields.getTextInputValue("description");
    
    globalThis.__pbEditCache = globalThis.__pbEditCache || new Map();
    globalThis.__pbEditCache.set(interaction.user.id, { pbId, name, description });
    
    await updatePowerbase(pbId, { name, description });

    const pb = await getPowerbase(pbId);
    const currentMemberIds = (pb?.powerbase_members || []).map(m => String(m.discord_user_id));
    
    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId("pb_edit_members")
      .setPlaceholder("Select Apprentices to include")
      .setMinValues(0)
      .setMaxValues(10);
    
    if (typeof selectMenu.setDefaultUsers === "function" && currentMemberIds.length > 0) {
      selectMenu.setDefaultUsers(currentMemberIds);
    }

    const row = new ActionRowBuilder().addComponents(selectMenu);

    globalThis.__pbEditMembersCache = globalThis.__pbEditMembersCache || new Map();
    globalThis.__pbEditMembersCache.set(interaction.user.id, { pbId: pbId, name });

    await interaction.update(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2(`### Powerbase: ${name}`),
        textDisplayV2("Please select the Apprentices for this Powerbase. Anyone not selected will be removed. (Max 10)."),
        row
      ])
    ])));
    return true;
  }
  
  return false;
}

async function handleEditMembers(interaction) {
  const selectedMembers = interaction.values;
  const leaderId = interaction.user.id;
  const cached = globalThis.__pbEditMembersCache?.get(leaderId);
  
  if (!cached) {
    return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Your edit session expired. Please try again.")])])));
  }

  const pb = await getPowerbase(cached.pbId);
  if (!pb) return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase no longer exists.")])])));

  const actorProfile = await getVerifiedProfile(leaderId);
  
  const finalMemberIds = [];
  try {
    for (const memberId of selectedMembers) {
      if (memberId === leaderId) continue;
      const memberProfile = await getVerifiedProfile(memberId);
      if (!memberProfile) throw new Error(`<@${memberId}> is not verified with Holonet.`);
      
      const memberPb = await getPowerbaseForUser(memberId);
      if (memberPb && memberPb.id !== pb.id) {
        throw new Error(`<@${memberId}> is already in a Powerbase (${memberPb.name}).`);
      }
      
      if (!isHigherRank(actorProfile.profile, memberProfile.profile)) {
        throw new Error(`<@${memberId}> is a higher rank than you.`);
      }
      
      finalMemberIds.push(memberId);
    }
    
    await updatePowerbase(pb.id, {}, finalMemberIds);
    globalThis.__pbEditMembersCache.delete(leaderId);
    
    await interaction.update(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2(`### Powerbase Updated`),
        textDisplayV2(`Powerbase **${cached.name}** updated successfully!`)
      ])
    ])));
  } catch (err) {
    await interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2(`❌ **Error:** ${err.message}`)])])));
  }
  
  return true;
}

async function handleCreateMembers(interaction) {
  const selectedMembers = interaction.values;
  const leaderId = interaction.user.id;
  const cached = globalThis.__pbCreateCache?.get(leaderId);
  
  if (!cached) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Your creation session expired. Please try again.")])])));
  }

  try {
    const leaderProfile = await getVerifiedProfile(leaderId);
    if (!leaderProfile) throw new Error("Your verification profile was lost.");
    
    for (const memberId of selectedMembers) {
      if (memberId === leaderId) continue;
      const memberProfile = await getVerifiedProfile(memberId);
      if (!memberProfile) throw new Error(`<@${memberId}> is not verified.`);
      if (isHigherRank(memberProfile.profile, leaderProfile.profile)) {
         throw new Error(`Apprentice <@${memberId}> cannot be a higher rank than you.`);
      }
      const existing = await getPowerbaseForUser(memberId);
      if (existing) throw new Error(`<@${memberId}> is already in a Powerbase (${existing.name}).`);
    }

    await createPowerbase({
      name: cached.name,
      description: cached.description,
      robloxGroupId: cached.robloxGroupId,
      leaderId: leaderId,
      status: "PENDING_CREATE"
    }, selectedMembers);
    
    globalThis.__pbCreateCache.delete(leaderId);

    await interaction.update(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2(`### Request Submitted`),
        textDisplayV2(`Powerbase **${cached.name}** creation request submitted for approval by High Command!`)
      ])
    ])));
  } catch (err) {
    await interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2(`❌ **Error:** ${err.message}`)])])));
  }

  return true;
}

// --------------------------------------------------------------------------------------
// EDIT FLOW
// --------------------------------------------------------------------------------------

async function handleEdit(interaction, verified) {
  const existing = await getPowerbaseForUser(interaction.user.id);
  if (!existing || existing.leader_id !== interaction.user.id) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You do not lead a Powerbase.")])])));
  }

  const modal = new ModalBuilder()
    .setCustomId(`pb_edit_modal:${existing.id}`)
    .setTitle(`Edit ${existing.name.substring(0, 30)}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("name")
        .setLabel("Powerbase Name")
        .setStyle(TextInputStyle.Short)
        .setValue(existing.name)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("description")
        .setLabel("Description")
        .setStyle(TextInputStyle.Paragraph)
        .setValue(existing.description || "")
        .setRequired(false)
    )
  );
  
  await interaction.showModal(modal);
  return true;
}

async function handleManage(interaction, verified) {
  const isEmperorPlus = hasDarkCouncilRank(verified.profile, 253);
  const isOverseer = hasAnyOverseer(verified.profile);

  if (!isEmperorPlus && !isOverseer) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You do not have permission to manage Powerbases.")])])));
  }

  let powerbases = await fetchPowerbases();
  
  if (!isEmperorPlus) {
    powerbases = powerbases.filter(pb => pb.leader_id === interaction.user.id);
  }

  if (powerbases.length === 0) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You do not have any Powerbases to manage.")])])));
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("pb_edit_select")
    .setPlaceholder("Select a Powerbase to manage")
    .addOptions(powerbases.map(pb => ({
      label: pb.name,
      value: pb.id
    })));

  const row = new ActionRowBuilder().addComponents(select);

  await interaction.reply(ephemeral(componentsV2Message([
    containerV2([
      textDisplayV2("Select a Powerbase to manage:"),
      row
    ])
  ])));
  return true;
}

// --------------------------------------------------------------------------------------
// DISSOLVE FLOW
// --------------------------------------------------------------------------------------

async function handleDissolve(interaction, verified) {
  const isEmperorPlus = hasDarkCouncilRank(verified.profile, 253);
  const isOverseer = hasAnyOverseer(verified.profile);

  if (!isEmperorPlus && !isOverseer) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You do not have permission to dissolve Powerbases.")])])));
  }

  let powerbases = await fetchPowerbases();
  
  if (!isEmperorPlus) {
    powerbases = powerbases.filter(pb => pb.leader_id === interaction.user.id);
  }

  if (powerbases.length === 0) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You do not have any Powerbases to dissolve.")])])));
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("pb_dissolve_select")
    .setPlaceholder("Select a Powerbase to dissolve")
    .addOptions(powerbases.map(pb => ({
      label: pb.name,
      value: pb.id
    })));

  const row = new ActionRowBuilder().addComponents(select);

  await interaction.reply(ephemeral(componentsV2Message([
    containerV2([
      textDisplayV2("Select a Powerbase to dissolve:"),
      row
    ])
  ])));
  return true;
}

// --------------------------------------------------------------------------------------
// INFO FLOW
// --------------------------------------------------------------------------------------

async function handleInfo(interaction, verified) {
  let powerbases = await fetchPowerbases();
  powerbases = powerbases.filter(pb => pb.status === "ACTIVE");

  if (powerbases.length === 0) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("There are no active Powerbases.")])])));
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("pb_info_select")
    .setPlaceholder("Select a Powerbase to view")
    .addOptions(powerbases.map(pb => ({
      label: pb.name,
      value: pb.id
    })));

  const row = new ActionRowBuilder().addComponents(select);

  await interaction.reply(ephemeral(componentsV2Message([
    containerV2([
      textDisplayV2("Select a Powerbase to view:"),
      row
    ])
  ])));
  return true;
}

async function handleEditSelect(interaction) {
  const pbId = interaction.values[0];
  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

  const modal = new ModalBuilder()
    .setCustomId(`pb_edit_modal:${pbId}`)
    .setTitle(`Edit ${pb.name.substring(0, 30)}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("name")
        .setLabel("Powerbase Name")
        .setStyle(TextInputStyle.Short)
        .setValue(pb.name)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("description")
        .setLabel("Description")
        .setStyle(TextInputStyle.Paragraph)
        .setValue(pb.description || "")
        .setRequired(false)
    )
  );
  
  await interaction.showModal(modal);
  return true;
}

async function handleDissolveSelect(interaction) {
  const pbId = interaction.values[0];
  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

  if (pb.status === "PENDING_CREATE") {
    await updatePowerbase(pbId, { status: "DISSOLVED" });
    const v2Payload = componentsV2Message([
      containerV2([
        textDisplayV2(`### Request Cancelled`),
        textDisplayV2(`Powerbase request for **${pb.name}** has been cancelled.`)
      ])
    ]);
    return interaction.update(ephemeral(v2Payload));
  }

  await updatePowerbase(pbId, { status: "PENDING_DISSOLVE" });
  const v2Payload = componentsV2Message([
    containerV2([
      textDisplayV2(`### Dissolution Requested`),
      textDisplayV2(`Dissolution request for Powerbase **${pb.name}** has been submitted for approval.`)
    ])
  ]);
  return interaction.update(ephemeral(v2Payload));
}

async function handleInfoSelect(interaction) {
  const pbId = interaction.values[0];
  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

  const memberList = [`<@${pb.leader_id}>`, ...(pb.powerbase_members || []).map(m => `<@${m.discord_user_id}>`)].join(", ") || "None";

  const v2Payload = componentsV2Message([
    containerV2([
      textDisplayV2(`### ${pb.name}`),
      textDisplayV2(`**Description:** ${pb.description || "None"}\n**Leader:** <@${pb.leader_id}>\n**Tier:** ${romanize(pb.tier)}\n**Prestige:** ${pb.prestige}\n**Status:** ${pb.status}`),
      separatorV2(),
      textDisplayV2(`**Members:** ${memberList}`)
    ])
  ]);

  await interaction.update(ephemeral(v2Payload));
  return true;
}

function romanize(num) {
  return ["I", "II", "III", "IV"][num - 1] || "I";
}
