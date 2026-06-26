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
  return subClauses.map(clause => `
    <div class="sub-clause">
      <span class="sub-marker">${escapeHtml(clause.label || "Sub-Section")}</span>
      ${renderTextBlocks(clause.body || "", "")}
    </div>
  `).join("");
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

  return `
    <div class="contents-article">
      <a class="contents-link" href="#${articleAnchor}">${title}</a>
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
    </section>
  `;
}

function ensureEditorOverlay() {
  let overlay = document.getElementById("library-editor-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "library-editor-overlay";
  overlay.innerHTML = `
    <div class="resource-editor-container library-editor-container" role="dialog" aria-modal="true" aria-labelledby="library-editor-title">
      <div class="resource-editor-topbar">
        <span class="resource-editor-title" id="library-editor-title">WRITE CANON ARTICLE</span>
        <button type="button" class="resource-editor-close" data-library-close>CLOSE</button>
      </div>
      <form class="resource-editor-form library-editor-form" id="library-editor-form"></form>
      <div class="resource-editor-actions">
        <span class="resource-editor-status" data-library-status></span>
        <button type="submit" class="resource-editor-submit" form="library-editor-form">SAVE</button>
      </div>
      <div class="resource-editor-footer">
        <span class="resource-editor-hint"><kbd>ESC</kbd> CLOSE</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("[data-library-close]").addEventListener("click", () => overlay.classList.remove("active"));
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
          <button type="button" class="hub-write-btn" data-library-new>${archiveMode ? "WRITE ARTICLE" : "WRITE CODEX ARTICLE"}</button>
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
        workingDocument.imageAlt = data.imageAlt || "";
      } else {
        workingDocument.entries = workingDocument.entries.map((entry, index) => ({
          anchor: generatedAnchor(articleNumber, Number(data[`entry-number-${index}`]) || index + 1),
          label: labelForRegulation(Number(data[`entry-number-${index}`]) || index + 1),
          body: data[`entry-body-${index}`] || entry.body || "",
          subClauses: normalizeLineClauses(data[`entry-sub-${index}`] || ""),
          displayOrder: Number(data[`entry-number-${index}`]) || index + 1,
          originalDisplayOrder: Number(entry.originalDisplayOrder || entry.displayOrder) || index + 1
        }));
      }
    }

     function renderForm() {
      title.textContent = archiveMode
        ? `${workingDocument.id ? "EDIT" : "WRITE"} ARCHIVE ARTICLE`
        : `${workingDocument.id ? "EDIT" : "WRITE"} CODEX ARTICLE`;

      if (archiveMode) {
        form.innerHTML = `
          <input type="hidden" name="id" value="${escapeHtml(workingDocument.id || "")}">
          <div class="library-entry-stack">
            <section class="library-entry-editor">
              <div class="library-entry-toolbar">
                <span class="library-entry-title">Archive Article</span>
              </div>
              <div class="resource-editor-field">
                <label>Article Title</label>
                <input name="title" value="${escapeHtml(workingDocument.title || "")}" required>
              </div>
              <div class="resource-editor-field">
                <label>Article Body</label>
                <textarea name="body" required>${escapeHtml(workingDocument.body || "")}</textarea>
              </div>
              <div class="resource-editor-field">
                <label>Image Asset Path</label>
                <input name="imagePath" value="${escapeHtml(workingDocument.imagePath || "")}" placeholder="archives/example.png">
              </div>
              <div class="resource-editor-field">
                <label>Image Alt</label>
                <input name="imageAlt" value="${escapeHtml(workingDocument.imageAlt || "")}">
              </div>
              <div class="resource-editor-field">
                <label>Article Number</label>
                <input type="number" min="1" name="articleNumber" value="${escapeHtml(articleNumberValue(workingDocument))}" required>
              </div>
            </section>
          </div>
          <div class="library-editor-buttons">
            ${workingDocument.id ? `<button type="button" class="library-inline-btn danger" data-library-delete>DELETE ARTICLE</button>` : ""}
          </div>
        `;
        return;
      }

       if (!Array.isArray(workingDocument.entries)) {
        workingDocument.entries = [];
      }

      form.innerHTML = `
        <input type="hidden" name="id" value="${escapeHtml(workingDocument.id || "")}">
        <input type="hidden" name="articleNumber" value="${escapeHtml(articleNumberValue(workingDocument))}">
        <div class="resource-editor-field">
          <label>Article Title</label>
          <input name="title" value="${escapeHtml(workingDocument.title || "")}" required>
        </div>
        <div class="library-entry-stack">
          ${workingDocument.entries.map((entry, index) => formEntryMarkup(entry, index)).join("")}
        </div>
        <div class="library-editor-buttons">
          <button type="button" class="library-inline-btn" data-library-add-entry>ADD REGULATION</button>
          ${workingDocument.id ? `<button type="button" class="library-inline-btn danger" data-library-delete>DELETE ARTICLE</button>` : ""}
        </div>
      `;
    }

    renderForm();
    status.textContent = "";
    overlay.classList.add("active");

    form.onclick = async event => {
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

      const add = event.target.closest("[data-library-add-entry]");
      if (add) {
        syncWorkingDocumentFromForm();
        workingDocument.entries.push({ anchor: "", label: "", body: "", subClauses: [], displayOrder: workingDocument.entries.length + 1 });
        renderForm();
        return;
       }

      const remove = event.target.closest("[data-library-remove-entry]");
      if (remove) {
        if (!window.confirm("Are you sure you want to delete this regulation?")) return;

        syncWorkingDocumentFromForm();
        workingDocument.entries.splice(Number(remove.dataset.libraryRemoveEntry), 1);
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
          imageAlt: data.imageAlt,
          status: "published",
          displayOrder: articleNumber
        } : {
          id: data.id,
          articleNumber: `ARTICLE ${toRoman(articleNumber)}`,
          title: data.title,
          displayOrder: articleNumber,
          entries: workingDocument.entries.map((entry, index) => ({
            anchor: generatedAnchor(articleNumber, Number(data[`entry-number-${index}`]) || index + 1),
            label: labelForRegulation(Number(data[`entry-number-${index}`]) || index + 1),
            body: data[`entry-body-${index}`] || entry.body,
            subClauses: normalizeLineClauses(data[`entry-sub-${index}`] || ""),
            displayOrder: Number(data[`entry-number-${index}`]) || index + 1,
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

  render();

  mount.addEventListener("click", event => {
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
