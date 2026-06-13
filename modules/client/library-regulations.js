const LIBRARY_ENDPOINT = "/api/library";

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

function installDomObserver() {
  if (window.__holonetLibraryRegulationObserverInstalled) return;
  window.__holonetLibraryRegulationObserverInstalled = true;

  renderRomanArticleNumbers();
  removeClauseTitleFields();

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        renderRomanArticleNumbers(node);
        removeClauseTitleFields(node);
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
