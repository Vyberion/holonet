import { executeLegacyHandler } from "../../../../lib/legacy-api-adapter.js";
import {
  OAUTH_STATE_MAX_AGE_SECONDS, oauthRedirectUri, encodeOAuthStateCookie, createRandomToken, serializeCookie, STATE_COOKIE
} from "../../../../lib/api-helpers.js";




const handler = async (req, res) => {
    const clientID = process.env.ROBLOX_CLIENT_ID;
    const redirectUri = oauthRedirectUri(req);
    const state = createRandomToken();
    const scope = encodeURIComponent("openid profile");
    const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${encodeURIComponent(state)}`;

    console.info("Roblox OAuth login", {
      host: req?.headers?.host || "",
      redirectUri
    });

    res.setHeader("Set-Cookie", serializeCookie(STATE_COOKIE, encodeOAuthStateCookie({ state, redirectUri }), {
      maxAge: OAUTH_STATE_MAX_AGE_SECONDS
    }));
    return res.redirect(robloxAuthUrl);
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
