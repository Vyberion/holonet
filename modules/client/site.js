(function () {
  const canonCache = new Map();
  const canonFetches = new Map();

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
    clearAllCanonPayloads,
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

  window.addEventListener("holonet:access-updated", () => {
    clearAllCanonPayloads();
  });
})();
