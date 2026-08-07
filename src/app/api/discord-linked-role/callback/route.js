import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import { decodeOAuthStateCookie, statesMatch } from "../../../../lib/api-helpers.js";
import { clearCookie, getCookie, STATE_COOKIE, supabaseRest } from "../../../../../modules/auth/session-store.js";
import { getDiscordOAuthTokens, getDiscordUser, getRankMetadataForProfile, pushRoleConnectionData } from "../../../../../bot/services/discord-linked-roles.js";
import { getAuthContext, loadGroupRoles } from "../../../../../modules/auth/auth-context.js";
import { buildProfile } from "../../../../../modules/auth/profile.js";
import { compileProfilePermissions, nicknameRuleForProfile } from "../../../../../modules/auth/role-permissions.js";
import { hasPermission } from "../../../../../modules/auth/permissions.js";
import { loadRobloxUser } from "../../../../../bot/services/roblox.js";

const handler = async (req, res) => {
  const { code, state, error } = req.query || {};

  if (error) {
    return res.redirect(`/account.html?status=error&msg=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect("/account.html?status=error&msg=Invalid+callback+payload");
  }

  const expected = decodeOAuthStateCookie(getCookie(req, STATE_COOKIE));
  if (!statesMatch(state, expected.state)) {
    res.setHeader("Set-Cookie", clearCookie(STATE_COOKIE));
    return res.redirect("/account.html?status=error&msg=OAuth+state+verification+failed");
  }

  try {
    const host = req?.headers?.host || "www.thesithorder.org";
    const protocol = req?.headers?.["x-forwarded-proto"] || "https";
    const redirectUri = expected.redirectUri || `${protocol}://${host}/api/discord-linked-role/callback`;

    // 1. Exchange code for Discord access token
    const tokens = await getDiscordOAuthTokens(code, redirectUri);
    const discordUser = await getDiscordUser(tokens.access_token);

    // 2. Fetch logged in Holonet user auth context or look up verified link by discordUserId
    const auth = await getAuthContext(req, { optional: true });
    let profile = (auth?.authenticated && auth?.profile?.robloxId && auth?.profile?.robloxId !== "0") ? auth.profile : null;
    let robloxUsername = auth?.user?.roblox_username || "";

    if (!profile && discordUser.id) {
      const rows = await supabaseRest(
        `verification_links?discord_user_id=eq.${encodeURIComponent(discordUser.id)}&select=roblox_user_id,roblox_username`
      ).catch(() => []);
      
      const link = Array.isArray(rows) ? rows[0] : null;

      if (link?.roblox_user_id) {
        const robloxId = String(link.roblox_user_id);
        robloxUsername = link.roblox_username || "";
        const groupRoles = await loadGroupRoles(robloxId).catch(() => []);
        profile = buildProfile({ robloxId, groupRoles });
      }
    }

    if (profile?.robloxId && profile.robloxId !== "0" && !robloxUsername) {
      const robloxUser = await loadRobloxUser(profile.robloxId).catch(() => null);
      if (robloxUser?.name) robloxUsername = robloxUser.name;
    }

    // 3. Compile permissions using existing permissions system
    const perms = profile ? compileProfilePermissions(profile) : [];
    const isOperator = hasPermission({ permissions: perms }, "holonet:operator");

    // 4. Platform username is the user's Roblox username
    const platformUsername = robloxUsername || profile?.name || discordUser.username || "Sith Order Member";
    const rankMetadata = getRankMetadataForProfile(profile);

    // 5. Push role connection metadata to Discord API
    await pushRoleConnectionData(tokens.access_token, platformUsername, {
      holonet_operator: isOperator ? 1 : 0,
      ...rankMetadata
    });

    res.setHeader("Set-Cookie", clearCookie(STATE_COOKIE));
    return res.redirect("/account.html?status=success&msg=Linked+role+connection+updated");
  } catch (err) {
    console.error("Discord Linked Role callback failed:", err);
    res.setHeader("Set-Cookie", clearCookie(STATE_COOKIE));
    return res.redirect(`/account.html?status=error&msg=${encodeURIComponent(err.message)}`);
  }
};

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
