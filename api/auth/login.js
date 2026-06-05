import { createRandomToken, serializeCookie, STATE_COOKIE } from "../../modules/auth/session-store.js";

export default async function handler(req, res) {
  const clientID = process.env.ROBLOX_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.ROBLOX_REDIRECT_URI);
  const state = createRandomToken();
  
  // Scopes required to check your user's basic profile identity
  const scope = encodeURIComponent('openid profile');

  const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientID}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=${encodeURIComponent(state)}`;

  res.setHeader("Set-Cookie", serializeCookie(STATE_COOKIE, state, { maxAge: 60 * 10 }));
  return res.redirect(robloxAuthUrl);
}
