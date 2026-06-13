(function () {
  const canonCache = new Map();
  const canonFetches = new Map();

  function canonStorageKey(key) {
    return `holonet:canon:${key}`;
  }

  function accessStorageKey() {
    return "holonet:access:global";
  }

  function canonEndpoint(key) {
    if (key === "archives") return "/api/archives";
    return `/api/library?library=${encodeURIComponent(key)}`;
  }

  function readCanonFromStorage(key) {
    try {
      const raw = sessionStorage.getItem(canonStorageKey(key));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeCanonToStorage(key, payload) {
    try {
      sessionStorage.setItem(canonStorageKey(key), JSON.stringify(payload));
    } catch {
      return null;
    }
  }

  function rememberCanon(key, payload) {
    canonCache.set(key, payload);
    writeCanonToStorage(key, payload);
    return payload;
  }

  function getCanonPayload(key) {
    return canonCache.get(key) || readCanonFromStorage(key) || null;
  }

  function clearCanonPayload(key) {
    canonCache.delete(key);
    canonFetches.delete(key);
    try {
      sessionStorage.removeItem(canonStorageKey(key));
    } catch {
      return null;
    }
  }

  function clearAccessPayload() {
    try {
      sessionStorage.removeItem(accessStorageKey());
    } catch {
      return null;
    }
  }

  function warmCanonPayload(key, options = {}) {
    if (options.force) {
      clearCanonPayload(key);
    }

    if (canonFetches.has(key)) return canonFetches.get(key);

    const cached = getCanonPayload(key);
    if (cached) {
      const resolved = Promise.resolve(cached);
      canonFetches.set(key, resolved);
      return resolved;
    }

    const request = fetch(canonEndpoint(key))
      .then(response => response.json())
      .then(payload => {
        if (!payload || payload.ok === false) {
          throw new Error(payload?.reason || payload?.error || "CANON_PREFETCH_FAILED");
        }
        return rememberCanon(key, payload);
      })
      .catch(error => {
        canonFetches.delete(key);
        throw error;
      });

    canonFetches.set(key, request);
    return request;
  }

  function readAccessFromStorage() {
    try {
      const raw = sessionStorage.getItem(accessStorageKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
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

  function initLoader() {
    const loader = document.getElementById("loader");
    if (!loader) return;

    const loaderAlreadyShown = sessionStorage.getItem("loaderShown");
    const accessPending = document.documentElement.classList.contains("access-pending");

    if (loaderAlreadyShown && !accessPending) {
      loader.style.display = "none";
      return;
    }

    if (!loaderAlreadyShown) {
      sessionStorage.setItem("loaderShown", "true");
    }

    function waitForAccessAndHide() {
      if (document.documentElement.classList.contains("access-pending")) {
        setTimeout(waitForAccessAndHide, 50);
        return;
      }

      loader.classList.add("hidden");
    }

    if (document.readyState === "complete") {
      waitForAccessAndHide();
    } else {
      window.addEventListener("load", waitForAccessAndHide);
    }
  }

  function initDirectoryCards() {
    document.querySelectorAll(".dir-card[data-href]").forEach(card => {
      card.addEventListener("click", event => {
        if (event.target.closest("a, button")) return;
        window.location.href = card.dataset.href;
      });
    });
  }

  window.HolonetSite = {
    loadNav,
    initLoader,
    getCanonPayload,
    warmCanonPayload,
    clearCanonPayload,
    clearAccessPayload,
    boot() {
      initLoader();
      loadNav();
      initDirectoryCards();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", window.HolonetSite.boot);
  } else {
    window.HolonetSite.boot();
  }
})();
