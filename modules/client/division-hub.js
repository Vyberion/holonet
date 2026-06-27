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
  if (kind === "activity" || kind === "trackers") return "";

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

function itemTime(item) {
  const value = item?.publishedAt || item?.submittedAt || item?.updatedAt || item?.createdAt || 0;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function latestItems(items = [], limit = Number.POSITIVE_INFINITY) {
  return (items || [])
    .slice()
    .sort((left, right) => itemTime(right) - itemTime(left))
    .slice(0, limit);
}

function normalizeTime(hours = 0, minutes = 0) {
  const totalMinutes = Math.max(0, Math.floor(Number(hours) || 0) * 60 + Math.floor(Number(minutes) || 0));
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60
  };
}

function formatDuration(totalMinutes = 0) {
  const time = normalizeTime(0, totalMinutes);
  return `${time.hours}h ${time.minutes}m`;
}

function totalRosterMinutes(members = []) {
  return members.reduce((total, member) => {
    const minutes = Number(member.minutes ?? member.totalMinutes ?? 0) || 0;
    const hours = Number(member.hours ?? member.totalHours ?? 0) || 0;
    return total + (hours * 60) + minutes;
  }, 0);
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
    const target = href && isExternal && kind === "activity" ? ' target="_blank" rel="noopener noreferrer"' : "";
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
  if (!items?.length) return "";

  return `<div class="hub-list">${items.map(item => {
    const disabled = item.disabled ? " is-disabled" : "";
    const href = item.disabled ? "#" : item.href;

    return `
      <a class="hub-action${disabled}" href="${escapeHtml(href)}" aria-disabled="${item.disabled ? "true" : "false"}">
        <strong>${escapeHtml(item.label)}</strong>
      </a>
    `;
  }).join("")}</div>`;
}

function renderPanel(card, title, content) {
  if (!content) return "";

  return `
    <section class="hub-panel" data-hub-card="${escapeHtml(card)}">
      <h3 class="hub-panel-title">${escapeHtml(title)}</h3>
      ${content}
    </section>
  `;
}

function renderActivityOverview(division) {
  const members = Array.isArray(division.activityMembers) ? division.activityMembers : [];
  const totalMinutes = totalRosterMinutes(members);

  return `
    <div class="hub-list">
      <div class="hub-row">
        <strong>Weekly Activity</strong>
        <span>Total time across ${escapeHtml(members.length)} member${members.length === 1 ? "" : "s"}</span>
        <p>${escapeHtml(formatDuration(totalMinutes))} recorded this week</p>
        <a class="hub-inline-link" href="${escapeHtml(`${divisionBasePath(division)}/trackers`)}">OPEN ACTIVITY</a>
      </div>
    </div>
  `;
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
  const transmissions = latestItems(division.transmissions, 3);
  const documents = latestItems(division.documents);
  const reports = latestItems(division.reports, 1);
  const activityTotal = formatDuration(totalRosterMinutes(division.activityMembers || []));
  const pagesPanel = renderPanel("pages", "Pages", renderActions(division.actions));
  const documentsPanel = documents.length
    ? renderPanel("documents", "Documents", renderRows(documents, "No documents", { kind: "documents", division }))
    : "";
  const transmissionsPanel = transmissions.length
    ? renderPanel("transmissions", "Transmission Feed", renderFeed(transmissions, "No transmissions"))
    : "";
  const activityPanel = renderPanel("activity", "Activity", renderActivityOverview(division));
  const reportsPanel = reports.length
    ? renderPanel("reports", "Reports", renderRows(reports, "No reports", { kind: "reports", division }))
    : "";

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
            <span class="hub-value">ACTIVE</span>
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
            <span class="hub-label">Activity</span>
            <span class="hub-value">${escapeHtml(activityTotal)}</span>
          </div>
        </div>
      </div>

      ${renderCouncilFloorCard(division)}

      <div class="hub-grid">
        <div class="hub-column">
          ${documentsPanel}
          ${transmissionsPanel}
        </div>

        <aside class="hub-column">
          ${pagesPanel}
          ${activityPanel}
          ${reportsPanel}
        </aside>
      </div>
    </section>
  `;
}

async function fetchDivisionRosterPayload(division) {
  const response = await fetch(`/api/division-roster?division=${encodeURIComponent(division)}`);
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "ROSTER_UNAVAILABLE");
  return payload;
}

async function loadDivisionResourceSets(division) {
  const [transmissions, documents, reports, trackers, rosterPayload] = await Promise.all([
    fetchDivisionResources(division.id, "transmissions"),
    fetchDivisionResources(division.id, "documents"),
    fetchDivisionResources(division.id, "reports"),
    fetchDivisionResources(division.id, "trackers"),
    fetchDivisionRosterPayload(division.id).catch(() => ({ members: [] }))
  ]);

  return {
    ...division,
    transmissions: latestItems(transmissions),
    documents: latestItems(documents),
    reports: latestItems(reports),
    trackers,
    activityMembers: rosterPayload.members || []
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
    trackers: [],
    activityMembers: []
  });

  const hydratedDivision = await loadDivisionResourceSets(division);
  mount.innerHTML = renderHub(hydratedDivision);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDivisionHub);
} else {
  initDivisionHub();
}
