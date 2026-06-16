import { getAuthContext } from "../../../../modules/auth/auth-context.js";
import { checkPageAccess } from "../../../../modules/auth/permissions.js";
import { createSignedStorageUrl, supabaseRest } from "../../../../modules/auth/session-store.js";
import { exportGoogleDocPdf, extractGoogleFileId, extractGoogleTabId, getGoogleFileMetadata } from "../../../lib/google-drive.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PDF_HEADERS = {
  "Content-Type": "application/pdf",
  "Cache-Control": "private, max-age=0, must-revalidate"
};

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
      ...PDF_HEADERS,
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
      const metadata = await getGoogleFileMetadata(googleFileId);
      const etag = cacheTagFor(resource.id, googleFileId, googleTabId, metadata);
      const cacheHeaders = {
        ...PDF_HEADERS,
        ETag: etag,
        ...(metadata.modifiedTime ? { "Last-Modified": new Date(metadata.modifiedTime).toUTCString() } : {})
      };

      if (requestHasEtag(request, etag)) {
        return new Response(null, {
          status: 304,
          headers: cacheHeaders
        });
      }

      const pdf = await exportGoogleDocPdf(googleFileId, { tabId: googleTabId });

      return new Response(pdf, {
        status: 200,
        headers: {
          ...cacheHeaders,
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
