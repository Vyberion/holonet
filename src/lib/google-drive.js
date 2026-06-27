import { GoogleAuth } from "google-auth-library";

const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const DOCUMENTS_READONLY_SCOPE = "https://www.googleapis.com/auth/documents.readonly";
const SPREADSHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
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
      scopes: [DRIVE_READONLY_SCOPE, DOCUMENTS_READONLY_SCOPE, SPREADSHEETS_READONLY_SCOPE]
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

async function fetchGoogleJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GOOGLE_API_FAILED:${response.status}:${detail.slice(0, 240)}`);
  }

  return response.json();
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
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    return url.searchParams.get("tab") || url.searchParams.get("gid") || hashParams.get("gid") || hashParams.get("tab") || "";
  } catch {
    return text.match(/[?&#](?:tab|gid)=([^&#]+)/)?.[1] || "";
  }
}

function extractGoogleSheetRange(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const url = new URL(text);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    return url.searchParams.get("range") || hashParams.get("range") || "";
  } catch {
    return text.match(/[?&#]range=([^&#]+)/)?.[1] || "";
  }
}

export function googleWorkspaceKindFromUrl(value) {
  const text = String(value || "");
  if (/\/presentation\/d\//i.test(text)) return "presentation";
  if (/\/document\/d\//i.test(text)) return "document";
  if (/\/spreadsheets\/d\//i.test(text)) return "spreadsheet";
  return "";
}

function sheetIdFrom(value) {
  const text = String(value || "").trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

function quoteSheetName(value) {
  return `'${String(value || "Sheet1").replace(/'/g, "''")}'`;
}

function columnLabel(index) {
  let value = Math.max(0, Number(index) || 0) + 1;
  let label = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }

  return label;
}

function isNonWhiteColor(color) {
  if (!color || typeof color !== "object") return false;

  const red = color.red ?? 1;
  const green = color.green ?? 1;
  const blue = color.blue ?? 1;
  const alpha = color.alpha ?? 1;

  if (alpha <= 0.05) return false;
  return red < 0.96 || green < 0.96 || blue < 0.96;
}

function cellBackgroundColor(cell = {}) {
  return cell.effectiveFormat?.backgroundColorStyle?.rgbColor
    || cell.effectiveFormat?.backgroundColor
    || cell.userEnteredFormat?.backgroundColorStyle?.rgbColor
    || cell.userEnteredFormat?.backgroundColor
    || null;
}

function cellHasContent(cell = {}) {
  if (String(cell.formattedValue || "").trim()) return true;
  return Boolean(cell.effectiveValue && Object.keys(cell.effectiveValue).length);
}

function cellIsVisibleContent(cell = {}) {
  return cellHasContent(cell) || isNonWhiteColor(cellBackgroundColor(cell));
}

function visibleBoundsForSheet(sheet = {}) {
  const bounds = {
    minRow: Infinity,
    minCol: Infinity,
    maxRow: -1,
    maxCol: -1
  };

  for (const grid of sheet.data || []) {
    const rowOffset = Number(grid.startRow) || 0;
    const colOffset = Number(grid.startColumn) || 0;

    (grid.rowData || []).forEach((row, rowIndex) => {
      (row.values || []).forEach((cell, colIndex) => {
        if (!cellIsVisibleContent(cell)) return;

        const absoluteRow = rowOffset + rowIndex;
        const absoluteCol = colOffset + colIndex;
        bounds.minRow = Math.min(bounds.minRow, absoluteRow);
        bounds.minCol = Math.min(bounds.minCol, absoluteCol);
        bounds.maxRow = Math.max(bounds.maxRow, absoluteRow);
        bounds.maxCol = Math.max(bounds.maxCol, absoluteCol);
      });
    });
  }

  if (!Number.isFinite(bounds.minRow) || bounds.maxRow < 0 || bounds.maxCol < 0) {
    return null;
  }

  return bounds;
}

async function resolveSpreadsheetCropRange(fileId, { tabId = "", sourceUrl = "", token = "" } = {}) {
  const explicitRange = extractGoogleSheetRange(sourceUrl);
  if (explicitRange) return decodeURIComponent(explicitRange);

  try {
    const targetSheetId = sheetIdFrom(tabId || extractGoogleTabId(sourceUrl));
    const metadataUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}`);
    metadataUrl.searchParams.set("fields", "sheets(properties(sheetId,title,index))");

    const metadata = await fetchGoogleJson(metadataUrl, token);
    const metadataSheets = metadata.sheets || [];
    const targetSheet = metadataSheets.find(sheet => sheet.properties?.sheetId === targetSheetId) || metadataSheets[0];
    const sheetTitle = targetSheet?.properties?.title;
    if (!sheetTitle) return "";

    const dataUrl = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}`);
    dataUrl.searchParams.set("includeGridData", "true");
    dataUrl.searchParams.set("ranges", quoteSheetName(sheetTitle));
    dataUrl.searchParams.set("fields", "sheets(properties(sheetId,title),data(startRow,startColumn,rowData(values(formattedValue,effectiveValue,effectiveFormat(backgroundColor,backgroundColorStyle),userEnteredFormat(backgroundColor,backgroundColorStyle))))))");

    const grid = await fetchGoogleJson(dataUrl, token);
    const sheet = (grid.sheets || []).find(item => item.properties?.sheetId === targetSheet?.properties?.sheetId) || grid.sheets?.[0];
    const bounds = visibleBoundsForSheet(sheet);
    if (!bounds) return "";

    return `${quoteSheetName(sheetTitle)}!${columnLabel(bounds.minCol)}${bounds.minRow + 1}:${columnLabel(bounds.maxCol)}${bounds.maxRow + 1}`;
  } catch (error) {
    console.warn("Spreadsheet crop range detection failed:", error);
    return "";
  }
}

export function googlePdfExportUrl(fileId, { tabId = "", sourceUrl = "", fileKind = "", spreadsheetRange = "" } = {}) {
  const id = extractGoogleFileId(fileId);
  if (!id) {
    throw new Error("GOOGLE_FILE_ID_REQUIRED");
  }

  const kind = fileKind || googleWorkspaceKindFromUrl(sourceUrl);
  const isSpreadsheet = kind === "spreadsheet";
  const isPresentation = kind === "presentation";
  const isDocument = kind === "document";
  const exportUrl = kind === "presentation"
    ? new URL(`https://docs.google.com/presentation/d/${encodeURIComponent(id)}/export/pdf`)
    : kind === "spreadsheet"
    ? new URL(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export`)
    : (tabId || kind === "document")
    ? new URL(`https://docs.google.com/document/d/${encodeURIComponent(id)}/export`)
    : new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export`);

  if (isPresentation) {
    exportUrl.searchParams.set("id", id);
  } else if (isSpreadsheet) {
    exportUrl.searchParams.set("format", "pdf");
    exportUrl.searchParams.set("single", "true");
    exportUrl.searchParams.set("size", "7");
    exportUrl.searchParams.set("portrait", "false");
    exportUrl.searchParams.set("fitw", "true");
    exportUrl.searchParams.set("sheetnames", "false");
    exportUrl.searchParams.set("printtitle", "false");
    exportUrl.searchParams.set("pagenumbers", "false");
    exportUrl.searchParams.set("gridlines", "false");
    exportUrl.searchParams.set("fzr", "false");
    exportUrl.searchParams.set("top_margin", "0");
    exportUrl.searchParams.set("bottom_margin", "0");
    exportUrl.searchParams.set("left_margin", "0");
    exportUrl.searchParams.set("right_margin", "0");
    if (tabId) exportUrl.searchParams.set("gid", tabId);
    if (spreadsheetRange) exportUrl.searchParams.set("range", spreadsheetRange);
  } else if (tabId || isDocument) {
    exportUrl.searchParams.set("format", "pdf");
    if (tabId) exportUrl.searchParams.set("tab", tabId);
  } else {
    exportUrl.searchParams.set("mimeType", GOOGLE_DOC_PDF_MIME);
  }

  return exportUrl;
}

export async function exportGoogleDocPdf(fileId, { tabId = "", sourceUrl = "", fileKind = "" } = {}) {
  const id = extractGoogleFileId(fileId);
  if (!id) {
    throw new Error("GOOGLE_FILE_ID_REQUIRED");
  }

  const kind = fileKind || googleWorkspaceKindFromUrl(sourceUrl);
  const token = await getGoogleAccessToken();
  const spreadsheetRange = kind === "spreadsheet"
    ? await resolveSpreadsheetCropRange(id, { tabId, sourceUrl, token })
    : "";
  const exportUrl = googlePdfExportUrl(id, { tabId, sourceUrl, fileKind: kind, spreadsheetRange });

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
