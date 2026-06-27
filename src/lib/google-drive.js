import { GoogleAuth } from "google-auth-library";

const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const DOCUMENTS_READONLY_SCOPE = "https://www.googleapis.com/auth/documents.readonly";
const GOOGLE_DOC_PDF_MIME = "application/pdf";

let authClientPromise = null;

function parseServiceAccountJson() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON_INVALID: ${error.message}`);
  }
}

function serviceAccountCredentials() {
  const jsonCredentials = parseServiceAccountJson();
  if (jsonCredentials?.client_email && jsonCredentials?.private_key) {
    return {
      client_email: jsonCredentials.client_email,
      private_key: String(jsonCredentials.private_key).replace(/\\n/g, "\n")
    };
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_MISSING");
  }

  return {
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, "\n")
  };
}

async function getDriveAuthClient() {
  if (!authClientPromise) {
    authClientPromise = new GoogleAuth({
      credentials: serviceAccountCredentials(),
      scopes: [DRIVE_READONLY_SCOPE, DOCUMENTS_READONLY_SCOPE]
    }).getClient();
  }

  return authClientPromise;
}

async function getGoogleAccessToken() {
  const client = await getDriveAuthClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;

  if (!token) {
    throw new Error("GOOGLE_ACCESS_TOKEN_MISSING");
  }

  return token;
}

export function extractGoogleFileId(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  if (/^[a-zA-Z0-9_-]{20,}$/.test(text)) return text;

  const patterns = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  return "";
}

export function extractGoogleTabId(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const url = new URL(text);
    return url.searchParams.get("tab") || "";
  } catch {
    return text.match(/[?&]tab=([^&#]+)/)?.[1] || "";
  }
}

export function googleWorkspaceKindFromUrl(value) {
  const text = String(value || "");
  if (/\/presentation\/d\//i.test(text)) return "presentation";
  if (/\/document\/d\//i.test(text)) return "document";
  if (/\/spreadsheets\/d\//i.test(text)) return "spreadsheet";
  return "";
}

export async function exportGoogleDocPdf(fileId, { tabId = "", sourceUrl = "", fileKind = "" } = {}) {
  const id = extractGoogleFileId(fileId);
  if (!id) {
    throw new Error("GOOGLE_FILE_ID_REQUIRED");
  }

  const token = await getGoogleAccessToken();
  const kind = fileKind || googleWorkspaceKindFromUrl(sourceUrl);

  const exportUrl = kind === "presentation"
    ? new URL(`https://docs.google.com/presentation/d/${encodeURIComponent(id)}/export/pdf`)
    : (tabId || kind === "document")
    ? new URL(`https://docs.google.com/document/d/${encodeURIComponent(id)}/export`)
    : new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export`);

  if (kind === "presentation") {
    exportUrl.searchParams.set("id", id);
  } else if (tabId || kind === "document") {
    exportUrl.searchParams.set("format", "pdf");
    if (tabId) exportUrl.searchParams.set("tab", tabId);
  } else {
    exportUrl.searchParams.set("mimeType", GOOGLE_DOC_PDF_MIME);
  }

  const response = await fetch(exportUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: GOOGLE_DOC_PDF_MIME
    }
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GOOGLE_DOC_EXPORT_FAILED:${response.status}:${detail.slice(0, 240)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
