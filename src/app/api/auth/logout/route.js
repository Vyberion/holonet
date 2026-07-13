import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import {
  clearCookie, deleteSessionToken, getCookie, SESSION_COOKIE
} from "../../../../lib/api-helpers.js";




const handler = async (req, res) => {
    try {
      const token = getCookie(req, SESSION_COOKIE);
      await deleteSessionToken(token);
      res.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE));
      return res.status(200).json({ ok: true });
    } catch (err) {
      res.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE));
      return res.status(500).json({ ok: false, error: err.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
