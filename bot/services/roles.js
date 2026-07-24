import { PermissionFlagsBits } from "discord.js";
import { config } from "../config/index.js";
import { missingBotPermissionsError, roleManagementBlockedError } from "./bot-errors.js";
import { ROBLOX_GROUPS, SUPER_USER_IDS } from "../../modules/auth/roblox-groups.js";
import { hasCoreAccess } from "../../modules/auth/permissions.js";
import { loadProfileForRoblox, loadRobloxUser, rawRanksFromProfile } from "./roblox.js";
import { audit, supabase } from "./supabase.js";
import {
  compactRoleIds,
  managedRoleIdsFromConfig,
  roleIdsFromRanges,
  roleIdsFromRule,
  roleSyncPlan
} from "./role-rules.js";

const ROBLOX_RANK_DELEGATE_DISCORD_IDS = new Set(["1046546991360004136"]);
const UNLINKED_ROLE_ID = config.roles?.unlinked || "1340850135680155674";
const UNVERIFIED_REMOVED_ROLE_IDS = ["1340829015484928053"];

function isMainGroupMember(profile) {
  return Number(profile?.groupRanks?.[ROBLOX_GROUPS.HIGH_RANKS.groupId] || 0) > 0;
}

export function managedRoleIds() {
  return managedRoleIdsFromConfig(config, { unlinkedRoleId: UNLINKED_ROLE_ID });
}

function roleIdsForProfile(profile) {
  const ids = [config.roles?.verified];

  if (!isMainGroupMember(profile)) {
    if (config.roles?.verifiedNonHighRank) ids.push(config.roles.verifiedNonHighRank);
    return compactRoleIds(ids);
  }

  const ranks = rawRanksFromProfile(profile);
  const managed = config.roles?.managed || {};

  ids.push(roleIdsFromRule(managed.DARK_COUNCIL?.ranks?.[String(ranks.darkCouncil)]));
  ids.push(roleIdsFromRanges(ranks.darkCouncil, managed.DARK_COUNCIL?.ranges));
  ids.push(roleIdsFromRule(managed.HIGH_RANKS?.ranks?.[String(ranks.highranks)]));
  ids.push(roleIdsFromRanges(ranks.highranks, managed.HIGH_RANKS?.ranges));

  for (const [roleName, active] of Object.entries(profile.authorityRoles || {})) {
    if (active) ids.push(managed.DARK_COUNCIL?.senior?.[roleName]);
  }

  for (const [division, rank] of Object.entries(ranks.divisions)) {
    ids.push(roleIdsFromRule(managed.DIVISIONS?.[division]?.ranks?.[String(rank)]));
    ids.push(roleIdsFromRanges(rank, managed.DIVISIONS?.[division]?.ranges));
  }

  return compactRoleIds(ids);
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

function capitalizeFirstLetter(value) {
  const text = String(value || "").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

async function nicknameForProfile(profile, link) {
  if (config.nicknames?.enabled === false) return "";

  const rule = nicknameRuleForProfile(profile);
  if (rule?.mode === "fixed") return cleanNickname(rule.value);

  const robloxUser = await loadRobloxUser(link.roblox_user_id).catch(() => null);
  const displayName = capitalizeFirstLetter(robloxUser?.displayName || robloxUser?.name || link.roblox_user_id);
  if (!rule?.value) return cleanNickname(displayName);

  return cleanNickname(`${rule.value} ${displayName}`);
}

export function isDiscordAdmin(member) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
}

function assertBotGuildPermissions(member, permissions) {
  const missing = member?.guild?.members?.me?.permissions?.missing?.(permissions) || [];
  if (missing.length) throw missingBotPermissionsError(missing);
}

function assertBotCanManageRoleIds(member, roleIds) {
  assertBotGuildPermissions(member, ["ManageRoles"]);

  const guild = member?.guild;
  const blockedRoles = [...new Set(roleIds)]
    .map(roleId => guild?.roles?.cache?.get(roleId))
    .filter(role => role && !role.editable)
    .map(role => ({
      id: role.id,
      name: role.name,
      managed: Boolean(role.managed)
    }));

  if (blockedRoles.length) throw roleManagementBlockedError(blockedRoles);
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

const UPDATE_ROLES_BYPASS_ROLES = new Set([
  "1164544685222658138",
  "1150992093435666432",
  "1150907546773749820"
]);

export function canUpdateMemberRoles(actorProfile, targetProfile, actorMember = null, actorDiscordId = "") {
  if (canManageBot(actorProfile, actorMember)) return true;
  
  const hasBypassRole = actorMember?.roles?.cache?.some(role => UPDATE_ROLES_BYPASS_ROLES.has(role.id));
  if (hasBypassRole) return true;

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
  const wanted = verified ? roleIdsForProfile(verified.profile) : [UNLINKED_ROLE_ID];
  const managed = verified
    ? managedRoleIds()
    : [...managedRoleIds(), ...UNVERIFIED_REMOVED_ROLE_IDS];
  const currentRoleIds = member.roles.cache.map(role => role.id);
  const { add, remove } = roleSyncPlan({
    currentRoleIds,
    wantedRoleIds: wanted,
    managedRoleIds: managed
  });

  if (remove.length || add.length) assertBotCanManageRoleIds(member, [...remove, ...add]);

  if (remove.length) await member.roles.remove(remove, "Holonet role sync");
  if (add.length) await member.roles.add(add, "Holonet role sync");

  if (!verified) {
    let nicknameUpdated = false;
    if (member.manageable && member.nickname) {
      assertBotGuildPermissions(member, ["ManageNicknames"]);
      await member.setNickname(null, "Holonet unlink sync");
      nicknameUpdated = true;
    }

    await audit("roles.sync", {
      actorDiscordId,
      targetDiscordId: member.id,
      robloxUserId: null,
      metadata: { added: add, removed: remove, unlinked: true, nicknameUpdated }
    });

    return {
      link: null,
      profile: null,
      added: add,
      removed: remove,
      roleIds: wanted,
      nickname: "",
      nicknameUpdated,
      unlinked: true
    };
  }

  const nickname = await nicknameForProfile(verified.profile, verified.link);
  let nicknameUpdated = false;

  if (nickname && member.manageable && member.nickname !== nickname) {
    assertBotGuildPermissions(member, ["ManageNicknames"]);
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
