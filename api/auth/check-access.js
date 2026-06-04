// Group Configuration
const IMPERIAL_REGISTRY = {
  // ─── MAIN ORDER GROUP ───
  MAIN_ORDER: {
    groupId: 3241567, 
    ranks: {
      emperor:   [255],
      powerbase: [250, 251, 252],
      council:   [240, 241, 242, 243] // Every Overseer also holds these
    }
  },

  // ─── HIGH RANKS GROUP ───
  HIGH_RANKS: {
    groupId: 4444444,
    ranks: {
      overseer: [254, 255],
      upper:    [100, 101, 102, 110],
      lower:    [10, 11, 12, 15, 20]
    }
  },

  // ─── WARLORDS GROUP ───
  WARLORDS: {
    groupId: 9999999,
    ranks: {
      warmaster: [250, 254], 
      warlord:   [10, 11, 12, 15, 50, 100] // Base Warlords
    }
  },

  // ─── DIVISIONS  ───
  DIVISIONS: {
    reavers: {
      groupId: 5555555,
      ranks: {
        overseer: [254, 255],
        "1ic":    [250],
        "2ic":    [200],
        co:       [100, 101, 102],
        nco:      [50, 51, 52, 60],
        member:   [10, 11, 12, 13, 14, 20]
      }
    },
    dhg: {
      groupId: 6666666,
      ranks: {
        overseer: [254, 255],
        "1ic":    [250],
        "2ic":    [200],
        co:       [100, 105],
        nco:      [50, 60],
        member:   [10, 15, 20]
      }
    },
    inquisitors: {
      groupId: 7777777,
      ranks: {
        overseer: [254, 255],
        "1ic":    [250],
        "2ic":    [200],
        co:       [100],
        nco:      [50],
        member:   [10]
      }
    },
    dreadmasters: {
      groupId: 8888888,
      ranks: {
        overseer: [254, 255],
        "1ic":    [250],
        "2ic":    [200],
        co:       [100],
        nco:      [50],
        member:   [10]
      }
    }
  }
};

const SUPER_USER_ID = "2627035499"; // Absolute Clearance Bypass Override

export default async function handler(req, res) {
  const { deviceId, page } = req.query;

  if (!deviceId) {
    return res.status(400).json({ authorized: false, error: "Missing identity context" });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. Resolve bound account
    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/device_bindings?device_id=eq.${encodeURIComponent(deviceId)}&select=roblox_id`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });

    if (!dbResponse.ok) throw new Error("Database verification matrix timed out");
    const dbData = await dbResponse.json();

    if (!dbData || dbData.length === 0) {
      return res.status(200).json({ authorized: false, reason: "DEVICE_UNBOUND" });
    }

    const robloxId = String(dbData[0].roblox_id);

    // 2. Fetch all current Group Profiles via Roblox Web API
    const rblxResponse = await fetch(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`);
    if (!rblxResponse.ok) throw new Error("Roblox Core Engine communication error");
    const rblxData = await rblxResponse.json();

    // Create a fast-lookup map of group memberships
    const userGroupsMap = {};
    rblxData.data.forEach(g => {
      userGroupsMap[g.group.id] = g.role.rank;
    });

    // 3. Compile individual security footprints
    const profile = {
      isSuperUser: robloxId === SUPER_USER_ID,
      
      // Core Ranks (Main Group)
      isEmperor:   (userGroupsMap[ROBLOX_GROUPS.MAIN_ORDER] === 255),
      isPowerbase: (userGroupsMap[ROBLOX_GROUPS.MAIN_ORDER] >= 250),
      isCouncil:   (userGroupsMap[ROBLOX_GROUPS.MAIN_ORDER] >= 240), // Generic Overseer rank value inside Main Group

      // High Ranks Group
      highRank: "none", // none, lower, upper, overseer

      // Warlords Group
      warlordRank: "none", // none, member, leader/overseer

      // Divisions Matrix
      divisions: {
        reavers: "none", // none, member, nco, co, 2ic, 1ic, overseer
        dhg: "none",
        inquisitors: "none",
        dreadmasters: "none"
      }
    };

    // Parse High Ranks Group
    const hrRank = userGroupsMap[ROBLOX_GROUPS.HIGH_RANKS] || 0;
    if (hrRank >= 254) profile.highRank = "overseer";
    else if (hrRank >= 100) profile.highRank = "upper";
    else if (hrRank >= 10)  profile.highRank = "lower";

    // Parse Warlords Group
    const wlRank = userGroupsMap[ROBLOX_GROUPS.WARLORDS] || 0;
    if (wlRank >= 250) profile.warlordRank = "warmaster"; // 1ic and overseer
    else if (wlRank >= 10)  profile.warlordRank = "warlord";   // base warlord member

    // Helper utility to convert a separate division group rank scale into named categories
    const getDivisionTier = (rank) => {
      if (!rank || rank < 10) return "none";
      if (rank >= 254) return "overseer";
      if (rank >= 250) return "1ic";
      if (rank >= 200) return "2ic";
      if (rank >= 100) return "co";
      if (rank >= 50)  return "nco";
      return "member";
    };

    profile.divisions.reavers      = getDivisionTier(userGroupsMap[ROBLOX_GROUPS.REAVERS]);
    profile.divisions.dhg          = getDivisionTier(userGroupsMap[ROBLOX_GROUPS.DHG]);
    profile.divisions.inquisitors  = getDivisionTier(userGroupsMap[ROBLOX_GROUPS.INQUISITORS]);
    profile.divisions.dreadmasters = getDivisionTier(userGroupsMap[ROBLOX_GROUPS.DREAD_MASTERS]);

    // 4. Global Security Check (If accessing a guarded sub-page via guard.js)
    if (page) {
      let authorized = false;
      const targetPage = page.toLowerCase();

      // Core overrides
      if (profile.isSuperUser || profile.isEmperor || profile.isPowerbase || profile.isCouncil) {
        authorized = true;
      }

      // Check explicit page pathways
      if (targetPage.includes("index_reaver") && profile.divisions.reavers !== "none") authorized = true;
      if (targetPage.includes("index_dhg") && profile.divisions.dhg !== "none") authorized = true;
      if (targetPage.includes("index_inquisitor") && profile.divisions.inquisitors !== "none") authorized = true;
      if (targetPage.includes("index_dreadmaster") && profile.divisions.dreadmasters !== "none") authorized = true;
      if (targetPage.includes("index_warlord") && profile.warlordRank !== "none") authorized = true;
      if (targetPage.includes("index_highrank") && profile.highRank !== "none") authorized = true;
      if (targetPage === "index") authorized = true; // Main index viewable by all

      return res.status(200).json({ authorized, profile });
    }

    // Default configuration return
    return res.status(200).json({ authorized: true, profile });

  } catch (err) {
    return res.status(500).json({ authorized: false, error: err.message });
  }
}