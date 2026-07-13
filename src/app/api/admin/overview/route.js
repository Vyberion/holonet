import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import {
  isMissingSchemaError, getAuthContext, canAccessAdmin, loadCounts, loadPendingRetirements, loadRecentActivity, loadAdminHealth
} from "../../../../lib/api-helpers.js";




const handler = async (req, res) => {
    try {
      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const permission = canAccessAdmin(auth.profile);
      if (!permission.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
      }

      const [counts, health, pendingRetirements, activity] = await Promise.all([
        loadCounts(),
        loadAdminHealth(),
        loadPendingRetirements(),
        loadRecentActivity()
      ]);

      return res.status(200).json({
        ok: true,
        counts,
        health,
        pendingRetirements,
        activity
      });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({
          ok: true,
          migrationRequired: true,
          counts: {
            codexArticles: 0,
            archiveArticles: 0,
            activeOverrides: 0,
            activeBotLinks: 0,
            activeShifts: 0,
            publishedResources: 0,
            pendingRetirements: []
          },
          health: { ok: false, checks: [] },
          pendingRetirements: [],
          activity: { items: [], page: 1, pageSize: 20, totalApprox: 0, hasNext: false, filters: ["all"] }
        });
      }

      return res.status(500).json({ ok: false, error: error.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
