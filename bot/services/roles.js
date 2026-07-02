import { PermissionFlagsBits } from "discord.js";
import { config } from "../config/index.js";
import { ROBLOX_GROUPS, SUPER_USER_IDS } from "../../modules/auth/roblox-groups.js";
import { hasCoreAccess } from "../../modules/auth/permissions.js";
import { loadProfileForRoblox, loadRobloxUser, rawRanksFromProfile } from "./roblox.js";
import { audit, supabase } from "./supabase.js";

const ROBLOX_RANK_DELEGATE_DISCORD_IDS = new Set(["1046546991360004136"]);
const UNLINKED_ROLE_ID = "1340850135680155674";

function compactIds(values) {
  return values.flat().filter(value => value && !String(value).includes("ROLE_ID"));
}

function rolesFromRule(rule) {
  if (!rule) return [];
  if (Array.isArray(rule)) return rule;
  if (typeof rule === "string") return [rule];
  if (Array.isArray(rule.roles)) return rule.roles;
  if (typeof rule.role === "string") return [rule.role];
  return [];
}

function rolesFromRanges(rank, ranges = []) {
  const numericRank = Number(rank) || 0;
  return ranges.flatMap(range => {
    const min = range.min ?? Number.NEGATIVE_INFINITY;
    const max = range.max ?? Number.POSITIVE_INFINITY;
    return numericRank >= min && numericRank <= max ? rolesFromRule(range) : [];
  });
}

function isMainGroupMember(profile) {
  return Number(profile?.groupRanks?.[ROBLOX_GROUPS.HIGH_RANKS.groupId] || 0) > 0;
}

export function managedRoleIds() {
  const roles = config.roles?.managed || {};
  const ids = [config.roles?.verified, UNLINKED_ROLE_ID];

  Object.values(roles.DARK_COUNCIL?.ranks || {}).forEach(id => ids.push(id));
  (roles.DARK_COUNCIL?.ranges || []).forEach(range => ids.push(rolesFromRule(range)));
  Object.values(roles.DARK_COUNCIL?.senior || {}).forEach(id => ids.push(id));
  Object.values(roles.HIGH_RANKS?.ranks || {}).forEach(id => ids.push(id));
  (roles.HIGH_RANKS?.ranges || []).forEach(range => ids.push(rolesFromRule(range)));
  Object.values(roles.DIVISIONS || {}).forEach(group => {
    Object.values(group.ranks || {}).forEach(id => ids.push(id));
    (group.ranges || []).forEach(range => ids.push(rolesFromRule(range)));
  });

  return compactIds([...new Set(ids)]);
}

function roleIdsForProfile(profile) {
  const ids = [config.roles?.verified];
  const ranks = rawRanksFromProfile(profile);
  const managed = config.roles?.managed || {};

  if (!isMainGroupMember(profile)) {
    return compactIds([...new Set(ids)]);
  }

  ids.push(rolesFromRule(managed.DARK_COUNCIL?.ranks?.[String(ranks.darkCouncil)]));
  ids.push(rolesFromRanges(ranks.darkCouncil, managed.DARK_COUNCIL?.ranges));
  ids.push(rolesFromRule(managed.HIGH_RANKS?.ranks?.[String(ranks.highranks)]));
  ids.push(rolesFromRanges(ranks.highranks, managed.HIGH_RANKS?.ranges));

  for (const [roleName, active] of Object.entries(profile.authorityRoles || {})) {
    if (active) ids.push(managed.DARK_COUNCIL?.senior?.[roleName]);
  }

  for (const [division, rank] of Object.entries(ranks.divisions)) {
    ids.push(rolesFromRule(managed.DIVISIONS?.[division]?.ranks?.[String(rank)]));
    ids.push(rolesFromRanges(rank, managed.DIVISIONS?.[division]?.ranges));
  }

  return compactIds([...new Set(ids)]);
}

function nicknameRuleForProfile(profile) {
  if (!config.nicknames?.enabled || !isMainGroupMember(profile)) return null;

  const ranks = rawRanksFromProfile(profile);
  const managed = config.nicknames?.managed || {};
  const priority = config.nicknames?.priority || ["DIVISIONS", "HIGH_RANKS", "DARK_COUNCIL"];

  for (const group of priority) {
    if (group === "DIVISIONS") {
      for (const division of config.scopes?.divisionOrder || []) {
        const rule = managed.DIVISIONS?.[division]?.ranks?.[String(ranks.divisions?.[division] || 0)];
        if (rule) return rule;
      }
    }

    if (group === "HIGH_RANKS") {
      const rule = managed.HIGH_RANKS?.ranks?.[String(ranks.highranks)];
      if (rule) return rule;
    }

    if (group === "DARK_COUNCIL") {
      const rule = managed.DARK_COUNCIL?.ranks?.[String(ranks.darkCouncil)];
      if (rule) return rule;
    }
  }

  return null;
}

function cleanNickname(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 32);
}

async function nicknameForProfile(profile, link) {
  const rule = nicknameRuleForProfile(profile);
  if (!rule?.value) return "";
  if (rule.mode === "fixed") return cleanNickname(rule.value);

  const robloxUser = await loadRobloxUser(link.roblox_user_id).catch(() => null);
  const displayName = robloxUser?.displayName || robloxUser?.name || link.roblox_user_id;
  return cleanNickname(`${rule.value} ${displayName}`);
}

export function isDiscordAdmin(member) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
}

export function canManageBot(profile, member = null) {
  const roles = profile?.authorityRoles || {};
  return Boolean(
    isDiscordAdmin(member) ||
    hasCoreAccess(profile) ||
    roles.groupOwner ||
    roles.projectManager ||
    roles.emperor ||
    roles["emperorPowerbase"]
  );
}

function robloxRankPairs(profile) {
  const ranks = rawRanksFromProfile(profile);
  return [
    ["darkCouncil", ranks.darkCouncil],
    ["highranks", ranks.highranks],
    ...Object.entries(ranks.divisions)
  ];
}

function hasHigherSharedRobloxRank(actorProfile, targetProfile) {
  if (!actorProfile || !targetProfile) return false;

  const targetRanks = new Map(robloxRankPairs(targetProfile));
  return robloxRankPairs(actorProfile).some(([scope, actorRank]) => {
    const targetRank = Number(targetRanks.get(scope) || 0);
    return Number(actorRank || 0) > 0 && targetRank > 0 && Number(actorRank) > targetRank;
  });
}

export function canUpdateMemberRoles(actorProfile, targetProfile, actorMember = null, actorDiscordId = "") {
  if (canManageBot(actorProfile, actorMember)) return true;
  if (!ROBLOX_RANK_DELEGATE_DISCORD_IDS.has(String(actorDiscordId))) return false;
  return hasHigherSharedRobloxRank(actorProfile, targetProfile);
}

export function canManageEmperorVote(profile, member = null) {
  const roles = profile?.authorityRoles || {};
  return Boolean(isDiscordAdmin(member) || hasCoreAccess(profile) || roles.groupOwner || roles.projectManager);
}

export function canVoteEmperor(profile) {
  return Number(profile?.groupRanks?.[ROBLOX_GROUPS.HIGH_RANKS.groupId] || 0) > 0;
}

export function inferScope(profile) {
  const highRankValue = Number(profile?.groupRanks?.[ROBLOX_GROUPS.HIGH_RANKS.groupId] || 0);

  const tierWeight = { none: 0, member: 1, nco: 2, co: 3, "2ic": 4, "1ic": 5, overseer: 6 };
  const divisionScope = (config.scopes.divisionOrder || [])
    .map(scope => ({ scope, weight: tierWeight[profile.divisions?.[scope] || "none"] || 0 }))
    .filter(item => item.weight > 0)
    .sort((a, b) => b.weight - a.weight)[0]?.scope;

  if (divisionScope) return divisionScope;
  if (Number(profile?.groupRanks?.[ROBLOX_GROUPS.DARK_COUNCIL.groupId] || 0) > 0) return "darkCouncil";
  if (highRankValue >= 44 && highRankValue <= 53) return "highranks";

  return "";
}

export async function getVerifiedProfile(discordUserId) {
  const { data, error } = await supabase
    .from("verification_links")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.roblox_user_id) return null;

  const profile = await loadProfileForRoblox(data.roblox_user_id);
  profile.isSuperUser = SUPER_USER_IDS.includes(String(data.roblox_user_id));
  profile.hasFullAccess = profile.hasFullAccess || profile.isSuperUser;
  return { link: data, profile };
}

export async function syncMemberRoles(member, actorDiscordId = member.id) {
  const verified = await getVerifiedProfile(member.id);
  if (!verified) throw new Error("DISCORD_NOT_LINKED");

  const wanted = roleIdsForProfile(verified.profile);
  const managed = managedRoleIds();
  const currentManaged = member.roles.cache.filter(role => managed.includes(role.id)).map(role => role.id);
  const remove = currentManaged.filter(id => !wanted.includes(id));
  const add = wanted.filter(id => !member.roles.cache.has(id));

  if (remove.length) await member.roles.remove(remove, "Holonet role sync");
  if (add.length) await member.roles.add(add, "Holonet role sync");

  const nickname = await nicknameForProfile(verified.profile, verified.link);
  let nicknameUpdated = false;

  if (nickname && member.manageable && member.nickname !== nickname) {
    await member.setNickname(nickname, "Holonet nickname sync");
    nicknameUpdated = true;
  }

  await supabase
    .from("verification_links")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("discord_user_id", member.id);

  await audit("roles.sync", {
    actorDiscordId,
    targetDiscordId: member.id,
    robloxUserId: verified.link.roblox_user_id,
    metadata: { added: add, removed: remove, nickname: nickname || null, nicknameUpdated }
  });

  return { ...verified, added: add, removed: remove, roleIds: wanted, nickname, nicknameUpdated };
}

async function loadLinkedDiscordUserIds() {
  const ids = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("verification_links")
      .select("discord_user_id")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    ids.push(...(data || []).map(row => row.discord_user_id).filter(Boolean));
    if (!data || data.length < pageSize) break;
  }

  return [...new Set(ids.map(String))];
}

export async function syncVerifiedRoleForLinkedUsers(client) {
  const roleId = config.roles?.verified;
  const guildId = config.discord?.guildId;
  if (!roleId || !guildId) return { checked: 0, added: 0, removed: 0, unlinkedAdded: 0, verifiedRemoved: 0, failed: 0 };

  const guild = await client.guilds.fetch(guildId);
  const linkedDiscordIds = await loadLinkedDiscordUserIds();
  const linkedDiscordIdSet = new Set(linkedDiscordIds);
  let added = 0;
  let removed = 0;
  let unlinkedAdded = 0;
  let verifiedRemoved = 0;
  let failed = 0;

  for (const discordUserId of linkedDiscordIds) {
    try {
      const member = await guild.members.fetch(discordUserId);
      if (member.roles.cache.has(UNLINKED_ROLE_ID)) {
        await member.roles.remove(UNLINKED_ROLE_ID, "Holonet verified Discord link");
        removed += 1;
      }
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(roleId, "Holonet verified Discord link");
        added += 1;
      }
    } catch (error) {
      failed += 1;
      console.warn("Failed to apply verified role", {
        discordUserId,
        reason: error.message || String(error)
      });
    }
  }

  const members = await guild.members.fetch();
  for (const member of members.values()) {
    if (member.user?.bot || linkedDiscordIdSet.has(member.id)) continue;

    try {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId, "Holonet unlinked Discord account");
        verifiedRemoved += 1;
      }
      if (!member.roles.cache.has(UNLINKED_ROLE_ID)) {
        await member.roles.add(UNLINKED_ROLE_ID, "Holonet unlinked Discord account");
        unlinkedAdded += 1;
      }
    } catch (error) {
      failed += 1;
      console.warn("Failed to apply unlinked role", {
        discordUserId: member.id,
        reason: error.message || String(error)
      });
    }
  }

  return { checked: linkedDiscordIds.length, added, removed, unlinkedAdded, verifiedRemoved, failed };
}

export function divisionTierWeight(tier) {
  return { none: 0, member: 1, nco: 2, co: 3, "2ic": 4, "1ic": 5, overseer: 6 }[tier] || 0;
}

export function canAdjustTime(actorProfile, targetProfile, targetScope, sameUser = false) {
  if (sameUser) return true;
  if (!actorProfile || !targetProfile) return false;
  if (hasCoreAccess(actorProfile) || Object.values(actorProfile.authorityRoles || {}).some(Boolean)) return true;
  if (["darkCouncil", "highranks"].includes(targetScope)) return false;

  const actorTier = divisionTierWeight(actorProfile.divisions?.[targetScope] || "none");
  const targetTier = divisionTierWeight(targetProfile.divisions?.[targetScope] || "none");

  return actorTier >= divisionTierWeight("co") && actorTier > targetTier;
}
