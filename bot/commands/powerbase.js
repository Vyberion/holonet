import { ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } from "discord.js";
import { getVerifiedProfile } from "../services/roles.js";
import { hasAnyOverseer, hasDarkCouncilRank } from "./shift.js";
import { ephemeral, componentsV2Message, containerV2, textDisplayV2, separatorV2, buttonRow, button, mediaGalleryV2 } from "../services/discord-ui.js";
import { createPowerbase, deletePowerbase, fetchPowerbases, getPowerbase, getPowerbaseByName, getPowerbaseCapacity, getPowerbaseForUser, isHigherRank, logPowerbaseAction, persistBannerImage, slugifyPowerbase, syncPowerbaseRosterMessage, syncStoredPowerbaseRosters, updatePowerbase } from "../services/powerbase-api.js";
import { ROBLOX_GROUPS } from "../../modules/data/roblox-config.js";
import { hasPermission } from "../../modules/auth/permissions.js";
import { postActivityLog, postPowerbaseLog, HIGH_COMMAND_ROLE_ID } from "../services/activity-log.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("powerbase")
    .setDescription("Powerbase management tools")
    .addSubcommand(subcommand =>
      subcommand
        .setName("banner")
        .setDescription("Upload a banner image attachment for a Powerbase")
        .addAttachmentOption(option =>
          option.setName("image").setDescription("The image to upload").setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("create")
        .setDescription("Request the creation of a new Powerbase.")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("manage")
        .setDescription("Manage Powerbase name, description, group ID, members, or leadership")
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
    .addSubcommand(subcommand =>
      subcommand
        .setName("sync")
        .setDescription("Sync and refresh all Powerbase roster embeds in Discord")
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

    if (subcommand === "sync") {
      const canManageAll = hasPermission(verified.profile, "powerbase:manage:all");
      if (!canManageAll) {
        await interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You do not have permission to force sync Powerbases.")])])));
        return true;
      }
      await interaction.deferReply({ ephemeral: true });
      const result = await syncStoredPowerbaseRosters(interaction.client);
      await interaction.editReply(ephemeral(componentsV2Message([containerV2([
        textDisplayV2("### Powerbase Sync Completed"),
        textDisplayV2(`Successfully checked and synced **${result.synced}** active Powerbase(s) in the roster channel.`)
      ])])));
      return true;
    }

    if (subcommand === "create") return await handleCreate(interaction, verified);
    if (subcommand === "manage") return await handleManage(interaction, verified);
    if (subcommand === "dissolve") return await handleDissolve(interaction, verified);
    if (subcommand === "info") return await handleInfo(interaction, verified);
    if (subcommand === "banner") return await handleBanner(interaction, verified);

  } catch (err) {
    console.error(err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(ephemeral(componentsV2Message([containerV2([textDisplayV2(`**Error:** ` + err.message)])])));
    } else {
      await interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2(`**Error:** ` + err.message)])])));
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
  if (interaction.customId === "pb_banner_select") return await handleBannerSelect(interaction);
  if (interaction.customId.startsWith("pb_change_leader:")) return await handleChangeLeaderSelect(interaction);
  return false;
}

export async function handleButton(interaction) {
  if (interaction.customId.startsWith("pb_img_manage:")) {
    const pbId = interaction.customId.split(":")[1];
    return await showImageOptions(interaction, pbId);
  }

  if (interaction.customId.startsWith("pb_img_url_modal_trigger:")) {
    const pbId = interaction.customId.split(":")[1];
    const pb = await getPowerbase(pbId);
    const modal = new ModalBuilder()
      .setCustomId(`pb_img_url_modal:${pbId}`)
      .setTitle("Banner Image URL");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("imageUrl")
          .setLabel("Image Direct Link (URL)")
          .setStyle(TextInputStyle.Short)
          .setValue(pb?.image_url || "")
          .setPlaceholder("https://cdn.discordapp.com/attachments/... or direct image link")
          .setRequired(false)
      )
    );
    await interaction.showModal(modal);
    return true;
  }



  if (interaction.customId.startsWith("pb_img_remove:")) {
    const pbId = interaction.customId.split(":")[1];
    const pb = await getPowerbase(pbId);
    if (!pb) return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

    await updatePowerbase(pbId, { image_url: null });
    await syncPowerbaseRosterMessage(interaction.client, pbId);

    return interaction.update(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2("### Image Removed"),
        textDisplayV2(`Banner image for **${pb.name}** has been removed.`)
      ])
    ])));
  }

  return false;
}

async function showImageOptions(interaction, pbId) {
  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

  const payload = componentsV2Message([
    containerV2([
      textDisplayV2(`### Banner Image Management: ${pb.name}`),
      textDisplayV2("To upload an image file from your device, please use the `/powerbase banner` command anywhere in chat!"),
      textDisplayV2("Or, if you already have a direct link (URL) to an image, you can enter it below."),
      buttonRow([
        button(`pb_img_url_modal_trigger:${pbId}`, "Enter Image URL", ButtonStyle.Secondary),
        button(`pb_img_remove:${pbId}`, "Remove Image", ButtonStyle.Danger)
      ])
    ])
  ]);

  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(ephemeral(payload));
  } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
    return interaction.update(ephemeral(payload));
  } else {
    return interaction.reply(ephemeral(payload));
  }
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
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2(`A Powerbase named "${name}" already exists.`)])])));
    }

    const verified = await getVerifiedProfile(interaction.user.id).catch(() => null);
    const leaderUsername = verified?.profile?.name || verified?.link?.roblox_username || interaction.user.username;

    const createdPb = await createPowerbase({
      name,
      description,
      robloxGroupId,
      leaderId: interaction.user.id,
      leaderName: leaderUsername,
      status: "PENDING_CREATE"
    }, []);

    let groupLinkValue = "None";
    if (robloxGroupId) {
      const match = String(robloxGroupId).match(/\d+/);
      const cleanUrl = String(robloxGroupId).startsWith("http")
        ? robloxGroupId
        : `https://www.roblox.com/groups/${match ? match[0] : robloxGroupId}`;
      groupLinkValue = `[Group Link](${cleanUrl})`;
    }

    await postPowerbaseLog(interaction.client, {
      title: "Powerbase Creation Requested",
      description: `A new Powerbase creation request has been submitted for approval by High Command.`,
      content: `<@&${HIGH_COMMAND_ROLE_ID}>`,
      fields: [
        { name: "Powerbase Name", value: name, inline: true },
        { name: "Leader", value: `${leaderUsername} (<@${interaction.user.id}>)`, inline: true },
        { name: "Roblox Group", value: groupLinkValue, inline: true }
      ],
      color: 0xc90705,
      allowedRoleIds: [HIGH_COMMAND_ROLE_ID]
    });

    await interaction.reply(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2(`### Request Submitted`),
        textDisplayV2(`Powerbase **${name}** creation request submitted for approval by High Command. You can set a banner image now or later via manage.`),
        buttonRow([
          button(`pb_img_manage:${createdPb.id}`, "Upload / Set Banner Image", ButtonStyle.Primary)
        ])
      ])
    ])));
    return true;
  }

  if (interaction.customId.startsWith("pb_img_url_modal:")) {
    const pbId = interaction.customId.split(":")[1];
    const rawImageUrl = interaction.fields.getTextInputValue("imageUrl");

    const pb = await getPowerbase(pbId);
    if (!pb) return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

    await interaction.deferReply({ ephemeral: true });
    const imageUrl = rawImageUrl ? await persistBannerImage(rawImageUrl, pbId) : null;

    await updatePowerbase(pbId, { image_url: imageUrl });
    await syncPowerbaseRosterMessage(interaction.client, pbId);

    const msg = imageUrl ? `Banner image for **${pb.name}** updated successfully!` : `Banner image for **${pb.name}** removed.`;
    await interaction.editReply(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2("### Image Details Updated"),
        textDisplayV2(msg)
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
      return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2(`A Powerbase named "${name}" already exists.`)])])));
    }

    await updatePowerbase(pbId, { name, description, roblox_group_id: robloxGroupId || null });
    await syncPowerbaseRosterMessage(interaction.client, pbId);

    const pb = await getPowerbase(pbId);
    let editGroupLink = "None";
    if (pb.roblox_group_id) {
      const match = String(pb.roblox_group_id).match(/\d+/);
      const cleanUrl = String(pb.roblox_group_id).startsWith("http")
        ? pb.roblox_group_id
        : `https://www.roblox.com/groups/${match ? match[0] : pb.roblox_group_id}`;
      editGroupLink = `[Group Link](${cleanUrl})`;
    }

    await postPowerbaseLog(interaction.client, {
      title: "Powerbase Details Updated",
      description: `Powerbase details for **${pb.name}** have been updated.`,
      fields: [
        { name: "Powerbase Name", value: pb.name, inline: true },
        { name: "Leader", value: `<@${pb.leader_id}>`, inline: true },
        { name: "Roblox Group", value: editGroupLink, inline: true },
        { name: "Updated By", value: `<@${interaction.user.id}>`, inline: true }
      ],
      color: 0xc90705
    });
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

    const oldMemberIds = (pb?.powerbase_members || [])
      .map(m => String(m.user_id || m.discord_user_id || ""))
      .filter(Boolean);

    await updatePowerbase(pb.id, {}, finalMemberIds);
    if (globalThis.__pbEditMembersCache) globalThis.__pbEditMembersCache.delete(interaction.user.id);

    await syncPowerbaseRosterMessage(interaction.client, pb.id);

    const addedIds = finalMemberIds.filter(id => !oldMemberIds.includes(id));
    const removedIds = oldMemberIds.filter(id => !finalMemberIds.includes(id));

    if (addedIds.length > 0 || removedIds.length > 0) {
      const addedText = addedIds.length > 0 ? addedIds.map(id => `<@${id}>`).join("\n") : "*None*";
      const removedText = removedIds.length > 0 ? removedIds.map(id => `<@${id}>`).join("\n") : "*None*";

      await postPowerbaseLog(interaction.client, {
        title: "Powerbase Roster Updated",
        description: `Roster for Powerbase **${pb.name}** has been updated.`,
        fields: [
          { name: "Leader", value: `<@${pb.leader_id}>`, inline: true },
          { name: "Updated By", value: `<@${interaction.user.id}>`, inline: true },
          { name: "Apprentices Added", value: addedText, inline: true },
          { name: "Apprentices Removed", value: removedText, inline: true }
        ],
        color: 0xc90705
      });
    }

    const v2Payload = componentsV2Message([
      containerV2([
        textDisplayV2(`### Powerbase Updated`),
        textDisplayV2(`Roster for Powerbase **${pb.name}** updated successfully!`)
      ])
    ]);
    return interaction.update(ephemeral(v2Payload));
  } catch (err) {
    return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2(`**Error:** ${err.message}`)])])));
  }
}

// --------------------------------------------------------------------------------------
// EDIT FLOW
// --------------------------------------------------------------------------------------

async function showManageOptions(interaction, pb, canManageAll) {
  const isImperial = Boolean(pb.is_imperial || pb.tier === 10 || pb.tier === "X" || pb.name?.toLowerCase().includes("imperial powerbase"));

  const options = [];

  if (!isImperial) {
    options.push({ label: "Edit Details (Name / Description / Group ID)", value: "edit" });
  }

  options.push(
    { label: "Set / Change Banner Image", value: "image" },
    { label: "Manage Roster (Add / Remove Apprentices)", value: "members" }
  );

  if (canManageAll && !isImperial) {
    options.push({ label: "Transfer Leadership", value: "leader" });
  }

  if (!isImperial) {
    options.push({ label: "Dissolve Powerbase", value: "dissolve" });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`pb_manage_action:${pb.id}`)
    .setPlaceholder(`Manage ${pb.name.substring(0, 30)}...`)
    .addOptions(options);

  const payload = componentsV2Message([
    containerV2([
      textDisplayV2(`### Manage Powerbase: ${pb.name}`),
      textDisplayV2("Select an action to perform:"),
      new ActionRowBuilder().addComponents(select)
    ])
  ]);

  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(ephemeral(payload));
  } else if (interaction.isStringSelectMenu()) {
    return interaction.update(ephemeral(payload));
  } else {
    return interaction.reply(ephemeral(payload));
  }
}

async function handleManage(interaction, verified) {
  const canManageAll = hasPermission(verified.profile, "powerbase:manage:all");

  if (canManageAll) {
    const powerbases = await fetchPowerbases();
    const activePbs = powerbases.filter(pb => pb.status !== "DISSOLVED" && pb.status !== "DELETED");
    if (activePbs.length === 0) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("There are no active Powerbases to manage.")])])));
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId("pb_manage_select")
      .setPlaceholder("Select a Powerbase to manage")
      .addOptions(activePbs.map(pb => ({
        label: pb.name,
        value: pb.id
      })));

    return interaction.reply(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2("Select a Powerbase to manage:"),
        new ActionRowBuilder().addComponents(select)
      ])
    ])));
  }

  // Regular leader: default to own Powerbase
  const pb = await getPowerbaseForUser(interaction.user.id);
  if (!pb || pb.leader_id !== interaction.user.id) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You do not lead a Powerbase.")])])));
  }

  return showManageOptions(interaction, pb, false);
}

async function handleManageSelect(interaction) {
  const pbId = interaction.values[0];
  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

  const verified = await getVerifiedProfile(interaction.user.id);
  const canManageAll = hasPermission(verified.profile, "powerbase:manage:all");

  return showManageOptions(interaction, pb, canManageAll);
}

async function handleManageActionSelect(interaction) {
  const pbId = interaction.customId.split(":")[1];
  const action = interaction.values[0];

  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

  if (action === "image") {
    return await showImageOptions(interaction, pbId);
  }

  if (action === "edit") {
    const isImperial = Boolean(pb.is_imperial || pb.tier === 10 || pb.tier === "X" || pb.name?.toLowerCase().includes("imperial powerbase"));
    if (isImperial) {
      return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("The Imperial Powerbase details cannot be edited.")])])));
    }
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
    const isImperial = Boolean(pb.is_imperial || pb.tier === 10 || pb.tier === "X" || pb.name?.toLowerCase().includes("imperial powerbase"));
    const maxCapacity = isImperial ? 3 : getPowerbaseCapacity(pb.tier);

    const currentMemberIds = (pb?.powerbase_members || [])
      .map(m => String(m.user_id || m.discord_user_id))
      .filter(Boolean);

    const selectMenu = new UserSelectMenuBuilder()
      .setCustomId(`pb_edit_members:${pbId}`)
      .setPlaceholder("Select Apprentices to include")
      .setMinValues(0)
      .setMaxValues(maxCapacity);

    if (typeof selectMenu.setDefaultUsers === "function" && currentMemberIds.length > 0) {
      selectMenu.setDefaultUsers(currentMemberIds.slice(0, maxCapacity));
    }

    await interaction.update(ephemeral(componentsV2Message([
      containerV2([
        textDisplayV2(`### Powerbase: ${pb.name}`),
        textDisplayV2(`Please select the Apprentices for this Powerbase. Anyone not selected will be removed. (Max ${maxCapacity}).`),
        new ActionRowBuilder().addComponents(selectMenu)
      ])
    ])));
    return true;
  }

async function handleEditMembers(interaction) {
  const pbId = interaction.customId.split(":")[1];
  const selectedMemberIds = interaction.values || [];

  // Defer update immediately to acknowledge interaction before 3s Discord timeout
  await interaction.deferUpdate();

  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.editReply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

  try {
    const isImperial = Boolean(pb.is_imperial || pb.tier === 10 || pb.tier === "X" || pb.name?.toLowerCase().includes("imperial powerbase"));
    const maxCapacity = isImperial ? 3 : getPowerbaseCapacity(pb.tier);

    if (selectedMemberIds.length > maxCapacity) {
      throw new Error(`You can select at most ${maxCapacity} Apprentices.`);
    }

    // Verify all selected users
    for (const userId of selectedMemberIds) {
      const verified = await getVerifiedProfile(userId);
      if (!verified) throw new Error(`<@${userId}> is not verified with Holonet.`);
      
      const existingPb = await getPowerbaseForUser(userId);
      if (existingPb && existingPb.id !== pbId) {
        throw new Error(`<@${userId}> is already in another Powerbase (${existingPb.name}).`);
      }
    }

    await updatePowerbase(pbId, {}, selectedMemberIds);
    await syncPowerbaseRosterMessage(interaction.client, pbId);

    const memberMentions = selectedMemberIds.length > 0
      ? selectedMemberIds.map(id => `<@${id}>`).join(", ")
      : "*None*";

    const v2Payload = componentsV2Message([
      containerV2([
        textDisplayV2(`### Apprentices Updated`),
        textDisplayV2(`Apprentices for Powerbase **${pb.name}** have been updated.\n\n**Current Apprentices:** ${memberMentions}`)
      ])
    ]);
    return interaction.editReply(ephemeral(v2Payload));
  } catch (err) {
    return interaction.editReply(ephemeral(componentsV2Message([containerV2([textDisplayV2(`❌ **Error:** ${err.message}`)])])));
  }
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

    let dissolveGroupLink = "None";
    if (pb.roblox_group_id) {
      const match = String(pb.roblox_group_id).match(/\d+/);
      const cleanUrl = String(pb.roblox_group_id).startsWith("http")
        ? pb.roblox_group_id
        : `https://www.roblox.com/groups/${match ? match[0] : pb.roblox_group_id}`;
      dissolveGroupLink = `[Group Link](${cleanUrl})`;
    }

    await postPowerbaseLog(interaction.client, {
      title: "Powerbase Dissolution Requested",
      description: `A dissolution request for Powerbase **${pb.name}** has been submitted for approval by High Command.`,
      content: `<@&${HIGH_COMMAND_ROLE_ID}>`,
      fields: [
        { name: "Powerbase Name", value: pb.name, inline: true },
        { name: "Leader", value: `<@${pb.leader_id}>`, inline: true },
        { name: "Roblox Group", value: dissolveGroupLink, inline: true }
      ],
      color: 0xc90705,
      allowedRoleIds: [HIGH_COMMAND_ROLE_ID]
    });

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

  await interaction.deferUpdate();

  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.editReply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

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

    await postPowerbaseLog(interaction.client, {
      title: "Powerbase Leadership Transferred",
      description: `Leadership of Powerbase **${pb.name}** has been transferred.`,
      fields: [
        { name: "Powerbase Name", value: pb.name, inline: true },
        { name: "Old Leader", value: `<@${pb.leader_id}>`, inline: true },
        { name: "New Leader", value: `<@${newLeaderId}>`, inline: true },
        { name: "Transferred By", value: `<@${interaction.user.id}>`, inline: true }
      ],
      color: 0xc90705
    });

    const v2Payload = componentsV2Message([
      containerV2([
        textDisplayV2(`### Leadership Transferred`),
        textDisplayV2(`Leadership of Powerbase **${pb.name}** has been transferred to <@${newLeaderId}>.`)
      ])
    ]);
    return interaction.editReply(ephemeral(v2Payload));
  } catch (err) {
    return interaction.editReply(ephemeral(componentsV2Message([containerV2([textDisplayV2(`❌ **Error:** ${err.message}`)])])));
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

  const apprenticeText = memberIds.length > 0
    ? memberIds.map(id => `<@${id}>`).join("\n")
    : "*None*";

  const sdBadge = pb.is_sudden_death ? " **[SUDDEN DEATH]**" : "";

  const slug = String(pb.name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const pbUrl = `https://www.thesithorder.org/powerbases/${slug}`;

  const components = [
    textDisplayV2(`# [${pb.name}](${pbUrl})`),
    textDisplayV2(`**Tier:** ${romanize(pb.tier)}${sdBadge}\n**Prestige:** ${pb.prestige}\n**Members:** ${memberIds.length + 1} / ${getPowerbaseCapacity(pb.tier)}`),
    separatorV2()
  ];

  if (pb.description) {
    components.push(textDisplayV2(`### Description\n${pb.description}`));
    components.push(separatorV2());
  }

  if (pb.roblox_group_id) {
    const match = String(pb.roblox_group_id).match(/\d+/);
    const cleanUrl = String(pb.roblox_group_id).startsWith("http")
      ? pb.roblox_group_id
      : `https://www.roblox.com/groups/${match ? match[0] : pb.roblox_group_id}`;
    components.push(textDisplayV2(`**Roblox Group:** [Group Link](${cleanUrl})`));
    components.push(separatorV2());
  }

  components.push(textDisplayV2(`### Roster\n**Leader:**\n<@${pb.leader_id}>\n\n**Apprentices:**\n${apprenticeText}`));

  if (pb.image_url) {
    components.push(separatorV2());
    components.push(mediaGalleryV2(pb.image_url));
  }

  const v2Payload = componentsV2Message([containerV2(components, 0xc90705)]);
  await interaction.update(ephemeral(v2Payload));
  return true;
}

function romanize(num) {
  return ["I", "II", "III", "IV"][num - 1] || "I";
}

async function handleBanner(interaction, verified) {
  const attachment = interaction.options.getAttachment("image");
  if (!attachment || !attachment.contentType?.startsWith("image/")) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("Please upload a valid image file.")])])));
  }

  const isHighCommand = hasPermission(verified.profile, "powerbase:manage_all");
  const pbs = await fetchPowerbases();
  const manageablePbs = pbs.filter(pb => isHighCommand || pb.leader_id === interaction.user.id);

  if (manageablePbs.length === 0) {
    return interaction.reply(ephemeral(componentsV2Message([containerV2([textDisplayV2("You do not lead or have permission to manage any Powerbases.")])])));
  }

  if (manageablePbs.length === 1) {
    const pb = manageablePbs[0];
    await interaction.deferReply({ ephemeral: true });
    const permanentUrl = await persistBannerImage(attachment.url, pb.id);
    await updatePowerbase(pb.id, { image_url: permanentUrl });
    await syncPowerbaseRosterMessage(interaction.client, pb.id);
    return interaction.editReply(ephemeral(componentsV2Message([containerV2([textDisplayV2(`Banner image uploaded and set for **${pb.name}**!`)])])));
  }

  const options = manageablePbs.slice(0, 25).map(pb => ({
    label: pb.name,
    description: `Set banner for ${pb.name}`,
    value: pb.id
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("pb_banner_select")
    .setPlaceholder("Select a Powerbase to set this banner for...")
    .addOptions(options);

  globalThis.__pbBannerCache = globalThis.__pbBannerCache || new Map();
  globalThis.__pbBannerCache.set(interaction.user.id, attachment.url);

  return interaction.reply(ephemeral(componentsV2Message([
    containerV2([
      textDisplayV2("### Select Powerbase"),
      textDisplayV2("Please select which Powerbase you want to apply the uploaded banner image to:"),
      new ActionRowBuilder().addComponents(selectMenu)
    ])
  ])));
}

async function handleBannerSelect(interaction) {
  const pbId = interaction.values[0];
  const imageUrl = globalThis.__pbBannerCache?.get(interaction.user.id);

  if (!imageUrl) {
    return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Upload session expired. Please run `/powerbase banner` again.")])])));
  }

  const pb = await getPowerbase(pbId);
  if (!pb) return interaction.update(ephemeral(componentsV2Message([containerV2([textDisplayV2("Powerbase not found.")])])));

  await interaction.deferUpdate();
  const permanentUrl = await persistBannerImage(imageUrl, pbId);
  await updatePowerbase(pbId, { image_url: permanentUrl });
  await syncPowerbaseRosterMessage(interaction.client, pbId);
  globalThis.__pbBannerCache.delete(interaction.user.id);

  return interaction.editReply(ephemeral(componentsV2Message([
    containerV2([
      textDisplayV2("### Image Uploaded"),
      textDisplayV2(`Banner image uploaded and set for **${pb.name}** successfully!`)
    ])
  ])));
}
