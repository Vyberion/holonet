function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatSignal(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "SIGNAL UNKNOWN";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function excerpt(value, length = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

async function fetchBoard() {
  const response = await fetch("/api/board");
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "BOARD_UNAVAILABLE");
  return payload;
}

async function saveBoardTransmission(data) {
  const response = await fetch("/api/board", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "BROADCAST_FAILED");
  return payload;
}

function channelLabel(channel) {
  return {
    holonet: "Holonet",
    reavers: "Reavers",
    dhg: "Dark Honor Guard",
    inquisitors: "Inquisitors",
    dreadmasters: "Dread Masters",
    highranks: "High Ranks",
    darkCouncil: "Dark Council"
  }[channel] || channel;
}

function ensureBoardOverlay(channels = []) {
  let overlay = document.getElementById("board-editor-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "board-editor-overlay";
  overlay.innerHTML = `
    <div class="resource-editor-container library-editor-container" role="dialog" aria-modal="true" aria-labelledby="board-editor-title">
      <div class="resource-editor-topbar">
        <span class="resource-editor-title" id="board-editor-title">BROADCAST TRANSMISSION</span>
        <button type="button" class="resource-editor-close" data-board-close>CLOSE</button>
      </div>
      <form class="resource-editor-form" id="board-editor-form">
        <div class="resource-editor-field">
          <label>Channel</label>
          <select name="channel" data-board-channel-select>
            ${channels.map(channel => `<option value="${escapeHtml(channel)}">${escapeHtml(channelLabel(channel))}</option>`).join("")}
          </select>
        </div>
        <div class="resource-editor-field">
          <label>Title</label>
          <input name="title" required>
        </div>
        <div class="resource-editor-field">
          <label>Body</label>
          <textarea name="body" required></textarea>
        </div>
        <div class="resource-editor-field">
          <label>Image Path</label>
          <input name="imagePath">
        </div>
      </form>
      <div class="resource-editor-actions">
        <span class="resource-editor-status" data-board-status></span>
        <button type="submit" class="resource-editor-submit" form="board-editor-form">TRANSMIT</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-board-close]").addEventListener("click", () => overlay.classList.remove("active"));
  overlay.addEventListener("click", event => {
    if (event.target === overlay) overlay.classList.remove("active");
  });
  return overlay;
}

function renderTransmissionCard(item, featured = false) {
  return `
    <article class="${featured ? "board-feature" : "board-feed-card"}" data-board-channel="${escapeHtml(item.channel || "holonet")}">
      <div class="board-card-top">
        <span class="hub-kicker">${escapeHtml(item.channel || "holonet")} / ${escapeHtml(formatSignal(item.signal))}</span>
        <span class="board-status">RECEIVED</span>
      </div>
      <h3 class="${featured ? "board-feature-title" : "board-feed-title"}">${escapeHtml(item.title || "Untitled Transmission")}</h3>
      <p>${escapeHtml(excerpt(item.body || item.description || "", featured ? 420 : 170))}</p>
      ${item.imageUrl ? `<img class="board-image" src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy">` : ""}
      <div class="board-card-footer">
        <span>${escapeHtml(item.author || "Holonet Relay")}</span>
        <span>${escapeHtml(item.visibility || "public")}</span>
      </div>
    </article>
  `;
}

function renderBoard(mount, payload) {
  const transmissions = payload.transmissions || [];
  const featured = transmissions[0] || null;
  const feed = transmissions.slice(featured ? 1 : 0);
  const channels = Array.from(new Set([...(payload.channels || []), ...transmissions.map(item => item.channel || "holonet")]));

  mount.innerHTML = `
    <section class="board-shell">
      <div class="board-hero">
        <div class="hub-identity">
          <div>
            <span class="hub-kicker">Public Broadcast / Open Channel</span>
            <h2 class="hub-title">Transmission Board</h2>
          </div>
          <div class="hub-identity-aside">
            <div class="board-signal-stack">
              <span class="hub-label">Signal Integrity</span>
              <strong>${transmissions.length ? "ACTIVE" : "QUIET"}</strong>
            </div>
            ${payload.canWrite ? `<button type="button" class="hub-write-btn" data-board-write>WRITE BROADCAST</button>` : ""}
          </div>
        </div>
        <p class="hub-summary">Public Sith Order transmissions, announcements and broadcast fragments relayed through the Holonet.</p>
      </div>

      <div class="board-console">
        <aside class="board-filter-panel">
          <span class="hub-kicker">Channels</span>
          <button type="button" class="board-filter is-active" data-board-filter="all">ALL SIGNALS</button>
          ${channels.map(channel => `<button type="button" class="board-filter" data-board-filter="${escapeHtml(channel)}">${escapeHtml(channelLabel(channel))}</button>`).join("")}
        </aside>

        <div class="board-main-feed">
          ${featured ? renderTransmissionCard(featured, true) : `<p class="hub-empty">No public transmissions are currently broadcasting.</p>`}
          <div class="board-feed-grid">
            ${feed.map(item => renderTransmissionCard(item)).join("")}
          </div>
        </div>
      </div>
    </section>
  `;
}

async function initBoard() {
  const mount = document.querySelector("[data-board-terminal]");
  if (!mount || mount.dataset.boardBound === "true") return;
  mount.dataset.boardBound = "true";

  let latestPayload = null;

  async function hydrate() {
    latestPayload = await fetchBoard();
    renderBoard(mount, latestPayload);
  }

  try {
    await hydrate();
  } catch (error) {
    mount.innerHTML = `<p class="hub-empty">${escapeHtml(error.message.replace(/_/g, " "))}</p>`;
  }

  mount.addEventListener("click", event => {
    const writeButton = event.target.closest("[data-board-write]");
    if (writeButton) {
      const overlay = ensureBoardOverlay(latestPayload?.channels || []);
      const form = overlay.querySelector("#board-editor-form");
      const channelSelect = overlay.querySelector("[data-board-channel-select]");
      const status = overlay.querySelector("[data-board-status]");
      channelSelect.innerHTML = (latestPayload?.channels || []).map(channel => `<option value="${escapeHtml(channel)}">${escapeHtml(channelLabel(channel))}</option>`).join("");
      form.reset();
      status.textContent = "";
      form.onsubmit = async submitEvent => {
        submitEvent.preventDefault();
        status.textContent = "Transmitting...";
        try {
          const payload = await saveBoardTransmission(Object.fromEntries(new FormData(form).entries()));
          latestPayload = {
            ...latestPayload,
            transmissions: payload.transmissions || latestPayload?.transmissions || []
          };
          overlay.classList.remove("active");
          renderBoard(mount, latestPayload);
        } catch (error) {
          status.textContent = error.message.replace(/_/g, " ");
        }
      };
      overlay.classList.add("active");
      form.querySelector("input, textarea, select")?.focus();
      return;
    }

    const filter = event.target.closest("[data-board-filter]");
    if (!filter) return;

    const channel = filter.dataset.boardFilter;
    mount.querySelectorAll("[data-board-filter]").forEach(button => button.classList.toggle("is-active", button === filter));
    mount.querySelectorAll("[data-board-channel]").forEach(card => {
      card.hidden = channel !== "all" && card.dataset.boardChannel !== channel;
    });
  });
}

window.initHolonetBoard = initBoard;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBoard);
} else {
  initBoard();
}
