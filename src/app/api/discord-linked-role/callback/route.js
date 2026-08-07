import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import { decodeOAuthStateCookie, statesMatch } from "../../../../lib/api-helpers.js";
import { clearCookie, getCookie, STATE_COOKIE } from "../../../../../modules/auth/session-store.js";
import { getDiscordOAuthTokens, getDiscordUser, pushRoleConnectionData } from "../../../../../bot/services/discord-linked-roles.js";
import { getAuthContext } from "../../../../../modules/auth/auth-context.js";
import { compileProfilePermissions, nicknameRuleForProfile } from "../../../../../modules/auth/role-permissions.js";

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
    let auth = await getAuthContext(req);
    let profile = auth?.profile;
    let robloxUsername = "";

    if (!profile && discordUser.id) {
      const { data: link } = await supabase
        .from("verification_links")
        .select("roblox_user_id, roblox_username")
        .eq("discord_user_id", discordUser.id)
        .maybeSingle();

      if (link?.roblox_user_id) {
        profile = await loadFullProfile(link.roblox_user_id);
        robloxUsername = link.roblox_username || "";
      }
    }

    if (profile?.robloxId && !robloxUsername) {
      const robloxUser = await loadRobloxUser(profile.robloxId).catch(() => null);
      if (robloxUser?.name) robloxUsername = robloxUser.name;
    }

    // 3. Compile permissions using existing permissions system
    const perms = profile ? compileProfilePermissions(profile) : [];
    const isOperator = hasPermission({ permissions: perms }, "holonet:operator");

    // 4. Format platform username using rank nickname config
    const baseUsername = robloxUsername || profile?.name || discordUser.username || "Holonet User";
    let platformUsername = baseUsername;

    if (profile) {
      const rule = nicknameRuleForProfile(profile);
      if (rule?.value) {
        platformUsername = rule.mode === "prefix" ? `${rule.value} ${baseUsername}` : rule.value;
      }
    }

    // 5. Push role connection metadata to Discord API
    await pushRoleConnectionData(tokens.access_token, platformUsername, {
      holonet_operator: isOperator ? 1 : 0
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
