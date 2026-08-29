import { supabase } from "./supabase.js";
import { rawRanksFromProfile } from "./roblox.js";
import { componentsV2Message, containerV2, textDisplayV2, separatorV2, mediaGalleryV2 } from "./discord-ui.js";
import { ROBLOX_GROUPS } from "../../modules/data/roblox-config.js";
import { getVerifiedProfile } from "./roles.js";

export const ROSTER_CHANNEL_ID = "1046537270150299720";

/**
 * Downloads an image (e.g. from Discord CDN) and stores it permanently in Supabase Storage.
 * Discord CDN URLs expire after a short time; storing them in Supabase gives a permanent URL.
 */
export async function persistBannerImage(imageUrl, pbId) {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  
  // If it's already hosted on Supabase Storage, no need to re-upload
  if (imageUrl.includes("/storage/v1/object/public/")) {
    return imageUrl;
  }

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.warn(`[persistBannerImage] Failed to fetch source image: ${res.status} ${res.statusText}`);
      return imageUrl;
    }

    const rawType = res.headers.get("content-type") || "";
    let contentType = "image/png";
    let extension = "png";

    if (rawType.includes("gif")) {
      contentType = "image/gif";
      extension = "gif";
    } else if (rawType.includes("jpeg") || rawType.includes("jpg")) {
      contentType = "image/jpeg";
      extension = "jpg";
    } else if (rawType.includes("webp")) {
      contentType = "image/webp";
      extension = "webp";
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const bucketName = "powerbases";
    const filePath = `banners/${pbId || "banner"}_${Date.now()}.${extension}`;

    // Ensure bucket exists with public access
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    const exists = (buckets || []).some(b => b.name === bucketName);
    if (!exists) {
      const { error: createErr } = await supabase.storage.createBucket(bucketName, { public: true });
      if (createErr) console.warn("[persistBannerImage] Could not create bucket automatically:", createErr);
    }

    // Upload to Supabase Storage bucket 'powerbases' with public access
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      console.error("[persistBannerImage] Supabase storage upload error:", uploadError);
      return imageUrl;
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    const finalUrl = publicUrlData?.publicUrl || imageUrl;
    console.log(`[persistBannerImage] Uploaded banner: ${finalUrl}`);
    return finalUrl;
  } catch (err) {
    console.error("[persistBannerImage] Error persisting banner image:", err);
    return imageUrl;
  }
}

/**
 * Deletes a stored banner image from Supabase storage if it was stored in the powerbases bucket.
 */
export async function removePersistedBannerImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return;
  try {
    const bucketName = "powerbases";
    const marker = `/storage/v1/object/public/${bucketName}/`;
    if (imageUrl.includes(marker)) {
      const storagePath = imageUrl.substring(imageUrl.indexOf(marker) + marker.length);
      if (storagePath) {
        const { error } = await supabase.storage.from(bucketName).remove([decodeURIComponent(storagePath)]);
        if (error) console.warn("[removePersistedBannerImage] Error removing storage object:", error);
      }
    }
  } catch (err) {
    console.warn("[removePersistedBannerImage] Exception while deleting old banner:", err);
  }
}

function romanize(num) {
  if (num === 10 || num === "X" || String(num).toUpperCase() === "X") return "X";
  return ["I", "II", "III", "IV"][num - 1] || "I";
}

export async function getPowerbaseUserLabel(discordUserId, client = null) {
  if (!discordUserId || discordUserId === "0") return "*Vacant*";

  try {
    const { data: link } = await supabase
      .from("verification_links")
      .select("roblox_username, discord_username")
      .eq("discord_user_id", String(discordUserId))
      .maybeSingle();

    if (link?.roblox_username) {
      return link.roblox_username;
    }
    if (link?.discord_username) {
      return `@${link.discord_username}`;
    }
    if (client?.users) {
      const u = await client.users.fetch(String(discordUserId)).catch(() => null);
      if (u) {
        return u.displayName || u.globalName || `@${u.username}`;
      }
    }
  } catch (_) { }

  return `User ${discordUserId}`;
}

export async function getPowerbaseUserLabels(discordUserIds = [], client = null) {
  const ids = Array.from(new Set(discordUserIds.map(id => String(id || "")).filter(Boolean)));
  const map = {};
  if (!ids.length) return map;

  try {
    const { data: links } = await supabase
      .from("verification_links")
      .select("discord_user_id, roblox_username, discord_username")
      .in("discord_user_id", ids);

    (links || []).forEach(l => {
      if (l.roblox_username) {
        map[l.discord_user_id] = l.roblox_username;
      } else if (l.discord_username) {
        map[l.discord_user_id] = `@${l.discord_username}`;
      }
    });

    const missing = ids.filter(id => !map[id]);
    if (missing.length && client?.users) {
      await Promise.all(missing.map(async (id) => {
        try {
          const u = await client.users.fetch(id).catch(() => null);
          if (u) {
            map[id] = u.displayName || u.globalName || `@${u.username}`;
          }
        } catch (_) { }
      }));
    }

    ids.forEach(id => {
      if (!map[id]) map[id] = `User ${id}`;
    });
  } catch (_) { }

  return map;
}

export function getPowerbaseCapacity(tier, isImperial = false) {
  if (isImperial || tier === 10 || tier === "X") return 3;
  const cap = { 1: 4, 2: 6, 3: 8, 4: 10 };
  return cap[Number(tier)] || 4;
}

/**
 * Auto-detect and sync verified members for the Imperial Powerbase.
 * Looks up verified Roblox profiles for Emperor (253), Voice (252), Wrath (251), and Shadow Guards (42).
 */
export async function syncImperialPowerbaseData(pb) {
  try {
    const { data: verifiedLinks } = await supabase
      .from("verification_links")
      .select("discord_user_id, roblox_user_id");

    if (!verifiedLinks || verifiedLinks.length === 0) return { emperorId: pb.leader_id, voiceId: null, wrathId: null, shadowGuardIds: [] };

    let emperorId = null;
    let voiceId = null;
    let wrathId = null;
    const shadowGuardIds = [];

    // Check profiles
    for (const link of verifiedLinks) {
      if (!link.discord_user_id) continue;
      try {
        const verified = await getVerifiedProfile(link.discord_user_id);
        if (!verified?.profile) continue;

        const dcRank = Number(verified.profile.groupRanks?.[ROBLOX_GROUPS.DARK_COUNCIL.groupId] || 0);
        const mainRank = Number(verified.profile.groupRanks?.[ROBLOX_GROUPS.MAIN_GROUP.groupId] || 0);

        if (dcRank === 253) emperorId = link.discord_user_id;
        if (dcRank === 252) voiceId = link.discord_user_id;
        if (dcRank === 251) wrathId = link.discord_user_id;
        if (mainRank === 42) shadowGuardIds.push(link.discord_user_id);
      } catch (e) {
        // ignore profile lookup failure for single user
      }
    }

    if (emperorId && emperorId !== pb.leader_id) {
      await supabase.from("powerbases").update({ leader_id: emperorId }).eq("id", pb.id);
      pb.leader_id = emperorId;
    }

    return { emperorId: pb.leader_id || emperorId, voiceId, wrathId, shadowGuardIds };
  } catch (err) {
    console.error("Failed to sync Imperial Powerbase data:", err);
    return { emperorId: pb.leader_id, voiceId: null, wrathId: null, shadowGuardIds: [] };
  }
}

/**
 * Sync persistent Powerbase roster message in channel 1046537270150299720.
 */
export async function syncPowerbaseRosterMessage(client, powerbaseId) {
  if (!client || !powerbaseId) return;
  try {
    const pb = await getPowerbase(powerbaseId);
    if (!pb) {
      console.warn(`[syncPowerbaseRosterMessage] Powerbase ${powerbaseId} not found`);
      return;
    }

    const channel = await client.channels.fetch(ROSTER_CHANNEL_ID).catch((err) => {
      console.error(`[syncPowerbaseRosterMessage] Failed to fetch channel ${ROSTER_CHANNEL_ID}:`, err?.message || err);
      return null;
    });
    if (!channel || !channel.isTextBased()) {
      console.warn(`[syncPowerbaseRosterMessage] Channel ${ROSTER_CHANNEL_ID} unavailable or not text-based`);
      return;
    }

    if (pb.status === "DISSOLVED" || pb.status === "DELETED") {
      if (pb.roster_message_id) {
        const existingMsg = await channel.messages.fetch(pb.roster_message_id).catch(() => null);
        if (existingMsg) await existingMsg.delete().catch(() => { });
      }
      return;
    }

    const isImperial = Boolean(pb.is_imperial || pb.tier === 10 || pb.tier === "X" || pb.name?.toLowerCase().includes("imperial powerbase"));

    const memberIds = (pb.powerbase_members || [])
      .map(m => String(m.user_id || m.discord_user_id || ""))
      .filter(Boolean);

    const pbSlug = slugifyPowerbase(pb.name);
    const pbUrl = `https://www.thesithorder.org/powerbases/${pbSlug}`;

    let groupLinkText = "";
    if (pb.roblox_group_id) {
      const match = String(pb.roblox_group_id).match(/\d+/);
      const cleanUrl = String(pb.roblox_group_id).startsWith("http")
        ? pb.roblox_group_id
        : `https://www.roblox.com/groups/${match ? match[0] : pb.roblox_group_id}`;
      groupLinkText = `**Roblox Group:** [Group Link](${cleanUrl})`;
    }

    const components = [];

    if (isImperial) {
      // Imperial Powerbase Embed Formatting
      const { emperorId, voiceId, wrathId, shadowGuardIds } = await syncImperialPowerbaseData(pb);
      const totalMemberCount = (emperorId ? 1 : 0) + (voiceId ? 1 : 0) + (wrathId ? 1 : 0) + shadowGuardIds.length + memberIds.length;

      const allIds = [emperorId || pb.leader_id, voiceId, wrathId, ...shadowGuardIds, ...memberIds].filter(Boolean);
      const userNames = await getPowerbaseUserLabels(allIds, client);

      components.push(textDisplayV2(`# [${pb.name}](${pbUrl})`));
      components.push(textDisplayV2(`**Tier:** X\n**Members:** ${totalMemberCount}`));
      components.push(separatorV2());

      if (pb.description) {
        components.push(textDisplayV2(`### Description\n${pb.description}`));
        components.push(separatorV2());
      }

      if (groupLinkText) {
        components.push(textDisplayV2(groupLinkText));
        components.push(separatorV2());
      }

      // Roster section: Leader (Emperor)
      const empLeaderName = userNames[emperorId || pb.leader_id] || "*Vacant*";
      components.push(textDisplayV2(`### Roster\n**Leader:**\n${empLeaderName}`));

      // Emperor's Voice and Wrath section
      const secondaries = [];
      if (voiceId) secondaries.push(`**Emperor's Voice:**\n${userNames[voiceId] || `User ${voiceId}`}`);
      if (wrathId) secondaries.push(`**Emperor's Wrath:**\n${userNames[wrathId] || `User ${wrathId}`}`);

      if (secondaries.length > 0) {
        components.push(separatorV2());
        components.push(textDisplayV2(secondaries.join("\n\n")));
      }

      // Shadow Guards section (only if any exist)
      if (shadowGuardIds.length > 0) {
        components.push(separatorV2());
        const sgLines = shadowGuardIds.map(id => userNames[id] || `User ${id}`).join("\n");
        components.push(textDisplayV2(`**Shadow Guards:**\n${sgLines}`));
      }

      // Apprentices section (only if any exist)
      if (memberIds.length > 0) {
        components.push(separatorV2());
        const appLines = memberIds.map(id => userNames[id] || `User ${id}`).join("\n");
        components.push(textDisplayV2(`**Apprentices:**\n${appLines}`));
      }

      if (pb.image_url) {
        components.push(separatorV2());
        components.push(mediaGalleryV2(pb.image_url));
      }

    } else {
      // Standard Powerbase Embed Formatting
      const allIds = [pb.leader_id, ...memberIds].filter(Boolean);
      const userNames = await getPowerbaseUserLabels(allIds, client);

      const leaderName = userNames[pb.leader_id] || (pb.leader_id ? `User ${pb.leader_id}` : "*Vacant*");
      const apprenticeText = memberIds.length > 0
        ? memberIds.map(id => userNames[id] || `User ${id}`).join("\n")
        : "*None*";

      const sdBadge = pb.is_sudden_death ? " **[SUDDEN DEATH]**" : "";

      components.push(textDisplayV2(`# [${pb.name}](${pbUrl})`));
      components.push(textDisplayV2(`**Tier:** ${romanize(pb.tier)}${sdBadge}\n**Prestige:** ${pb.prestige}\n**Members:** ${memberIds.length + 1} / ${getPowerbaseCapacity(pb.tier)}`));
      components.push(separatorV2());

      if (pb.description) {
        components.push(textDisplayV2(`### Description\n${pb.description}`));
        components.push(separatorV2());
      }

      if (groupLinkText) {
        components.push(textDisplayV2(groupLinkText));
        components.push(separatorV2());
      }

      components.push(textDisplayV2(`### Roster\n**Leader:**\n${leaderName}\n\n**Apprentices:**\n${apprenticeText}`));

      if (pb.image_url) {
        components.push(separatorV2());
        components.push(mediaGalleryV2(pb.image_url));
      }
    }

    const v2Payload = componentsV2Message([containerV2(components, 0xc90705)]);

    let edited = false;
    if (pb.roster_message_id) {
      const messageObj = await channel.messages.fetch(pb.roster_message_id).catch(() => null);
      if (messageObj) {
        try {
          await messageObj.edit(v2Payload);
          edited = true;
        } catch (editErr) {
          console.warn(`[syncPowerbaseRosterMessage] Edit failed for message ${pb.roster_message_id}, sending new message:`, editErr?.message || editErr);
        }
      }
    }

    if (!edited) {
      const newMsg = await channel.send(v2Payload);
      await supabase
        .from("powerbases")
        .update({ roster_message_id: newMsg.id })
        .eq("id", pb.id);
    }
  } catch (err) {
    console.error("Error syncing powerbase roster message:", err);
  }
}

/**
 * Sync stored powerbase rosters for all active powerbases.
 * Ensures the Imperial Powerbase exists and rotates message IDs if needed.
 */
export async function syncStoredPowerbaseRosters(client) {
  try {
    const powerbases = await fetchPowerbases();
    let activePbs = (powerbases || []).filter(pb => pb.status === "ACTIVE");

    // Fetch roster channel messages to inspect actual Discord message order
    let channelMessages = [];
    if (client) {
      try {
        const channel = await client.channels.fetch(ROSTER_CHANNEL_ID).catch(() => null);
        if (channel && channel.isTextBased()) {
          const msgs = await channel.messages.fetch({ limit: 20 }).catch(() => null);
          if (msgs) {
            // Sort ascending by created timestamp (oldest first)
            channelMessages = Array.from(msgs.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
          }
        }
      } catch (err) {
        console.warn("[syncStoredPowerbaseRosters] Could not fetch channel messages:", err);
      }
    }

    const imperialPb = activePbs.find(pb => pb.is_imperial || pb.name?.toLowerCase().includes("imperial powerbase"));
    const nonImperialPbs = activePbs
      .filter(pb => !pb.is_imperial && !pb.name?.toLowerCase().includes("imperial powerbase"))
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

    // If we have at least 2 Discord messages in the channel:
    // Slot 1 (Oldest Discord message) MUST be Imperial PB
    // Slot 2 (2nd oldest Discord message) MUST be Oldest non-Imperial PB
    // Slot 3 (3rd message) MUST be 2nd non-Imperial PB
    if (channelMessages.length >= 2 && imperialPb) {
      const msg1Id = channelMessages[0].id;
      const msg2Id = channelMessages[1].id;
      const msg3Id = channelMessages[2]?.id || null;

      // Assign Imperial to msg1Id
      if (imperialPb.roster_message_id !== msg1Id) {
        console.log(`[syncStoredPowerbaseRosters] Aligning Imperial PB to oldest message: ${msg1Id}`);
        await supabase.from("powerbases").update({ roster_message_id: msg1Id }).eq("id", imperialPb.id);
        imperialPb.roster_message_id = msg1Id;
      }

      // Assign oldest non-imperial to msg2Id
      if (nonImperialPbs[0] && nonImperialPbs[0].roster_message_id !== msg2Id) {
        console.log(`[syncStoredPowerbaseRosters] Aligning ${nonImperialPbs[0].name} to 2nd message: ${msg2Id}`);
        await supabase.from("powerbases").update({ roster_message_id: msg2Id }).eq("id", nonImperialPbs[0].id);
        nonImperialPbs[0].roster_message_id = msg2Id;
      }

      // Assign 2nd non-imperial to msg3Id (or null so it sends a new 3rd message)
      if (nonImperialPbs[1]) {
        if (msg3Id && nonImperialPbs[1].roster_message_id !== msg3Id) {
          console.log(`[syncStoredPowerbaseRosters] Aligning ${nonImperialPbs[1].name} to 3rd message: ${msg3Id}`);
          await supabase.from("powerbases").update({ roster_message_id: msg3Id }).eq("id", nonImperialPbs[1].id);
          nonImperialPbs[1].roster_message_id = msg3Id;
        } else if (!msg3Id && (nonImperialPbs[1].roster_message_id === msg1Id || nonImperialPbs[1].roster_message_id === msg2Id)) {
          console.log(`[syncStoredPowerbaseRosters] Clearing ${nonImperialPbs[1].name} message ID so it sends fresh 3rd message`);
          await supabase.from("powerbases").update({ roster_message_id: null }).eq("id", nonImperialPbs[1].id);
          nonImperialPbs[1].roster_message_id = null;
        }
      }
    } else if (!imperialPb) {
      // Create Imperial PB if completely missing
      const oldestPb = nonImperialPbs[0];
      const secondPb = nonImperialPbs[1];

      const msg1Id = channelMessages[0]?.id || oldestPb?.roster_message_id || null;
      const msg2Id = channelMessages[1]?.id || secondPb?.roster_message_id || null;

      const insertPayload = {
        name: "The Imperial Powerbase",
        description: "The supreme Powerbase of the Sith Empire, lead directly by the Dark Lord of the Sith and formed from the High Command, their chosen Shadow Guards and Apprentices.",
        leader_id: oldestPb?.leader_id || "0",
        tier: 10,
        prestige: 0,
        status: "ACTIVE",
        roster_message_id: msg1Id
      };

      const { data: createdRows } = await supabase.from("powerbases").insert([insertPayload]).select();
      if (createdRows && createdRows.length > 0) {
        if (oldestPb) {
          await supabase.from("powerbases").update({ roster_message_id: msg2Id }).eq("id", oldestPb.id);
          oldestPb.roster_message_id = msg2Id;
        }
        if (secondPb) {
          await supabase.from("powerbases").update({ roster_message_id: null }).eq("id", secondPb.id);
          secondPb.roster_message_id = null;
        }
      }
    }

    // Refresh and sort: Imperial first, then by tier desc, prestige desc
    const refreshed = await fetchPowerbases();
    activePbs = (refreshed || []).filter(pb => pb.status === "ACTIVE");

    activePbs.sort((a, b) => {
      const isImpA = a.is_imperial || a.name?.toLowerCase().includes("imperial powerbase") ? 1 : 0;
      const isImpB = b.is_imperial || b.name?.toLowerCase().includes("imperial powerbase") ? 1 : 0;
      if (isImpA !== isImpB) return isImpB - isImpA;
      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    });

    let synced = 0;
    for (const pb of activePbs) {
      await syncPowerbaseRosterMessage(client, pb.id);
      synced++;
    }
    return { checked: activePbs.length, synced };
  } catch (error) {
    console.error("Failed to sync stored powerbase rosters:", error);
    return { checked: 0, synced: 0 };
  }
}

/**
 * Fetch all powerbases, with their members.
 */
export async function fetchPowerbases() {
  const { data, error } = await supabase
    .from("powerbases")
    .select("*, powerbase_members(*)");

  if (error) throw error;
  return data;
}

export function slugifyPowerbase(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Fetch a powerbase by name (case-insensitive / slug-matched).
 */
export async function getPowerbaseByName(name) {
  const targetSlug = slugifyPowerbase(name);
  const { data, error } = await supabase
    .from("powerbases")
    .select("*, powerbase_members(*)")
    .neq("status", "DISSOLVED");

  if (error) throw error;
  return (data || []).find(pb => slugifyPowerbase(pb.name) === targetSlug) || null;
}

/**
 * Fetch a specific powerbase by ID.
 */
export async function getPowerbase(id) {
  const { data, error } = await supabase
    .from("powerbases")
    .select("*, powerbase_members(*)")
    .eq("id", id);

  if (error) throw error;
  return (data && data.length > 0) ? data[0] : null;
}

/**
 * Check if a user is already in a powerbase.
 * Returns the powerbase they are in, or null.
 */
export async function getPowerbaseForUser(discordId) {
  if (!discordId) return null;

  // First check if they are a leader
  const { data: leaderData, error: leaderError } = await supabase
    .from("powerbases")
    .select("*")
    .eq("leader_id", String(discordId))
    .neq("status", "DISSOLVED");

  if (leaderError) throw leaderError;
  if (leaderData && leaderData.length > 0) return leaderData[0];

  // Then check if they are a member
  const { data: memberData, error: memberError } = await supabase
    .from("powerbase_members")
    .select("powerbase_id, powerbases(*)")
    .eq("user_id", String(discordId));

  if (memberError) throw memberError;

  if (memberData && memberData.length > 0) {
    const activeMember = memberData.find(m => m.powerbases && m.powerbases.status !== "DISSOLVED");
    if (activeMember) return activeMember.powerbases;
  }

  return null;
}

/**
 * Creates a new powerbase with status PENDING_APPROVAL.
 */
export async function createPowerbase(payload, members = []) {
  // Check if leader is already in a powerbase
  const leaderPb = await getPowerbaseForUser(payload.leaderId);
  if (leaderPb) {
    throw new Error(`Leader is already in a Powerbase (${leaderPb.name}).`);
  }

  // Check if any members are already in a powerbase
  for (const memberId of members) {
    if (memberId === payload.leaderId) continue;
    const memberPb = await getPowerbaseForUser(memberId);
    if (memberPb) {
      throw new Error(`Member is already in a Powerbase (${memberPb.name}).`);
    }
  }

  const { data: rows, error } = await supabase
    .from("powerbases")
    .insert([{
      name: payload.name,
      description: payload.description || null,
      roblox_group_id: payload.robloxGroupId || null,
      image_url: payload.imageUrl || payload.image_url || null,
      leader_id: payload.leaderId,
      leader_name: payload.leaderName || null,
      status: "PENDING_APPROVAL"
    }])
    .select();

  if (error) throw error;
  const data = rows && rows.length > 0 ? rows[0] : null;
  const powerbaseId = data.id;

  const validMembers = members.filter(id => id !== payload.leaderId);
  if (validMembers.length > 0) {
    const membersPayload = validMembers.map(id => ({
      powerbase_id: powerbaseId,
      user_id: id
    }));
    await supabase.from("powerbase_members").insert(membersPayload);
  }

  return data;
}

/**
 * Updates a powerbase and its members.
 */
export async function updatePowerbase(id, payload, newMembers = null) {
  let data = null;

  if (payload && Object.keys(payload).length > 0) {
    // If updating image_url, wipe the old stored banner image if it differs
    if (Object.prototype.hasOwnProperty.call(payload, "image_url")) {
      const existing = await getPowerbase(id);
      if (existing?.image_url && existing.image_url !== payload.image_url) {
        removePersistedBannerImage(existing.image_url).catch(() => {});
      }
    }

    const { data: rows, error } = await supabase
      .from("powerbases")
      .update(payload)
      .eq("id", id)
      .select();

    if (error) throw error;
    data = rows && rows.length > 0 ? rows[0] : null;
  }

  if (!data) {
    data = await getPowerbase(id);
  }

  if (!data) {
    throw new Error("Powerbase not found.");
  }

  if (newMembers !== null) {
    const validMembers = newMembers.filter(memberId => memberId !== data.leader_id);

    // Check that none of newMembers are in another active powerbase
    for (const memberId of validMembers) {
      const existingPb = await getPowerbaseForUser(memberId);
      if (existingPb && existingPb.id !== id) {
        throw new Error(`User is already in another Powerbase (${existingPb.name}).`);
      }
    }

    // Delete old members
    await supabase.from("powerbase_members").delete().eq("powerbase_id", id);

    // Insert new members
    if (validMembers.length > 0) {
      const membersPayload = validMembers.map(userId => ({
        powerbase_id: id,
        user_id: userId
      }));
      await supabase.from("powerbase_members").insert(membersPayload);
    }
  }

  return data;
}

/**
 * Log a powerbase action.
 */
export async function logPowerbaseAction(userId, action, powerbaseId = null, details = null) {
  const { error } = await supabase
    .from("powerbase_logs")
    .insert([{
      user_id: userId,
      powerbase_id: powerbaseId,
      action: action,
      details: details
    }]);

  if (error) console.error("Failed to log powerbase action:", error);
}

export function getMinPrestigeForTier(tier) {
  if (tier >= 4) return 15;
  if (tier >= 3) return 10;
  if (tier >= 2) return 5;
  return 0;
}

export function calculateTierFromPrestige(prestige) {
  if (prestige >= 15) return 4;
  if (prestige >= 10) return 3;
  if (prestige >= 5) return 2;
  return 1;
}

function processMatchPrestigeAndTier(pb, prestigeChange, isWinner) {
  const currentPrestige = pb.prestige || 0;
  const currentTier = pb.tier || 1;
  const wasSuddenDeath = !!pb.is_sudden_death;

  const newPrestige = Math.min(25, Math.max(0, currentPrestige + prestigeChange));
  let newTier = currentTier;
  let isSuddenDeath = wasSuddenDeath;
  let suddenDeathStatus = null; // 'ENTERED', 'CLEARED', 'RELEGATED', or null

  if (isWinner) {
    if (wasSuddenDeath) {
      // Grace Match Victory: Sudden Death removed!
      isSuddenDeath = false;
      const qualifiedTier = calculateTierFromPrestige(newPrestige);
      if (newPrestige >= getMinPrestigeForTier(currentTier)) {
        newTier = Math.max(currentTier, qualifiedTier);
      } else {
        newTier = qualifiedTier;
      }
      suddenDeathStatus = "CLEARED";
    } else {
      // Normal win: check for tier promotion
      const qualifiedTier = calculateTierFromPrestige(newPrestige);
      if (qualifiedTier > currentTier) {
        newTier = qualifiedTier;
      }
      if (newPrestige >= getMinPrestigeForTier(newTier)) {
        isSuddenDeath = false;
      }
    }
  } else {
    // Loser
    if (wasSuddenDeath) {
      // Grace Match Defeat: Immediate relegation to highest qualified tier!
      isSuddenDeath = false;
      newTier = calculateTierFromPrestige(newPrestige);
      suddenDeathStatus = "RELEGATED";
    } else {
      // Normal loss: check if prestige falls below current tier minimum requirement
      const minRequired = getMinPrestigeForTier(currentTier);
      if (newPrestige < minRequired && currentTier > 1) {
        // Enters Sudden Death state! Retains current tier capacity until next Kaggath (Grace Match)
        isSuddenDeath = true;
        newTier = currentTier;
        suddenDeathStatus = "ENTERED";
      } else {
        isSuddenDeath = false;
        newTier = calculateTierFromPrestige(newPrestige);
      }
    }
  }

  return {
    prestige: newPrestige,
    tier: newTier,
    is_sudden_death: isSuddenDeath,
    suddenDeathStatus
  };
}

/**
 * Record a Domination Kaggath result: updates prestige, tier, sudden death, wins, and losses.
 */
export async function recordKaggathResult(winnerPbId, loserPbId, winnerPrestigeChange, loserPrestigeChange, client = null) {
  const winnerPb = await getPowerbase(winnerPbId);
  const loserPb = await getPowerbase(loserPbId);
  if (!winnerPb || !loserPb) return null;

  const winnerRes = processMatchPrestigeAndTier(winnerPb, winnerPrestigeChange, true);
  const loserRes = processMatchPrestigeAndTier(loserPb, loserPrestigeChange, false);

  const { data: updatedWinner } = await supabase
    .from("powerbases")
    .update({
      prestige: winnerRes.prestige,
      tier: winnerRes.tier,
      is_sudden_death: winnerRes.is_sudden_death,
      kaggath_wins: (winnerPb.kaggath_wins || 0) + 1
    })
    .eq("id", winnerPbId)
    .select()
    .single();

  const { data: updatedLoser } = await supabase
    .from("powerbases")
    .update({
      prestige: loserRes.prestige,
      tier: loserRes.tier,
      is_sudden_death: loserRes.is_sudden_death,
      kaggath_losses: (loserPb.kaggath_losses || 0) + 1
    })
    .eq("id", loserPbId)
    .select()
    .single();

  if (client) {
    await syncPowerbaseRosterMessage(client, winnerPbId);
    await syncPowerbaseRosterMessage(client, loserPbId);
  }

  return {
    winner: { ...updatedWinner, suddenDeathStatus: winnerRes.suddenDeathStatus },
    loser: { ...updatedLoser, suddenDeathStatus: loserRes.suddenDeathStatus }
  };
}

/**
 * Adjust prestige and tier based on a manual adjustment.
 */
export async function adjustPrestige(powerbaseId, amount, client = null) {
  const pb = await getPowerbase(powerbaseId);
  if (!pb) return null;
  if (pb.is_imperial || pb.tier === 10 || pb.tier === "X" || pb.name?.toLowerCase().includes("imperial powerbase")) {
    return pb;
  }

  const currentPrestige = pb.prestige || 0;
  const currentTier = pb.tier || 1;
  const newPrestige = Math.min(25, Math.max(0, currentPrestige + amount));

  let newTier = currentTier;
  let isSuddenDeath = !!pb.is_sudden_death;

  const minReq = getMinPrestigeForTier(currentTier);
  if (newPrestige < minReq && currentTier > 1) {
    isSuddenDeath = true;
  } else if (newPrestige >= minReq) {
    isSuddenDeath = false;
    newTier = Math.max(currentTier, calculateTierFromPrestige(newPrestige));
  } else {
    newTier = calculateTierFromPrestige(newPrestige);
    isSuddenDeath = false;
  }

  const { data, error } = await supabase
    .from("powerbases")
    .update({ prestige: newPrestige, tier: newTier, is_sudden_death: isSuddenDeath })
    .eq("id", powerbaseId)
    .select()
    .single();

  if (error) throw error;
  if (client) {
    await syncPowerbaseRosterMessage(client, powerbaseId);
  }
  return data;
}

/**
 * Compare two profiles to see if A is strictly higher rank than B.
 * Checks Dark Council rank first, then High Ranks.
 */
export function isHigherRank(profileA, profileB) {
  const ranksA = rawRanksFromProfile(profileA);
  const ranksB = rawRanksFromProfile(profileB);

  if (ranksA.darkCouncil !== ranksB.darkCouncil) {
    return ranksA.darkCouncil > ranksB.darkCouncil;
  }
  return ranksA.highranks > ranksB.highranks;
}

/**
 * Hard delete a powerbase and its members.
 */
export async function deletePowerbase(id) {
  const pb = await getPowerbase(id);
  if (pb && (pb.is_imperial || pb.tier === 10 || pb.tier === "X" || pb.name?.toLowerCase().includes("imperial powerbase"))) {
    throw new Error("The Imperial Powerbase cannot be deleted or dissolved.");
  }
  if (pb?.image_url) {
    removePersistedBannerImage(pb.image_url).catch(() => {});
  }
  await supabase.from("powerbase_members").delete().eq("powerbase_id", id);
  const { error } = await supabase.from("powerbases").delete().eq("id", id);
  if (error) throw error;
  return true;
}


