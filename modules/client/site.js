(function () {
  const INTRO_COMPLETE_KEY = "holonet:intro:v1:complete";
  const INTRO_COMPLETE_COOKIE = "holonet_intro_v1_complete";
  const INTRO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
  const LOADER_SHOWN_KEY = "loaderShown";
  const MUX_PLAYER_SCRIPT = "https://cdn.jsdelivr.net/npm/@mux/mux-player";
  const OLD_GUARD_PLAYBACK_ID = "5B00WSZwcoH023XoGAE94RSxu5Pu3GFn9TCqIuNM1x73E";
  const OLD_GUARD_TITLE = "THE OLD GUARD";
  const canonCache = new Map();
  const canonFetches = new Map();
  let editorOverlayBlurInitialized = false;

  function canonStorageKey(key) {
    return `holonet:canon:${key}`;
  }

  function accessStorageKey() {
    return "holonet:access:global";
  }

  function readAccessFromStorage() {
    try {
      const raw = sessionStorage.getItem(accessStorageKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function canonAccessSignature() {
    const access = readAccessFromStorage();
    const profile = access?.profile;

    if (!access?.authorized || !profile?.robloxId) {
      return "anonymous";
    }

    const accessKind = profile.isSuperUser ? "superuser" : profile.hasFullAccess ? "full-access" : "standard";
    return `${profile.robloxId}:${accessKind}`;
  }

  function canonFetchKey(key, signature = canonAccessSignature()) {
    return `${key}:${signature}`;
  }

  function canonEndpoint(key) {
    if (key === "archives") return "/api/archives";
    return `/api/library?library=${encodeURIComponent(key)}`;
  }

  function canonRecordFor(payload, signature = canonAccessSignature()) {
    return {
      accessSignature: signature,
      payload
    };
  }

  function payloadFromCanonRecord(record) {
    if (!record?.payload || !record?.accessSignature) return null;
    return record.accessSignature === canonAccessSignature() ? record.payload : null;
  }

  function readCanonFromStorage(key) {
    try {
      const raw = sessionStorage.getItem(canonStorageKey(key));
      return raw ? payloadFromCanonRecord(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  function writeCanonToStorage(key, record) {
    try {
      sessionStorage.setItem(canonStorageKey(key), JSON.stringify(record));
    } catch {
      return null;
    }
  }

  function rememberCanon(key, payload, signature = canonAccessSignature()) {
    const record = canonRecordFor(payload, signature);
    canonCache.set(key, record);
    writeCanonToStorage(key, record);
    return payload;
  }

  function getCanonPayload(key) {
    return payloadFromCanonRecord(canonCache.get(key)) || readCanonFromStorage(key) || null;
  }

  function clearCanonPayload(key) {
    canonCache.delete(key);
    Array.from(canonFetches.keys())
      .filter(fetchKey => fetchKey.startsWith(`${key}:`))
      .forEach(fetchKey => canonFetches.delete(fetchKey));
    try {
      sessionStorage.removeItem(canonStorageKey(key));
    } catch {
      return null;
    }
  }

  function clearAllCanonPayloads() {
    canonCache.clear();
    canonFetches.clear();
    try {
      Object.keys(sessionStorage)
        .filter(key => key.startsWith("holonet:canon:"))
        .forEach(key => sessionStorage.removeItem(key));
    } catch {
      return null;
    }
  }

  function clearAccessPayload() {
    try {
      sessionStorage.removeItem(accessStorageKey());
      clearAllCanonPayloads();
    } catch {
      return null;
    }
  }

  function warmCanonPayload(key, options = {}) {
    if (options.force) {
      clearCanonPayload(key);
    }

    const signature = canonAccessSignature();
    const fetchKey = canonFetchKey(key, signature);
    if (canonFetches.has(fetchKey)) return canonFetches.get(fetchKey);

    const cached = getCanonPayload(key);
    if (cached) {
      const resolved = Promise.resolve(cached);
      canonFetches.set(fetchKey, resolved);
      return resolved;
    }

    const request = fetch(canonEndpoint(key), { cache: "no-store" })
      .then(response => response.json())
      .then(payload => {
        if (!payload || payload.ok === false) {
          throw new Error(payload?.reason || payload?.error || "CANON_PREFETCH_FAILED");
        }
        return rememberCanon(key, payload, signature);
      })
      .catch(error => {
        canonFetches.delete(fetchKey);
        throw error;
      });

    canonFetches.set(fetchKey, request);
    return request;
  }

  function writeAccessToStorage(payload) {
    try {
      sessionStorage.setItem(accessStorageKey(), JSON.stringify(payload));
    } catch {
      return null;
    }
  }

  function getAccessPayload() {
    return readAccessFromStorage();
  }

  function warmAccessPayload() {
    const cached = getAccessPayload();
    if (cached) return Promise.resolve(cached);

    return fetch("/api/auth/check-access")
      .then(response => response.json())
      .then(payload => {
        if (payload) writeAccessToStorage(payload);
        return payload;
      })
      .catch(error => {
        console.warn("Access preview unavailable:", error);
        return null;
      });
  }
  warmCanonPayload("codex").catch(() => {});
  warmCanonPayload("archives").catch(() => {});
  warmAccessPayload().catch(() => {});

  function renderPrivilegedLinks(container, payload) {
    if (!container) return;

    const links = [`
        <a href="/lookup" class="nav-link account-link" data-page="lookup">
          <div class="account-text"><span class="nav-link-label">Lookup</span></div>
          <div class="account-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
          <div class="nav-link-corners" aria-hidden="true"></div>
        </a>
      `];

    if (payload?.authorized && payload.permissions?.canAccessAdmin) {
      links.push(`
        <a href="/admin" class="nav-link account-link" data-page="admin">
          <div class="account-text"><span class="nav-link-label">Admin</span></div>
          <div class="account-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"></path>
              <path d="M9 12l2 2 4-4"></path>
            </svg>
          </div>
          <div class="nav-link-corners" aria-hidden="true"></div>
        </a>
      `);
    }

    container.innerHTML = links.join("");
    container.dataset.ready = "true";
  }

  async function enrichNav(container) {
    const privileged = container.querySelector("[data-nav-privileged]");
    if (!privileged) return;

    try {
      const cached = getAccessPayload();
      if (cached?.authorized) {
        renderPrivilegedLinks(privileged, cached);
      }

      if (privileged.dataset.ready === "true") return;

      const payload = await warmAccessPayload();
      if (payload?.authorized) {
        renderPrivilegedLinks(privileged, payload);
      }
    } catch (error) {
      console.warn("Privileged nav unavailable:", error);
    }
  }

  async function loadNav() {
    return null;
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function waitForWindowLoad() {
    if (document.readyState === "complete") return Promise.resolve();
    return new Promise(resolve => window.addEventListener("load", resolve, { once: true }));
  }

  function waitForAccessClear() {
    return new Promise(resolve => {
      function checkAccess() {
        if (document.documentElement.classList.contains("access-pending")) {
          setTimeout(checkAccess, 50);
          return;
        }

        resolve();
      }

      checkAccess();
    });
  }

  function setLoaderPhase(loader, phase) {
    window.__holonetLoaderHidden = false;
    loader.dataset.loaderPhase = phase;
    loader.classList.remove("hidden");
    loader.style.display = "";
    loader.removeAttribute("aria-hidden");
  }

  function setLoaderProgress(loader, value) {
    const progress = Math.max(0, Math.min(100, Number(value) || 0));
    loader.style.setProperty("--loader-progress", `${progress}%`);
  }

  function startLoaderProgress(loader, { start = 8, cap = 92 } = {}) {
    setLoaderProgress(loader, start);

    const interval = window.setInterval(() => {
      const current = Number.parseFloat(loader.style.getPropertyValue("--loader-progress")) || 0;
      if (current >= cap) return;

      const next = current + Math.max(0.8, (cap - current) * 0.08);
      setLoaderProgress(loader, Math.min(cap, next));
    }, 180);

    return () => window.clearInterval(interval);
  }

  function beginPageCrtOpen() {
    document.documentElement.classList.add("holonet-crt-armed");
    document.documentElement.classList.remove("holonet-crt-opening");
    void document.documentElement.offsetWidth;
    document.documentElement.classList.add("holonet-crt-opening");
  }

  function clearPageCrtOpen() {
    document.documentElement.classList.remove("holonet-crt-armed");
    document.documentElement.classList.remove("holonet-crt-opening");
  }

  function hideLoader(loader) {
    setLoaderProgress(loader, 100);
    window.setTimeout(() => {
      loader.classList.add("hidden");
      loader.setAttribute("aria-hidden", "true");
      window.setTimeout(() => {
        if (loader.classList.contains("hidden")) {
          loader.style.display = "none";
        }
        clearPageCrtOpen();
        window.__holonetLoaderHidden = true;
        window.dispatchEvent(new CustomEvent("holonet:loader-hidden"));
      }, 520);
    }, 140);
  }

  function readLocalStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeLocalStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      return null;
    }
  }

  function readCookie(name) {
    try {
      const prefix = `${name}=`;
      return document.cookie
        .split(";")
        .map(part => part.trim())
        .find(part => part.startsWith(prefix))
        ?.slice(prefix.length) || null;
    } catch {
      return null;
    }
  }

  function writeCookie(name, value, maxAge = INTRO_COOKIE_MAX_AGE_SECONDS) {
    try {
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
    } catch {
      return null;
    }
  }

  function readIntroComplete() {
    const storageComplete = readLocalStorage(INTRO_COMPLETE_KEY) === "true";
    const cookieComplete = readCookie(INTRO_COMPLETE_COOKIE) === "true";

    if (cookieComplete && !storageComplete) {
      writeLocalStorage(INTRO_COMPLETE_KEY, "true");
    }

    if (storageComplete && !cookieComplete) {
      writeCookie(INTRO_COMPLETE_COOKIE, "true");
    }

    return storageComplete || cookieComplete;
  }

  function markIntroComplete() {
    writeLocalStorage(INTRO_COMPLETE_KEY, "true");
    writeCookie(INTRO_COMPLETE_COOKIE, "true");
  }

  function shouldForceIntro() {
    try {
      return new URLSearchParams(window.location.search).get("intro") === "1";
    } catch {
      return false;
    }
  }

  function getReleaseIntroConfig() {
    const config = window.HOLONET_RELEASE_INTRO_CONFIG;
    if (config && typeof config === "object") return config;

    const loader = document.getElementById("loader");
    if (!loader) return {};

    const dataset = loader.dataset;
    return {
      enabled: dataset.releaseIntroEnabled === "true",
      force: dataset.releaseIntroForce === "true",
      waitForGalaxyReady: dataset.releaseIntroWaitForGalaxyReady === "true",
      video: {
        enabled: dataset.releaseIntroVideoEnabled !== "false",
        player: dataset.releaseIntroVideoPlayer || null,
        autoBypass: dataset.releaseIntroVideoAutoBypass === "true"
      },
      music: dataset.releaseIntroMusicId ? {
        id: dataset.releaseIntroMusicId,
        src: dataset.releaseIntroMusicSrc || "",
        preload: dataset.releaseIntroMusicPreload || "auto",
        loop: dataset.releaseIntroMusicLoop === "true",
        volume: dataset.releaseIntroMusicVolume,
        startAfterLoaderHidden: dataset.releaseIntroMusicStartAfterLoaderHidden === "true",
        fadeInMs: dataset.releaseIntroMusicFadeInMs
      } : null
    };
  }

  function shouldForceReleaseIntro() {
    return window.HOLONET_FORCE_RELEASE_INTRO === true || getReleaseIntroConfig().force === true;
  }

  function shouldRunReleaseIntro() {
    const releaseIntroConfig = getReleaseIntroConfig();
    if (shouldForceReleaseIntro() || shouldForceIntro()) return true;
    if (releaseIntroConfig.enabled === false) return false;
    return !readIntroComplete();
  }

  function clearIntroForceParam() {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("intro") !== "1") return;
      url.searchParams.delete("intro");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      return null;
    }
  }

  function shouldUseIntroVideo() {
    return getReleaseIntroConfig().video?.enabled !== false;
  }

  function shouldAutoBypassIntroVideo() {
    const video = getReleaseIntroConfig().video;
    return video?.enabled === false || video?.autoBypass === true;
  }

  function ensureIntroMusic() {
    const music = getReleaseIntroConfig().music;
    if (!music?.id) return null;

    let audio = document.getElementById(music.id);
    if (!audio && music.src) {
      audio = document.createElement("audio");
      audio.id = music.id;
      audio.src = music.src;
      audio.preload = music.preload || "auto";
      audio.loop = Boolean(music.loop);
      document.body.appendChild(audio);
    }

    if (!audio) return null;

    if (Number.isFinite(Number(music.volume))) {
      audio.volume = Math.max(0, Math.min(1, Number(music.volume)));
    }

    return audio;
  }

  function fadeIntroMusicIn(audio, targetVolume, duration) {
    const startedAt = performance.now();
    const fadeDuration = Math.max(0, Number(duration) || 0);

    if (!fadeDuration) {
      audio.volume = targetVolume;
      return;
    }

    function frame(now) {
      const progress = Math.min(1, (now - startedAt) / fadeDuration);
      audio.volume = targetVolume * progress;
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  function startIntroMusicAfterLoaderHidden(loader, audio, music) {
    let started = false;
    const targetVolume = Number.isFinite(Number(music.volume))
      ? Math.max(0, Math.min(1, Number(music.volume)))
      : audio.volume;

    function tryStart() {
      if (started || loader.style.display !== "none") return;
      started = true;

      try {
        audio.volume = 0;
        const playAttempt = audio.paused ? audio.play() : Promise.resolve();
        Promise.resolve(playAttempt)
          .then(() => fadeIntroMusicIn(audio, targetVolume, music.fadeInMs))
          .catch(() => {});
      } catch {}
    }

    const observer = new MutationObserver(tryStart);
    observer.observe(loader, { attributes: true, attributeFilter: ["class", "style", "aria-hidden"] });
    window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
    tryStart();
  }

  function armIntroMusic(loader) {
    const music = getReleaseIntroConfig().music;
    const audio = ensureIntroMusic();
    const establishButton = loader.querySelector("[data-loader-establish]");
    if (!audio || !establishButton) return;

    if (music?.startAfterLoaderHidden) {
      audio.volume = 0;
      startIntroMusicAfterLoaderHidden(loader, audio, music);
    }

    establishButton.addEventListener("click", () => {
      try {
        if (music?.startAfterLoaderHidden) {
          audio.volume = 0;
          audio.load();
        }
        audio.currentTime = 0;
        const playAttempt = audio.play();
        if (playAttempt?.catch) playAttempt.catch(() => {});
      } catch {}
    }, { once: true });
  }

  function waitForGalaxyLoaderReadiness({ onProgress } = {}) {
    if (window.__holonetGalaxyLoaderDetail) {
      onProgress?.(window.__holonetGalaxyLoaderDetail);
      if (window.__holonetGalaxyLoaderDetail.ready) return Promise.resolve(window.__holonetGalaxyLoaderDetail);
    }

    return new Promise(resolve => {
      let resolved = false;

      function cleanup() {
        window.removeEventListener("holonet:galaxy-loader-progress", handleProgress);
        window.removeEventListener("holonet:galaxy-loader-ready", finish);
      }

      function finish(event) {
        if (resolved) return;
        resolved = true;
        const detail = event?.detail || window.__holonetGalaxyLoaderDetail || { ready: true, progress: 100 };
        onProgress?.(detail);
        cleanup();
        resolve(detail);
      }

      function handleProgress(event) {
        onProgress?.(event?.detail);
        if (event?.detail?.ready) finish();
      }

      window.addEventListener("holonet:galaxy-loader-progress", handleProgress);
      window.addEventListener("holonet:galaxy-loader-ready", finish);
    });
  }

  function waitForReleaseIntroReadiness() {
    if (!getReleaseIntroConfig().waitForGalaxyReady) return Promise.resolve();
    return waitForGalaxyLoaderReadiness();
  }

  function waitForReleaseIntroLoadGate() {
    return getReleaseIntroConfig().waitForGalaxyReady
      ? waitForReleaseIntroReadiness()
      : waitForWindowLoad();
  }

  function ensureMuxPlayerReady() {
    if (window.customElements?.get("mux-player")) {
      return Promise.resolve();
    }

    const existingScript = document.querySelector(`script[src="${MUX_PLAYER_SCRIPT}"]`);
    const scriptPromise = existingScript
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = MUX_PLAYER_SCRIPT;
          script.async = true;
          script.addEventListener("load", resolve, { once: true });
          script.addEventListener("error", reject, { once: true });
          document.head.appendChild(script);
        });

    return scriptPromise.then(() => window.customElements?.whenDefined?.("mux-player"));
  }

  function buildIntroPlayer(videoSlot) {
    const skipButton = videoSlot.querySelector("[data-loader-skip-intro]");
    const player = document.createElement("mux-player");
    player.className = "old-guard-mux old-guard-mux--intro";
    player.setAttribute("playback-id", OLD_GUARD_PLAYBACK_ID);
    player.setAttribute("metadata-video-title", OLD_GUARD_TITLE);
    player.setAttribute("video-title", OLD_GUARD_TITLE);
    player.setAttribute("accent-color", "#4d0000");
    player.setAttribute("primary-color", "#ff0000");
    player.setAttribute("secondary-color", "#050102");
    player.setAttribute("stream-type", "on-demand");
    player.setAttribute("preload", "auto");
    player.setAttribute("playsinline", "");
    player.setAttribute("data-loader-created-player", "true");

    const shell = document.createElement("div");
    shell.className = "old-guard-player old-guard-player--intro";
    shell.setAttribute("data-old-guard-intro-player", "");
    shell.appendChild(player);

    videoSlot.innerHTML = "";
    videoSlot.appendChild(shell);
    if (skipButton) videoSlot.appendChild(skipButton);
    return player;
  }

  async function getIntroPlayer(loader) {
    if (!shouldUseIntroVideo()) return null;

    await ensureMuxPlayerReady();

    const videoSlot = loader.querySelector("[data-loader-intro-video]");
    if (!videoSlot) return null;

    const existing = videoSlot.querySelector("mux-player");
    return existing || buildIntroPlayer(videoSlot);
  }

  function resetIntroPlayer(player) {
    if (!player) return;

    try {
      player.pause?.();
      player.currentTime = 0;
      player.muted = false;
      player.volume = 1;
    } catch {
      return null;
    }
  }

  async function playIntroPlayer(player) {
    if (!player?.play) return false;

    try {
      player.muted = false;
      player.volume = 1;
      player.currentTime = 0;
      await player.play();
      return true;
    } catch (error) {
      console.warn("Old Guard intro playback was blocked:", error);
      return false;
    }
  }

  function waitForIntroEnded(player, skipPromise) {
    if (!player) return Promise.resolve(false);

    return new Promise(resolve => {
      let finished = false;
      let timeoutId = null;

      function cleanup() {
        player.removeEventListener("ended", finish);
        player.removeEventListener("error", finish);
        if (timeoutId) window.clearTimeout(timeoutId);
      }

      function finish() {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(false);
      }

      function finishSkipped() {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(true);
      }

      if (player.ended) {
        finish();
        return;
      }

      player.addEventListener("ended", finish);
      player.addEventListener("error", finish);
      if (skipPromise) skipPromise.then(finishSkipped);
      timeoutId = window.setTimeout(finish, 10 * 60 * 1000);
    });
  }

  async function runReleaseIntro(loader) {
    if (loader.dataset.releaseIntroReady === "true") return;

    loader.dataset.releaseIntroReady = "true";
    setLoaderPhase(loader, "intro-prompt");
    armIntroMusic(loader);

    const establishButton = loader.querySelector("[data-loader-establish]");
    const useIntroVideo = shouldUseIntroVideo();
    const autoBypassIntroVideo = shouldAutoBypassIntroVideo();
    const playerPromise = useIntroVideo ? getIntroPlayer(loader)
      .then(player => {
        resetIntroPlayer(player);
        return player;
      })
      .catch(error => {
        console.warn("Old Guard intro unavailable:", error);
        return null;
      }) : Promise.resolve(null);

    async function startIntro() {
      if (loader.dataset.releaseIntroRunning === "true") return;
      loader.dataset.releaseIntroRunning = "true";

      if (establishButton) establishButton.disabled = true;

      setLoaderPhase(loader, "intro-loading");
      const stopIntroProgress = startLoaderProgress(loader, { start: 12, cap: 88 });

      await Promise.all([waitForReleaseIntroLoadGate(), wait(2300)]);

      stopIntroProgress();
      setLoaderProgress(loader, 92);
      setLoaderPhase(loader, "intro-ready");
      await wait(1150);

      const player = await playerPromise;
      const videoSlot = loader.querySelector("[data-loader-intro-video]");
      const skipButton = loader.querySelector("[data-loader-skip-intro]");
      let activeIntroPlayer = null;
      let skipRequested = false;
      let resolveSkip = null;
      const skipPromise = new Promise(resolve => {
        resolveSkip = resolve;
      });

      function requestSkip() {
        if (skipRequested) return;
        skipRequested = true;
        if (skipButton) skipButton.disabled = true;
        try {
          activeIntroPlayer?.pause?.();
        } catch {}
        resolveSkip?.(true);
      }

      if (skipButton) {
        skipButton.disabled = false;
        skipButton.addEventListener("click", requestSkip);
      }

      if (videoSlot) videoSlot.setAttribute("aria-hidden", "false");
      setLoaderPhase(loader, "intro-video");
      if (autoBypassIntroVideo) requestSkip();
      await Promise.race([wait(650), skipPromise]);

      if (player && !skipRequested) {
        activeIntroPlayer = player;
        resetIntroPlayer(player);
        const playing = await playIntroPlayer(player);
        if (playing) {
          const skipped = await waitForIntroEnded(player, skipPromise);
          if (!skipped) await wait(650);
        } else {
          await Promise.race([wait(1800), skipPromise]);
        }
      } else if (!skipRequested) {
        await Promise.race([wait(1800), skipPromise]);
      }

      if (skipButton) {
        skipButton.removeEventListener("click", requestSkip);
        skipButton.disabled = false;
      }

      if (videoSlot) videoSlot.setAttribute("aria-hidden", "true");
      document.documentElement.classList.add("holonet-crt-armed");
      setLoaderPhase(loader, "intro-blackout");
      await wait(900);
      await waitForAccessClear();
      beginPageCrtOpen();
      setLoaderPhase(loader, "intro-reveal");
      await wait(1850);

      markIntroComplete();
      clearIntroForceParam();
      try {
        sessionStorage.setItem(LOADER_SHOWN_KEY, "true");
      } catch {}

      hideLoader(loader);
    }

    if (establishButton) {
      establishButton.addEventListener("click", startIntro, { once: true });
      window.setTimeout(() => establishButton.focus({ preventScroll: true }), 0);
    }
  }

  async function runStandardLoader(loader) {
    const loaderAlreadyShown = sessionStorage.getItem(LOADER_SHOWN_KEY);
    const accessPending = document.documentElement.classList.contains("access-pending");
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    const waitForGalaxyLoader = path === "/galaxy" || Boolean(document.querySelector(".gm-root"));
    const loaderRunId = `${path}:${Date.now()}`;

    if (!loaderAlreadyShown) {
      sessionStorage.setItem(LOADER_SHOWN_KEY, "true");
    }

    loader.dataset.standardLoaderRun = loaderRunId;
    setLoaderPhase(loader, "standard");
    const stopProgress = waitForGalaxyLoader
      ? () => {}
      : startLoaderProgress(loader, {
        start: document.readyState === "complete" ? 48 : 10,
        cap: accessPending ? 93 : 88
      });

    const isCurrentRun = () => loader.dataset.standardLoaderRun === loaderRunId;

    function setGalaxyProgress(detail) {
      if (!isCurrentRun()) return;
      const progress = Number(detail?.progress);
      if (Number.isFinite(progress)) {
        setLoaderProgress(loader, progress);
        const loaderText = loader.querySelector(".loader-text");
        if (loaderText) {
          loaderText.textContent = progress >= 100 || detail?.ready
            ? "Link Established"
            : `Establishing Link... ${Math.round(progress)}%`;
        }
      }
    }

    try {
      if (waitForGalaxyLoader) {
        setLoaderProgress(loader, 4);
        await waitForGalaxyLoaderReadiness({ onProgress: setGalaxyProgress });
      } else {
        await waitForWindowLoad();
      }

      await waitForAccessClear();
      if (!isCurrentRun()) return;

      stopProgress();
      hideLoader(loader);
    } catch (error) {
      console.warn("Holonet loader failed:", error);
      if (isCurrentRun()) {
        stopProgress();
        hideLoader(loader);
      }
    }
  }

  function initLoader() {
    const loader = document.getElementById("loader");
    if (!loader) return;

    if (shouldRunReleaseIntro()) {
      document.documentElement.classList.add("holonet-release-intro");
      document.documentElement.classList.remove("holonet-standard-loader");
      runReleaseIntro(loader);
      return;
    }

    document.documentElement.classList.add("holonet-standard-loader");
    document.documentElement.classList.remove("holonet-release-intro");
    runStandardLoader(loader);
  }

  function initDirectoryCards() {
    document.querySelectorAll(".dir-card[data-href]").forEach(card => {
      if (card.dataset.directoryCardBound === "true") return;
      card.dataset.directoryCardBound = "true";
      card.addEventListener("click", event => {
        if (event.target.closest("a, button")) return;
        window.location.href = card.dataset.href;
      });
    });
  }

  function initEditorOverlayBlur() {
    if (editorOverlayBlurInitialized) return;
    editorOverlayBlurInitialized = true;

    const overlaySelectors = [
      "#resource-editor-overlay",
      "#library-editor-overlay",
      "#inspection-editor-overlay",
      "#council-editor-overlay",
      "#timeline-editor-overlay"
    ];
    const activeOverlaySelector = overlaySelectors.map(selector => `${selector}.active`).join(",");

    function syncOverlayState() {
      const active = Boolean(document.querySelector(activeOverlaySelector));
      document.body.classList.toggle("editor-overlay-active", active);
    }

    const observer = new MutationObserver(syncOverlayState);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true
    });

    syncOverlayState();
  }

  window.HolonetSite = {
    loadNav,
    initLoader,
    getCanonPayload,
    warmCanonPayload,
    clearCanonPayload,
    clearAllCanonPayloads,
    clearAccessPayload,
    boot() {
      initLoader();
      loadNav();
      initDirectoryCards();
      initEditorOverlayBlur();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", window.HolonetSite.boot);
  } else {
    window.HolonetSite.boot();
  }

  window.addEventListener("holonet:access-updated", () => {
    clearAllCanonPayloads();
  });
})();
