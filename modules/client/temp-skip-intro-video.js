(function () {
  // TEMP_SKIP_INTRO_VIDEO
  // Remove this file and its LegacyClientModules import when the intro video is ready again.
  const TEMP_SKIP_INTRO_VIDEO = true;
  const INTRO_COMPLETE_KEY = "holonet:intro:v1:complete";
  const LOADER_SHOWN_KEY = "loaderShown";

  if (!TEMP_SKIP_INTRO_VIDEO) return;

  class TemporaryMuxPlayerStub extends HTMLElement {
    play() {
      this.paused = false;
      window.setTimeout(() => {
        this.dispatchEvent(new Event("ended"));
      }, 0);
      return Promise.resolve();
    }

    pause() {
      this.paused = true;
    }
  }

  try {
    if (window.customElements && !window.customElements.get("mux-player")) {
      window.customElements.define("mux-player", TemporaryMuxPlayerStub);
    }
  } catch {
    return null;
  }

  function wait(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  function waitForWindowLoad() {
    if (document.readyState === "complete") return Promise.resolve();
    return new Promise(resolve => window.addEventListener("load", resolve, { once: true }));
  }

  function waitForAccessClear() {
    return new Promise(resolve => {
      function checkAccess() {
        if (document.documentElement.classList.contains("access-pending")) {
          window.setTimeout(checkAccess, 50);
          return;
        }

        resolve();
      }

      checkAccess();
    });
  }

  function beginPageCrtOpen() {
    document.documentElement.classList.add("holonet-crt-armed");
    document.documentElement.classList.remove("holonet-crt-opening");
    void document.documentElement.offsetWidth;
    document.documentElement.classList.add("holonet-crt-opening");
  }

  function finishLoader(loader) {
    loader.classList.add("hidden");
    loader.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      if (loader.classList.contains("hidden")) {
        loader.style.display = "none";
      }

      document.documentElement.classList.remove("holonet-crt-armed");
      document.documentElement.classList.remove("holonet-crt-opening");
    }, 520);
  }

  async function runDirectCrt(loader, button) {
    if (!loader || loader.dataset.tempSkipIntroRunning === "true") return;
    loader.dataset.tempSkipIntroRunning = "true";

    if (button) button.disabled = true;

    await waitForWindowLoad();
    await waitForAccessClear();

    loader.dataset.loaderPhase = "intro-blackout";
    loader.classList.remove("hidden");
    loader.style.display = "";
    loader.removeAttribute("aria-hidden");
    document.documentElement.classList.add("holonet-crt-armed");

    await wait(140);

    beginPageCrtOpen();
    loader.dataset.loaderPhase = "intro-reveal";

    await wait(1850);

    try {
      localStorage.setItem(INTRO_COMPLETE_KEY, "true");
      sessionStorage.setItem(LOADER_SHOWN_KEY, "true");
    } catch {}

    finishLoader(loader);
  }

  document.addEventListener(
    "click",
    event => {
      const button = event.target.closest?.("[data-loader-establish]");
      if (!button) return;

      const loader = button.closest("#loader") || document.getElementById("loader");
      if (!loader) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      runDirectCrt(loader, button);
    },
    true
  );
})();
