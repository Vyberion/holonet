import { buildProfile } from "../../modules/auth/profile.js";
import { checkPageAccess } from "../../modules/auth/permissions.js";

export default async function handler(req, res) {
  const { deviceId, page } = req.query;

  if (!deviceId) {
    return res.status(400).json({ authorized: false, error: "Missing identity context" });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Authorization service is not configured");
    }

    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/device_bindings?device_id=eq.${encodeURIComponent(deviceId)}&select=roblox_id`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });

    if (!dbResponse.ok) throw new Error("Database verification matrix timed out");
    const dbData = await dbResponse.json();

    if (!dbData || dbData.length === 0) {
      return res.status(200).json({ authorized: false, reason: "DEVICE_UNBOUND" });
    }

    const robloxId = String(dbData[0].roblox_id);
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
