import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  getQueryParam, requireString, personnelLookupWarnings, ROBLOX_GROUPS, resolveUserByUsername, loadRobloxProfileSummary
} from "../../../lib/api-helpers.js";




const handler = async (req, res) => {
    try {
      const username = requireString(req.method === "POST" ? req.body?.username : getQueryParam(req, "username"));
      if (!username) {
        return res.status(400).json({ ok: false, reason: "USERNAME_REQUIRED" });
      }

      const resolved = await resolveUserByUsername(username);
      if (!resolved?.id) {
        return res.status(200).json({ ok: false, reason: "USER_NOT_FOUND" });
      }

      const { user, groups, accountAgeDays, friendsCount, badgeCount } = await loadRobloxProfileSummary(resolved.id);
      const mainGroupMembership = (groups.data || []).find(
        membership => membership?.group?.id === ROBLOX_GROUPS.HIGH_RANKS.groupId
      );
      const divisionMemberships = Object.entries(ROBLOX_GROUPS.DIVISIONS)
        .map(([divisionKey, definition]) => {
          const membership = (groups.data || []).find(item => item?.group?.id === definition.groupId);
          if (!membership) return null;
          return {
            divisionKey,
            label: divisionKey === "dhg" ? "Dark Honor Guard" : divisionKey === "inquisitors" ? "Inquisitors" : divisionKey.charAt(0).toUpperCase() + divisionKey.slice(1),
            rankName: membership.role?.name || "Unknown",
            rank: membership.role?.rank || 0,
            joinedAt: membership.joinedAt || membership.joined_at || null
          };
        })
        .filter(Boolean);
      const warnings = personnelLookupWarnings({ accountAgeDays, friendsCount, badgeCount });

      return res.status(200).json({
        ok: true,
        authorized: true,
        user: {
          robloxId: String(resolved.id),
          username: resolved.name || username,
          displayName: resolved.displayName || user.displayName || resolved.name || username,
          created: user.created || null,
          accountAgeDays,
          friendsCount,
          badgeCount,
          profileUrl: `https://www.roblox.com/users/${resolved.id}/profile`,
          mainGroup: mainGroupMembership ? {
            inGroup: true,
            rankName: mainGroupMembership.role?.name || "Unknown",
            rank: mainGroupMembership.role?.rank || 0,
            joinedAt: mainGroupMembership.joinedAt || mainGroupMembership.joined_at || null
          } : {
            inGroup: false,
            rankName: "",
            rank: 0,
            joinedAt: null
          },
          divisionMemberships,
          warnings
        }
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
