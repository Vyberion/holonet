import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import {
  getQueryParam, getAuthContext, canAccessAdmin, canAccessNexus, canAccessPersonnelLookup, canAccessRegistry, checkPageAccess
} from "../../../../lib/api-helpers.js";




const handler = async (req, res) => {
    const page = getQueryParam(req, "page");
    let pageIsUnknown = false;

    try {
      if (page) {
        const unknownCheck = checkPageAccess({
          isSuperUser: false,
          hasFullAccess: false,
          divisions: {},
          highRank: "none"
        }, page);

        pageIsUnknown = unknownCheck.reason === "UNKNOWN_RESOURCE";

        if (unknownCheck.authorized) {
          return res.status(200).json(unknownCheck);
        }
      }

      const auth = await getAuthContext(req, { optional: true });
      if (!auth.authenticated) {
        if (pageIsUnknown) {
          return res.status(200).json({
            authorized: false,
            reason: "UNKNOWN_RESOURCE"
          });
        }

        return res.status(200).json({
          authorized: false,
          reason: auth.reason || "SESSION_REQUIRED"
        });
      }
      const profile = auth.profile;

      if (page) {
        const access = checkPageAccess(profile, page);
        return res.status(200).json({
          ...access,
          profile,
          permissions: {
            canAccessAdmin: canAccessAdmin(profile).authorized,
            canAccessPersonnelLookup: canAccessPersonnelLookup(profile).authorized,
            canAccessNexus: canAccessNexus(profile).authorized,
            canAccessRegistry: canAccessRegistry(profile).authorized
          }
        });
      }

      return res.status(200).json({
        authorized: true,
        profile,
        permissions: {
          canAccessAdmin: canAccessAdmin(profile).authorized,
          canAccessPersonnelLookup: canAccessPersonnelLookup(profile).authorized,
          canAccessNexus: canAccessNexus(profile).authorized,
          canAccessRegistry: canAccessRegistry(profile).authorized
        }
      });
    } catch (err) {
      return res.status(500).json({ authorized: false, error: err.message });
    }
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
