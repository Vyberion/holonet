import { buildProfile } from "./profile.js";
import { getSessionUser, supabaseRest } from "./session-store.js";

const GROUP_ROLE_CACHE_TTL_MS = 5 * 60 * 1000;
const groupRoleCache = globalThis.__holonetGroupRoleCache || new Map();
globalThis.__holonetGroupRoleCache = groupRoleCache;

function encodeEq(value) {
  return encodeURIComponent(String(value ?? ""));
}

function headerValue(req, name) {
  const headers = req?.headers;
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  return headers[name] || headers[name.toLowerCase()] || "";
}

function timingSafeEqualText(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (!a || !b || a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function bearerToken(req) {
  const authorization = headerValue(req, "authorization");
  const match = /^Bearer\s+(.+)$/i.exec(String(authorization || "").trim());
  return match?.[1]?.trim() || "";
}

function hasDarthManarToken(req) {
  const expected = String(process.env.DARTH_MANAR_TOKEN || "").trim();
  if (!expected) return false;

  const provided = bearerToken(req) || String(headerValue(req, "x-darth-manar-token") || "").trim();
  return timingSafeEqualText(provided, expected);
}

function darthManarAuthContext() {
  const profile = {
    robloxId: "darth-manar",
    isSuperUser: true,
    isMachine: true,
    machineName: "darth-manar",
    groupRanks: {},
    authorityRoles: {
      groupOwner: true,
      projectManager: true,
      emperor: true,
      emperorPowerbase: true
    },
    hasFullAccess: true,
    highRank: "overseer",
    divisions: {
      reavers: "overseer",
      dhg: "overseer",
      inquisitors: "overseer",
      dreadmasters: "overseer",
      dark_council: "overseer"
    },
    accessOverrides: []
  };

  return {
    authenticated: true,
    machine: true,
    user: {
      roblox_id: "darth-manar",
      roblox_username: "Darth Manar",
      roblox_display_name: "Darth Manar"
    },
    profile
  };
}

async function loadActiveOverrides(robloxId) {
  const now = encodeURIComponent(new Date().toISOString());
  const rows = await supabaseRest(
    `access_overrides?roblox_id=eq.${encodeEq(robloxId)}&active=eq.true&or=(expires_at.is.null,expires_at.gt.${now})&select=*`
  ).catch(() => []);

  return Array.isArray(rows) ? rows : [];
}

async function fetchGroupRoles(robloxId) {
  const response = await fetch(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`);
  if (!response.ok) {
    throw new Error("GROUP_ROLE_LOOKUP_FAILED");
  }

  const payload = await response.json();
  return payload.data || [];
}

async function loadGroupRoles(robloxId) {
  const cacheKey = String(robloxId || "");
  const cached = groupRoleCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.roles;
  }

  try {
    const roles = await fetchGroupRoles(cacheKey);
    groupRoleCache.set(cacheKey, {
      roles,
      expiresAt: Date.now() + GROUP_ROLE_CACHE_TTL_MS
    });
    return roles;
  } catch (error) {
    if (cached?.roles) return cached.roles;
    throw error;
  }
}

export async function getAuthContext(req, { optional = false } = {}) {
  if (hasDarthManarToken(req)) {
    return darthManarAuthContext();
  }

  const session = await getSessionUser(req);
  if (!session.authenticated) {
    const profile = buildProfile({ robloxId: "0", groupRoles: [] });
    const previewSuperuser = Boolean(profile.isSuperUser);

    return {
      authenticated: previewSuperuser || !optional,
      user: null,
      profile,
      reason: session.reason
    };
  }

  const robloxId = String(session.user.roblox_id);
  const [groupRoles, accessOverrides] = await Promise.all([
    loadGroupRoles(robloxId),
    loadActiveOverrides(robloxId)
  ]);

  const profile = buildProfile({
    robloxId,
    groupRoles
  });

  profile.accessOverrides = accessOverrides;

  return {
    authenticated: true,
    user: session.user,
    profile
  };
}
