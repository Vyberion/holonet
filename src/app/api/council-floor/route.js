import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  getAuthContext, requireString, isMissingSchemaError, councilPermissions,
  fetchCouncilEligibleSnapshot, loadCouncilProposals, createCouncilProposal,
  writeCouncilVote, vetoCouncilProposal, reopenCouncilProposal, amendCouncilProposal
} from "../../../lib/api-helpers.js";

const handler = async (req, res) => {
    try {
      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const permissions = councilPermissions(auth.profile);
      if (!permissions.canView) {
        return res.status(200).json({ ok: false, authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" });
      }

      if (req.method === "GET") {
        let roleSnapshot = null;
        try {
          roleSnapshot = await fetchCouncilEligibleSnapshot();
        } catch {
          roleSnapshot = { snapshot: [], countingEligibleCount: 0, majorityCount: 0 };
        }

        return res.status(200).json({
          ok: true,
          authorized: true,
          permissions,
          roleSnapshot,
          proposals: await loadCouncilProposals()
        });
      }

      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const action = requireString(body.action || (req.method === "POST" ? "create" : "")).toLowerCase();

      if (req.method === "POST" && action === "create") {
        const result = await createCouncilProposal(auth, body);
        return res.status(result.status).json(result.payload);
      }

      if ((req.method === "POST" || req.method === "PATCH") && action === "vote") {
        const result = await writeCouncilVote(auth, body);
        return res.status(result.status).json(result.payload);
      }

      if ((req.method === "POST" || req.method === "PATCH") && action === "veto") {
        const result = await vetoCouncilProposal(auth, body);
        return res.status(result.status).json(result.payload);
      }

      if ((req.method === "POST" || req.method === "PATCH") && action === "reopen") {
        const result = await reopenCouncilProposal(auth, body);
        return res.status(result.status).json(result.payload);
      }

      if ((req.method === "POST" || req.method === "PATCH") && action === "amend") {
        const result = await amendCouncilProposal(auth, body);
        return res.status(result.status).json(result.payload);
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        if (req.method !== "GET") {
          return res.status(200).json({ ok: false, reason: "MIGRATION_REQUIRED" });
        }

        return res.status(200).json({
          ok: true,
          migrationRequired: true,
          authorized: true,
          permissions: {},
          roleSnapshot: { snapshot: [], countingEligibleCount: 0, majorityCount: 0 },
          proposals: []
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
