const LIBRARY_ENDPOINT = "/api/library";
const CONTENTS_DOCK_STYLE_ID = "holonet-library-contents-dock-style";

function toRoman(value) {
  const number = Math.max(1, Math.min(3999, Number(value) || 1));
  const numerals = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
  ];
  let remaining = number;
  let result = "";

  numerals.forEach(([amount, glyph]) => {
    while (remaining >= amount) {
      result += glyph;
      remaining -= amount;
    }
  });

  return result;
}

function fromRoman(value) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const text = String(value || "").toUpperCase().replace(/[^IVXLCDM]/g, "");
  let total = 0;

  for (let index = 0; index < text.length; index += 1) {
    const current = map[text[index]] || 0;
    const next = map[text[index + 1]] || 0;
    total += current < next ? -current : current;
  }

  return total || 0;
}

function articleNumberValue(value, fallback = 1) {
  const text = String(value || "").trim();
  const explicit = text.match(/\d+/)?.[0];
  if (explicit) return Number(explicit);

  const romanText = text
    .replace(/^article\s+/i, "")
    .replace(/^archive\s+/i, "")
    .trim();

  return fromRoman(romanText) || Number(fallback) || 1;
}

function anchorFor(articleNumber, regulationNumber) {
  return `reg-${String(articleNumber).padStart(2, "0")}-${String(regulationNumber).padStart(2, "0")}`;
}

function labelFor(regulationNumber) {
  return `Regulation ${toRoman(regulationNumber)}`;
}

function usableNumber(value, maxReasonable) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return number <= maxReasonable ? Math.floor(number) : 0;
}

function regulationNumberFor(entry = {}, index = 0, total = 1) {
  const maxReasonable = Math.max(50, total * 3);
  const label = String(entry.label || "");

  return usableNumber(entry.displayOrder, maxReasonable)
    || usableNumber(entry.regulationNumber, maxReasonable)
    || usableNumber(entry.number, maxReasonable)
    || usableNumber(label.match(/\d+/)?.[0], maxReasonable)
    || usableNumber(fromRoman(label.replace(/^regulation\s+/i, "")), maxReasonable)
    || usableNumber(String(entry.anchor || "").match(/reg-\d+-(\d+)/i)?.[1], maxReasonable)
    || index + 1;
}

function normalizeEntry(entry = {}, index = 0, total = 1, articleNumber = 1) {
  const regulationNumber = regulationNumberFor(entry, index, total);

  return {
    ...entry,
    anchor: anchorFor(articleNumber, regulationNumber),
    label: labelFor(regulationNumber),
    displayOrder: regulationNumber
  };
}

function normalizeDocument(documentData = {}, index = 0) {
  const articleNumber = articleNumberValue(documentData.articleNumber, documentData.displayOrder || index + 1);
  const entries = Array.isArray(documentData.entries) ? documentData.entries : [];

  return {
    ...documentData,
    articleNumber: `ARTICLE ${articleNumber}`,
    articleDisplayNumber: `ARTICLE ${toRoman(articleNumber)}`,
    displayOrder: articleNumber,
    entries: entries.map((entry, entryIndex) => normalizeEntry(entry, entryIndex, entries.length, articleNumber))
  };
}

function normalizeLibraryPayload(payload) {
  if (!payload?.documents?.length) return payload;

  return {
    ...payload,
    documents: payload.documents.map(normalizeDocument)
  };
}

function normalizeLibrarySaveBody(body = {}) {
  const articleNumber = articleNumberValue(body.articleNumber, body.displayOrder || 1);
  const entries = Array.isArray(body.entries) ? body.entries : [];

  return {
    ...body,
    articleNumber: `ARTICLE ${articleNumber}`,
    displayOrder: articleNumber,
    entries: entries
      .map((entry, index) => normalizeEntry(entry, index, entries.length, articleNumber))
      .filter(entry => String(entry.body || "").trim())
  };
}

function isLibraryRequest(input) {
  try {
    const url = new URL(typeof input === "string" ? input : input?.url, window.location.origin);
    return url.pathname === LIBRARY_ENDPOINT;
  } catch {
    return false;
  }
}

function cloneHeaders(headers) {
  const cloned = new Headers(headers);
  cloned.set("Content-Type", "application/json");
  return cloned;
}

function installFetchNormalizer() {
  if (window.__holonetLibraryRegulationFetchInstalled) return;
  window.__holonetLibraryRegulationFetchInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    let nextInit = init;

    if (isLibraryRequest(input) && ["POST", "PATCH"].includes(String(init?.method || "GET").toUpperCase()) && init?.body) {
      try {
        nextInit = {
          ...init,
          body: JSON.stringify(normalizeLibrarySaveBody(JSON.parse(init.body)))
        };
      } catch {
        nextInit = init;
      }
    }

    const response = await originalFetch(input, nextInit);
    if (!isLibraryRequest(input) || String(nextInit?.method || "GET").toUpperCase() !== "GET") return response;

    const payload = await response.clone().json().catch(() => null);
    if (!payload?.ok) return response;

    return new Response(JSON.stringify(normalizeLibraryPayload(payload)), {
      status: response.status,
      statusText: response.statusText,
      headers: cloneHeaders(response.headers)
    });
  };
}

function installSiteCacheNormalizer() {
  const site = window.HolonetSite;
  if (!site || site.__libraryRegulationCacheNormalized) return;

  const originalWarm = site.warmCanonPayload?.bind(site);
  const originalGet = site.getCanonPayload?.bind(site);

  if (originalWarm) {
    site.warmCanonPayload = async (key, options = {}) => {
      const payload = await originalWarm(key, options);
      return key === "archives" ? payload : normalizeLibraryPayload(payload);
    };
  }

  if (originalGet) {
    site.getCanonPayload = key => {
      const payload = originalGet(key);
      return key === "archives" ? payload : normalizeLibraryPayload(payload);
    };
  }

  site.__libraryRegulationCacheNormalized = true;
}

function renderRomanArticleNumbers(root = document) {
  root.querySelectorAll?.(".codex-article[data-library-document-id] .article-number").forEach((node, index) => {
    const numeric = articleNumberValue(node.textContent, index + 1);
    node.textContent = `ARTICLE ${toRoman(numeric)}`;
  });
}

function removeClauseTitleFields(root = document) {
  root.querySelectorAll?.(".library-entry-editor .resource-editor-field").forEach(field => {
    const label = field.querySelector("label");
    if (!label || label.textContent.trim().toLowerCase() !== "clause title") return;

    field.querySelectorAll("input, textarea, select").forEach(input => {
      input.required = false;
      input.value = "";
    });
    field.remove();
  });
}

function installContentsDockStyles() {
  if (document.getElementById(CONTENTS_DOCK_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = CONTENTS_DOCK_STYLE_ID;
  style.textContent = `
    .codex-contents-list {
      padding-block: 8px;
      padding-inline: 8px;
      overflow-x: hidden;
    }

    .contents-article {
      max-width: 100%;
      position: relative;
      transform: translateX(0);
      transform-origin: left center;
      transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .contents-link {
      display: block;
      max-width: 100%;
      overflow-wrap: anywhere;
      white-space: normal;
      transition:
        color 0.2s ease,
        font-size 0.24s cubic-bezier(0.16, 1, 0.3, 1),
        letter-spacing 0.24s cubic-bezier(0.16, 1, 0.3, 1),
        text-shadow 0.2s ease;
    }

    .contents-article.is-dock-active {
      z-index: 4;
      transform: translateX(6px);
    }

    .contents-article.is-current-article .contents-link {
      color: var(--red-bright);
      text-shadow:
        0 0 5px rgba(255, 0, 34, 0.35),
        0 0 14px var(--red-glow);
    }

    .contents-article.is-dock-active .contents-link {
      color: var(--red-bright);
      font-size: calc(var(--contents-link-size, 0.8rem) + 0.1rem);
      letter-spacing: 0.035em;
      text-shadow:
        0 0 5px rgba(255, 0, 34, 0.45),
        0 0 18px var(--red-glow);
    }

    @media (max-width: 768px) {
      .contents-article.is-dock-active {
        transform: translateX(4px);
      }

      .contents-article.is-dock-active .contents-link {
        font-size: calc(var(--contents-link-size, 0.8rem) + 0.06rem);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .contents-article {
        transition: none;
      }
    }
  `;
  document.head.appendChild(style);
}

function contentsItems(shell) {
  return Array.from(shell.querySelectorAll(".codex-contents-list .contents-article"));
}

function contentArticles(shell) {
  return Array.from(shell.querySelectorAll(".codex-document .codex-article[id]"));
}

function itemTargetId(item) {
  const href = item.querySelector(".contents-link")?.getAttribute("href") || "";
  return href.startsWith("#") ? href.slice(1) : "";
}

function resolveCurrentArticleIndex(shell) {
  const items = contentsItems(shell);
  const articles = contentArticles(shell);
  if (!items.length || !articles.length) return -1;

  const viewportAnchor = Math.min(Math.max(window.innerHeight * 0.28, 120), 260);
  let bestId = articles[0]?.id || "";
  let bestScore = Number.POSITIVE_INFINITY;

  articles.forEach(article => {
    const rect = article.getBoundingClientRect();
    const visibleAtAnchor = rect.top <= viewportAnchor && rect.bottom >= viewportAnchor;
    const score = visibleAtAnchor
      ? Math.abs(rect.top - viewportAnchor) * 0.2
      : Math.min(Math.abs(rect.top - viewportAnchor), Math.abs(rect.bottom - viewportAnchor)) + 1000;

    if (score < bestScore) {
      bestScore = score;
      bestId = article.id;
    }
  });

  const matchedIndex = items.findIndex(item => itemTargetId(item) === bestId);
  return matchedIndex >= 0 ? matchedIndex : 0;
}

function applyContentsDock(shell) {
  const items = contentsItems(shell);
  if (!items.length) return;

  const hoverIndex = Number(shell.dataset.contentsDockHoverIndex ?? -1);
  const currentIndex = Number(shell.dataset.contentsDockCurrentIndex ?? resolveCurrentArticleIndex(shell));

  items.forEach((item, index) => {
    item.classList.remove("is-current-article", "is-dock-active");

    if (index === currentIndex) item.classList.add("is-current-article");
    if (index === hoverIndex) item.classList.add("is-dock-active");
  });
}

function syncCurrentContentsItem(shell) {
  const currentIndex = resolveCurrentArticleIndex(shell);
  if (currentIndex < 0) return;

  shell.dataset.contentsDockCurrentIndex = String(currentIndex);
  applyContentsDock(shell);
}

function installContentsDock(root = document) {
  installContentsDockStyles();

  const shells = new Set();
  root.querySelectorAll?.(".codex-shell").forEach(shell => shells.add(shell));
  const closestShell = root.closest?.(".codex-shell");
  if (closestShell) shells.add(closestShell);
  if (!shells.size) document.querySelectorAll(".codex-shell").forEach(shell => shells.add(shell));

  shells.forEach(shell => {
    if (!shell.querySelector(".codex-contents-list") || !shell.querySelector(".codex-document")) return;

    if (shell.dataset.contentsDockBound !== "true") {
      shell.dataset.contentsDockBound = "true";
      shell.dataset.contentsDockHoverIndex = "-1";

      shell.addEventListener("pointerover", event => {
        const item = event.target.closest(".contents-article");
        if (!item || !shell.contains(item)) return;

        shell.dataset.contentsDockHoverIndex = String(contentsItems(shell).indexOf(item));
        applyContentsDock(shell);
      });

      shell.querySelector(".codex-contents")?.addEventListener("pointerleave", () => {
        shell.dataset.contentsDockHoverIndex = "-1";
        applyContentsDock(shell);
      });

      shell.addEventListener("focusin", event => {
        const item = event.target.closest(".contents-article");
        if (!item || !shell.contains(item)) return;

        shell.dataset.contentsDockHoverIndex = String(contentsItems(shell).indexOf(item));
        applyContentsDock(shell);
      });

      shell.addEventListener("focusout", event => {
        if (shell.querySelector(".codex-contents")?.contains(event.relatedTarget)) return;

        shell.dataset.contentsDockHoverIndex = "-1";
        applyContentsDock(shell);
      });

      const syncOnScroll = () => window.requestAnimationFrame(() => syncCurrentContentsItem(shell));
      window.addEventListener("scroll", syncOnScroll, { passive: true });
      window.addEventListener("resize", syncOnScroll, { passive: true });
    }

    syncCurrentContentsItem(shell);
  });
}

function installDomObserver() {
  if (window.__holonetLibraryRegulationObserverInstalled) return;
  window.__holonetLibraryRegulationObserverInstalled = true;

  renderRomanArticleNumbers();
  removeClauseTitleFields();
  installContentsDock();

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        renderRomanArticleNumbers(node);
        removeClauseTitleFields(node);
        installContentsDock(node);
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

export function initLibraryRegulations() {
  installFetchNormalizer();
  installSiteCacheNormalizer();
  installDomObserver();
}

window.initHolonetLibraryRegulations = initLibraryRegulations;
initLibraryRegulations();
