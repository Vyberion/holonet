(function () {
  const MUSIC_ID = "galaxy-intro-music";
  const MUSIC_SRC = "/assets/music/galaxy/suspense.mp3";
  const MUSIC_VOLUME = 0.56;

  window.HOLONET_FORCE_RELEASE_INTRO = true;
  window.HOLONET_ALTERNATIVE_INTRO_ENABLED = true;

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
    audio.volume = MUSIC_VOLUME;
    document.body.appendChild(audio);
    return audio;
  }

  function armMusic() {
    const button = document.querySelector("[data-loader-establish]");
    const audio = ensureMusic();
    if (!button || !audio) return;

    button.addEventListener("click", () => {
      try {
        audio.volume = MUSIC_VOLUME;
        audio.currentTime = 0;
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

    if (window.MutationObserver) {
      const observer = new MutationObserver(bypassVideoPhase);
      observer.observe(loader, { attributes: true, attributeFilter: ["data-loader-phase"] });
      window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
    }

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
    armMusic();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootGalaxyIntro, { once: true });
  } else {
    bootGalaxyIntro();
  }
})();
