import {
  clearCookie,
  createSessionForUser,
  deleteSessionToken,
  getCookie,
  serializeCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  STATE_COOKIE
} from "../../modules/auth/session-store.js";

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/account.html?status=error&msg=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect("/account.html?status=error&msg=Invalid+callback+payload");
  }

  const expectedState = getCookie(req, STATE_COOKIE);

  if (!expectedState || state !== expectedState) {
    res.setHeader("Set-Cookie", clearCookie(STATE_COOKIE));
    return res.redirect("/account.html?status=error&msg=OAuth+state+verification+failed");
  }

  try {
    const tokenResponse = await fetch("https://apis.roblox.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.ROBLOX_CLIENT_ID,
        client_secret: process.env.ROBLOX_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.ROBLOX_REDIRECT_URI
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || "Failed token transaction exchange");
    }

    const userResponse = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const userData = await userResponse.json();
    if (!userResponse.ok) {
      throw new Error("Could not fetch Roblox identity profile data.");
    }

    const robloxId = String(userData.sub);
    const robloxUsername = userData.preferred_username;
    const robloxDisplayName = userData.name;

    await deleteSessionToken(getCookie(req, SESSION_COOKIE));

    const { token, expiresAt } = await createSessionForUser({
      robloxId,
      robloxUsername,
      robloxDisplayName
    });

    res.setHeader("Set-Cookie", [
      clearCookie(STATE_COOKIE),
      serializeCookie(SESSION_COOKIE, token, {
        maxAge: SESSION_MAX_AGE_SECONDS,
        expires: expiresAt
      })
    ]);

    return res.redirect("/account.html?status=success");
  } catch (err) {
    res.setHeader("Set-Cookie", clearCookie(STATE_COOKIE));
    return res.redirect(`/account.html?status=error&msg=${encodeURIComponent(err.message)}`);
  }
}
