import { createHash, randomBytes } from "crypto";

export const SESSION_COOKIE = "sith_session";
export const STATE_COOKIE = "sith_oauth_state";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 183;

const SESSION_TOUCH_INTERVAL_MS = 15 * 60 * 1000;
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const sessionTouchCache = globalThis.__holonetSessionTouchCache || new Map();
const sessionMaintenanceState = globalThis.__holonetSessionMaintenanceState || { lastCleanupAt: 0 };
globalThis.__holonetSessionTouchCache = sessionTouchCache;
globalThis.__holonetSessionMaintenanceState = sessionMaintenanceState;

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

function isHandbookRetirementPath(path) {
  return String(path || "").startsWith("resource_handbook_retirements");
}

export function createRandomToken() {
  return randomBytes(32).toString("base64url");
}

function parseCookies(req) {
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

function normalizeCookieDomain(value = "") {
  const domain = String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/^\./, "")
    .replace(/^www\./i, "");
    
  if (!domain || domain === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) return "";
  return domain.startsWith(".") ? domain : `.${domain}`;
}

function defaultCookieDomain() {
  const explicit = process.env.HOLONET_COOKIE_DOMAIN || process.env.COOKIE_DOMAIN || "";
  if (explicit) return normalizeCookieDomain(explicit);

  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.HOLONET_BASE_URL || "";
  if (!configuredUrl) {
    return process.env.NODE_ENV === "production" ? ".thesithorder.org" : "";
  }

  try {
    const url = new URL(configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`);
    return normalizeCookieDomain(url.hostname);
  } catch {
    return normalizeCookieDomain(configuredUrl);
  }
}

export function serializeCookie(name, value, options = {}) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) segments.push(`Max-Age=${options.maxAge}`);
  if (options.expires) segments.push(`Expires=${options.expires.toUTCString()}`);
  const domain = options.domain === undefined ? defaultCookieDomain() : normalizeCookieDomain(options.domain);
  if (domain) segments.push(`Domain=${domain}`);
  segments.push(`Path=${options.path || "/"}`);
  if (options.httpOnly !== false) segments.push("HttpOnly");
  if (options.secure !== false) segments.push("Secure");
  segments.push(`SameSite=${options.sameSite || "Lax"}`);

  return segments.join("; ");
}

export function clearCookie(name, options = {}) {
  return serializeCookie(name, "", {
    ...options,
    maxAge: 0,
    expires: new Date(0)
  });
}

export function getCookie(req, name) {
  return parseCookies(req)[name] || "";
}

export async function supabaseRest(path, options = {}) {
  if (isHandbookRetirementPath(path)) {
    const method = String(options.method || "GET").toUpperCase();
    return ["DELETE", "PATCH", "PUT"].includes(method) ? null : [];
  }

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

function encodeStoragePath(path) {
  return String(path || "")
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");
}

async function storageRequest(path, options = {}) {
  const { baseUrl, key } = getSupabaseConfig();
  const response = await fetch(`${baseUrl}/storage/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Storage request failed: ${detail}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function createSignedStorageUrl(bucket, path, expiresIn = 60 * 20) {
  const { baseUrl, key } = getSupabaseConfig();
  const response = await fetch(`${baseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ expiresIn })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Storage signing failed: ${detail}`);
  }

  const payload = await response.json();
  const signedPath = payload.signedURL || payload.signedUrl || payload.signed_url;

  if (!signedPath) {
    throw new Error("Storage signing failed: missing signed URL");
  }

  if (signedPath.startsWith("http")) return signedPath;

  const normalizedSignedPath = signedPath.startsWith("/") ? signedPath : `/${signedPath}`;
  return `${baseUrl}/storage/v1${normalizedSignedPath}`;
}

export async function listStorageObjects(bucket, prefix = "") {
  return storageRequest(`object/list/${encodeURIComponent(bucket)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prefix,
      limit: 100,
      offset: 0,
      sortBy: { column: "name", order: "asc" }
    })
  });
}

export async function uploadStorageObject(bucket, path, body, contentType = "application/octet-stream") {
  return storageRequest(`object/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body
  });
}

export async function removeStorageObjects(bucket, paths) {
  if (!Array.isArray(paths) || !paths.length) return null;

  return Promise.all(paths.map(path =>
    storageRequest(`object/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`, {
      method: "DELETE"
    })
  ));
}

export async function cleanupExpiredSessions({ force = false } = {}) {
  const nowMs = Date.now();
  if (!force && nowMs - sessionMaintenanceState.lastCleanupAt < SESSION_CLEANUP_INTERVAL_MS) {
    return;
  }

  sessionMaintenanceState.lastCleanupAt = nowMs;
  const now = encodeURIComponent(new Date(nowMs).toISOString());

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

  sessionTouchCache.set(sessionId, now.getTime());

  return { token, expiresAt };
}

export async function deleteSessionToken(token) {
  if (!token) return;
  const sessionId = hashToken(token);
  sessionTouchCache.delete(sessionId);
  await supabaseRest(`sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
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
    `sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=session_id,roblox_id,expires_at,last_seen_at`
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

  const nowMs = Date.now();
  const cachedTouch = sessionTouchCache.get(sessionId) || 0;
  const storedTouch = session.last_seen_at ? new Date(session.last_seen_at).getTime() : 0;
  const lastTouch = Math.max(cachedTouch, Number.isFinite(storedTouch) ? storedTouch : 0);

  if (nowMs - lastTouch >= SESSION_TOUCH_INTERVAL_MS) {
    sessionTouchCache.set(sessionId, nowMs);
    await supabaseRest(`sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      body: JSON.stringify({ last_seen_at: new Date(nowMs).toISOString() })
    }).catch(error => {
      sessionTouchCache.delete(sessionId);
      throw error;
    });
  }

  return {
    authenticated: true,
    user: users[0]
  };
}
