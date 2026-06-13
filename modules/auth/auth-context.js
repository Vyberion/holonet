import { buildProfile } from "./profile.js";
import { cleanupExpiredSessions, getSessionUser, supabaseRest } from "./session-store.js";

function encodeEq(value) {
  return encodeURIComponent(String(value ?? ""));
}

async function loadActiveOverrides(robloxId) {
  const now = encodeURIComponent(new Date().toISOString());
  const rows = await supabaseRest(
    `access_overrides?roblox_id=eq.${encodeEq(robloxId)}&active=eq.true&or=(expires_at.is.null,expires_at.gt.${now})&select=*`
  ).catch(() => []);

  return Array.isArray(rows) ? rows : [];
}

async function loadGroupRoles(robloxId) {
  const response = await fetch(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`);
  if (!response.ok) {
    throw new Error("Roblox Core Engine communication error");
  }

  const payload = await response.json();
  return payload.data || [];
}

export async function getAuthContext(req, { optional = false } = {}) {
  await cleanupExpiredSessions();

  const session = await getSessionUser(req);
  if (!session.authenticated) {
    const profile = buildProfile({ robloxId: "0", groupRoles: [] });

    return {
      authenticated: true,
      user: null,
      profile
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
