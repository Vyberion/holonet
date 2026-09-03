function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function renderTextBlocks(value, className = "reg-text") {
  const paragraphs = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return `<p class="${className}"></p>`;
  }

  return paragraphs.map(paragraph =>
    `<p class="${className}">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`
  ).join("");
}

function articleNumberAnchor(value, fallback) {
  const suffix = String(value || fallback || "")
    .trim()
    .replace(/^article\s+/i, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/gi, "");

  return `article-${suffix || "1"}`;
}

function ensureSearchScript() {
  if (typeof window.initHolonetSearch === "function") {
    window.initHolonetSearch();
    return;
  }

  import("../../js/search.js").then(() => window.initHolonetSearch?.()).catch(error => {
    console.warn("Holonet search unavailable:", error);
  });
}

function renderSubClauses(subClauses = []) {
  return subClauses.map((clause, index) => {
    const label = String(clause.label || "").replace(/Sub-Section\s+(\d+)/i, (_, value) => `Sub-Section ${toRoman(value)}`)
      || `Sub-Section ${toRoman(index + 1)}`;
    return `
    <div class="sub-clause">
      <span class="sub-marker">${escapeHtml(label)}</span>
      ${renderTextBlocks(clause.body || "", "")}
    </div>
  `;
  }).join("");
}

function renderEntry(entry) {
  return `
    <div class="regulation" id="${escapeHtml(entry.anchor || "")}">
      <h3 class="reg-title">${escapeHtml(entry.label || "Regulation")}</h3>
      ${renderTextBlocks(entry.body || "")}
      ${renderSubClauses(entry.subClauses)}
    </div>
  `;
}

function renderDocument(documentData, canEdit, index) {
  const articleAnchor = escapeHtml(articleNumberAnchor(documentData.articleNumber, index + 1));
  return `
    <article class="codex-article" id="${articleAnchor}" data-library-document-id="${escapeHtml(documentData.id || "")}">
      <div class="article-header">
        <span class="article-number">${escapeHtml(documentData.articleNumber || `ARTICLE ${index + 1}`)}</span>
        <h2 class="article-title">${escapeHtml(documentData.title || "Untitled Article")}</h2>
        ${canEdit ? `<button type="button" class="hub-write-btn" data-library-edit="${escapeHtml(documentData.id || "")}">EDIT ARTICLE</button>` : ""}
      </div>
      <div class="article-content">
        ${(documentData.entries || []).map(renderEntry).join("")}
      </div>
    </article>
  `;
}

function renderArchiveArticle(article, canEdit, index) {
  const articleAnchor = escapeHtml(articleNumberAnchor(article.articleNumber, index + 1));
  return `
    <article class="codex-article archive-article" id="${articleAnchor}" data-library-document-id="${escapeHtml(article.id || "")}">
      <div class="article-header">
        <span class="article-number">${escapeHtml(article.articleNumber || `ARCHIVE ${index + 1}`)}</span>
        <h2 class="article-title">${escapeHtml(article.title || "Untitled Archive")}</h2>
        ${canEdit ? `<button type="button" class="hub-write-btn" data-library-edit="${escapeHtml(article.id || "")}">EDIT ARTICLE</button>` : ""}
      </div>
      <div class="article-content">
        ${article.imageUrl ? `
          <figure class="archive-image">
            <img src="${escapeHtml(article.imageUrl)}" alt="${escapeHtml(article.imageAlt || article.title || "Archive image")}" loading="lazy">
          </figure>
        ` : ""}
        <div class="regulation">
          <h3 class="reg-title">${escapeHtml(article.label || "Archive Entry")}</h3>
          ${renderTextBlocks(article.body || "")}
        </div>
      </div>
    </article>
  `;
}

function renderContentsItem(documentData, index, archiveMode) {
  const articleAnchor = escapeHtml(articleNumberAnchor(documentData.articleNumber, index + 1));
  const title = escapeHtml(documentData.title || (archiveMode ? `Archive ${index + 1}` : `Article ${index + 1}`));
  const formattedIndex = String(index + 1).padStart(2, '0');

  return `
    <div class="contents-article">
      <a class="contents-link" href="#${articleAnchor}">${formattedIndex} | ${title}</a>
    </div>
  `;
}

function buildContents(items, archiveMode) {
  return `
    <div class="codex-contents-panel">
      <div class="codex-contents-header">
        <h2 class="codex-contents-title">${archiveMode ? "ARCHIVE CONTENTS" : "CODEX CONTENTS"}</h2>
      </div>
      <div class="codex-contents-list">
        ${items.map((documentData, index) => renderContentsItem(documentData, index, archiveMode)).join("")}
      </div>
    </div>
  `;
}

function updateContents(items, archiveMode) {
  const contentsMount = document.querySelector('[data-library-contents]');
  if (!contentsMount) return;
  contentsMount.innerHTML = buildContents(items, archiveMode);
}

function emptyDocument() {
  return {
    id: "",
    articleNumber: "",
    title: "",
    status: "published",
    displayOrder: 0,
    entries: [{ anchor: "", label: "", body: "", subClauses: [] }]
  };
}

function emptyArchiveArticle() {
  return {
    id: "",
    articleNumber: "",
    title: "",
    label: "Archive Entry",
    body: "",
    imagePath: "",
    imageAlt: "",
    status: "published",
    displayOrder: 0
  };
}

function normalizeLineClauses(value) {
  return String(value || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      label: `Sub-Section ${index + 1}`,
      body: line
    }));
}

function subClauseText(subClauses = []) {
  if (!Array.isArray(subClauses)) return "";

  return subClauses
    .map(clause => typeof clause === "string" ? clause : clause?.body)
    .map(body => String(body || "").trim())
    .filter(Boolean)
    .join("\n");
}

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
  const source = String(value || "").toUpperCase();
  const text = source.match(/\b[IVXLCDM]+\b/g)?.at(-1) || "";
  let total = 0;
  for (let index = 0; index < text.length; index += 1) {
    const current = map[text[index]] || 0;
    const next = map[text[index + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total || 0;
}

function articleNumberValue(documentData = {}) {
  const explicit = String(documentData.articleNumber || "").match(/\d+/)?.[0];
  const parsed = explicit ? Number(explicit) : fromRoman(documentData.articleNumber);
  const fallback = Number(documentData.displayOrder);
  const value = Number.isFinite(parsed) && parsed > 0
    ? parsed
    : Number.isFinite(fallback) && fallback > 0
      ? fallback
      : 1;

  return Math.max(1, Math.min(13, Math.floor(value)));
}

function cleanArticleInput(value, fallback = 1) {
  const number = Number(value);
  const fallbackNumber = Number(fallback) || 1;
  const parsed = Number.isFinite(number) && number > 0 ? number : fallbackNumber;
  return Math.max(1, Math.min(13, Math.floor(parsed)));
}

function regulationNumberValue(entry = {}, index = 0) {
  const anchorNumber = String(entry.anchor || "").match(/reg-\d+-(\d+)/i)?.[1];
  if (anchorNumber) return Number(anchorNumber);
  const labelNumber = String(entry.label || "").match(/\d+/)?.[0];
  return Number(entry.displayOrder || labelNumber || index + 1);
}

function generatedAnchor(articleNumber, regulationNumber) {
  return `reg-${String(articleNumber).padStart(2, "0")}-${String(regulationNumber).padStart(2, "0")}`;
}

function labelForRegulation(regulationNumber) {
  return `Regulation ${toRoman(regulationNumber)}`;
}

function formEntryMarkup(entry, index) {  
  const regulationNumber = regulationNumberValue(entry, index);
  return `
    <section class="library-entry-editor" data-library-entry-index="${index}">
      <div class="library-entry-toolbar">
        <span class="library-entry-title">Regulation ${regulationNumber}</span>
        <button type="button" class="library-inline-btn" data-library-remove-entry="${index}">REMOVE REGULATION</button>
      </div>
      <div class="resource-editor-field">
        <label>Regulation Number</label>
        <input type="number" min="1" name="entry-number-${index}" value="${escapeHtml(regulationNumber)}" required>
      </div>
      <div class="resource-editor-field">
        <label>Regulation Body</label>
        <textarea name="entry-body-${index}" required>${escapeHtml(entry.body || "")}</textarea>
      </div>
      <div class="resource-editor-field">
        <label>Sub-Sections</label>
        <textarea name="entry-sub-${index}" placeholder="One sub-section per line">${escapeHtml(subClauseText(entry.subClauses))}</textarea>
      </div>
    </section>
  `;
}

function ensureEditorOverlay() {
  let overlay = document.getElementById("codex-editor-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "codex-editor-overlay";
  overlay.className = "codex-modal-backdrop";
  overlay.innerHTML = `
    <div class="codex-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="library-editor-title">
      <div class="codex-modal-header">
        <h2 style="font-family: Cinzel, serif; font-size: 1.2rem; color: var(--red-bright); margin: 0; letter-spacing: 0.15em; text-shadow: 0 0 6px rgba(255,0,34,0.55), 0 0 20px rgba(255,0,34,0.35);" id="library-editor-title">WRITE CANON ARTICLE</h2>
        <button type="button" class="codex-modal-close" data-library-close>&times;</button>
      </div>
      <form class="codex-modal-body" id="library-editor-form"></form>
      <div class="codex-modal-footer" style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem;">
        <button type="button" class="hub-cancel-btn" data-library-delete style="display: none; margin-right: auto;">PURGE</button>
        <span class="resource-editor-status" data-library-status style="color: var(--text-dim); margin-right: 1rem;"></span>
        <button type="button" class="hub-cancel-btn" data-library-close>CANCEL</button>
        <button type="submit" class="hub-write-btn" form="library-editor-form">SAVE</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelectorAll("[data-library-close]").forEach(btn => {
    btn.addEventListener("click", () => overlay.classList.remove("active"));
  });
  let pointerStartedOnOverlay = false;
  overlay.addEventListener("pointerdown", event => {
    pointerStartedOnOverlay = event.target === overlay;
  });
  overlay.addEventListener("pointerup", event => {
    if (pointerStartedOnOverlay && event.target === overlay) overlay.classList.remove("active");
    pointerStartedOnOverlay = false;
  });
  overlay.addEventListener("pointercancel", () => {
    pointerStartedOnOverlay = false;
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") overlay.classList.remove("active");
  });

  return overlay;
}

function libraryEndpoint(libraryKey) {
  return libraryKey === "archives"
    ? "/api/archives"
    : `/api/library?library=${encodeURIComponent(libraryKey)}`;
}

async function fetchLibraryPayload(libraryKey) {
  if (typeof window.HolonetSite?.warmCanonPayload === "function") {
    return window.HolonetSite.warmCanonPayload(libraryKey);
  }

  const response = await fetch(libraryEndpoint(libraryKey));
  return response.json();
}

async function refreshLibraryPayload(libraryKey) {
  if (typeof window.HolonetSite?.warmCanonPayload === "function") {
    return window.HolonetSite.warmCanonPayload(libraryKey, { force: true });
  }

  const response = await fetch(libraryEndpoint(libraryKey), { cache: "no-store" });
  return response.json();
}

async function saveLibraryDocument(libraryKey, data) {
  const response = await fetch(libraryEndpoint(libraryKey), {
    method: data.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.reason || payload.error || "SAVE_FAILED");
  }
}

async function deleteLibraryDocument(libraryKey, id) {
  const endpoint = new URL(libraryEndpoint(libraryKey), window.location.origin);
  endpoint.searchParams.set("id", id);

  const response = await fetch(endpoint.pathname + endpoint.search, {
    method: "DELETE"
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.reason || payload.error || "DELETE_FAILED");
  }
}

async function initLibraryView() {
  const mount = document.querySelector("[data-library-document]");
  if (!mount) return;
  if (mount.dataset.libraryViewBound === "true") return;
  mount.dataset.libraryViewBound = "true";

  const libraryKey = mount.dataset.libraryKey || "codex";
  const archiveMode = libraryKey === "archives";
  let payload = await fetchLibraryPayload(libraryKey);

  function render() {
    const items = archiveMode ? (payload.articles || payload.documents || []) : (payload.documents || []);

    mount.innerHTML = `
      ${payload.canEdit ? `
        <div class="codex-toolbar">
          <button type="button" class="hub-write-btn" data-library-new>${archiveMode ? "WRITE ARTICLE" : "WRITE ARTICLE"}</button>
        </div>
      ` : ""}
      ${items.map((documentData, index) => archiveMode
        ? renderArchiveArticle(documentData, payload.canEdit, index)
        : renderDocument(documentData, payload.canEdit, index)).join("")}
    `;
    updateContents(items, archiveMode);
    ensureSearchScript();
  }

  function currentDocument(id) {
    const items = archiveMode ? (payload.articles || payload.documents || []) : (payload.documents || []);
    return items.find(documentData => String(documentData.id) === String(id));
  }

  function openEditor(documentData = archiveMode ? emptyArchiveArticle() : emptyDocument()) {
    const overlay = ensureEditorOverlay();
    const form = overlay.querySelector("#library-editor-form");
    const status = overlay.querySelector("[data-library-status]");
    const title = overlay.querySelector("#library-editor-title");
    if (!form || !status || !title) {
      console.error("Library editor overlay is missing required controls.");
      overlay.remove();
      openEditor(documentData);
      return;
    }
    let workingDocument = JSON.parse(JSON.stringify(documentData));
    let editingRegulationIndex = -1;

    function syncWorkingDocumentFromForm() {
      const liveForm = overlay.querySelector("#library-editor-form");
      if (!liveForm) return;

      const data = Object.fromEntries(new FormData(liveForm).entries());
      
      workingDocument.id = data.id || workingDocument.id;
      const articleNumber = archiveMode
        ? cleanArticleInput(data.articleNumber, articleNumberValue(workingDocument))
        : articleNumberValue(workingDocument);
      workingDocument.articleNumber = archiveMode
        ? `ARTICLE ${articleNumber}`
        : workingDocument.articleNumber || `ARTICLE ${toRoman(articleNumber)}`;
      workingDocument.title = data.title || workingDocument.title || "";
      workingDocument.status = "published";
      workingDocument.displayOrder = articleNumber;
      
      if (archiveMode) {
        workingDocument.label = data.label || "Archive Entry";
        workingDocument.body = data.body || "";
        workingDocument.imagePath = data.imagePath || "";
        workingDocument.imageAlt = data.title || "";
      } else {
        if (editingRegulationIndex >= 0 && editingRegulationIndex < workingDocument.entries.length) {
          workingDocument.entries[editingRegulationIndex] = {
            ...workingDocument.entries[editingRegulationIndex],
            anchor: generatedAnchor(articleNumber, Number(data['entry-number']) || editingRegulationIndex + 1),
            label: labelForRegulation(Number(data['entry-number']) || editingRegulationIndex + 1),
            body: data['entry-body'] || "",
            subClauses: normalizeLineClauses(data['entry-sub'] || ""),
            displayOrder: Number(data['entry-number']) || editingRegulationIndex + 1
          };
        }
      }
    }

     function renderForm() {
      title.textContent = archiveMode
        ? `${workingDocument.id ? "EDIT" : "WRITE"} ARCHIVE ARTICLE`
        : `${workingDocument.id ? "EDIT" : "WRITE"} CODEX ARTICLE`;

      const deleteBtn = overlay.querySelector("[data-library-delete]");
      if (deleteBtn) {
        deleteBtn.style.display = workingDocument.id ? "inline-block" : "none";
      }

      if (archiveMode) {
        form.innerHTML = `
          <input type="hidden" name="id" value="${escapeHtml(workingDocument.id || "")}">
          <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.2rem;">
            <div>
              <label class="codex-label">ARTICLE TITLE</label>
              <input type="text" class="codex-input" name="title" value="${escapeHtml(workingDocument.title || "")}" required>
            </div>
            <div>
              <label class="codex-label">ARTICLE NUMBER</label>
              <input type="number" min="1" class="codex-input" name="articleNumber" value="${escapeHtml(articleNumberValue(workingDocument))}" required>
            </div>
            <div>
              <label class="codex-label">IMAGE ASSET PATH (OPTIONAL)</label>
              <input type="text" class="codex-input" name="imagePath" value="${escapeHtml(workingDocument.imagePath || "")}" placeholder="archives/example.png">
            </div>
            <div>
              <label class="codex-label">FULL ARTICLE BODY</label>
              <textarea class="codex-textarea" name="body" rows="12" required>${escapeHtml(workingDocument.body || "")}</textarea>
            </div>
          </div>
        `;
        return;
      }

      if (!Array.isArray(workingDocument.entries)) {
        workingDocument.entries = [];
      }
      
      const activeEntry = editingRegulationIndex >= 0 && editingRegulationIndex < workingDocument.entries.length 
        ? workingDocument.entries[editingRegulationIndex] 
        : null;
      let mobileActivePane = editingRegulationIndex >= 0 ? "editor" : "list";

      form.innerHTML = `
        <input type="hidden" name="id" value="${escapeHtml(workingDocument.id || "")}">
        <div class="codex-split-container" data-active-pane="${mobileActivePane}">
          <!-- LEFT PANEL -->
          <div class="codex-split-left">
            <div>
              <label class="codex-label">ARTICLE TITLE</label>
              <input type="text" class="codex-input" name="title" value="${escapeHtml(workingDocument.title || "")}" required>
            </div>
            <div>
              <label class="codex-label">ARTICLE NUMBER</label>
              <input type="number" min="1" class="codex-input" name="articleNumber" value="${escapeHtml(articleNumberValue(workingDocument))}" required>
            </div>
            <div style="margin-top: 1rem; border-top: 1px solid var(--border-hot); padding-top: 1rem;">
              <label class="codex-label" style="color: var(--red-bright); margin-bottom: 0.8rem;">REGULATIONS (${workingDocument.entries.length})</label>
              <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 400px; overflow-y: auto;">
                ${workingDocument.entries.map((entry, index) => {
                  const titleStr = entry.body ? entry.body.substring(0, 35) + (entry.body.length > 35 ? "..." : "") : "New Regulation";
                  return `
                  <div class="codex-regulation-pill ${index === editingRegulationIndex ? 'active' : ''}" data-library-edit-entry="${index}">
                    <span class="codex-regulation-pill-title" style="display: flex; flex-direction: column; gap: 2px;">
                      <span style="font-weight: bold;">REG ${regulationNumberValue(entry, index)}</span>
                      <span style="font-size: 0.7rem; color: var(--text-dim);">${escapeHtml(titleStr)}</span>
                    </span>
                  </div>
                `}).join("")}
                ${workingDocument.entries.length === 0 ? `<div style="color: var(--text-dim); font-size: 0.8rem; font-family: 'Share Tech Mono', monospace; font-style: italic;">No regulations found.</div>` : ''}
              </div>
              <button type="button" class="hub-cancel-btn" style="width: 100%; margin-top: 0.8rem;" data-library-add-entry>+ ADD REGULATION</button>
            </div>
          </div>
          
          <!-- RIGHT PANEL -->
          <div class="codex-split-right">
            ${activeEntry ? `
              <div>
                <button type="button" class="codex-split-return-btn" data-library-return-list>&larr; RETURN TO REGULATIONS</button>
                <label class="codex-label" style="display: flex; justify-content: space-between; align-items: center;">
                  <span>EDITING REGULATION ${regulationNumberValue(activeEntry, editingRegulationIndex)}</span>
                  <button type="button" class="hub-cancel-btn" style="color: var(--red-bright); border-color: var(--red-bright); padding: 2px 6px; font-size: 0.65rem;" data-library-remove-entry="${editingRegulationIndex}">REMOVE</button>
                </label>
                <div style="margin-bottom: 1rem;">
                  <label class="codex-label">REGULATION NUMBER</label>
                  <input type="number" min="1" class="codex-input" name="entry-number" value="${escapeHtml(regulationNumberValue(activeEntry, editingRegulationIndex))}" required>
                </div>
                <div style="margin-bottom: 1rem;">
                  <label class="codex-label">REGULATION BODY</label>
                  <textarea class="codex-textarea" name="entry-body" rows="6" required>${escapeHtml(activeEntry.body || "")}</textarea>
                </div>
                <div>
                  <label class="codex-label">SUB-SECTIONS (ONE PER LINE)</label>
                  <textarea class="codex-textarea" name="entry-sub" rows="4" placeholder="- Clause A\n- Clause B">${escapeHtml(subClauseText(activeEntry.subClauses))}</textarea>
                </div>
              </div>
            ` : `
              <div style="height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; color: var(--text-dim); font-family: 'Share Tech Mono', monospace; border: 1px dashed var(--border-hot); background: rgba(192,0,26,0.03);">
                SELECT A REGULATION TO EDIT
              </div>
            `}
          </div>
        </div>
      `;
    }

    renderForm();
    status.textContent = "";
    overlay.classList.add("active");

    form.onclick = async event => {
      const returnList = event.target.closest("[data-library-return-list]");
      if (returnList) {
        syncWorkingDocumentFromForm();
        editingRegulationIndex = -1;
        renderForm();
        return;
      }

      const destroy = event.target.closest("[data-library-delete]");
      if (destroy && workingDocument.id) {
        if (!window.confirm("Are you sure you want to delete this article?")) return;

        try {
          status.textContent = "Deleting...";
          await deleteLibraryDocument(libraryKey, workingDocument.id);
          payload = await refreshLibraryPayload(libraryKey);
          render();
          status.textContent = "Deleted";
          setTimeout(() => overlay.classList.remove("active"), 150);
        } catch (error) {
          status.textContent = error.message.replace(/_/g, " ");
        }
        return;
      }

      if (archiveMode) return;
      
      const editEntry = event.target.closest("[data-library-edit-entry]");
      if (editEntry) {
        syncWorkingDocumentFromForm();
        editingRegulationIndex = Number(editEntry.dataset.libraryEditEntry);
        renderForm();
        return;
      }

      const add = event.target.closest("[data-library-add-entry]");
      if (add) {
        syncWorkingDocumentFromForm();
        workingDocument.entries.push({ anchor: "", label: "", body: "", subClauses: [], displayOrder: workingDocument.entries.length + 1 });
        editingRegulationIndex = workingDocument.entries.length - 1;
        renderForm();
        return;
      }

      const remove = event.target.closest("[data-library-remove-entry]");
      if (remove) {
        if (!window.confirm("Are you sure you want to delete this regulation?")) return;

        syncWorkingDocumentFromForm();
        workingDocument.entries.splice(Number(remove.dataset.libraryRemoveEntry), 1);
        editingRegulationIndex = -1;
        renderForm();
        return;
      }
      
    };

    form.onsubmit = async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      status.textContent = "Saving...";

      try {
        const articleNumber = cleanArticleInput(data.articleNumber, articleNumberValue(workingDocument));
        const payloadData = archiveMode ? {
          id: data.id,
          articleNumber: `ARTICLE ${articleNumber}`,
          title: data.title,
          body: data.body,
          imagePath: data.imagePath,
          imageAlt: data.title,
          status: "published",
          displayOrder: articleNumber
        } : {
          id: data.id,
          articleNumber: `ARTICLE ${toRoman(articleNumber)}`,
          title: data.title,
          displayOrder: articleNumber,
          entries: workingDocument.entries.map((entry, index) => ({
            anchor: generatedAnchor(articleNumber, regulationNumberValue(entry, index)),
            label: labelForRegulation(regulationNumberValue(entry, index)),
            body: entry.body,
            subClauses: entry.subClauses,
            displayOrder: regulationNumberValue(entry, index),
            originalDisplayOrder: Number(entry.originalDisplayOrder || entry.displayOrder) || index + 1
          })).filter(entry => entry.body)
        };

        await saveLibraryDocument(libraryKey, payloadData);

        payload = await refreshLibraryPayload(libraryKey);
        render();
        status.textContent = "Saved";
        setTimeout(() => overlay.classList.remove("active"), 300);
      } catch (error) {
        status.textContent = error.message.replace(/_/g, " ");
      }
    };
  }

  function scrollToHashTarget(hashTarget) {
    const hash = hashTarget || window.location.hash;
    if (!hash) return;
    const targetId = hash.replace(/^#/, "");
    if (!targetId) return;

    setTimeout(() => {
      const el = document.getElementById(targetId) || 
                 document.querySelector(`[id="${targetId}"]`) || 
                 document.querySelector(`[data-library-document-id="${targetId}"]`);
      if (el) {
        const header = document.querySelector(".nav-header, header, nav");
        const headerHeight = header ? header.getBoundingClientRect().height : 80;
        const top = el.getBoundingClientRect().top + window.pageYOffset - headerHeight - 25;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }, 200);
  }

  render();
  scrollToHashTarget();

  mount.addEventListener("click", event => {
    const hashLink = event.target.closest("a[href*='#']");
    if (hashLink && mount.contains(hashLink)) {
      const href = hashLink.getAttribute("href");
      if (href && href.includes("#")) {
        const hash = href.slice(href.indexOf("#"));
        scrollToHashTarget(hash);
      }
    }

    if (event.target.closest("[data-library-new]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      openEditor(archiveMode ? emptyArchiveArticle() : emptyDocument());
      return;
    }

    const editButton = event.target.closest("[data-library-edit]");
    if (editButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      openEditor(currentDocument(editButton.dataset.libraryEdit) || (archiveMode ? emptyArchiveArticle() : emptyDocument()));
    }
  }, true);
}

window.initHolonetLibraryView = initLibraryView;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLibraryView);
} else {
  initLibraryView();
}
