function escapeHtml(string) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(string || "").replace(/[&<>"']/g, match => map[match]);
}

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeImage(image = {}) {
  return {
    bucket: text(image.bucket),
    path: text(image.path),
    url: text(image.url)
  };
}

function defaultState(root) {
  try {
    const raw = root?.dataset?.cotsState;
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function normalizeState(value, fallback = {}) {
  const state = typeof value === "object" && value !== null ? value : {};
  const fallbackChampion = typeof fallback.champion === "object" && fallback.champion !== null ? fallback.champion : {};

  return {
    champion: {
      name: text(state.champion?.name, fallbackChampion.name),
      title: text(state.champion?.title, fallbackChampion.title),
      motto: "The Future Belongs to the Bold.",
      season: text(state.champion?.season, fallbackChampion.season),
      podiumImage: normalizeImage(state.champion?.podiumImage || fallbackChampion.podiumImage)
    },
    podium: Array.isArray(state.podium) && state.podium.length ? state.podium : fallback.podium || [
      { place: "I", name: "", note: "Champion" },
      { place: "II", name: "", note: "Finalist" },
      { place: "III", name: "", note: "Podium" }
    ],
    challongeUrl: text(state.challongeUrl, fallback.challongeUrl || ""),
    
    // Archiving previous bracket data to prevent data loss
    bracket: Array.isArray(state.bracket) ? state.bracket : fallback.bracket || [],
    losersBracket: Array.isArray(state.losersBracket) ? state.losersBracket : fallback.losersBracket || [],
    grandFinals: Array.isArray(state.grandFinals) ? state.grandFinals : fallback.grandFinals || []
  };
}

function podiumRow(entry, index) {
  return `
    <div class="cots-podium-row">
      <span>${escapeHtml(entry.place || ["I", "II", "III"][index] || index + 1)}</span>
      <strong>${escapeHtml(entry.name || "Awaiting victor")}</strong>
      <em>${escapeHtml(entry.note || "")}</em>
    </div>
  `;
}

function renderCots(root, state, canEdit, meta = {}) {
  const image = normalizeImage(state.champion.podiumImage);
  root.innerHTML = `
    <section class="cots-hero" aria-labelledby="cots-title">
      <div class="cots-hero-copy">
        <p class="hub-kicker">Current Champion</p>
        <h2 id="cots-title" class="cots-title">${escapeHtml(state.champion.name || "Awaiting Champion")}</h2>
        <p class="cots-quote">&quot;The Future Belongs to the Bold.&quot;</p>
      </div>
      ${canEdit ? '<button type="button" class="resource-editor-open cots-edit-button" data-cots-edit>Edit CoTS</button>' : ""}
    </section>

    <section class="cots-feature-grid" aria-label="Champion imagery and podium">
      <figure class="cots-media-card${image.url ? "" : " cots-media-card--empty"}">
        <div class="cots-media-frame">
          ${image.url
            ? `<img src="${escapeHtml(image.url)}" alt="Champion of The Sith podium">`
            : `<div class="cots-media-placeholder"><span>Podium Image</span></div>`}
        </div>
      </figure>

      <div class="hub-panel cots-podium-panel">
        <h3 class="hub-panel-title">Podium</h3>
        <div class="cots-podium-list">
          ${(state.podium || []).slice(0, 3).map(podiumRow).join("")}
        </div>
      </div>
    </section>

    <section class="hub-panel cots-bracket-panel" aria-label="Tournament bracket" style="padding: 0; overflow: hidden;">
      ${state.challongeUrl 
        ? `<iframe src="${escapeHtml(state.challongeUrl)}" width="100%" height="800" frameborder="0" scrolling="auto" allowtransparency="true" style="border: none; width: 100%; height: 800px; display: block;"></iframe>` 
        : `<p class="hub-empty" style="margin: 20px;">No tournament bracket available.</p>`}
    </section>
  `;
}

function ensureEditorOverlay() {
  let overlay = document.getElementById("cots-editor-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "cots-editor-overlay";
  overlay.innerHTML = `
    <div class="resource-editor-container library-editor-container cots-editor-container" role="dialog" aria-modal="true" aria-labelledby="cots-editor-title">
      <div class="resource-editor-header">
        <h2 class="resource-editor-title" id="cots-editor-title">Edit Champion of the Sith</h2>
        <button type="button" class="resource-editor-close" data-cots-close>Close</button>
      </div>
      <form class="resource-editor-form" id="cots-editor-form"></form>
      <div class="resource-editor-footer">
        <div class="resource-editor-status" aria-live="polite" data-cots-status></div>
        <button type="submit" form="cots-editor-form" class="resource-editor-submit">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener("click", event => {
    if (event.target === overlay || event.target.closest("[data-cots-close]")) {
      overlay.classList.remove("active");
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && overlay.classList.contains("active")) {
      overlay.classList.remove("active");
    }
  });

  return overlay;
}

function syncStateFromForm(form, workingState) {
  const data = Object.fromEntries(new FormData(form).entries());
  
  workingState.champion = {
    ...workingState.champion,
    name: text(data.championName)
  };
  
  workingState.challongeUrl = text(data.challongeUrl);

  workingState.podium = [
    { place: "I", name: text(data.podium0), note: "Champion" },
    { place: "II", name: text(data.podium1), note: "Finalist" },
    { place: "III", name: text(data.podium2), note: "Podium" }
  ];
}

function renderEditorForm(form, state) {
  form.innerHTML = `
    <div class="library-entry-stack">
      <section class="library-entry-editor">
        <div class="library-entry-toolbar"><span class="library-entry-title">Champion Settings</span></div>
        <div class="resource-editor-field"><label>Champion Username</label><input name="championName" value="${escapeHtml(state.champion.name || "")}" required></div>
        <div class="resource-editor-field"><label>Podium Image</label><input type="file" name="podiumImage" accept="image/*"></div>
        <div class="resource-editor-field">
          <label>Challonge Embed URL</label>
          <input name="challongeUrl" value="${escapeHtml(state.challongeUrl || "")}" placeholder="https://challonge.com/hnm2rcj7/module">
          <p style="font-size: 11px; opacity: 0.6; margin-top: 4px;">Paste the direct src URL (e.g. https://challonge.com/hnm2rcj7/module)</p>
        </div>
      </section>

      <section class="library-entry-editor">
        <div class="library-entry-toolbar"><span class="library-entry-title">Podium Winners</span></div>
        <div class="resource-editor-field"><label>1st Place (Champion)</label><input name="podium0" value="${escapeHtml(state.podium?.[0]?.name || "")}"></div>
        <div class="resource-editor-field"><label>2nd Place (Finalist)</label><input name="podium1" value="${escapeHtml(state.podium?.[1]?.name || "")}"></div>
        <div class="resource-editor-field"><label>3rd Place (Podium)</label><input name="podium2" value="${escapeHtml(state.podium?.[2]?.name || "")}"></div>
      </section>
    </div>
  `;
}

async function saveCotsState(state, form) {
  const body = new FormData();
  body.set("payload", JSON.stringify(state));

  const image = form.podiumImage?.files?.[0];
  if (image) body.set("podiumImage", image);

  const response = await fetch("/api/cots", {
    method: "POST",
    body
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.reason || payload.error || "SAVE_FAILED");
  }
  return payload;
}

async function initCots() {
  const root = document.querySelector("[data-cots-root]");
  if (!root || root.dataset.cotsBound === "true") return;
  root.dataset.cotsBound = "true";

  const fallback = normalizeState(defaultState(root), { champion: {}, podium: [], challongeUrl: "", bracket: [] });
  let state = fallback;
  let canEdit = false;
  let meta = {};

  renderCots(root, state, canEdit, meta);

  try {
    const response = await fetch("/api/cots", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok && payload.ok) {
      state = normalizeState(payload.state, fallback);
      canEdit = Boolean(payload.canEdit);
      meta = { migrationRequired: Boolean(payload.migrationRequired) };
      renderCots(root, state, canEdit, meta);
    }
  } catch (error) {
    console.warn("CoTS payload unavailable:", error);
  }

  root.addEventListener("click", event => {
    if (!event.target.closest("[data-cots-edit]")) return;

    const overlay = ensureEditorOverlay();
    const form = overlay.querySelector("#cots-editor-form");
    const status = overlay.querySelector("[data-cots-status]");
    const workingState = normalizeState(JSON.parse(JSON.stringify(state)), fallback);

    renderEditorForm(form, workingState);
    status.textContent = meta.migrationRequired ? "Migration required before saving" : "";
    overlay.classList.add("active");

    form.onsubmit = async event => {
      event.preventDefault();
      syncStateFromForm(form, workingState);
      status.textContent = "Saving...";

      try {
        const payload = await saveCotsState(workingState, form);
        state = normalizeState(payload.state, fallback);
        meta = { migrationRequired: false };
        renderCots(root, state, canEdit, meta);
        status.textContent = "Saved";
        setTimeout(() => overlay.classList.remove("active"), 250);
      } catch (error) {
        status.textContent = error.message.replace(/_/g, " ");
      }
    };
  });
}

window.initHolonetCots = initCots;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCots);
} else {
  initCots();
}
