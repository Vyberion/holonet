function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function textBlocks(value) {
  return String(value || "")
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => `<p class="reg-text">${escapeHtml(part).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

async function fetchTimeline() {
  const response = await fetch("/api/group-timeline");
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "TIMELINE_UNAVAILABLE");
  return payload;
}

async function saveTimelineEntry(data) {
  const response = await fetch("/api/group-timeline", {
    method: data.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "SAVE_FAILED");
  return payload;
}

async function deleteTimelineEntry(id) {
  const response = await fetch(`/api/group-timeline?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "DELETE_FAILED");
  return payload;
}

function renderEntry(entry, canEdit, index) {
  const date = entry.dateLabel || [entry.startDate, entry.endDate].filter(Boolean).join(" - ") || "Undated";
  return `
    <article class="timeline-entry" data-timeline-index="${index}">
      <div class="timeline-marker"></div>
      <div class="timeline-card">
        <div class="timeline-head">
          <div>
            <span class="hub-kicker">${escapeHtml(entry.category || "major_event")} / ${escapeHtml(date)}</span>
            <h2 class="article-title">${escapeHtml(entry.title)}</h2>
          </div>
          ${canEdit ? `<button type="button" class="hub-write-btn" data-timeline-edit="${index}">EDIT</button>` : ""}
        </div>
        ${entry.imageUrl ? `<figure class="archive-image"><img src="${escapeHtml(entry.imageUrl)}" alt="${escapeHtml(entry.imageAlt || entry.title)}" loading="lazy"></figure>` : ""}
        <div class="timeline-body">${textBlocks(entry.body)}</div>
      </div>
    </article>
  `;
}

function ensureTimelineOverlay() {
  let overlay = document.getElementById("timeline-editor-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "timeline-editor-overlay";
  overlay.innerHTML = `
    <div class="resource-editor-container library-editor-container" role="dialog" aria-modal="true" aria-labelledby="timeline-editor-title">
      <div class="resource-editor-topbar">
        <span class="resource-editor-title" id="timeline-editor-title">WRITE TIMELINE ENTRY</span>
        <button type="button" class="resource-editor-close" data-timeline-close>CLOSE</button>
      </div>
      <form class="resource-editor-form" id="timeline-editor-form"></form>
      <div class="resource-editor-actions">
        <span class="resource-editor-status" data-timeline-status></span>
        <button type="submit" class="resource-editor-submit" form="timeline-editor-form">SAVE</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-timeline-close]").addEventListener("click", () => overlay.classList.remove("active"));
  overlay.addEventListener("click", event => {
    if (event.target === overlay) overlay.classList.remove("active");
  });
  return overlay;
}

function formMarkup(entry = {}) {
  return `
    <input type="hidden" name="id" value="${escapeHtml(entry.id || "")}">
    <div class="resource-editor-field"><label>Title</label><input name="title" value="${escapeHtml(entry.title || "")}" required></div>
    <div class="resource-editor-field">
      <label>Category</label>
      <select name="category">
        ${["owner", "era", "emperor", "map", "major_event", "reform"].map(category =>
          `<option value="${category}" ${entry.category === category ? "selected" : ""}>${category.replace("_", " ")}</option>`
        ).join("")}
      </select>
    </div>
    <div class="resource-editor-field"><label>Date Label</label><input name="dateLabel" value="${escapeHtml(entry.dateLabel || "")}"></div>
    <div class="resource-editor-field"><label>Start Date</label><input type="date" name="startDate" value="${escapeHtml(entry.startDate || "")}"></div>
    <div class="resource-editor-field"><label>End Date</label><input type="date" name="endDate" value="${escapeHtml(entry.endDate || "")}"></div>
    <div class="resource-editor-field"><label>Body</label><textarea name="body" required>${escapeHtml(entry.body || "")}</textarea></div>
    <div class="resource-editor-field"><label>Image Path</label><input name="imagePath" value="${escapeHtml(entry.imagePath || "")}"></div>
    <div class="resource-editor-field"><label>Image Alt</label><input name="imageAlt" value="${escapeHtml(entry.imageAlt || "")}"></div>
    <div class="resource-editor-field">
      <label>Status</label>
      <select name="status">
        <option value="published" ${entry.status === "published" ? "selected" : ""}>Published</option>
        <option value="draft" ${entry.status === "draft" ? "selected" : ""}>Draft</option>
        <option value="archived" ${entry.status === "archived" ? "selected" : ""}>Archived</option>
      </select>
    </div>
    <div class="resource-editor-field"><label>Display Order</label><input type="number" name="displayOrder" value="${escapeHtml(entry.displayOrder || 0)}"></div>
    ${entry.id ? `<button type="button" class="library-inline-btn danger" data-timeline-delete>DELETE ENTRY</button>` : ""}
  `;
}

function renderTimeline(mount, payload) {
  mount.innerHTML = `
    <section class="timeline-shell">
      <div class="hub-hero">
        <div class="hub-identity">
          <div>
            <span class="hub-kicker">Archives / Group Record</span>
            <h2 class="hub-title">Group Timeline</h2>
          </div>
          <div class="hub-identity-aside">
            <a class="hub-inline-link" href="/archives">LORE ARCHIVES</a>
            ${payload.canEdit ? `<button type="button" class="hub-write-btn" data-timeline-new>WRITE ENTRY</button>` : ""}
          </div>
        </div>
        <p class="hub-summary">Owners, eras, emperors, maps, reforms and major events.</p>
      </div>
      ${payload.migrationRequired ? `<p class="hub-empty">Timeline database table has not been installed.</p>` : ""}
      <div class="timeline-list">
        ${(payload.entries || []).length
          ? payload.entries.map((entry, index) => renderEntry(entry, payload.canEdit, index)).join("")
          : `<p class="hub-empty">No timeline entries recorded.</p>`}
      </div>
    </section>
  `;
}

async function initGroupTimeline() {
  const mount = document.querySelector("[data-group-timeline]");
  if (!mount || mount.dataset.timelineBound === "true") return;
  mount.dataset.timelineBound = "true";
  let payload = { entries: [], canEdit: false };

  async function hydrate() {
    try {
      payload = await fetchTimeline();
      renderTimeline(mount, payload);
    } catch (error) {
      mount.innerHTML = `<p class="hub-empty">${escapeHtml(error.message.replace(/_/g, " "))}</p>`;
    }
  }

  function openEditor(entry = {}) {
    const overlay = ensureTimelineOverlay();
    const form = overlay.querySelector("#timeline-editor-form");
    const status = overlay.querySelector("[data-timeline-status]");
    form.innerHTML = formMarkup(entry);
    status.textContent = "";
    form.onsubmit = async event => {
      event.preventDefault();
      status.textContent = "Saving...";
      try {
        await saveTimelineEntry(Object.fromEntries(new FormData(form).entries()));
        overlay.classList.remove("active");
        await hydrate();
      } catch (error) {
        status.textContent = error.message.replace(/_/g, " ");
      }
    };
    form.onclick = async event => {
      if (event.target.closest("[data-timeline-delete]") && entry.id) {
        status.textContent = "Deleting...";
        try {
          await deleteTimelineEntry(entry.id);
          overlay.classList.remove("active");
          await hydrate();
        } catch (error) {
          status.textContent = error.message.replace(/_/g, " ");
        }
      }
    };
    overlay.classList.add("active");
  }

  mount.addEventListener("click", event => {
    if (event.target.closest("[data-timeline-new]")) {
      openEditor({});
      return;
    }
    const edit = event.target.closest("[data-timeline-edit]");
    if (edit) {
      openEditor(payload.entries[Number(edit.dataset.timelineEdit)] || {});
    }
  });

  await hydrate();
}

window.initHolonetGroupTimeline = initGroupTimeline;

if (document.readyState === "loading") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGroupTimeline);
  } else {
    initGroupTimeline();
  }
} else {
  initGroupTimeline();
}
