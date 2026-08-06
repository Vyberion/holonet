import { ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { getVerifiedProfile } from "../services/roles.js";
import { hasAnyOverseer, hasDarkCouncilRank } from "./clock.js";
import { ephemeral, componentsV2Message, containerV2, textDisplayV2, separatorV2 } from "../services/discord-ui.js";
import { createPowerbase, deletePowerbase, fetchPowerbases, getPowerbase, getPowerbaseByName, getPowerbaseForUser, isHigherRank, logPowerbaseAction, slugifyPowerbase, syncPowerbaseRosterMessage, updatePowerbase } from "../services/powerbase-api.js";
import { ROBLOX_GROUPS } from "../../modules/data/roblox-config.js";
import { hasPermission } from "../../modules/auth/permissions.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("powerbase")
    .setDescription("Powerbase management tools")
    .addSubcommand(subcommand =>
      subcommand
        .setName("create")
        .setDescription("Request the creation of a new Powerbase.")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("edit")
        .setDescription("Edit your Powerbase name, description, group ID, or members")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("manage")
        .setDescription("Manage a Powerbase's name, description, group ID, members, or leadership")
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
  if (interaction.customId.startsWith("pb_edit_members")) return await handleEditMembers(interaction);
  if (interaction.customId === "pb_edit_select") return await handleEditSelect(interaction);
  if (interaction.customId === "pb_dissolve_select") return await handleDissolveSelect(interaction);
  if (interaction.customId === "pb_manage_select") return await handleManageSelect(interaction);
  if (interaction.customId.startsWith("pb_manage_action:")) return await handleManageActionSelect(interaction);
  if (interaction.customId === "pb_info_select") return await handleInfoSelect(interaction);
  if (interaction.customId.startsWith("pb_change_leader:")) return await handleChangeLeaderSelect(interaction);
  return false;
}

// --------------------------------------------------------------------------------------
// CREATION FLOW
// --------------------------------------------------------------------------------------

async function handleCreate(interaction, verified) {
  if (!hasPermission(verified.profile, "powerbase:create")) {
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
        .setLabel("Description (Optional)")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("robloxGroupId")
        .setLabel("Roblox Group ID / Link (Optional)")
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

    const existingName = await getPowerbaseByName(name);
    if (existingName) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2(`❌ A Powerbase named "${name}" already exists.`)])])));
    }

    await createPowerbase({
      name,
      description,
      robloxGroupId,
      leaderId: interaction.user.id,
      status: "PENDING_CREATE"
    }, []);

    await interaction.reply(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2(`### Request Submitted`),
        textDisplayV2(`Powerbase **${name}** creation request submitted for approval by High Command.`)
      ])
    ])));
    return true;
  }

  if (interaction.customId.startsWith("pb_edit_modal:")) {
    const pbId = interaction.customId.split(":")[1];
    const name = interaction.fields.getTextInputValue("name");
    const description = interaction.fields.getTextInputValue("description");
    const robloxGroupId = interaction.fields.getTextInputValue("robloxGroupId");

    const existingName = await getPowerbaseByName(name);
    if (existingName && existingName.id !== pbId) {
      return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2(`❌ A Powerbase named "${name}" already exists.`)])])));
    }

    await updatePowerbase(pbId, { name, description, roblox_group_id: robloxGroupId || null });
    await syncPowerbaseRosterMessage(interaction.client, pbId);

    const pb = await getPowerbase(pbId);
    const currentMemberIds = (pb?.powerbase_members || [])
      .map(m => String(m.user_id || m.discord_user_id))
      .filter(Boolean);

    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId(`pb_edit_members:${pbId}`)
      .setPlaceholder("Select Apprentices to include")
      .setMinValues(0)
      .setMaxValues(10);

    if (typeof selectMenu.setDefaultUsers === "function" && currentMemberIds.length > 0) {
      selectMenu.setDefaultUsers(currentMemberIds);
    }

    await interaction.update(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2(`### Powerbase: ${name}`),
        textDisplayV2("Please select the Apprentices for this Powerbase. Anyone not selected will be removed. (Max 10)."),
        new ActionRowBuilder().addComponents(selectMenu)
      ])
    ])));
    return true;
  }

  return false;
}

async function handleEditMembers(interaction) {
  const selectedMembers = interaction.values;
  const pbId = interaction.customId.includes(":") 
    ? interaction.customId.split(":")[1] 
    : globalThis.__pbEditMembersCache?.get(interaction.user.id)?.pbId;

  if (!pbId) {
    return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Your edit session expired. Please try again.")])])));
  }

  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase no longer exists.")])])));

  const actorProfile = await getVerifiedProfile(interaction.user.id);

  const finalMemberIds = [];
  try {
    for (const memberId of selectedMembers) {
      if (memberId === pb.leader_id) continue;
      const memberProfile = await getVerifiedProfile(memberId);
      if (!memberProfile) throw new Error(`<@${memberId}> is not verified with Holonet.`);

      const memberPb = await getPowerbaseForUser(memberId);
      if (memberPb && memberPb.id !== pb.id) {
        throw new Error(`<@${memberId}> is already in a Powerbase (${memberPb.name}).`);
      }

      finalMemberIds.push(memberId);
    }

    await updatePowerbase(pb.id, {}, finalMemberIds);
    if (globalThis.__pbEditMembersCache) globalThis.__pbEditMembersCache.delete(interaction.user.id);

    await syncPowerbaseRosterMessage(interaction.client, pb.id);

    const v2Payload = componentsV2Message([
      containerV2([
        textDisplayV2(`### Powerbase Updated`),
        textDisplayV2(`Roster for Powerbase **${pb.name}** updated successfully!`)
      ])
    ]);
    return interaction.update(ephemeral(v2Payload));
  } catch (err) {
    return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2(`❌ **Error:** ${err.message}`)])])));
  }
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
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("robloxGroupId")
        .setLabel("Roblox Group ID / Link (Optional)")
        .setStyle(TextInputStyle.Short)
        .setValue(existing.roblox_group_id || "")
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
    .setCustomId("pb_manage_select")
    .setPlaceholder("Select a Powerbase to manage")
    .addOptions(powerbases.map(pb => ({
      label: pb.name,
      value: pb.id
    })));

  await interaction.reply(ephemeral(componentsV2Message([
    containerV2([
      textDisplayV2("Select a Powerbase to manage:"),
      new ActionRowBuilder().addComponents(select)
    ])
  ])));
  return true;
}

async function handleManageSelect(interaction) {
  const pbId = interaction.values[0];
  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

  const verified = await getVerifiedProfile(interaction.user.id);
  const isEmperorPlus = hasDarkCouncilRank(verified.profile, 253);

  const options = [
    { label: "Edit Details (Name / Description / Group ID)", value: "edit" },
    { label: "Manage Roster (Add / Remove Apprentices)", value: "members" }
  ];

  if (isEmperorPlus) {
    options.push({ label: "Transfer Leadership", value: "leader" });
  }

  options.push({ label: "Dissolve Powerbase", value: "dissolve" });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`pb_manage_action:${pbId}`)
    .setPlaceholder(`Manage ${pb.name.substring(0, 30)}...`)
    .addOptions(options);

  await interaction.update(ephemeral(componentsV2Message([
    containerV2([
      textDisplayV2(`### Manage Powerbase: ${pb.name}`),
      textDisplayV2("Select an action to perform:"),
      new ActionRowBuilder().addComponents(select)
    ])
  ])));
  return true;
}

async function handleManageActionSelect(interaction) {
  const pbId = interaction.customId.split(":")[1];
  const action = interaction.values[0];

  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

  if (action === "edit") {
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
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("robloxGroupId")
          .setLabel("Roblox Group ID / Link (Optional)")
          .setStyle(TextInputStyle.Short)
          .setValue(pb.roblox_group_id || "")
          .setRequired(false)
      )
    );

    await interaction.showModal(modal);
    return true;
  }

  if (action === "members") {
    const currentMemberIds = (pb?.powerbase_members || [])
      .map(m => String(m.user_id || m.discord_user_id))
      .filter(Boolean);

    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId(`pb_edit_members:${pbId}`)
      .setPlaceholder("Select Apprentices to include")
      .setMinValues(0)
      .setMaxValues(10);

    if (typeof selectMenu.setDefaultUsers === "function" && currentMemberIds.length > 0) {
      selectMenu.setDefaultUsers(currentMemberIds);
    }

    await interaction.update(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2(`### Powerbase: ${pb.name}`),
        textDisplayV2("Please select the Apprentices for this Powerbase. Anyone not selected will be removed. (Max 10)."),
        new ActionRowBuilder().addComponents(selectMenu)
      ])
    ])));
    return true;
  }

  if (action === "leader") {
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId(`pb_change_leader:${pbId}`)
      .setPlaceholder("Select a new Leader for this Powerbase");

    await interaction.update(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2(`### Manage Leadership: ${pb.name}`),
        textDisplayV2(`**Current Leader:** <@${pb.leader_id}>\n\nSelect a verified user to transfer leadership of this Powerbase:`),
        new ActionRowBuilder().addComponents(userSelect)
      ])
    ])));
    return true;
  }

  if (action === "dissolve") {
    if (pb.status === "PENDING_CREATE") {
      await deletePowerbase(pbId);
      await syncPowerbaseRosterMessage(interaction.client, pbId);
      const v2Payload = componentsV2Message([
        containerV2([
          textDisplayV2(`### Request Cancelled`),
          textDisplayV2(`Powerbase request for **${pb.name}** has been cancelled and deleted.`)
        ])
      ]);
      return interaction.update(ephemeral(v2Payload));
    }

    await updatePowerbase(pbId, { status: "PENDING_DISSOLVE" });
    await syncPowerbaseRosterMessage(interaction.client, pbId);
    const v2Payload = componentsV2Message([
      containerV2([
        textDisplayV2(`### Dissolution Requested`),
        textDisplayV2(`Dissolution request for Powerbase **${pb.name}** has been submitted for approval by High Command.`)
      ])
    ]);
    return interaction.update(ephemeral(v2Payload));
  }

  return true;
}

async function handleChangeLeaderSelect(interaction) {
  const pbId = interaction.customId.split(":")[1];
  const newLeaderId = interaction.values[0];

  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

  try {
    const verified = await getVerifiedProfile(newLeaderId);
    if (!verified) throw new Error(`<@${newLeaderId}> is not verified with Holonet.`);

    const existingPb = await getPowerbaseForUser(newLeaderId);
    if (existingPb && existingPb.id !== pbId) {
      throw new Error(`<@${newLeaderId}> is already in another Powerbase (${existingPb.name}).`);
    }

    const currentMemberIds = (pb.powerbase_members || [])
      .map(m => String(m.user_id || m.discord_user_id || ""))
      .filter(id => id && id !== newLeaderId);

    await updatePowerbase(pbId, { leader_id: newLeaderId }, currentMemberIds);

    await logPowerbaseAction(interaction.user.id, "LEADER_CHANGED", pbId, `Leadership transferred to <@${newLeaderId}>`);

    await syncPowerbaseRosterMessage(interaction.client, pbId);

    const v2Payload = componentsV2Message([
      containerV2([
        textDisplayV2(`### Leadership Transferred`),
        textDisplayV2(`Leadership of Powerbase **${pb.name}** has been transferred to <@${newLeaderId}>.`)
      ])
    ]);
    return interaction.update(ephemeral(v2Payload));
  } catch (err) {
    return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2(`❌ **Error:** ${err.message}`)])])));
  }
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

  await interaction.reply(ephemeral(componentsV2Message([
    containerV2([
      textDisplayV2("Select a Powerbase to dissolve:"),
      new ActionRowBuilder().addComponents(select)
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

  await interaction.reply(ephemeral(componentsV2Message([
    containerV2([
      textDisplayV2("Select a Powerbase to view:"),
      new ActionRowBuilder().addComponents(select)
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
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("robloxGroupId")
        .setLabel("Roblox Group ID / Link (Optional)")
        .setStyle(TextInputStyle.Short)
        .setValue(pb.roblox_group_id || "")
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
    await deletePowerbase(pbId);
    await syncPowerbaseRosterMessage(interaction.client, pbId);
    const v2Payload = componentsV2Message([
      containerV2([
        textDisplayV2(`### Request Cancelled`),
        textDisplayV2(`Powerbase request for **${pb.name}** has been cancelled and deleted.`)
      ])
    ]);
    return interaction.update(ephemeral(v2Payload));
  }

  await updatePowerbase(pbId, { status: "PENDING_DISSOLVE" });
  await syncPowerbaseRosterMessage(interaction.client, pbId);
  const v2Payload = componentsV2Message([
    containerV2([
      textDisplayV2(`### Dissolution Requested`),
      textDisplayV2(`Dissolution request for Powerbase **${pb.name}** has been submitted for approval by High Command.`)
    ])
  ]);
  return interaction.update(ephemeral(v2Payload));
}

async function handleInfoSelect(interaction) {
  const pbId = interaction.values[0];
  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

  const memberIds = (pb.powerbase_members || [])
    .map(m => String(m.user_id || m.discord_user_id || ""))
    .filter(Boolean);

  const leaderText = `<@${pb.leader_id}> *(Leader)*`;
  const apprenticeText = memberIds.length > 0
    ? memberIds.map(id => `<@${id}> *(Apprentice)*`).join("\n")
    : "*No apprentices assigned*";

  const sdBadge = pb.is_sudden_death ? " ⚠️ **[SUDDEN DEATH]**" : "";

  const slug = String(pb.name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const pbUrl = `https://www.thesithorder.org/powerbases/${slug}`;

  const components = [
    textDisplayV2(`### [${pb.name}](${pbUrl})`),
    separatorV2(),
    textDisplayV2(`**Leader:** <@${pb.leader_id}>\n**Tier:** ${romanize(pb.tier)}${sdBadge}\n**Prestige:** ${pb.prestige}`)
  ];

  if (pb.description) {
    components.push(separatorV2());
    components.push(textDisplayV2(`**Description:**\n${pb.description}`));
  }

  if (pb.roblox_group_id) {
    components.push(separatorV2());
    components.push(textDisplayV2(`**Roblox Group ID:** ${pb.roblox_group_id}`));
  }

  components.push(separatorV2());
  components.push(textDisplayV2(`**Roster (${memberIds.length + 1} Total):**\n${leaderText}\n${apprenticeText}`));

  const v2Payload = componentsV2Message([containerV2(components)]);
  await interaction.update(ephemeral(v2Payload));
  return true;
}

function romanize(num) {
  return ["I", "II", "III", "IV"][num - 1] || "I";
}
