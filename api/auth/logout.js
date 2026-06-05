import { clearCookie, deleteSessionToken, getCookie, SESSION_COOKIE } from "../../modules/auth/session-store.js";

export default async function handler(req, res) {
  try {
    const token = getCookie(req, SESSION_COOKIE);
    await deleteSessionToken(token);

    res.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE));
    return res.status(200).json({ ok: true });
  } catch (err) {
    res.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE));
    return res.status(500).json({ ok: false, error: err.message });
  }
}
