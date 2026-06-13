import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import { LEGACY_API_HANDLERS } from "../../../lib/legacy-api-handlers.js";

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

  return executeLegacyHandler(handler, request);
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
