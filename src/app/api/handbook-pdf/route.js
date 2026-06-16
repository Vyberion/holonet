import { getAuthContext } from "../../../../modules/auth/auth-context.js";
import { checkPageAccess } from "../../../../modules/auth/permissions.js";
import {
  createSignedStorageUrl,
  listStorageObjects,
  removeStorageObjects,
  supabaseRest,
  uploadStorageObject
} from "../../../../modules/auth/session-store.js";
import {
  exportGoogleDocPdf,
  extractGoogleFileId,
  extractGoogleTabId,
  getGoogleFileMetadata,
  googleWorkspaceKindFromUrl
} from "../../../lib/google-drive.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_BUCKET = "handbooks";
const CACHE_PREFIX = "google-cache";
const PDF_MIME_TYPE = "application/pdf";
const SIGNED_URL_TTL_SECONDS = 60 * 20;
const REDIRECT_CACHE_TTL_MS = 60 * 1000;
const redirectCache = globalThis.__holonetHandbookPdfRedirectCache || new Map();
globalThis.__holonetHandbookPdfRedirectCache = redirectCache;

function jsonError(status, reason, detail = {}) {
  return Response.json({ ok: false, reason, ...detail }, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}

function legacyRequestFrom(request) {
  return {
    headers: {
      cookie: request.headers.get("cookie") || ""
    }
  };
}

function safeSegment(value, fallback = "unknown") {
  return String(value || fallback)
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || fallback;
}

function cacheParts(resourceId, metadata, tabId) {
  const version = safeSegment(metadata?.version || metadata?.modifiedTime || Date.now(), "version");
  const tab = tabId ? `-${safeSegment(tabId, "tab")}` : "";
  const prefix = `${CACHE_PREFIX}/${safeSegment(resourceId, "resource")}`;
  const fileName = `${version}${tab}.pdf`;

  return {
    prefix,
    fileName,
    path: `${prefix}/${fileName}`
  };
}

function storageObjectPath(prefix, object) {
  const name = String(object?.name || "").replace(/^\/+/, "");
  if (!name) return "";
  return name.startsWith(`${prefix}/`) ? name : `${prefix}/${name}`;
}

async function listCachedObjects(prefix) {
  const objects = await listStorageObjects(CACHE_BUCKET, prefix).catch(() => []);
  return Array.isArray(objects) ? objects : [];
}

function hasCachedObject(objects, prefix, fileName) {
  const target = `${prefix}/${fileName}`;
  return objects.some(object => {
    const name = String(object?.name || "");
    return name === fileName || name === target || storageObjectPath(prefix, object) === target;
  });
}

async function removeOldCachedObjects(objects, prefix, currentPath) {
  const stalePaths = objects
    .map(object => storageObjectPath(prefix, object))
    .filter(path => path && path !== currentPath && path.endsWith(".pdf"));

  if (!stalePaths.length) return;
  await removeStorageObjects(CACHE_BUCKET, stalePaths).catch(error => {
    console.warn("Google handbook PDF cache cleanup failed:", error);
  });
}

function redirectTo(url, cacheStatus) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": "private, max-age=60",
      "X-Holonet-PDF-Cache": cacheStatus
    }
  });
}

async function signedCacheRedirect(cachePath, cacheStatus) {
  const memo = redirectCache.get(cachePath);
  if (memo && memo.expiresAt > Date.now()) {
    return redirectTo(memo.url, "memory");
  }

  const signedUrl = await createSignedStorageUrl(CACHE_BUCKET, cachePath, SIGNED_URL_TTL_SECONDS);
  redirectCache.set(cachePath, {
    url: signedUrl,
    expiresAt: Date.now() + REDIRECT_CACHE_TTL_MS
  });

  return redirectTo(signedUrl, cacheStatus);
}

async function loadHandbookResource(resourceId) {
  const [resource] = await supabaseRest(
    `registry_resources?id=eq.${encodeURIComponent(resourceId)}&resource_type=eq.handbook&status=eq.published&select=id,division_key,slug,title,status,visibility,updated_at`
  );

  if (!resource) return null;

  const [detail] = await supabaseRest(
    `resource_handbooks?resource_id=eq.${encodeURIComponent(resource.id)}&select=*`
  );

  return { resource, detail: detail || {} };
}

async function metadataForGoogleFile(fileId, resource, detail) {
  try {
    return await getGoogleFileMetadata(fileId);
  } catch (error) {
    console.warn("Google file metadata unavailable; using resource timestamp for handbook PDF cache:", error);
    return {
      modifiedTime: detail.updated_at || resource.updated_at || new Date().toISOString(),
      version: "metadata-unavailable"
    };
  }
}

async function cachedGooglePdfRedirect(resource, detail, googleFileId, googleTabId) {
  const googleDocUrl = detail.google_doc_url || "";
  const metadata = await metadataForGoogleFile(googleFileId, resource, detail);
  const cache = cacheParts(resource.id, metadata, googleTabId);
  const cachedObjects = await listCachedObjects(cache.prefix);

  if (!hasCachedObject(cachedObjects, cache.prefix, cache.fileName)) {
    const pdfBuffer = await exportGoogleDocPdf(googleFileId, {
      tabId: googleTabId,
      sourceUrl: googleDocUrl,
      fileKind: googleWorkspaceKindFromUrl(googleDocUrl)
    });

    await uploadStorageObject(CACHE_BUCKET, cache.path, pdfBuffer, PDF_MIME_TYPE);
    await removeOldCachedObjects(cachedObjects, cache.prefix, cache.path);
    return signedCacheRedirect(cache.path, "miss");
  }

  return signedCacheRedirect(cache.path, "hit");
}

async function supabasePdfRedirect(detail) {
  if (!detail.storage_path) {
    return jsonError(404, "HANDBOOK_NOT_LINKED");
  }

  const signedUrl = await createSignedStorageUrl(detail.storage_bucket || CACHE_BUCKET, detail.storage_path, SIGNED_URL_TTL_SECONDS);
  return redirectTo(signedUrl, "supabase");
}

export async function GET(request) {
  const url = new URL(request.url);
  const resourceId = String(url.searchParams.get("resourceId") || "").trim();

  if (!resourceId) {
    return jsonError(400, "RESOURCE_ID_REQUIRED");
  }

  try {
    const record = await loadHandbookResource(resourceId);
    if (!record) {
      return jsonError(404, "HANDBOOK_NOT_FOUND");
    }

    const { resource, detail } = record;
    const auth = await getAuthContext(legacyRequestFrom(request));
    const access = checkPageAccess(auth.profile, `${resource.division_key}_handbooks`);

    if (!access.authorized) {
      return jsonError(403, access.reason || "ACCESS_DENIED");
    }

    const googleFileId = detail.google_file_id || extractGoogleFileId(detail.google_doc_url);
    const googleTabId = detail.google_tab_id || extractGoogleTabId(detail.google_doc_url);

    if (googleFileId) {
      return await cachedGooglePdfRedirect(resource, detail, googleFileId, googleTabId);
    }

    return await supabasePdfRedirect(detail);
  } catch (error) {
    console.error("Handbook PDF export failed:", error);
    return jsonError(502, "HANDBOOK_PDF_EXPORT_FAILED", { error: error.message });
  }
}
