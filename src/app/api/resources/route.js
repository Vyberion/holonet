import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  getQueryParam, authAuthorName, detailTableFor, getAuthContext, checkPageAccess, checkResourceWriteAccess, getHandbookSlot, getHandbookSlots, cleanupRetiredHandbooks, loadPublishedResources, loadDetailRows, normalizeRows, writeResource, deleteResource
} from "../../../lib/api-helpers.js";




const handler = async (req, res) => {
    try {
      const division = getQueryParam(req, "division");
      const requestedType = getQueryParam(req, "type");
      const resourceType = {
        handbooks: "handbook",
        documents: "handbook",
        transmissions: "transmission",
        activity: "tracker",
        trackers: "tracker",
        reports: "report"
      }[requestedType];
      const detailTable = detailTableFor(resourceType);

      if (!division || !resourceType || !detailTable) {
        return res.status(400).json({ ok: false, reason: "UNKNOWN_RESOURCE_TYPE" });
      }

      await cleanupRetiredHandbooks();

      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason });
      }

      const pageKey = `${division}_${{
        handbooks: "handbooks",
        documents: "handbooks",
        transmissions: "transmissions",
        activity: "activity",
        trackers: "activity",
        reports: "reports"
      }[requestedType]}`;
      const access = checkPageAccess(auth.profile, pageKey);
      if (!access.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: access.reason || "ACCESS_DENIED" });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        if (resourceType === "handbook") {
          return res.status(405).json({ ok: false, reason: "HANDBOOK_UPLOADS_DISABLED" });
        }

        const writeAccess = checkResourceWriteAccess(auth.profile, { division, resourceType });
        if (!writeAccess.authorized) {
          return res.status(200).json({ ok: false, authorized: false, reason: writeAccess.reason });
        }

        const result = await writeResource({
          division,
          resourceType,
          detailTable,
          body: resourceType === "transmission"
            ? { ...(typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})), status: "published", visibility: "restricted" }
            : req.body || {},
          authorName: authAuthorName(auth)
        });

        return res.status(result.status).json(result.payload);
      }

      if (req.method === "DELETE") {
        if (resourceType === "handbook") {
          return res.status(405).json({ ok: false, reason: "HANDBOOK_UPLOADS_DISABLED" });
        }

        const writeAccess = checkResourceWriteAccess(auth.profile, { division, resourceType });
        if (!writeAccess.authorized) {
          return res.status(200).json({ ok: false, authorized: false, reason: writeAccess.reason });
        }

        const result = await deleteResource({
          division,
          resourceType,
          detailTable,
          id: getQueryParam(req, "id")
        });

        return res.status(result.status).json(result.payload);
      }

      if (req.method !== "GET") {
        return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
      }

      const resources = await loadPublishedResources(division, resourceType);
      const rows = resources?.length
        ? await normalizeRows(resources, await loadDetailRows(detailTable, resources.map(resource => resource.id)), resourceType)
        : [];

      if (resourceType === "handbook") {
        const slotCatalog = getHandbookSlots(division);
        const sortedRows = rows.slice().sort((left, right) => {
          const leftSlot = getHandbookSlot(division, left.slotKey || "");
          const rightSlot = getHandbookSlot(division, right.slotKey || "");
          return (leftSlot?.order || left.displayOrder || 0) - (rightSlot?.order || right.displayOrder || 0);
        });

        return res.status(200).json({
          ok: true,
          authorized: true,
          canWrite: false,
          canUpload: false,
          slotCatalog,
          resources: sortedRows
        });
      }

      return res.status(200).json({
        ok: true,
        authorized: true,
        canWrite: checkResourceWriteAccess(auth.profile, { division, resourceType }).authorized,
        resources: rows
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
