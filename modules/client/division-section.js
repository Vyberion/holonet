import { getDivision } from "../data/divisions/index.js";
import { deleteDivisionResource, fetchDivisionResourcePayload, fetchJsonWithTimeout, saveDivisionResource } from "./resources.js";

let activeEntries = [];
let activeContext = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function normalizeTime(hours = 0, minutes = 0) {
  const totalMinutes = Math.max(0, Math.floor(Number(hours) || 0) * 60 + Math.floor(Number(minutes) || 0));
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60
  };
}

function reportTotals(members = []) {
  return members.reduce((totals, member) => ({
    hours: totals.hours + (Number(member.hours) || 0),
    minutes: totals.minutes + (Number(member.minutes) || 0),
    eventsHosted: totals.eventsHosted + (Number(member.eventsHosted) || 0),
    eventsAttended: totals.eventsAttended + (Number(member.eventsAttended) || 0)
  }), { hours: 0, minutes: 0, eventsHosted: 0, eventsAttended: 0 });
}

function timestampFor(entry, section) {
  if (section === "activity") return "";

  const value = {
    transmissions: entry.publishedAt || entry.updatedAt || entry.createdAt,
    reports: entry.submittedAt || entry.updatedAt || entry.createdAt
  }[section];

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

function renderTimestamp(entry, section) {
  const timestamp = timestampFor(entry, section);
  return timestamp ? `<span class="hub-timestamp">${escapeHtml(timestamp)}</span>` : "";
}

async function fetchWeeklyReportPayload(division, draft = false) {
  const response = await fetchJsonWithTimeout(`/api/weekly-reports?division=${encodeURIComponent(division)}${draft ? "&draft=1" : ""}`);
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "REPORTS_UNAVAILABLE");
  return payload;
}

async function saveWeeklyReport(data) {
  const response = await fetch("/api/weekly-reports", {
    method: data.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "SAVE_FAILED");
  return payload;
}

async function fetchDivisionRosterPayload(division) {
  const response = await fetchJsonWithTimeout(`/api/division-roster?division=${encodeURIComponent(division)}`);
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "ROSTER_UNAVAILABLE");
  return payload;
}

function divisionSectionName(division = {}) {
  return {
    reavers: "Reaver",
    dhg: "Dark Honor Guard",
    inquisitors: "Inquisitor",
    dreadmasters: "Dread Master",
    highranks: "High Rank",
    darkCouncil: "Dark Council"
  }[division.id] || division.shortName || division.name || "Division";
}

function titleForSection(section, division = null) {
  const baseTitle = {
    transmissions: "Transmissions",
    reports: "Reports",
    activity: "Activity"
  }[section] || "Division";

  return division ? `${divisionSectionName(division)} ${baseTitle}` : baseTitle;
}

function descriptionForSection(division, section) {
  const divisionName = divisionSectionName(division);
  return {
    transmissions: `Official announcements for ${divisionName}.`,
    reports: `Weekly activity reports for ${divisionName}.`,
    activity: `Current activity records for ${divisionName}.`
  }[section] || "";
}

function emptyForSection(section) {
  return {
    transmissions: "No transmissions connected",
    reports: "No report feed connected",
    activity: "No activity connected"
  }[section] || "No entries connected";
}

function renderEntries(section, entries) {
  if (!entries?.length) return `<p class="hub-empty">${emptyForSection(section)}</p>`;

  return `<div class="hub-list">${entries.map((entry, index) => {
    const label = entry.title || entry.label || "Untitled entry";
    const meta = entry.meta || entry.scope || entry.author || entry.value || "Pending";
    const body = entry.body || entry.summary || entry.description || "";
    const href = entry.href && entry.href !== "#" ? entry.href : "";
    const isActivity = section === "activity";
    const target = href && isActivity ? ' target="_blank" rel="noopener noreferrer"' : "";
    const editButton = activeContext?.canWrite
      ? `<div class="hub-row-tools"><button type="button" class="hub-row-edit" data-resource-edit="${index}">EDIT</button></div>`
      : "";

    return `
      <article class="hub-row hub-section-row">
        <strong>${escapeHtml(label)}</strong>
        ${renderTimestamp(entry, section)}
        <span>${escapeHtml(meta)}</span>
        ${body ? `<p>${escapeHtml(body)}</p>` : ""}
        ${href ? `<a class="hub-inline-link" href="${escapeHtml(href)}"${target}>OPEN NODE</a>` : ""}
        ${editButton}
      </article>
    `;
  }).join("")}</div>`;
}

function renderWeeklyReports(entries) {
  if (!entries?.length) return `<p class="hub-empty">No weekly reports connected</p>`;

  return `<div class="hub-list">${entries.map((entry, index) => {
    const totals = entry.totals || {};
    const totalTime = normalizeTime(totals.hours, totals.minutes);
    const memberCount = Array.isArray(entry.members) ? entry.members.length : 0;
    return `
      <article class="hub-row hub-section-row">
        <strong>${escapeHtml(entry.divisionKey || activeContext?.division?.shortName || "Division")} Weekly Report</strong>
        <span class="hub-timestamp">Week: ${escapeHtml(entry.weekStart || "Unknown")}</span>
        <span>${escapeHtml(entry.authorName || "Unknown author")}</span>
        <p>${memberCount} members / ${Number(totalTime.hours || 0)}h ${Number(totalTime.minutes || 0)}m / ${Number(totals.eventsHosted || 0)} hosted / ${Number(totals.eventsAttended || 0)} attended</p>
        <div class="hub-row-tools">
          <button type="button" class="hub-write-btn" data-weekly-report-view="${index}">VIEW REPORT</button>
          ${activeContext?.canWrite ? `<button type="button" class="hub-row-edit" data-weekly-report-edit="${index}">EDIT</button>` : ""}
        </div>
      </article>
    `;
  }).join("")}</div>`;
}

function renderActivityRoster(members) {
  if (!members?.length) return '<p class="hub-empty">No current division members found</p>';
  const visibleMembers = activeContext?.division?.id === "darkCouncil"
    ? members.filter(member => !/\b(project\s*manager|group\s*owner|owner|manager)\b/i.test(String(member.role || "")))
    : members;

  return `
    <div class="tracking-table-wrap">
      <table class="tracking-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Rank</th>
            <th>Tracked Time</th>
          </tr>
        </thead>
        <tbody>
          ${visibleMembers.map(member => {
            const time = normalizeTime(member.hours, member.minutes);
            const identity = member.displayName && member.displayName !== member.username
              ? `${member.displayName} (@${member.username})`
              : member.username || member.displayName || member.robloxId;
            return `
              <tr>
                <td>
                  <strong>${escapeHtml(identity)}</strong>
                  <span>${escapeHtml(member.robloxId || "")}</span>
                </td>
                <td>${escapeHtml(member.role || "Unranked")}</td>
                <td>${time.hours}h ${time.minutes}m</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function formFieldsFor(section, entry = {}) {
  const common = `
    <input type="hidden" name="id" value="${escapeHtml(entry.id || "")}">
    <div class="resource-editor-field">
      <label for="resource-title">Title</label>
      <input id="resource-title" name="title" value="${escapeHtml(entry.title || "")}" required>
    </div>
  `;

  if (section === "transmissions") {
    return `${common}
      <div class="resource-editor-field">
        <label for="resource-body">Body</label>
        <textarea id="resource-body" name="body" required>${escapeHtml(entry.body || "")}</textarea>
      </div>
      ${entry.id ? `
        <div class="library-editor-buttons">
          <button type="button" class="library-inline-btn danger" data-resource-delete>DELETE TRANSMISSION</button>
        </div>
      ` : ""}
    `;
  }

  return `${common}
    <div class="resource-editor-field">
      <label for="resource-body">Body</label>
      <textarea id="resource-body" name="body" required>${escapeHtml(entry.body || "")}</textarea>
    </div>
    <div class="resource-editor-field">
      <label for="resource-visibility">Visibility</label>
      <select id="resource-visibility" name="visibility">
        <option value="restricted" ${entry.visibility !== "public" && entry.visibility !== "private" ? "selected" : ""}>Restricted</option>
        <option value="public" ${entry.visibility === "public" ? "selected" : ""}>Public</option>
        <option value="private" ${entry.visibility === "private" ? "selected" : ""}>Private</option>
      </select>
    </div>
  `;
}

function ensureEditorOverlay() {
  let overlay = document.getElementById("resource-editor-overlay");
  if (overlay) return overlay

  overlay = document.createElement("div");
  overlay.id = "resource-editor-overlay";
  overlay.innerHTML = `
    <div class="resource-editor-container" role="dialog" aria-modal="true" aria-labelledby="resource-editor-title">
      <div class="resource-editor-topbar">
        <span class="resource-editor-title" id="resource-editor-title">WRITE RESOURCE</span>
        <button type="button" class="resource-editor-close" data-resource-close>CLOSE</button>
      </div>
      <form class="resource-editor-form" data-resource-form></form>
      <div class="resource-editor-actions">
        <span class="resource-editor-status" data-resource-status></span>
        <button type="submit" class="resource-editor-submit" form="resource-editor-form">SAVE</button>
      </div>
      <div class="resource-editor-footer">
        <span class="resource-editor-hint"><kbd>ESC</kbd> CLOSE</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("[data-resource-form]").id = "resource-editor-form";
  overlay.querySelector("[data-resource-close]").addEventListener("click", closeEditor);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeEditor();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeEditor();
  });

  return overlay;
}

function weekStartValue() {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function reportMemberRows(members = []) {
  return members.filter(Boolean).sort((left, right) => (
    Number(right.rank || 0) - Number(left.rank || 0)
    || String(left.username || left.displayName || left.robloxId || "").localeCompare(String(right.username || right.displayName || right.robloxId || ""))
  )).map((member, index) => {
    const memberTime = normalizeTime(member.hours, member.minutes);
    return `
      <div class="weekly-report-member" data-report-member="${index}">
        <div>
          <strong>${escapeHtml(member.username || member.displayName || member.robloxId)}</strong>
          <span>${escapeHtml(member.role || "")}</span>
        </div>
        <input type="hidden" name="robloxId-${index}" value="${escapeHtml(member.robloxId || "")}">
        <input type="hidden" name="username-${index}" value="${escapeHtml(member.username || "")}">
        <input type="hidden" name="displayName-${index}" value="${escapeHtml(member.displayName || "")}">
        <input type="hidden" name="rank-${index}" value="${escapeHtml(member.rank || 0)}">
        <input type="hidden" name="role-${index}" value="${escapeHtml(member.role || "")}">
        <label>H <input type="number" min="0" name="hours-${index}" value="${escapeHtml(memberTime.hours)}"></label>
        <label>M <input type="number" min="0" max="59" name="minutes-${index}" value="${escapeHtml(memberTime.minutes)}"></label>
        <label>Hosted <input type="number" min="0" name="eventsHosted-${index}" value="${escapeHtml(member.eventsHosted || 0)}"></label>
        <label>Attended <input type="number" min="0" name="eventsAttended-${index}" value="${escapeHtml(member.eventsAttended || 0)}"></label>
      </div>
    `;
  }).join("");
}

function reportMemberIdentity(member = {}) {
  return member.displayName && member.displayName !== member.username
    ? `${member.displayName} (@${member.username})`
    : member.username || member.displayName || member.robloxId || "Unknown";
}

function renderReportViewerRows(members = []) {
  if (!members.length) return `<tr><td colspan="5">No member rows recorded.</td></tr>`;

  return members.slice().sort((left, right) => (
    Number(right.rank || 0) - Number(left.rank || 0)
    || String(reportMemberIdentity(left)).localeCompare(String(reportMemberIdentity(right)))
  )).map(member => {
    const memberTime = normalizeTime(member.hours, member.minutes);
    return `
      <tr>
        <td><strong>${escapeHtml(reportMemberIdentity(member))}</strong><span>${escapeHtml(member.robloxId || "")}</span></td>
        <td>${escapeHtml(member.role || "Unranked")}</td>
        <td>${escapeHtml(memberTime.hours)}h ${escapeHtml(memberTime.minutes)}m</td>
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

function openReportViewer(report = {}) {
  const overlay = ensureReportViewOverlay();
  const body = overlay.querySelector("[data-report-view-body]");
  const members = Array.isArray(report.members) ? report.members : [];
  const totals = report.totals || reportTotals(members);
  const time = normalizeTime(totals.hours, totals.minutes);

  body.innerHTML = `
    <div class="overview-total-strip">
      <span>${escapeHtml(members.length)} members</span>
      <span>${escapeHtml(time.hours)}h ${escapeHtml(time.minutes)}m</span>
      <span>${escapeHtml(totals.eventsHosted || 0)} hosted</span>
      <span>${escapeHtml(totals.eventsAttended || 0)} attended</span>
      <span>${escapeHtml(report.authorName || "Unknown author")}</span>
    </div>
    <div class="tracking-table-wrap">
      <table class="tracking-table">
        <thead><tr><th>Member</th><th>Rank</th><th>Tracked Time</th><th>Hosted</th><th>Attended</th></tr></thead>
        <tbody>${renderReportViewerRows(members)}</tbody>
      </table>
    </div>
  `;
  overlay.classList.add("active");
}

async function openWeeklyReportEditor(entry = null) {
  if (!activeContext) return;

  const overlay = ensureEditorOverlay();
  const form = overlay.querySelector("[data-resource-form]");
  const status = overlay.querySelector("[data-resource-status]");
  const title = overlay.querySelector("#resource-editor-title");

  title.textContent = `${entry?.id ? "EDIT" : "WRITE"} WEEKLY REPORT`;
  status.textContent = entry ? "" : "Loading roster...";
  overlay.classList.add("active");

  let members = entry?.members || [];
  if (!entry) {
    try {
      const payload = await fetchWeeklyReportPayload(activeContext.division.id, true);
      members = payload.roster || [];
    } catch (error) {
      status.textContent = error.message.replace(/_/g, " ");
      return;
    }
  }

  form.innerHTML = `
    <input type="hidden" name="id" value="${escapeHtml(entry?.id || "")}">
    <div class="resource-editor-field">
      <label>Week Start</label>
      <input type="date" name="weekStart" value="${escapeHtml(entry?.weekStart || weekStartValue())}" required>
    </div>
    <div class="weekly-report-grid">
      ${reportMemberRows(members)}
    </div>
  `;
  status.textContent = "";

  form.onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const memberRows = Array.from(form.querySelectorAll("[data-report-member]")).map((row, index) => {
      const memberTime = normalizeTime(data[`hours-${index}`], data[`minutes-${index}`]);
      return {
        robloxId: data[`robloxId-${index}`],
        username: data[`username-${index}`],
        displayName: data[`displayName-${index}`],
        rank: Number(data[`rank-${index}`]) || 0,
        role: data[`role-${index}`],
        hours: memberTime.hours,
        minutes: memberTime.minutes,
        eventsHosted: Number(data[`eventsHosted-${index}`]) || 0,
        eventsAttended: Number(data[`eventsAttended-${index}`]) || 0
      };
    });

    status.textContent = "Saving...";
    try {
      await saveWeeklyReport({
        id: data.id,
        division: activeContext.division.id,
        weekStart: data.weekStart,
        members: memberRows
      });
      status.textContent = "Saved";
      await activeContext.reload();
      setTimeout(closeEditor, 350);
    } catch (error) {
      status.textContent = error.message.replace(/_/g, " ");
    }
  };
}

function closeEditor() {
  document.getElementById("resource-editor-overlay")?.classList.remove("active");
}

function openEditor(entry = {}) {
  if (!activeContext) return;

  const overlay = ensureEditorOverlay();
  const form = overlay.querySelector("[data-resource-form]");
  const status = overlay.querySelector("[data-resource-status]");
  const title = overlay.querySelector("#resource-editor-title");

  title.textContent = `${entry.id ? "EDIT" : "WRITE"} ${titleForSection(activeContext.section, activeContext.division)}`;
  status.textContent = "";
  form.innerHTML = `
    ${formFieldsFor(activeContext.section, entry)}
    ${activeContext.section === "transmissions" ? "" : `
      <div class="resource-editor-field">
        <label for="resource-status">Status</label>
        <select id="resource-status" name="status">
          <option value="published" ${entry.status === "published" ? "selected" : ""}>Published</option>
          <option value="draft" ${entry.status === "draft" ? "selected" : ""}>Draft</option>
          <option value="archived" ${entry.status === "archived" ? "selected" : ""}>Archived</option>
        </select>
      </div>
    `}
  `;

  form.onclick = async event => {
    const destroy = event.target.closest("[data-resource-delete]");
    if (!destroy || !entry.id) return;
    if (!window.confirm("Are you sure you want to delete this transmission?")) return;

    try {
      status.textContent = "Deleting...";
      await deleteDivisionResource(activeContext.division.id, activeContext.section, entry.id);
      status.textContent = "Deleted";
      await activeContext.reload();
      setTimeout(closeEditor, 150);
    } catch (error) {
      status.textContent = error.message.replace(/_/g, " ");
    }
  };

  form.onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    status.textContent = "Saving...";

    try {
      await saveDivisionResource(activeContext.division.id, activeContext.section, data);
      status.textContent = "Saved";
      await activeContext.reload();
      setTimeout(closeEditor, 350);
    } catch (error) {
      status.textContent = error.message.replace(/_/g, " ");
    }
  };

  overlay.classList.add("active");
  form.querySelector("input, textarea, select")?.focus();
}

function bindEditorControls(mount) {
  if (mount.dataset.resourceEditorBound === "true") return;
  mount.dataset.resourceEditorBound = "true";

  mount.addEventListener("click", event => {
    const newButton = event.target.closest("[data-resource-new]");
    if (newButton) {
      if (activeContext?.section === "reports") {
        openWeeklyReportEditor();
        return;
      }
      openEditor();
      return;
    }

    const weeklyEdit = event.target.closest("[data-weekly-report-edit]");
    if (weeklyEdit) {
      openWeeklyReportEditor(activeEntries[Number(weeklyEdit.dataset.weeklyReportEdit)] || {});
      return;
    }

    const weeklyView = event.target.closest("[data-weekly-report-view]");
    if (weeklyView) {
      openReportViewer(activeEntries[Number(weeklyView.dataset.weeklyReportView)] || {});
      return;
    }

    const editButton = event.target.closest("[data-resource-edit]");
    if (editButton) {
      const entry = activeEntries[Number(editButton.dataset.resourceEdit)] || {};
      openEditor(entry);
    }
  });
}

function renderSection(mount, division, section, entries, canWrite, options = {}) {
  activeEntries = entries || [];
  activeContext = {
    division,
    section,
    canWrite,
    reload: () => hydrateSection(mount, division, section)
  };

  mount.innerHTML = `
    <section class="hub-shell" aria-label="${escapeHtml(division.name)} ${escapeHtml(section)}">
      <div class="hub-hero">
        <div class="hub-identity">
          <div>
            <span class="hub-kicker">Registry Node / ${escapeHtml(division.node)}</span>
            <h2 class="hub-title">${escapeHtml(titleForSection(section, division))}</h2>
          </div>
          <div>
            <span class="hub-kicker">Division</span>
            <span class="hub-value">${escapeHtml(division.shortName || division.name)}</span>
          </div>
        </div>
        <p class="hub-summary">${escapeHtml(descriptionForSection(division, section))}</p>
      </div>
      ${["transmissions", "reports", "activity"].includes(section) ? `
        <div class="hub-status-grid division-section-status-grid">
          <div class="hub-status-cell"><span class="hub-label">Status</span><span class="hub-value">ACTIVE</span></div>
          <div class="hub-status-cell"><span class="hub-label">Division</span><span class="hub-value">${escapeHtml(division.shortName || division.name)}</span></div>
          <div class="hub-status-cell"><span class="hub-label">${section === "activity" ? "Activity" : escapeHtml(section)}</span><span class="hub-value">${section === "activity" ? `${escapeHtml(entries?.length || 0)} MEMBERS` : `${escapeHtml(entries?.length || 0)} ENTRIES`}</span></div>
        </div>
      ` : ""}

      <section class="hub-panel">
        ${section === "activity" ? "" : `
          <div class="hub-panel-head">
            <h3 class="hub-panel-title">${escapeHtml(titleForSection(section, division))}</h3>
            ${canWrite ? `<button type="button" class="hub-write-btn" data-resource-new>WRITE NEW</button>` : ""}
          </div>
        `}
        ${section === "reports"
          ? renderWeeklyReports(entries)
          : section === "activity"
            ? renderActivityRoster(entries)
            : renderEntries(section, entries)}
      </section>
    </section>
  `;

  bindEditorControls(mount);

  if (options.error) {
    const panel = mount.querySelector(".hub-panel");
    if (panel) {
      panel.insertAdjacentHTML("beforeend", `<div class="hub-empty" role="alert">${escapeHtml(options.error)}</div>`);
    }
  }
}

async function hydrateSection(mount, division, section) {
  try {
    if (section === "activity") {
      const payload = await fetchDivisionRosterPayload(division.id);
      renderSection(mount, division, section, payload.members, false);
      return;
    }

    if (section === "reports") {
      const payload = await fetchWeeklyReportPayload(division.id);
      renderSection(mount, division, section, payload.reports, payload.canWrite);
      return;
    }

    const payload = await fetchDivisionResourcePayload(division.id, section);
    renderSection(mount, division, section, payload.resources, payload.canWrite);
  } catch (error) {
    const message = String(error?.message || error || "SECTION_UNAVAILABLE").replace(/_/g, " ");
    renderSection(mount, division, section, [], false, {
      error: `Unable to load ${titleForSection(section, division).toLowerCase()}: ${message}`
    });
  }
}

async function initDivisionSection() {
  const mount = document.querySelector("[data-division-section]");
  if (!mount) return;

  const division = getDivision(mount.dataset.division || "");
  const section = mount.dataset.divisionSection;

  if (!division) {
    mount.innerHTML = '<p class="hub-empty">Division configuration unavailable</p>';
    return;
  }

  document.body.classList.add(division.theme);
  document.querySelector("[data-division-title]")?.replaceChildren(document.createTextNode(division.name));
  document.querySelector("[data-section-title]")?.replaceChildren(document.createTextNode(titleForSection(section, division)));
  document.querySelector("[data-division-node]")?.replaceChildren(document.createTextNode(division.node));

  renderSection(mount, division, section, [], false);
  await hydrateSection(mount, division, section);
}

if (document.readyState === "loading") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDivisionSection);
  } else {
    initDivisionSection();
  }
} else {
  initDivisionSection();
}
