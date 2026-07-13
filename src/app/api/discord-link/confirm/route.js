import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import {
  confirmDiscordLink
} from "../../../../lib/api-helpers.js";


const handler = async (req, res) => {
    try {
      const result = await confirmDiscordLink(req);
      return res.status(result.status).json(result.payload);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
