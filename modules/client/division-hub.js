import { divisionLockedHref, getDivision } from "../data/divisions/index.js";
import { fetchDivisionResources, fetchJsonWithTimeout } from "./resources.js";

const reportViewCache = new Map();
let reportViewBound = false;

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
  if (kind === "activity") return "";

  const value = {
    transmissions: item.publishedAt || item.updatedAt || item.createdAt,
    documents: item.publishedAt || item.updatedAt || item.createdAt,
    reports: item.weekStart || item.reportPeriodStart || item.submittedAt || item.updatedAt || item.createdAt
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
  const value = item?.weekStart || item?.reportPeriodStart || item?.publishedAt || item?.submittedAt || item?.updatedAt || item?.createdAt || 0;
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

function reportTotals(members = []) {
  return members.reduce((totals, member) => ({
    hours: totals.hours + (Number(member.hours) || 0),
    minutes: totals.minutes + (Number(member.minutes) || 0),
    eventsHosted: totals.eventsHosted + (Number(member.eventsHosted) || 0),
    eventsAttended: totals.eventsAttended + (Number(member.eventsAttended) || 0)
  }), { hours: 0, minutes: 0, eventsHosted: 0, eventsAttended: 0 });
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
  return divisionLockedHref(division.id).replace(/\/+$/, "");
}

function resourceLink(item, kind, division) {
  if (kind === "documents") {
    const key = item.slug || item.id || item.storagePath || item.fileName || "";
    return key ? `${divisionBasePath(division)}/handbooks?document=${encodeURIComponent(key)}` : "";
  }

  return item.href || item.signedUrl || "";
}

function rememberReport(item) {
  if (!item?.id || !Array.isArray(item.members)) return "";
  reportViewCache.set(String(item.id), item);
  return String(item.id);
}

function renderRows(items, emptyText, { kind = "", division = null } = {}) {
  if (!items?.length) return `<p class="hub-empty">${escapeHtml(emptyText)}</p>`;

  return `<div class="hub-list">${items.map(item => {
    const href = resourceLink(item, kind, division);
    const isExternal = /^https?:\/\//i.test(href);
    const target = href && isExternal && kind === "activity" ? ' target="_blank" rel="noopener noreferrer"' : "";
    const openLink = href ? `<a class="hub-inline-link" href="${escapeHtml(href)}"${target}>OPEN NODE</a>` : "";
    const reportId = kind === "reports" ? rememberReport(item) : "";
    const viewReport = reportId ? `<button type="button" class="hub-write-btn" data-report-view="${escapeHtml(reportId)}">VIEW REPORT</button>` : "";
    const actions = openLink || viewReport ? `<div class="hub-card-actions">${viewReport}${openLink}</div>` : "";

    return `
    <div class="hub-row">
      <strong>${escapeHtml(item.title || item.label || "Untitled")}</strong>
      ${renderTimestamp(item, kind)}
      <span>${escapeHtml(item.meta || item.value || item.description || item.notes || "")}</span>
      ${actions}
    </div>
  `;
  }).join("")}</div>`;
}

function activityHrefFrom(value) {
  return String(value || "#");
}

function renderActions(items) {
  if (!items?.length) return "";

  return `<div class="hub-list">${items.map(item => {
    const disabled = item.disabled ? " is-disabled" : "";
    const href = item.disabled ? "#" : activityHrefFrom(item.href);

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
        <a class="hub-inline-link" href="${escapeHtml(`${divisionBasePath(division)}/activity`)}">OPEN ACTIVITY</a>
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
        <a class="hub-inline-link" href="${escapeHtml(divisionLockedHref("darkCouncil", "council-floor"))}">OPEN FLOOR</a>
      </div>
      <p class="hub-summary">Propose legislation, motions and councillor elections. Votes are subject to veto.</p>
    </section>
  `;
}

function normalizeWeeklyReport(report, division) {
  const members = Array.isArray(report?.members) ? report.members : [];
  const totals = report?.totals || reportTotals(members);
  const time = normalizeTime(totals.hours, totals.minutes);
  const week = report?.weekStart || report?.updatedAt || report?.createdAt || "Unknown";

  return {
    id: `weekly-${report.id || week}`,
    title: "Weekly Report",
    meta: `Week ${week}`,
    description: `${members.length} member${members.length === 1 ? "" : "s"} / ${time.hours}h ${time.minutes}m / ${Number(totals.eventsHosted || 0)} hosted / ${Number(totals.eventsAttended || 0)} attended`,
    href: `${divisionBasePath(division)}/reports`,
    weekStart: report?.weekStart,
    updatedAt: report?.updatedAt,
    createdAt: report?.createdAt,
    authorName: report?.authorName || "Unknown author",
    members,
    totals
  };
}

function renderHub(division) {
  reportViewCache.clear();
  const transmissions = latestItems(division.transmissions, 3);
  const documents = latestItems(division.documents);
  const reports = latestItems(division.reports, 1);
  const activityTotal = formatDuration(totalRosterMinutes(division.activityMembers || []));
  const pagesPanel = renderPanel("pages", "Pages", renderActions(division.actions));
  const documentsPanel = renderPanel("documents", "Documents", renderRows(documents, "NO DOCUMENTS", { kind: "documents", division }));
  const transmissionsPanel = renderPanel("transmissions", "Transmission Feed", renderFeed(transmissions, "NO TRANSMISSIONS"));
  const activityPanel = renderPanel("activity", "Activity", renderActivityOverview(division));
  const reportsPanel = renderPanel("reports", "Reports", renderRows(reports, "NO REPORTS", { kind: "reports", division }));

  if (division.loadError) {
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
        </div>
        <section class="hub-panel" role="alert">
          <p class="hub-empty">${escapeHtml(division.loadError)}</p>
        </section>
      </section>
    `;
  }

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
  const response = await fetchJsonWithTimeout(`/api/division-roster?division=${encodeURIComponent(division)}`);
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "ROSTER_UNAVAILABLE");
  return payload;
}

async function fetchWeeklyReportPayload(division) {
  try {
    const response = await fetchJsonWithTimeout(`/api/weekly-reports?division=${encodeURIComponent(division)}`);
    const payload = await response.json();
    if (!response.ok || !payload.ok) return { reports: [], canWrite: false };
    return {
      reports: payload.reports || [],
      canWrite: Boolean(payload.canWrite)
    };
  } catch {
    return { reports: [], canWrite: false };
  }
}

async function loadDivisionResourceSets(division) {
  const [transmissions, documents, registryReports, rosterPayload, weeklyPayload] = await Promise.all([
    fetchDivisionResources(division.id, "transmissions"),
    fetchDivisionResources(division.id, "documents"),
    fetchDivisionResources(division.id, "reports"),
    fetchDivisionRosterPayload(division.id).catch(() => ({ members: [] })),
    fetchWeeklyReportPayload(division.id)
  ]);

  const weeklyReports = (weeklyPayload.reports || []).map(report => normalizeWeeklyReport(report, division));

  return {
    ...division,
    transmissions: latestItems(transmissions),
    documents: latestItems(documents),
    reports: latestItems([...weeklyReports, ...registryReports]),
    activityMembers: rosterPayload.members || []
  };
}

function reportMemberIdentity(member) {
  return member.displayName && member.displayName !== member.username
    ? `${member.displayName} (@${member.username})`
    : member.username || member.displayName || member.robloxId || "Unknown";
}

function reportMemberRows(members = []) {
  if (!members.length) {
    return `<tr><td colspan="5">No member rows recorded.</td></tr>`;
  }

  return members.slice().sort((left, right) => (
    Number(right.rank || 0) - Number(left.rank || 0)
    || String(reportMemberIdentity(left)).localeCompare(String(reportMemberIdentity(right)))
  )).map(member => {
    const time = normalizeTime(member.hours, member.minutes);
    return `
      <tr>
        <td><strong>${escapeHtml(reportMemberIdentity(member))}</strong><span>${escapeHtml(member.robloxId || "")}</span></td>
        <td>${escapeHtml(member.role || "Unranked")}</td>
        <td>${escapeHtml(time.hours)}h ${escapeHtml(time.minutes)}m</td>
        <td>${escapeHtml(member.eventsHosted || 0)}</td>
        <td>${escapeHtml(member.eventsAttended || 0)}</td>
      </tr>
    `;
  }).join("");
}

function ensureReportViewOverlay() {
  let overlay = document.getElementById("report-view-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "report-view-overlay";
  overlay.innerHTML = `
    <div class="resource-editor-container library-editor-container" role="dialog" aria-modal="true" aria-labelledby="report-view-title">
      <div class="resource-editor-topbar">
        <span class="resource-editor-title" id="report-view-title">VIEW REPORT</span>
        <button type="button" class="resource-editor-close" data-report-view-close>CLOSE</button>
      </div>
      <div class="report-view-body" data-report-view-body></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-report-view-close]").addEventListener("click", () => overlay.classList.remove("active"));
  overlay.addEventListener("click", event => {
    if (event.target === overlay) overlay.classList.remove("active");
  });
  return overlay;
}

function openReportViewer(report) {
  const overlay = ensureReportViewOverlay();
  const body = overlay.querySelector("[data-report-view-body]");
  const totals = report.totals || reportTotals(report.members || []);
  const time = normalizeTime(totals.hours, totals.minutes);

  body.innerHTML = `
    <div class="overview-total-strip">
      <span>${escapeHtml(report.members?.length || 0)} members</span>
      <span>${escapeHtml(time.hours)}h ${escapeHtml(time.minutes)}m</span>
      <span>${escapeHtml(totals.eventsHosted || 0)} hosted</span>
      <span>${escapeHtml(totals.eventsAttended || 0)} attended</span>
      <span>${escapeHtml(report.authorName || "Unknown author")}</span>
    </div>
    <div class="tracking-table-wrap">
      <table class="tracking-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Rank</th>
            <th>Tracked Time</th>
            <th>Hosted</th>
            <th>Attended</th>
          </tr>
        </thead>
        <tbody>${reportMemberRows(report.members || [])}</tbody>
      </table>
    </div>
  `;

  overlay.classList.add("active");
}

function bindReportViewControls() {
  if (reportViewBound) return;
  reportViewBound = true;
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-report-view]");
    if (!button) return;
    const report = reportViewCache.get(String(button.dataset.reportView || ""));
    if (report) openReportViewer(report);
  });
}

async function initDivisionHub() {
  const mount = document.querySelector("[data-division-hub]");
  if (!mount) return;
  bindReportViewControls();

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
    activityMembers: []
  });

  try {
    const hydratedDivision = await loadDivisionResourceSets(division);
    mount.innerHTML = renderHub(hydratedDivision);
  } catch (error) {
    console.error("Division hub failed to initialize:", error);
    mount.innerHTML = renderHub({
      ...division,
      transmissions: [],
      documents: [],
      reports: [],
      activityMembers: [],
      loadError: `Unable to load ${division.name} command hub: ${String(error?.message || error || "NETWORK_UNAVAILABLE").replace(/_/g, " ")}`
    });
  }
}

window.initHolonetDivisionHub = initDivisionHub;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDivisionHub);
} else {
  initDivisionHub();
}
