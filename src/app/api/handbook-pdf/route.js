import { getAuthContext } from "../../../../modules/auth/auth-context.js";
import { checkPageAccess } from "../../../../modules/auth/permissions.js";
import { createSignedStorageUrl, supabaseRest } from "../../../../modules/auth/session-store.js";
import { exportGoogleDocPdf, extractGoogleFileId, extractGoogleTabId, getGoogleFileMetadata } from "../../../lib/google-drive.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_EXPORT_CACHE_SECONDS = 120;
const MAX_EXPORT_CACHE_ENTRIES = 8;
const pdfExportCache = globalThis.__holonetHandbookPdfExportCache || new Map();
globalThis.__holonetHandbookPdfExportCache = pdfExportCache;

function jsonError(status, reason) {
  return Response.json({ ok: false, reason }, {
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

function safePdfFileName(resource, detail) {
  const source = detail?.file_name || resource?.slug || resource?.title || "handbook";
  const cleaned = String(source)
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `${cleaned || "handbook"}.pdf`;
}

function cacheTagFor(resourceId, googleFileId, googleTabId, metadata) {
  const version = metadata?.modifiedTime || metadata?.version || "unknown";
  const raw = `${resourceId}:${googleFileId}:${googleTabId || "file"}:${version}`;
  return `"${Buffer.from(raw).toString("base64url")}"`;
}

function requestHasEtag(request, etag) {
  const value = request.headers.get("if-none-match") || "";
  return value.split(",").map(item => item.trim()).includes(etag);
}

function shouldUseGoogleMetadata() {
  return /^(1|true|yes)$/i.test(String(process.env.HANDBOOK_PDF_USE_METADATA || ""));
}

function exportCacheSeconds() {
  const value = Number(process.env.HANDBOOK_PDF_CACHE_SECONDS ?? DEFAULT_EXPORT_CACHE_SECONDS);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function pdfCacheControl() {
  const seconds = exportCacheSeconds();
  return seconds
    ? `private, max-age=${seconds}, stale-while-revalidate=${seconds * 3}`
    : "private, max-age=0, must-revalidate";
}

function pdfHeaders() {
  return {
    "Content-Type": "application/pdf",
    "Cache-Control": pdfCacheControl()
  };
}

function exportCacheTtlMs() {
  return exportCacheSeconds() * 1000;
}

function exportCacheKey(resourceId, googleFileId, googleTabId, sourceUrl, metadata) {
  const version = metadata?.modifiedTime || metadata?.version || "unversioned";
  return [
    resourceId,
    googleFileId,
    googleTabId || "file",
    sourceUrl || "",
    version
  ].join(":");
}

function trimExportCache() {
  while (pdfExportCache.size > MAX_EXPORT_CACHE_ENTRIES) {
    pdfExportCache.delete(pdfExportCache.keys().next().value);
  }
}

async function cachedGooglePdfExport(cacheKey, exporter) {
  const ttlMs = exportCacheTtlMs();
  if (!ttlMs) {
    return {
      pdf: await exporter(),
      cacheStatus: "off"
    };
  }

  const now = Date.now();
  const existing = pdfExportCache.get(cacheKey);
  if (existing && existing.expiresAt > now) {
    return {
      pdf: await (existing.promise || existing.pdf),
      cacheStatus: existing.promise ? "pending" : "hit"
    };
  }

  if (existing) {
    pdfExportCache.delete(cacheKey);
  }

  const promise = Promise.resolve().then(exporter);
  pdfExportCache.set(cacheKey, {
    expiresAt: now + ttlMs,
    promise
  });
  trimExportCache();

  try {
    const pdf = await promise;
    pdfExportCache.set(cacheKey, {
      expiresAt: Date.now() + ttlMs,
      pdf
    });
    trimExportCache();
    return {
      pdf,
      cacheStatus: "miss"
    };
  } catch (error) {
    const latest = pdfExportCache.get(cacheKey);
    if (latest?.promise === promise) {
      pdfExportCache.delete(cacheKey);
    }
    throw error;
  }
}

async function loadHandbookResource(resourceId) {
  const [resource] = await supabaseRest(
    `registry_resources?id=eq.${encodeURIComponent(resourceId)}&resource_type=eq.handbook&status=eq.published&select=id,division_key,slug,title,status`
  );

  if (!resource) return null;

  const [detail] = await supabaseRest(
    `resource_handbooks?resource_id=eq.${encodeURIComponent(resource.id)}&select=*`
  );

  return { resource, detail: detail || {} };
}

async function legacySupabasePdfResponse(resource, detail) {
  if (!detail.storage_path) {
    return jsonError(404, "HANDBOOK_NOT_LINKED");
  }

  const signedUrl = await createSignedStorageUrl(detail.storage_bucket || "handbooks", detail.storage_path);
  const response = await fetch(signedUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`LEGACY_HANDBOOK_FETCH_FAILED:${response.status}`);
  }

  return new Response(await response.arrayBuffer(), {
    status: 200,
    headers: {
      ...pdfHeaders(),
      "Content-Disposition": `inline; filename="${safePdfFileName(resource, detail)}"`
    }
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const resourceId = String(url.searchParams.get("resourceId") || "").trim();

  if (!resourceId) {
    return jsonError(400, "RESOURCE_ID_REQUIRED");
  }

  const auth = await getAuthContext(legacyRequestFrom(request));
  const record = await loadHandbookResource(resourceId);

  if (!record) {
    return jsonError(404, "HANDBOOK_NOT_FOUND");
  }

  const { resource, detail } = record;
  const access = checkPageAccess(auth.profile, `${resource.division_key}_handbooks`);

  if (!access.authorized) {
    return jsonError(200, access.reason || "ACCESS_DENIED");
  }

  const googleFileId = detail.google_file_id || extractGoogleFileId(detail.google_doc_url);
  const googleTabId = detail.google_tab_id || extractGoogleTabId(detail.google_doc_url);

  try {
    if (googleFileId) {
      let metadata = null;
      let cacheHeaders = pdfHeaders();

      if (shouldUseGoogleMetadata()) {
        try {
          metadata = await getGoogleFileMetadata(googleFileId);
          const etag = cacheTagFor(resource.id, googleFileId, googleTabId, metadata);
          cacheHeaders = {
            ...pdfHeaders(),
            ETag: etag,
            ...(metadata.modifiedTime ? { "Last-Modified": new Date(metadata.modifiedTime).toUTCString() } : {})
          };

          if (requestHasEtag(request, etag)) {
            return new Response(null, {
              status: 304,
              headers: cacheHeaders
            });
          }
        } catch (metadataError) {
          console.warn("Google file metadata unavailable; exporting handbook PDF without revalidation:", metadataError);
        }
      }

      const { pdf, cacheStatus } = await cachedGooglePdfExport(
        exportCacheKey(resource.id, googleFileId, googleTabId, detail.google_doc_url, metadata),
        () => exportGoogleDocPdf(googleFileId, {
          tabId: googleTabId,
          sourceUrl: detail.google_doc_url
        })
      );

      return new Response(pdf, {
        status: 200,
        headers: {
          ...cacheHeaders,
          "Content-Length": String(pdf.byteLength),
          "X-Handbook-Pdf-Cache": cacheStatus,
          "Content-Disposition": `inline; filename="${safePdfFileName(resource, detail)}"`
        }
      });
    }

    return await legacySupabasePdfResponse(resource, detail);
  } catch (error) {
    console.error("Handbook PDF export failed:", error);
    return jsonError(502, "HANDBOOK_PDF_EXPORT_FAILED");
  }
}
