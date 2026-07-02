import { HOLONET_ALTERNATIVE_INTRO_ENABLED } from "../config/intro.js";

(function () {
  const INTRO_COMPLETE_COOKIE = "holonet_intro_v1_complete";
  const INTRO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
  const forceReleaseIntro = Boolean(window.HOLONET_FORCE_RELEASE_INTRO);
  const releaseIntroEnabled = HOLONET_ALTERNATIVE_INTRO_ENABLED || forceReleaseIntro;

  function writeCookie(name, value, maxAge = INTRO_COOKIE_MAX_AGE_SECONDS) {
    try {
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
    } catch {
      return null;
    }
  }

  window.HOLONET_ALTERNATIVE_INTRO_ENABLED = releaseIntroEnabled;

  if (releaseIntroEnabled) return;

  try {
    localStorage.setItem("holonet:intro:v1:complete", "true");
  } catch {}
  writeCookie(INTRO_COMPLETE_COOKIE, "true");

  try {
    sessionStorage.setItem("loaderShown", "true");
  } catch {}

  document.documentElement.classList.remove("holonet-release-intro");
  document.documentElement.classList.add("holonet-standard-loader");

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("intro") === "1") {
      url.searchParams.delete("intro");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  } catch {}
})();
