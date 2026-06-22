import { fetchDivisionResourcePayload } from "./resources.js";

let pdfjsLibPromise = null;
const pdfByteCache = new Map();
const MAX_CACHED_PDFS = 6;

async function getPdfjsLib() {
  if (!pdfjsLibPromise) {
    const pdfjsUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";
    const workerUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";

    const nativeImport = new Function("url", "return import(url)");

    pdfjsLibPromise = nativeImport(pdfjsUrl).then(module => {
      module.GlobalWorkerOptions.workerSrc = workerUrl;
      return module;
    });
  }

  return pdfjsLibPromise;
}

const ZOOM_MIN = 0.75;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;
const DEFAULT_PAGE_WIDTH = 816;

const state = {
  taskId: 0,
  pdf: null,
  activeTab: null,
  zoom: 1,
  isFitHeight: false,
  isFitWidth: false,
  baselineScale: 1,
  pageText: new Map(),
  matches: [],
  activeMatchIndex: 0,
  renderedPages: new Set(),
  pageRenderPromises: new Map(),
  pageObserver: null,
  searchTaskId: 0,
  renderTimer: null,
  renderPromise: Promise.resolve(),
  handbookPayload: null,
  pdfjsLib: null
};

const dom = {};

function rememberPdfBytes(source, buffer) {
  if (pdfByteCache.has(source)) {
    pdfByteCache.delete(source);
  }

  pdfByteCache.set(source, buffer);

  while (pdfByteCache.size > MAX_CACHED_PDFS) {
    pdfByteCache.delete(pdfByteCache.keys().next().value);
  }
}

async function fetchPdfBytes(source) {
  const cached = pdfByteCache.get(source);
  if (cached) {
    return cached instanceof Promise ? await cached : cached;
  }

  const request = fetch(source, {
    credentials: "same-origin"
  }).then(async response => {
    if (!response.ok) {
      throw new Error(`PDF_FETCH_FAILED:${response.status}`);
    }

    return response.arrayBuffer();
  });

  pdfByteCache.set(source, request);

  try {
    const buffer = await request;
    rememberPdfBytes(source, buffer);
    return buffer;
  } catch (error) {
    pdfByteCache.delete(source);
    throw error;
  }
}

async function openPdfDocument(pdfjsLib, source) {
  try {
    const cached = pdfByteCache.get(source);
    if (cached && !(cached instanceof Promise)) {
      return await pdfjsLib.getDocument({ data: cached.slice(0) }).promise;
    }

    return await pdfjsLib.getDocument({
      url: source,
      disableAutoFetch: false,
      disableStream: false,
      disableRange: false
    }).promise;
  } catch (directError) {
    console.warn("Direct PDF.js load failed, falling back to byte cache:", directError);
    const buffer = await fetchPdfBytes(source);
    return pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanFileName(value) {
  return String(value || "")
    .split("/")
    .pop()
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function displayTitle(resource) {
  return resource.slotLabel || cleanFileName(resource.fileName || resource.storagePath) || resource.title || "Handbook";
}

function tabLabel(resource) {
  if (resource.slotLabel) return resource.slotLabel;

  return displayTitle(resource)
    .replace(/\bhandbook\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || displayTitle(resource);
}

function slotOrder(slot) {
  return Number(slot?.order || 0) || 999;
}

function isResourceAvailable(resource) {
  return Boolean(resource?.signedUrl || resource?.href);
}

function placeholderForSlot(slot) {
  return {
    id: `slot-${slot.key}`,
    slug: slot.slug || slot.key,
    slotKey: slot.key,
    slotLabel: slot.label,
    title: slot.label,
    fileName: slot.label,
    meta: `${slot.label} - Unlinked`,
    href: "",
    signedUrl: "",
    available: false
  };
}

function normalizeHandbookPayload(payload) {
  const slotCatalog = Array.isArray(payload?.slotCatalog)
    ? payload.slotCatalog.slice().sort((a, b) => slotOrder(a) - slotOrder(b))
    : [];
  const resources = Array.isArray(payload?.resources) ? payload.resources : [];

  if (!slotCatalog.length) {
    return {
      ...payload,
      resources
    };
  }

  const resourcesBySlot = new Map(resources.map(resource => [resource.slotKey, resource]));

  return {
    ...payload,
    slotCatalog,
    resources: slotCatalog.map(slot => {
      const resource = resourcesBySlot.get(slot.key);
      if (!resource) return placeholderForSlot(slot);

      return {
        ...resource,
        slotLabel: slot.label,
        meta: slot.label,
        title: slot.label,
        fileName: slot.label,
        available: isResourceAvailable(resource)
      };
    })
  };
}

function requestedDocumentKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get("document") || params.get("handbook") || params.get("tab") || "";
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function resourceKeys(resource) {
  return [
    resource.slug,
    resource.id,
    resource.slotKey,
    resource.slotLabel,
    resource.storagePath,
    resource.fileName,
    resource.title
  ].map(normalizeKey).filter(Boolean);
}

async function hydratePdfTabsFromResources() {
  const tabStrip = document.querySelector("[data-pdf-tab-strip]");
  const division = tabStrip?.dataset.pdfDivision;
  if (!tabStrip || !division) return;

  tabStrip.innerHTML = '<span class="pdf-loading">Loading handbook registry...</span>';

  state.handbookPayload = normalizeHandbookPayload(await fetchDivisionResourcePayload(division, "documents"));
  const handbooks = state.handbookPayload.resources || [];

  if (!handbooks.length) {
    tabStrip.innerHTML = '<span class="pdf-loading">No handbooks published.</span>';
    return;
  }

  const requestedKey = normalizeKey(requestedDocumentKey());
  const requestedIndex = handbooks.findIndex(resource => resourceKeys(resource).includes(requestedKey));
  const firstAvailableIndex = handbooks.findIndex(isResourceAvailable);
  const activeIndex = requestedIndex >= 0 ? requestedIndex : Math.max(0, firstAvailableIndex);

  tabStrip.innerHTML = handbooks.map((resource, index) => `
    <button
      type="button"
      class="pdf-tab${index === activeIndex ? " is-active" : ""}${isResourceAvailable(resource) ? "" : " is-disabled"}"
      role="tab"
      aria-selected="${index === activeIndex ? "true" : "false"}"
      aria-disabled="${isResourceAvailable(resource) ? "false" : "true"}"
      data-pdf-tab
      data-pdf-key="${escapeHtml(resource.slug || resource.id || resource.storagePath || resource.fileName || resource.title)}"
      data-pdf-label="${escapeHtml(displayTitle(resource))}"
      data-pdf-document-meta="${escapeHtml(resource.meta || resource.title || "HANDBOOK")}"
      data-pdf-src="${escapeHtml(resource.signedUrl || resource.href || "")}"
      data-pdf-available="${isResourceAvailable(resource) ? "true" : "false"}"
    >
      ${escapeHtml(tabLabel(resource))}
    </button>
  `).join("");
}

function getPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

function getAvailablePageWidth() {
  return Math.max((dom.container?.clientWidth || 900) - 34, 320);
}

function getAvailablePageHeight() {
  return Math.max((dom.scrollBox?.clientHeight || 700) - 34, 320);
}

function getScrollRatio() {
  if (!dom.scrollBox) return 0;
  const maxScroll = dom.scrollBox.scrollHeight - dom.scrollBox.clientHeight;
  return maxScroll > 0 ? dom.scrollBox.scrollTop / maxScroll : 0;
}

function restoreScrollRatio(ratio) {
  if (!dom.scrollBox) return;
  const maxScroll = dom.scrollBox.scrollHeight - dom.scrollBox.clientHeight;
  dom.scrollBox.scrollTop = Math.max(0, maxScroll * ratio);
}

function updateZoomLabel() {
  if (!dom.zoomLabel) return;
  if (state.isFitHeight) dom.zoomLabel.textContent = "FIT";
  else if (state.isFitWidth) dom.zoomLabel.textContent = "FILL";
  else dom.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
}

function clearSearchState() {
  state.matches = [];
  state.activeMatchIndex = 0;
  state.searchTaskId += 1;
  if (dom.searchInput) dom.searchInput.value = "";
  if (dom.searchResults) dom.searchResults.innerHTML = "";
  updateSearchCounter();
}

function getUniqueTextItems(items) {
  const seen = new Set();
  return items.filter(item => {
    if (!item.str || !item.str.trim()) return false;
    const x = Math.round(item.transform[4]);
    const y = Math.round(item.transform[5]);
    const key = `${item.str.trim()}::${x}::${y}`;
    
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function positionTextSpan(span, item, viewport) {
  const pdfjsLib = state.pdfjsLib;
  const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
  const angle = Math.atan2(tx[1], tx[0]);
  const fontHeight = Math.hypot(tx[2], tx[3]);
  span.style.position = "absolute";
  span.style.whiteSpace = "pre";
  span.style.lineHeight = "1";
  span.style.fontFamily = item.fontName ? `${item.fontName}, sans-serif` : "sans-serif";
  span.style.color = "transparent";

  span.style.left = `${tx[4]}px`;
  span.style.top = `${tx[5]}px`;
  span.style.fontSize = `${fontHeight}px`;
  
  span.dataset.baseTransform = `translateY(-100%) rotate(${angle}rad)`;
  span.style.transform = span.dataset.baseTransform;
  span.style.transformOrigin = "0 0";

  span.dataset.desiredWidth = String(Math.max((item.width || 0) * viewport.scale, 1));
}

function fitTextSpanWidth(span, item, viewport) {
  const desiredWidth = Number(span.dataset.desiredWidth) || Math.max((item.width || 0) * viewport.scale, 1);
  const actualWidth = span.offsetWidth || desiredWidth;
  const scaleX = actualWidth > 0 ? desiredWidth / actualWidth : 1;

  span.style.transform = `${span.dataset.baseTransform} scaleX(${scaleX})`;
}

function createHighlightRect(match, span, highlightLayer, globalIndex) {
  const textNode = span.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;

  const range = document.createRange();
  const start = Math.min(match.index, textNode.length);
  const end = Math.min(match.index + match.length, textNode.length);
  range.setStart(textNode, start);
  range.setEnd(textNode, end);

  const rangeRect = range.getBoundingClientRect();
  const layerRect = highlightLayer.getBoundingClientRect();
  range.detach();

  if (!rangeRect.width || !rangeRect.height) return null;

  const rect = document.createElement("button");

  rect.type = "button";
  rect.className = "pdf-search-mark";
  rect.dataset.matchIndex = String(globalIndex);
  rect.setAttribute("aria-label", `Search match ${globalIndex + 1}`);
  rect.style.left = `${rangeRect.left - layerRect.left}px`;
  rect.style.top = `${rangeRect.top - layerRect.top}px`;
  rect.style.width = `${rangeRect.width}px`;
  rect.style.height = `${rangeRect.height}px`;
  rect.style.transformOrigin = "0 50%";
  rect.classList.toggle("is-active", globalIndex === state.activeMatchIndex);
  rect.addEventListener("click", () => setActiveMatch(globalIndex));

  return rect;
}

function disconnectPageObserver() {
  state.pageObserver?.disconnect();
  state.pageObserver = null;
}

function setBaselineFromPage(baseViewport) {
  const pageGap = 18;
  const verticalPadding = 32;
  const targetPageWidth = Math.min(DEFAULT_PAGE_WIDTH, getAvailablePageWidth());
  state.baselineScale = targetPageWidth / baseViewport.width;

  const pageHeight = baseViewport.height * state.baselineScale;
  const viewerHeight = verticalPadding + pageHeight + pageGap + (pageHeight / 6);
  dom.scrollBox.style.height = `${Math.round(viewerHeight)}px`;
}

function scaleForPage(baseViewport) {
  if (state.isFitHeight) return getAvailablePageHeight() / baseViewport.height;
  if (state.isFitWidth) return getAvailablePageWidth() / baseViewport.width;
  return state.baselineScale * state.zoom;
}

function placeholderDimensions(baseViewport) {
  const scale = scaleForPage(baseViewport);
  return {
    width: Math.floor(baseViewport.width * scale),
    height: Math.floor(baseViewport.height * scale)
  };
}

function createPagePlaceholder(pageNumber, dimensions) {
  const wrapper = document.createElement("div");
  wrapper.className = "pdf-page pdf-page--pending";
  wrapper.dataset.pageNumber = String(pageNumber);
  wrapper.style.width = `${dimensions.width}px`;
  wrapper.style.height = `${dimensions.height}px`;
  return wrapper;
}

async function extractPageText(pageNumber, page = null) {
  if (state.pageText.has(pageNumber)) return state.pageText.get(pageNumber);
  if (!state.pdf) return null;

  const sourcePage = page || await state.pdf.getPage(pageNumber);
  const textContent = await sourcePage.getTextContent();
  const uniqueItems = getUniqueTextItems(textContent.items);
  const items = uniqueItems.map(item => item.str || "").filter(Boolean);
  const pageText = {
    pageNumber,
    items,
    text: items.join(" ").replace(/\s+/g, " ").trim()
  };
  state.pageText.set(pageNumber, pageText);
  return pageText;
}

async function renderPage(pdf, pageNumber, taskId) {
  const wrapper = dom.container?.querySelector(`.pdf-page[data-page-number="${pageNumber}"]`);
  if (!wrapper) return;

  const page = await pdf.getPage(pageNumber);
  if (taskId !== state.taskId) return;

  wrapper.classList.remove("pdf-page--pending");
  wrapper.replaceChildren();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  const textLayer = document.createElement("div");
  textLayer.className = "pdf-text-layer";
  const highlightLayer = document.createElement("div");
  highlightLayer.className = "pdf-highlight-layer";

  wrapper.appendChild(canvas);
  wrapper.appendChild(highlightLayer);
  wrapper.appendChild(textLayer);

  const baseViewport = page.getViewport({ scale: 1 });
  const cssScale = scaleForPage(baseViewport);
  const outputScale = getPixelRatio();
  const viewport = page.getViewport({ scale: cssScale });

  wrapper.style.width = `${Math.floor(viewport.width)}px`;
  wrapper.style.height = `${Math.floor(viewport.height)}px`;
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  textLayer.style.width = canvas.style.width;
  textLayer.style.height = canvas.style.height;
  highlightLayer.style.width = canvas.style.width;
  highlightLayer.style.height = canvas.style.height;

  await page.render({
    canvasContext: context,
    viewport,
    transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null
  }).promise;

  if (taskId !== state.taskId) return;

  const textContent = await page.getTextContent();
  const uniqueItems = getUniqueTextItems(textContent.items);
  const items = uniqueItems.map(item => item.str || "").filter(Boolean);
  state.pageText.set(pageNumber, {
    pageNumber,
    items,
    text: items.join(" ").replace(/\s+/g, " ").trim()
  });
  const pageMatches = state.matches
    .map((match, index) => ({ ...match, globalIndex: index }))
    .filter(match => match.pageNumber === pageNumber);

  uniqueItems.forEach((item, itemIndex) => {
    if (!item.str) return;

    const span = document.createElement("span");
    span.textContent = item.str;
    positionTextSpan(span, item, viewport);
    textLayer.appendChild(span);
    fitTextSpanWidth(span, item, viewport);

    pageMatches
      .filter(match => match.itemIndex === itemIndex)
      .forEach(match => {
        const rect = createHighlightRect(match, span, highlightLayer, match.globalIndex);
        if (rect) highlightLayer.appendChild(rect);
      });
  });

  state.renderedPages.add(pageNumber);
  refreshActiveMatchElement();
}

function ensurePageRendered(pageNumber) {
  if (!state.pdf || state.renderedPages.has(pageNumber)) return Promise.resolve();
  if (state.pageRenderPromises.has(pageNumber)) return state.pageRenderPromises.get(pageNumber);

  const taskId = state.taskId;
  const promise = renderPage(state.pdf, pageNumber, taskId)
    .catch(error => {
      console.error(`PDF page ${pageNumber} failed:`, error);
      const wrapper = dom.container?.querySelector(`.pdf-page[data-page-number="${pageNumber}"]`);
      if (wrapper && taskId === state.taskId) {
        wrapper.classList.add("pdf-page--pending");
        wrapper.textContent = "PAGE UNAVAILABLE";
      }
    })
    .finally(() => state.pageRenderPromises.delete(pageNumber));

  state.pageRenderPromises.set(pageNumber, promise);
  return promise;
}

function observePendingPages() {
  disconnectPageObserver();
  if (!dom.scrollBox || typeof IntersectionObserver !== "function") return;

  state.pageObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const pageNumber = Number(entry.target.dataset.pageNumber);
      state.pageObserver?.unobserve(entry.target);
      ensurePageRendered(pageNumber);
    });
  }, {
    root: dom.scrollBox,
    rootMargin: "120% 0px",
    threshold: 0.01
  });

  dom.container.querySelectorAll(".pdf-page--pending").forEach(page => {
    if (Number(page.dataset.pageNumber) !== 1) state.pageObserver.observe(page);
  });
}

function getPageContextIndex(page, itemText, itemIndex) {
  const lowerPageText = page.text.toLowerCase();
  const lowerItemText = itemText.toLowerCase();
  let fromIndex = 0;

  for (let i = 0; i <= itemIndex; i += 1) {
    const foundIndex = lowerPageText.indexOf(lowerItemText, fromIndex);
    if (foundIndex === -1) return Math.max(lowerPageText.indexOf(lowerItemText), 0);
    if (i === itemIndex) return foundIndex;
    fromIndex = foundIndex + lowerItemText.length;
  }

  return 0;
}

function getMatchSignature(match) {
  return `${match.pageNumber}::${match.text.toLowerCase()}::${match.contextIndex}`;
}

function dedupeMatches(matches) {
  const seen = new Set();

  return matches.filter(match => {
    const key = getMatchSignature(match);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collapseResultsForOverlay(matches) {
  const seen = new Set();

  return matches
    .map((match, index) => ({ ...match, globalIndex: index }))
    .filter(match => {
      const key = `${match.pageNumber}::${match.snippet}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(match => match.globalIndex);
}

async function renderDocument({ preserveScroll = false } = {}) {
  if (!state.pdf || !dom.container) return;

  const pagesToRestore = [...state.renderedPages];
  const scrollRatio = preserveScroll ? getScrollRatio() : 0;
  const taskId = state.taskId + 1;
  state.taskId = taskId;
  state.renderedPages = new Set();
  state.pageRenderPromises = new Map();
  disconnectPageObserver();
  dom.container.innerHTML = "";

  const firstPage = await state.pdf.getPage(1);
  if (taskId !== state.taskId) return;
  const baseViewport = firstPage.getViewport({ scale: 1 });
  setBaselineFromPage(baseViewport);
  const dimensions = placeholderDimensions(baseViewport);

  for (let pageNumber = 1; pageNumber <= state.pdf.numPages; pageNumber += 1) {
    dom.container.appendChild(createPagePlaceholder(pageNumber, dimensions));
  }

  observePendingPages();
  updateZoomLabel();

  const immediatePages = [...new Set([1, ...pagesToRestore])]
    .filter(pageNumber => pageNumber <= state.pdf.numPages);
  await Promise.all(immediatePages.map(ensurePageRendered));

  if (taskId === state.taskId) {
    if (preserveScroll) restoreScrollRatio(scrollRatio);
    refreshActiveMatchElement();
  }

  return taskId;
}

function scheduleRender(options = {}) {
  clearTimeout(state.renderTimer);
  state.renderTimer = setTimeout(() => {
    state.renderPromise = renderDocument(options);
  }, 80);
}

function renderNow(options = {}) {
  clearTimeout(state.renderTimer);
  state.renderPromise = Promise.resolve(renderDocument(options));
  return state.renderPromise;
}

async function waitForRender() {
  clearTimeout(state.renderTimer);
  await state.renderPromise;
}

async function loadPdf(tab) {
  const source = tab.dataset.pdfSrc;

  const taskId = state.taskId + 1;
  state.taskId = taskId;
  state.activeTab = tab;
  state.zoom = 1;
  state.isFitWidth = false;
  state.isFitHeight = false;
  state.pageText = new Map();
  state.renderedPages = new Set();
  state.pageRenderPromises = new Map();
  disconnectPageObserver();
  clearSearchState();

  if (dom.scrollBox) dom.scrollBox.scrollTop = 0;
  if (dom.title) dom.title.textContent = tab.dataset.pdfLabel || tab.textContent.trim();
  if (dom.meta) dom.meta.textContent = tab.dataset.pdfDocumentMeta || "PDF archive";
  updateZoomLabel();

  if (!source) {
    if (state.pdf) {
      await state.pdf.destroy();
      state.pdf = null;
    }

    dom.container.innerHTML = '<div class="pdf-loading">Document unavailable.</div>';
    state.pageText = new Map();
    return;
  }

  dom.container.innerHTML = '<div class="pdf-loading">Opening transmission...</div>';

  try {
    if (state.pdf) {
      await state.pdf.destroy();
      state.pdf = null;
    }

    const pdfjsLib = await getPdfjsLib();
    state.pdfjsLib = pdfjsLib;
    const pdf = await openPdfDocument(pdfjsLib, source);
    if (taskId !== state.taskId) {
      await pdf.destroy();
      return;
    }

    state.pdf = pdf;
    state.pageText = new Map();

    if (taskId !== state.taskId) return;
    await renderDocument();
  } catch (error) {
    console.error("PDF render failed:", error);
    if (taskId === state.taskId) {
      dom.container.innerHTML = '<div class="pdf-loading">Transmission failed.</div>';
    }
  }
}

function buildSearchOverlay() {
  if (!dom.searchOverlay || !dom.searchContainer) return;

  dom.searchContainer.innerHTML = `
    <div class="search-topbar">
      <span class="search-eyebrow">&#x2731;&nbsp; Handbook Search Protocol</span>
      <button class="search-close" aria-label="Close search">ESC &nbsp;/ CLOSE</button>
    </div>
    <div class="search-input-row">
      <span class="search-caret" aria-hidden="true">&#x25B8;</span>
      <input
        type="text"
        id="search-input"
        placeholder="Search active handbook..."
        aria-label="Search active handbook"
        autocomplete="off"
        spellcheck="false"
      />
      <span class="search-counter" id="search-counter-display"></span>
      <div class="search-nav-btns">
        <button class="search-nav-btn" id="search-prev" title="Previous match" aria-label="Previous match">&#x2191;</button>
        <button class="search-nav-btn" id="search-next" title="Next match" aria-label="Next match">&#x2193;</button>
      </div>
    </div>
    <div id="search-results"></div>
    <div class="search-footer">
      <span class="search-hint"><kbd>&#x2191;</kbd><kbd>&#x2193;</kbd>&nbsp;navigate</span>
      <span class="search-hint"><kbd>Enter</kbd>&nbsp;jump to</span>
      <span class="search-hint"><kbd>Esc</kbd>&nbsp;close</span>
    </div>
  `;

  dom.searchInput = document.getElementById("search-input");
  dom.searchResults = document.getElementById("search-results");
  dom.searchCounter = document.getElementById("search-counter-display");
  dom.searchClose = dom.searchContainer.querySelector(".search-close");
  dom.searchPrev = document.getElementById("search-prev");
  dom.searchNext = document.getElementById("search-next");
}

function openSearch() {
  if (!dom.searchOverlay || !dom.searchInput) return;
  dom.searchOverlay.classList.add("active");
  dom.searchInput.focus();
  dom.searchInput.select();
}

function closeSearch() {
  if (!dom.searchOverlay) return;
  dom.searchOverlay.classList.remove("active");
}

function buildSnippet(text, index, length) {
  const start = Math.max(index - 56, 0);
  const end = Math.min(index + length + 72, text.length);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  const snippet = `${prefix}${text.slice(start, end)}${suffix}`;
  const re = new RegExp(`(${escapeRegExp(dom.searchInput.value.trim())})`, "gi");

  return escapeHtml(snippet).replace(re, "<mark>$1</mark>");
}

async function ensureAllPageText(searchTaskId) {
  if (!state.pdf) return;

  for (let pageNumber = 1; pageNumber <= state.pdf.numPages; pageNumber += 1) {
    if (searchTaskId !== state.searchTaskId) return;
    await extractPageText(pageNumber);
  }
}

async function runSearch(query) {
  const searchTaskId = state.searchTaskId + 1;
  state.searchTaskId = searchTaskId;
  state.matches = [];
  state.activeMatchIndex = 0;
  if (dom.searchResults) dom.searchResults.innerHTML = "";

  if (!query || query.length < 2) {
    updateSearchCounter();
    renderNow({ preserveScroll: true });
    return;
  }

  if (dom.searchResults) {
    dom.searchResults.innerHTML = '<div class="search-no-results">// INDEXING HANDBOOK...</div>';
  }
  await ensureAllPageText(searchTaskId);
  if (searchTaskId !== state.searchTaskId) return;

  const q = query.toLowerCase();

  [...state.pageText.values()]
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .forEach(page => {
    page.items.forEach((itemText, itemIndex) => {
      const lower = itemText.toLowerCase();
      let index = lower.indexOf(q);

      while (index !== -1) {
        const contextIndex = getPageContextIndex(page, itemText, itemIndex) + index;

        state.matches.push({
          pageNumber: page.pageNumber,
          index,
          length: query.length,
          itemIndex,
          itemText,
          text: itemText.slice(index, index + query.length),
          contextIndex,
          snippet: buildSnippet(page.text, contextIndex, query.length)
        });
        index = lower.indexOf(q, index + query.length);
      }
    });
  });

  state.matches = dedupeMatches(state.matches);

  if (!state.matches.length && dom.searchResults) {
    dom.searchResults.innerHTML = '<div class="search-no-results">// NO RECORDS FOUND</div>';
  } else {
    renderSearchResults();
  }

  updateSearchCounter();
  renderNow({ preserveScroll: true });
}

function renderSearchResults() {
  if (!dom.searchResults) return;

  dom.searchResults.innerHTML = "";

  const resultIndexes = collapseResultsForOverlay(state.matches);

  resultIndexes.forEach(index => {
    const match = state.matches[index];
    const item = document.createElement("div");
    item.className = "search-result-item";
    item.classList.toggle("active", index === state.activeMatchIndex);
    item.dataset.matchIndex = String(index);

    const meta = document.createElement("div");
    meta.className = "search-result-meta";
    meta.textContent = `PAGE ${match.pageNumber} / MATCH ${index + 1}`;

    const snippet = document.createElement("div");
    snippet.className = "search-result-snippet";
    snippet.innerHTML = match.snippet;

    item.appendChild(meta);
    item.appendChild(snippet);
    item.addEventListener("click", () => {
      setActiveMatch(index);
      jumpToActiveMatch();
    });

    dom.searchResults.appendChild(item);
  });
}

function updateSearchCounter() {
  if (!dom.searchCounter) return;
  dom.searchCounter.textContent = state.matches.length
    ? `${state.activeMatchIndex + 1} / ${state.matches.length}`
    : "";
}

function refreshActiveSearchResult() {
  if (!dom.searchResults) return;

  dom.searchResults.querySelectorAll(".search-result-item").forEach((item, index) => {
    const itemIndex = Number(item.dataset.matchIndex);
    item.classList.toggle("active", itemIndex === state.activeMatchIndex);
  });

  let activeItem = dom.searchResults.querySelector(`[data-match-index="${state.activeMatchIndex}"]`);

  if (!activeItem) {
    activeItem = Array.from(dom.searchResults.querySelectorAll(".search-result-item"))
      .reverse()
      .find(item => Number(item.dataset.matchIndex) <= state.activeMatchIndex);
  }

  activeItem?.classList.add("active");
  activeItem?.scrollIntoView({ block: "nearest" });
}

function refreshActiveMatchElement() {
  document.querySelectorAll(".pdf-search-mark").forEach(mark => {
    mark.classList.toggle("is-active", Number(mark.dataset.matchIndex) === state.activeMatchIndex);
  });
}

function setActiveMatch(index) {
  if (!state.matches.length) return;
  state.activeMatchIndex = (index + state.matches.length) % state.matches.length;
  updateSearchCounter();
  refreshActiveSearchResult();
  refreshActiveMatchElement();
}

async function jumpToActiveMatch() {
  if (!state.matches.length || !dom.scrollBox) return;
  await waitForRender();

  const pageNumber = state.matches[state.activeMatchIndex].pageNumber;
  await ensurePageRendered(pageNumber);
  if (state.renderedPages.has(pageNumber)) {
    await renderPage(state.pdf, pageNumber, state.taskId);
  }

  const mark = document.querySelector(`.pdf-search-mark[data-match-index="${state.activeMatchIndex}"]`);
  const page = document.querySelector(`.pdf-page[data-page-number="${pageNumber}"]`);
  const target = mark || page;

  if (!target) return;

  const targetRect = target.getBoundingClientRect();
  const boxRect = dom.scrollBox.getBoundingClientRect();

  dom.scrollBox.scrollTo({
    top: dom.scrollBox.scrollTop + targetRect.top - boxRect.top - 80,
    behavior: "auto"
  });
}

async function stepMatch(direction) {
  if (!state.matches.length) return;
  setActiveMatch(state.activeMatchIndex + direction);
  await jumpToActiveMatch();
}

function setZoom(nextZoom, { fitWidth = false, fitHeight = false } = {}) {
  state.zoom = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
  state.isFitWidth = fitWidth;
  state.isFitHeight = fitHeight;
  scheduleRender({ preserveScroll: true });
  updateZoomLabel();
}

function activateTab(tab) {
  dom.tabs.forEach(item => {
    const isActive = item === tab;
    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", String(isActive));
  });

  const key = tab.dataset.pdfKey;
  if (key) {
    const url = new URL(window.location.href);
    url.searchParams.set("document", key);
    window.history.replaceState({}, "", url);
  }

  loadPdf(tab);
}

function setupEvents() {
  dom.tabs.forEach(tab => {
    tab.addEventListener("click", () => activateTab(tab));
  });

  dom.zoomOut?.addEventListener("click", () => setZoom(state.zoom - ZOOM_STEP));
  dom.zoomIn?.addEventListener("click", () => setZoom(state.zoom + ZOOM_STEP));
  dom.fitHeight?.addEventListener("click", () => setZoom(1, { fitHeight: true }));
  dom.fitWidth?.addEventListener("click", () => setZoom(1, { fitWidth: true }));  
  dom.openSearch?.addEventListener("click", openSearch);
  dom.searchClose?.addEventListener("click", closeSearch);
  dom.searchPrev?.addEventListener("click", () => stepMatch(-1));
  dom.searchNext?.addEventListener("click", () => stepMatch(1));

  dom.searchOverlay?.addEventListener("click", event => {
    if (event.target === dom.searchOverlay) closeSearch();
  });

  dom.searchInput?.addEventListener("input", () => runSearch(dom.searchInput.value.trim()));
  dom.searchInput?.addEventListener("keydown", async event => {
    if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
      event.preventDefault();
      await stepMatch(1);
    }

    if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
      event.preventDefault();
      await stepMatch(-1);
    }

    if (event.key === "Enter") {
      event.preventDefault();
      await jumpToActiveMatch();
      closeSearch();
    }
  });

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      openSearch();
    }

    if (event.key === "Escape" && dom.searchOverlay?.classList.contains("active")) {
      closeSearch();
    }
  });

  dom.scrollBox?.addEventListener("wheel", event => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    dom.scrollBox.scrollTop += event.deltaY;
  }, { passive: false });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (state.pdf) renderNow({ preserveScroll: true });
    }, 160);
  });
}

function cacheDom() {
  dom.tabs = Array.from(document.querySelectorAll("[data-pdf-tab]"));
  dom.container = document.querySelector("[data-pdf-pages]");
  dom.scrollBox = dom.container?.closest(".pdf-box");
  dom.title = document.getElementById("pdf-reader-title");
  dom.meta = document.getElementById("pdf-reader-meta");
  dom.zoomOut = document.querySelector("[data-pdf-zoom-out]");
  dom.zoomIn = document.querySelector("[data-pdf-zoom-in]");
  dom.zoomLabel = document.querySelector("[data-pdf-zoom-label]");
  dom.fitWidth = document.querySelector("[data-pdf-fit-width]");
  dom.fitHeight = document.querySelector("[data-pdf-fit-height]")
  dom.openSearch = document.querySelector("[data-pdf-open-search]");
  dom.searchOverlay = document.getElementById("search-overlay");
  dom.searchContainer = document.getElementById("search-container");
}

let pdfTabsInitPromise = null;

async function initPdfTabs() {
  if (!pdfTabsInitPromise) {
    pdfTabsInitPromise = (async () => {
      const pdfRuntimeWarmup = getPdfjsLib().catch(error => {
        console.warn("PDF runtime warmup failed:", error);
      });

      await hydratePdfTabsFromResources();
      cacheDom();
      if (!dom.tabs.length || !dom.container) return;

      const activeTab = dom.tabs.find(tab => tab.classList.contains("is-active")) || dom.tabs[0];
      buildSearchOverlay();
      setupEvents();
      await pdfRuntimeWarmup;
      activateTab(activeTab);
    })().catch(error => {
      pdfTabsInitPromise = null;
      console.error("Handbook viewer failed to initialize:", error);
      throw error;
    });
  }

  return pdfTabsInitPromise;
}

window.initHolonetPdfTabs = initPdfTabs;
