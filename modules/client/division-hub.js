import { getDivision } from "../data/divisions/index.js";
import { fetchDivisionResources } from "./resources.js";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function timestampFor(item, kind) {
  if (kind === "trackers") return "";

  const value = {
    transmissions: item.publishedAt || item.updatedAt || item.createdAt,
    documents: item.publishedAt || item.updatedAt || item.createdAt,
    reports: item.submittedAt || item.updatedAt || item.createdAt
  }[kind];

  if (!value) return "";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderTimestamp(item, kind) {
  const timestamp = timestampFor(item, kind);
  return timestamp ? `<span class="hub-timestamp">${escapeHtml(timestamp)}</span>` : "";
}

function renderFeed(items, emptyText) {
  if (!items?.length) return `<p class="hub-empty">${escapeHtml(emptyText)}</p>`;

  return `<div class="hub-feed">${items.map(item => `
    <article class="hub-feed-item">
      <span class="hub-meta">${escapeHtml(item.scope || item.meta || item.author || "Transmission")}</span>
      <strong>${escapeHtml(item.title)}</strong>
      ${renderTimestamp(item, "transmissions")}
      <span>${escapeHtml(item.body || item.summary || item.value || item.description || "")}</span>
    </article>
  `).join("")}</div>`;
}

function divisionBasePath(division) {
  return (division.href || `/${division.id}/home`).replace(/\/home(?:\.html)?$/, "");
}

function resourceLink(item, kind, division) {
  if (kind === "documents") {
    const key = item.slug || item.id || item.storagePath || item.fileName || "";
    return key ? `${divisionBasePath(division)}/handbooks?document=${encodeURIComponent(key)}` : "";
  }

  return item.href || item.signedUrl || "";
}

function renderRows(items, emptyText, { kind = "", division = null } = {}) {
  if (!items?.length) return `<p class="hub-empty">${escapeHtml(emptyText)}</p>`;

  return `<div class="hub-list">${items.map(item => {
    const href = resourceLink(item, kind, division);
    const isExternal = /^https?:\/\//i.test(href);
    const target = href && isExternal && kind === "trackers" ? ' target="_blank" rel="noopener noreferrer"' : "";
    const openLink = href ? `<a class="hub-inline-link" href="${escapeHtml(href)}"${target}>OPEN NODE</a>` : "";

    return `
    <div class="hub-row">
      <strong>${escapeHtml(item.title || item.label)}</strong>
      ${renderTimestamp(item, kind)}
      <span>${escapeHtml(item.meta || item.value || item.description || item.notes || "")}</span>
      ${openLink}
    </div>
  `;
  }).join("")}</div>`;
}

function renderActions(items) {
  if (!items?.length) return `<p class="hub-empty">No provisions</p>`;

  return `<div class="hub-list">${items.map(item => {
    const disabled = item.disabled ? " is-disabled" : "";
    const href = item.disabled ? "#" : item.href;

    return `
      <a class="hub-action${disabled}" href="${escapeHtml(href)}" aria-disabled="${item.disabled ? "true" : "false"}">
        <strong>${escapeHtml(item.label)}</strong>
        <span class="hub-action-meta">Minimum: ${escapeHtml(item.minimumTier || "member")}</span>
      </a>
    `;
  }).join("")}</div>`;
}

function renderCouncilFloorCard(division) {
  if (division.id !== "darkCouncil") return "";

  return `
    <section class="hub-panel council-floor-card">
      <div class="hub-identity">
        <div>
          <h3 class="hub-panel-title">Council Floor</h3>
        </div>
        <a class="hub-inline-link" href="/dark-council/council-floor">OPEN FLOOR</a>
      </div>
      <p class="hub-summary">Propose legislation, motions and councillor elections. Votes are subject to veto.</p>
    </section>
  `;
}

function renderHub(division) {
  return `
    <section class="hub-shell" aria-label="${escapeHtml(division.name)} command hub">
      <div class="hub-hero">
        <div class="hub-identity">
          <div>
            <span class="hub-kicker">Registry Node / ${escapeHtml(division.node)}</span>
            <h2 class="hub-title">${escapeHtml(division.name)}</h2>
          </div>
          <div>
            <span class="hub-kicker">Status</span>
            <span class="hub-value">${escapeHtml(division.status)}</span>
          </div>
        </div>
        <p class="hub-summary">${escapeHtml(division.description)}</p>
        <div class="hub-status-grid">
          <div class="hub-status-cell">
            <span class="hub-label">Transmissions</span>
            <span class="hub-value">${division.transmissions?.length || 0}</span>
          </div>
          <div class="hub-status-cell">
            <span class="hub-label">Documents</span>
            <span class="hub-value">${division.documents?.length || 0}</span>
          </div>
          <div class="hub-status-cell">
            <span class="hub-label">Trackers</span>
            <span class="hub-value">${division.trackers?.length || 0}</span>
          </div>
        </div>
      </div>

      ${renderCouncilFloorCard(division)}

      <div class="hub-grid">
        <div class="hub-column">
          <section class="hub-panel">
            <h3 class="hub-panel-title">Transmission Feed</h3>
            ${renderFeed(division.transmissions, "No transmissions")}
          </section>

          <section class="hub-panel">
            <h3 class="hub-panel-title">Documents</h3>
            ${renderRows(division.documents, "No documents", { kind: "documents", division })}
          </section>
        </div>

        <aside class="hub-column">
          <section class="hub-panel">
            <h3 class="hub-panel-title">Reports</h3>
            ${renderRows(division.reports, "No reports", { kind: "reports", division })}
          </section>

          <section class="hub-panel">
            <h3 class="hub-panel-title">Trackers</h3>
            ${renderRows(division.trackers, "No trackers", { kind: "trackers", division })}
          </section>

          <section class="hub-panel">
            <h3 class="hub-panel-title">Pages</h3>
            ${renderActions(division.actions)}
          </section>
        </aside>
      </div>
    </section>
  `;
}

async function loadDivisionResourceSets(division) {
  const [transmissions, documents, reports, trackers] = await Promise.all([
    fetchDivisionResources(division.id, "transmissions"),
    fetchDivisionResources(division.id, "documents"),
    fetchDivisionResources(division.id, "reports"),
    fetchDivisionResources(division.id, "trackers")
  ]);

  return {
    ...division,
    transmissions,
    documents: documents.slice().reverse(),
    reports,
    trackers
  };
}

async function initDivisionHub() {
  const mount = document.querySelector("[data-division-hub]");
  if (!mount) return;

  const divisionId = mount.dataset.divisionHub;
  const division = getDivision(divisionId);

  if (!division) {
    mount.innerHTML = '<p class="hub-empty">Division configuration unavailable</p>';
    return;
  }

  document.body.classList.add(division.theme);
  document.querySelector("[data-division-title]")?.replaceChildren(document.createTextNode(division.name));
  document.querySelector("[data-division-subtitle]")?.replaceChildren(document.createTextNode(division.subtitle));
  document.querySelector("[data-division-node]")?.replaceChildren(document.createTextNode(division.node));
  mount.innerHTML = renderHub({
    ...division,
    transmissions: [],
    documents: [],
    reports: [],
    trackers: []
  });

  const hydratedDivision = await loadDivisionResourceSets(division);
  mount.innerHTML = renderHub(hydratedDivision);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDivisionHub);
} else {
  initDivisionHub();
}
