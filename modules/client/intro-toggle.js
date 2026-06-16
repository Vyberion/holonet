import { HOLONET_ALTERNATIVE_INTRO_ENABLED } from "../config/intro.js";

(function () {
  window.HOLONET_ALTERNATIVE_INTRO_ENABLED = HOLONET_ALTERNATIVE_INTRO_ENABLED;

  if (HOLONET_ALTERNATIVE_INTRO_ENABLED) return;

  try {
    localStorage.setItem("holonet:intro:v1:complete", "true");
  } catch {}

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
