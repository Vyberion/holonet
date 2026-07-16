import {
  listStorageObjects,
  removeStorageObjects,
  supabaseRest,
  uploadStorageObject
} from "../../../../../modules/auth/session-store.js";
import {
  exportGoogleDocPdf,
  extractGoogleFileId,
  extractGoogleTabId,
  fetchGoogleFileMetadata,
  googleWorkspaceKindFromUrl
} from "../../../../lib/google-drive.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_BUCKET = "handbooks";
const CACHE_PREFIX = "google-cache";
const PDF_MIME_TYPE = "application/pdf";
const MAX_REFRESH_PER_RUN = Number(process.env.HANDBOOK_PDF_REFRESH_LIMIT || 8);

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}

function requireString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function safeSegment(value, fallback = "unknown") {
  return String(value || fallback)
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || fallback;
}

function cronAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const authorization = request.headers.get("authorization") || "";
  const headerSecret = request.headers.get("x-cron-secret") || "";
  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

function storageObjectPath(prefix, object) {
  const name = String(object?.name || "").replace(/^\/+/, "");
  if (!name) return "";
  return name.startsWith(`${prefix}/`) ? name : `${prefix}/${name}`;
}

function hasCachedObject(objects, prefix, fileName) {
  const target = `${prefix}/${fileName}`;
  return objects.some(object => {
    const name = String(object?.name || "");
    return name === fileName || name === target || storageObjectPath(prefix, object) === target;
  });
}

async function listCachedObjects(prefix) {
  const objects = await listStorageObjects(CACHE_BUCKET, prefix).catch(() => []);
  return Array.isArray(objects) ? objects : [];
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

function cacheParts(resource, googleTabId, modifiedTime) {
  const version = safeSegment(modifiedTime || resource.updated_at || resource.created_at || "published", "published");
  const tab = googleTabId ? `-${safeSegment(googleTabId, "tab")}` : "";
  const prefix = `${CACHE_PREFIX}/${safeSegment(resource.id, "resource")}`;
  const fileName = `${version}${tab}.pdf`;
  return { prefix, fileName, path: `${prefix}/${fileName}` };
}

function inList(values) {
  return values.map(value => String(value || "")).filter(Boolean).join(",");
}

async function loadPublishedGoogleHandbooks() {
  const resources = await supabaseRest(
    "registry_resources?resource_type=eq.handbook&status=eq.published&select=id,division_key,slug,title,created_at,updated_at&order=updated_at.desc"
  );

  if (!resources?.length) return [];

  const detailRows = await supabaseRest(
    `resource_handbooks?resource_id=in.(${inList(resources.map(resource => resource.id))})&select=*`
  );
  const detailsByResourceId = new Map((detailRows || []).map(detail => [detail.resource_id, detail]));

  return resources
    .map(resource => ({ resource, detail: detailsByResourceId.get(resource.id) || {} }))
    .filter(({ detail }) => detail.google_file_id || extractGoogleFileId(detail.google_doc_url));
}

function currentExportVersion(detail) {
  return requireString(detail.published_at || detail.cache_version || "");
}

async function refreshHandbook({ resource, detail }) {
  const googleDocUrl = requireString(detail.google_doc_url);
  const googleFileId = requireString(detail.google_file_id) || extractGoogleFileId(googleDocUrl);
  const googleTabId = requireString(detail.google_tab_id) || extractGoogleTabId(googleDocUrl);
  const metadata = await fetchGoogleFileMetadata(googleFileId);
  const modifiedTime = requireString(metadata.modifiedTime);

  if (!modifiedTime) {
    return { id: resource.id, title: resource.title, refreshed: false, reason: "GOOGLE_MODIFIED_TIME_MISSING" };
  }

  const cache = cacheParts(resource, googleTabId, modifiedTime);
  const cachedObjects = await listCachedObjects(cache.prefix);
  const alreadyExported = currentExportVersion(detail) === modifiedTime && hasCachedObject(cachedObjects, cache.prefix, cache.fileName);

  if (alreadyExported) {
    return { id: resource.id, title: resource.title, refreshed: false, reason: "UNCHANGED", googleModifiedTime: modifiedTime, cachePath: cache.path };
  }

  const pdfBuffer = await exportGoogleDocPdf(googleFileId, {
    tabId: googleTabId,
    sourceUrl: googleDocUrl,
    fileKind: googleWorkspaceKindFromUrl(googleDocUrl)
  });

  await uploadStorageObject(CACHE_BUCKET, cache.path, pdfBuffer, PDF_MIME_TYPE);
  await removeOldCachedObjects(cachedObjects, cache.prefix, cache.path);

  await supabaseRest(`resource_handbooks?resource_id=eq.${encodeURIComponent(resource.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      storage_bucket: CACHE_BUCKET,
      storage_path: cache.path,
      file_name: `${safeSegment(resource.slug || resource.title || resource.id, "handbook")}.pdf`,
      mime_type: PDF_MIME_TYPE,
      published_at: modifiedTime
    })
  });

  return { id: resource.id, title: resource.title, refreshed: true, googleModifiedTime: modifiedTime, cachePath: cache.path };
}

export async function GET(request) {
  if (!cronAuthorized(request)) {
    return json({ ok: false, reason: "CRON_UNAUTHORIZED" }, 401);
  }

  try {
    const candidates = await loadPublishedGoogleHandbooks();
    const limited = candidates.slice(0, Math.max(1, MAX_REFRESH_PER_RUN));
    const results = [];

    for (const candidate of limited) {
      try {
        results.push(await refreshHandbook(candidate));
      } catch (error) {
        results.push({ id: candidate.resource.id, title: candidate.resource.title, refreshed: false, reason: "REFRESH_FAILED", error: error.message });
      }
    }

    return json({ ok: true, checked: limited.length, totalCandidates: candidates.length, refreshed: results.filter(result => result.refreshed).length, results });
  } catch (error) {
    console.error("Handbook PDF refresh failed:", error);
    return json({ ok: false, reason: "HANDBOOK_PDF_REFRESH_FAILED", error: error.message }, 500);
  }
}
