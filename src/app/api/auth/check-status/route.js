import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import {
  cleanupExpiredSessions, getSessionUser
} from "../../../../lib/api-helpers.js";




const handler = async (req, res) => {
    try {
      await cleanupExpiredSessions();
      const session = await getSessionUser(req);

      if (!session.authenticated) {
        return res.status(200).json({ bound: false, reason: session.reason });
      }

      return res.status(200).json({
        bound: true,
        robloxId: session.user.roblox_id,
        robloxUsername: session.user.roblox_username
      });
    } catch (err) {
      return res.status(500).json({ bound: false, error: err.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
