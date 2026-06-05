import { buildProfile } from "../../modules/auth/profile.js";
import { checkPageAccess } from "../../modules/auth/permissions.js";
import { cleanupExpiredSessions, getSessionUser } from "../../modules/auth/session-store.js";

export default async function handler(req, res) {
  const { page } = req.query;

  try {
    await cleanupExpiredSessions();

    const session = await getSessionUser(req);

    if (!session.authenticated) {
      return res.status(200).json({
        authorized: false,
        reason: session.reason || "SESSION_REQUIRED"
      });
    }

    const robloxId = String(session.user.roblox_id);
    const rblxResponse = await fetch(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`);

    if (!rblxResponse.ok) throw new Error("Roblox Core Engine communication error");
    const rblxData = await rblxResponse.json();

    const profile = buildProfile({
      robloxId,
      groupRoles: rblxData.data
    });

    if (page) {
      const access = checkPageAccess(profile, page);
      return res.status(200).json({ ...access, profile });
    }

    return res.status(200).json({ authorized: true, profile });
  } catch (err) {
    return res.status(500).json({ authorized: false, error: err.message });
  }
}
