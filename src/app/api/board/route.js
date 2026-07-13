import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  requireString, authAuthorName, isMissingSchemaError, canWriteBoardBroadcast, boardChannelsFor, getAuthContext, loadBoardTransmissions, writeResource
} from "../../../lib/api-helpers.js";




const handler = async (req, res) => {
    try {
      const auth = await getAuthContext(req, { optional: true });

      if (req.method === "GET") {
        const canWrite = auth.authenticated ? canWriteBoardBroadcast(auth.profile) : false;
        return res.status(200).json({
          ok: true,
          canWrite,
          channels: canWrite ? boardChannelsFor(auth.profile) : [],
          transmissions: await loadBoardTransmissions()
        });
      }

      if (req.method === "POST") {
        if (!auth.authenticated) {
          return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
        }

        if (!canWriteBoardBroadcast(auth.profile)) {
          return res.status(200).json({ ok: false, authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" });
        }

        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const channel = requireString(body.channel || "holonet");
        const allowedChannels = boardChannelsFor(auth.profile);
        if (!allowedChannels.includes(channel)) {
          return res.status(200).json({ ok: false, authorized: false, reason: "CHANNEL_NOT_AUTHORIZED" });
        }

        const result = await writeResource({
          division: channel,
          resourceType: "transmission",
          detailTable: "resource_transmissions",
          body: {
            ...body,
            status: "published",
            visibility: "public"
          },
          authorName: authAuthorName(auth)
        });

        return res.status(result.status).json({ ...result.payload, transmissions: await loadBoardTransmissions() });
      }

      if (req.method !== "GET") {
        return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
      }
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: true, migrationRequired: true, transmissions: [] });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
