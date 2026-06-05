import { createHash, randomBytes } from "crypto";

export const SESSION_COOKIE = "sith_session";
export const STATE_COOKIE = "sith_oauth_state";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Authorization service is not configured");
  }

  return {
    baseUrl: supabaseUrl.replace(/\/$/, ""),
    key: supabaseKey
  };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRandomToken() {
  return randomBytes(32).toString("base64url");
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";

  return header.split(";").reduce((cookies, part) => {
    const index = part.indexOf("=");
    if (index === -1) return cookies;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);

    return cookies;
  }, {});
}

export function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) segments.push(`Max-Age=${options.maxAge}`);
  if (options.expires) segments.push(`Expires=${options.expires.toUTCString()}`);
  segments.push(`Path=${options.path || "/"}`);
  if (options.httpOnly !== false) segments.push("HttpOnly");
  if (options.secure !== false) segments.push("Secure");
  segments.push(`SameSite=${options.sameSite || "Lax"}`);

  return segments.join("; ");
}

export function clearCookie(name) {
  return serializeCookie(name, "", {
    maxAge: 0,
    expires: new Date(0)
  });
}

export function getCookie(req, name) {
  return parseCookies(req)[name] || "";
}

export async function supabaseRest(path, options = {}) {
  const { baseUrl, key } = getSupabaseConfig();
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Database request failed: ${detail}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function cleanupExpiredSessions() {
  const now = encodeURIComponent(new Date().toISOString());

  try {
    await supabaseRest(`sessions?expires_at=lt.${now}`, { method: "DELETE" });
  } catch (error) {
    console.error("Expired session cleanup failed:", error);
  }
}

export async function createSessionForUser({ robloxId, robloxUsername, robloxDisplayName }) {
  const token = createRandomToken();
  const sessionId = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

  await supabaseRest("users", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      roblox_id: String(robloxId),
      roblox_username: robloxUsername,
      roblox_display_name: robloxDisplayName,
      updated_at: now.toISOString()
    })
  });

  await supabaseRest("sessions", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      roblox_id: String(robloxId),
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      last_seen_at: now.toISOString()
    })
  });

  return { token, expiresAt };
}

export async function deleteSessionToken(token) {
  if (!token) return;
  await supabaseRest(`sessions?session_id=eq.${encodeURIComponent(hashToken(token))}`, {
    method: "DELETE"
  });
}

export async function getSessionUser(req) {
  const token = getCookie(req, SESSION_COOKIE);

  if (!token) {
    return { authenticated: false, reason: "SESSION_MISSING" };
  }

  const sessionId = hashToken(token);
  const sessions = await supabaseRest(
    `sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=session_id,roblox_id,expires_at`
  );

  if (!sessions || sessions.length === 0) {
    return { authenticated: false, reason: "SESSION_INVALID" };
  }

  const session = sessions[0];
  const expiresAt = new Date(session.expires_at);

  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
    await deleteSessionToken(token);
    return { authenticated: false, reason: "SESSION_EXPIRED" };
  }

  const users = await supabaseRest(
    `users?roblox_id=eq.${encodeURIComponent(session.roblox_id)}&select=roblox_id,roblox_username,roblox_display_name`
  );

  if (!users || users.length === 0) {
    await deleteSessionToken(token);
    return { authenticated: false, reason: "USER_NOT_FOUND" };
  }

  await supabaseRest(`sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify({ last_seen_at: new Date().toISOString() })
  });

  return {
    authenticated: true,
    user: users[0]
  };
}
