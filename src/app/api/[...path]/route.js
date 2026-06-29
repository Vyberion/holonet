import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import { LEGACY_API_HANDLERS } from "../../../lib/legacy-api-handlers.js";
import { getAuthContext } from "../../../../modules/auth/auth-context.js";
import { checkPageAccess } from "../../../../modules/auth/permissions.js";

function legacyAuthRequest(request) {
  return {
    headers: {
      cookie: request.headers.get("cookie") || ""
    }
  };
}

function redactInquisitorDivision(division) {
  return {
    ...division,
    status: "classified",
    classified: true,
    canWriteReport: false,
    latestReport: null,
    latestInspection: null,
    inspections: [],
    latestDocument: null,
    latestTransmission: null,
    counts: {
      reports: null,
      inspections: null,
      trackers: null,
      documents: null,
      transmissions: null
    },
    links: {
      reports: "",
      trackers: "",
      transmissions: ""
    }
  };
}

async function restrictNexusInquisitorReports(response, request) {
  if (request.method !== "GET" || response.status !== 200) return response;

  const payload = await response.clone().json().catch(() => null);
  if (!payload?.ok || !Array.isArray(payload.divisions)) return response;

  const auth = await getAuthContext(legacyAuthRequest(request), { optional: true }).catch(() => null);
  const access = auth?.authenticated
    ? checkPageAccess(auth.profile, "inquisitors_reports")
    : { authorized: false };

  if (access.authorized) return response;

  const safePayload = {
    ...payload,
    divisions: payload.divisions.map(division => (
      division?.id === "inquisitors" ? redactInquisitorDivision(division) : division
    ))
  };

  return new Response(JSON.stringify(safePayload), {
    status: response.status,
    headers: response.headers
  });
}

async function dispatch(request, context) {
  const params = await Promise.resolve(context.params);
  const rawPath = params?.path;
  const path = Array.isArray(rawPath)
    ? rawPath.join("/")
    : String(rawPath || "");
  const handler = LEGACY_API_HANDLERS[path];

  if (!handler) {
    return new Response(JSON.stringify({ ok: false, reason: "NOT_FOUND" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  const response = await executeLegacyHandler(handler, request);
  return path === "nexus"
    ? restrictNexusInquisitorReports(response, request)
    : response;
}

export function GET(request, context) {
  return dispatch(request, context);
}

export function POST(request, context) {
  return dispatch(request, context);
}

export function PATCH(request, context) {
  return dispatch(request, context);
}

export function DELETE(request, context) {
  return dispatch(request, context);
}

export function PUT(request, context) {
  return dispatch(request, context);
}
