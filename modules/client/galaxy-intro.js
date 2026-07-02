(function () {
  const path = window.location.pathname;
  if (path !== "/galaxy" && path !== "/galaxy/") return;

  const MUSIC_ID = "galaxy-intro-music";
  const MUSIC_SRC = "/assets/music/galaxy/suspense.mp3";
  const MUSIC_VOLUME = 0.224;

  window.HOLONET_FORCE_RELEASE_INTRO = true;
  window.HOLONET_ALTERNATIVE_INTRO_ENABLED = true;

  let galaxyReady = false;
  let resolveGalaxyReady;
  const galaxyReadyPromise = new Promise(resolve => {
    resolveGalaxyReady = resolve;
  });

  function markGalaxyReady() {
    if (galaxyReady) return;
    galaxyReady = true;
    resolveGalaxyReady?.();
  }

  function proxyLoadUntilGalaxyReady() {
    const nativeAddEventListener = window.addEventListener.bind(window);

    window.addEventListener = function patchedAddEventListener(type, listener, options) {
      if (type === "load" && !galaxyReady) {
        galaxyReadyPromise.then(() => {
          const event = new Event("load");
          if (typeof listener === "function") {
            listener.call(window, event);
            return;
          }
          listener?.handleEvent?.(event);
        });
        return undefined;
      }

      return nativeAddEventListener(type, listener, options);
    };
  }

  function watchGalaxyReadiness() {
    window.addEventListener("holonet:galaxy-loader-progress", event => {
      if (event?.detail?.ready) markGalaxyReady();
    });
    window.addEventListener("holonet:galaxy-loader-ready", markGalaxyReady);

    if (window.__holonetGalaxyLoaderDetail?.ready) markGalaxyReady();
  }

  function requestIntroRun() {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("intro") !== "1") {
        url.searchParams.set("intro", "1");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {}
  }

  function setText(selector, text) {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
  }

  function setIntroCopy() {
    setText(".loader-gate-kicker", "SITH CARTOGRAPHIC COMMAND");
    setText(".loader-gate-title", "GALACTIC CONTROL NET");
    setText("[data-loader-establish] span", "Open Star Map");
    setText(".loader-gate-meta span:first-child", "SECTORAL ARRAY READY");
    setText(".loader-gate-meta span:last-child", "ASTROGRAPHIC FEED: LIVE");

    const loadingLines = document.querySelectorAll(".loader-intro-loading .loader-terminal-line");
    ["Charting hyperspace lanes", "Synchronising sector telemetry", "Priming galactic projection"].forEach((text, index) => {
      if (loadingLines[index]) loadingLines[index].textContent = text;
    });

    setText(".loader-intro-ready .loader-terminal-line", "Array aligned");
    setText(".loader-intro-ready .loader-terminal-status", "Opening Galaxy");
  }

  function ensureMusic() {
    let audio = document.getElementById(MUSIC_ID);
    if (audio) return audio;

    audio = document.createElement("audio");
    audio.id = MUSIC_ID;
    audio.src = MUSIC_SRC;
    audio.preload = "auto";
    audio.loop = true;
    document.body.appendChild(audio);
    return audio;
  }

  function fadeMusicIn(audio) {
    const startedAt = performance.now();
    const duration = 1200;

    function frame(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      audio.volume = MUSIC_VOLUME * progress;
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function startMusicAfterLoaderGone(loader, audio) {
    function tryStart() {
      if (loader.style.display !== "none") return;

      try {
        audio.volume = 0;
        const playAttempt = audio.paused ? audio.play() : Promise.resolve();
        Promise.resolve(playAttempt).then(() => fadeMusicIn(audio)).catch(() => {});
      } catch {}
    }

    const observer = new MutationObserver(tryStart);
    observer.observe(loader, { attributes: true, attributeFilter: ["class", "style", "aria-hidden"] });
    window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
    tryStart();
  }

  function armMusic(loader) {
    const button = document.querySelector("[data-loader-establish]");
    const audio = ensureMusic();
    if (!button || !audio) return;

    audio.volume = 0;
    startMusicAfterLoaderGone(loader, audio);

    button.addEventListener("click", () => {
      try {
        audio.volume = 0;
        audio.load();
        const playAttempt = audio.play();
        if (playAttempt?.catch) playAttempt.catch(() => {});
      } catch {}
    }, { once: true });
  }

  function stripVideoIntro(loader) {
    const videoSlot = loader.querySelector("[data-loader-intro-video]");
    if (!videoSlot) return;

    videoSlot.removeAttribute("data-loader-intro-video");
    videoSlot.setAttribute("aria-hidden", "true");
    videoSlot.innerHTML = '<button class="loader-intro-skip" type="button" data-loader-skip-intro style="display:none">Bypass Transmission</button>';
  }

  function armVideoBypass(loader) {
    function bypassVideoPhase() {
      if (loader.dataset.loaderPhase !== "intro-video") return;
      const skipButton = loader.querySelector("[data-loader-skip-intro]");
      if (!skipButton || skipButton.disabled) return;
      skipButton.click();
    }

    const observer = new MutationObserver(bypassVideoPhase);
    observer.observe(loader, { attributes: true, attributeFilter: ["data-loader-phase"] });
    window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
    bypassVideoPhase();
  }

  function bootGalaxyIntro() {
    const loader = document.getElementById("loader");
    if (!loader) return;

    requestIntroRun();
    document.documentElement.classList.add("holonet-release-intro");
    document.documentElement.classList.remove("holonet-standard-loader");

    setIntroCopy();
    stripVideoIntro(loader);
    armVideoBypass(loader);
    armMusic(loader);
  }

  proxyLoadUntilGalaxyReady();
  watchGalaxyReadiness();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootGalaxyIntro, { once: true });
  } else {
    bootGalaxyIntro();
  }
})();
