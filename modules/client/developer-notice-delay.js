(function () {
  const READY_CLASS = "holonet-developer-notice-ready";
  const INTRO_COMPLETE_KEY = "holonet:intro:v1:complete";
  const INTRO_COMPLETE_COOKIE = "holonet_intro_v1_complete";
  const WAIT_LIMIT_MS = 180000;

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function readIntroComplete() {
    let storageComplete = false;
    try {
      storageComplete = localStorage.getItem(INTRO_COMPLETE_KEY) === "true";
    } catch {
      storageComplete = false;
    }

    try {
      return storageComplete || document.cookie.split(";").some(part => part.trim() === `${INTRO_COMPLETE_COOKIE}=true`);
    } catch {
      return storageComplete || true;
    }
  }

  function loaderFinished() {
    const loader = document.getElementById("loader");
    if (!loader) return true;
    return loader.style.display === "none";
  }

  function crtFinished() {
    const root = document.documentElement;
    return !root.classList.contains("holonet-crt-armed") && !root.classList.contains("holonet-crt-opening");
  }

  function introFinished() {
    const root = document.documentElement;
    return !root.classList.contains("holonet-release-intro") || readIntroComplete();
  }

  async function releaseNotice() {
    const started = Date.now();

    while (Date.now() - started < WAIT_LIMIT_MS) {
      if (introFinished() && loaderFinished() && crtFinished()) break;
      await wait(80);
    }

    await wait(120);
    document.documentElement.classList.add(READY_CLASS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", releaseNotice, { once: true });
  } else {
    releaseNotice();
  }
})();
