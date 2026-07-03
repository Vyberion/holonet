import { getAuthContext } from "../../../../modules/auth/auth-context.js";
import {
  canAccessAdmin,
  canAccessNexus,
  canAccessPersonnelLookup,
  canAccessRegistry,
  checkPageAccess
} from "../../../../modules/auth/permissions.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}

function publicProfile(profile) {
  return {
    robloxId: profile.robloxId,
    isSuperUser: Boolean(profile.isSuperUser),
    isMachine: Boolean(profile.isMachine),
    machineName: profile.machineName || "",
    hasFullAccess: Boolean(profile.hasFullAccess),
    highRank: profile.highRank,
    divisions: profile.divisions,
    authorityRoles: profile.authorityRoles
  };
}

export async function GET(request) {
  const auth = await getAuthContext(request, { optional: true });
  if (!auth.machine || !auth.profile?.isSuperUser) {
    return json({ ok: false, authorized: false, reason: "DARTH_MANAR_TOKEN_REQUIRED" }, 401);
  }

  const url = new URL(request.url);
  const page = String(url.searchParams.get("page") || "").trim();
  const pageAccess = page ? checkPageAccess(auth.profile, page) : null;

  return json({
    ok: true,
    authorized: true,
    identity: "darth-manar",
    profile: publicProfile(auth.profile),
    pageAccess,
    permissions: {
      canAccessAdmin: canAccessAdmin(auth.profile).authorized,
      canAccessNexus: canAccessNexus(auth.profile).authorized,
      canAccessRegistry: canAccessRegistry(auth.profile).authorized,
      canAccessPersonnelLookup: canAccessPersonnelLookup(auth.profile).authorized
    }
  });
}
