import { cleanupExpiredSessions, getSessionUser } from "../../modules/auth/session-store.js";

export default async function handler(req, res) {
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
}
