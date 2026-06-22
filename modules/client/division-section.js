import { getDivision } from "../data/divisions/index.js";
import { fetchDivisionResourcePayload, saveDivisionResource } from "./resources.js";

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

function timestampFor(entry, section) {
  if (section === "trackers") return "";

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
  const response = await fetch(`/api/weekly-reports?division=${encodeURIComponent(division)}${draft ? "&draft=1" : ""}`);
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
  const response = await fetch(`/api/division-roster?division=${encodeURIComponent(division)}`);
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "ROSTER_UNAVAILABLE");
  return payload;
}

function titleForSection(section) {
  return {
    transmissions: "Transmissions",
    reports: "Reports",
    trackers: "Tracking"
  }[section] || "Division";
}

function descriptionForSection(division, section) {
  return {
    transmissions: `Official announcements and operational transmissions published for ${division.name}.`,
    reports: `Published weekly activity reports and performance records for ${division.name}.`,
    trackers: `Current ${division.name} members in rank order with their live tracked hours and minutes.`
  }[section] || "";
}

function emptyForSection(section) {
  return {
    transmissions: "No transmissions connected",
    reports: "No report feed connected",
    trackers: "No trackers connected"
  }[section] || "No entries connected";
}

function renderEntries(section, entries) {
  if (!entries?.length) return `<p class="hub-empty">${emptyForSection(section)}</p>`;

  return `<div class="hub-list">${entries.map((entry, index) => {
    const label = entry.title || entry.label || "Untitled entry";
    const meta = entry.meta || entry.scope || entry.author || entry.value || "Pending";
    const body = entry.body || entry.summary || entry.description || "";
    const href = entry.href && entry.href !== "#" ? entry.href : "";
    const isTracker = section === "trackers";
    const target = href && isTracker ? ' target="_blank" rel="noopener noreferrer"' : "";
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
        ${activeContext?.canWrite ? `<div class="hub-row-tools"><button type="button" class="hub-row-edit" data-weekly-report-edit="${index}">EDIT</button></div>` : ""}
      </article>
    `;
  }).join("")}</div>`;
}

function renderTrackingRoster(members) {
  if (!members?.length) return '<p class="hub-empty">No current division members found</p>';

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
          ${members.map(member => {
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
  return members.map((member, index) => {
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

  title.textContent = `${entry.id ? "EDIT" : "WRITE"} ${titleForSection(activeContext.section)}`;
  status.textContent = "";
  form.innerHTML = `
    ${formFieldsFor(activeContext.section, entry)}
    <div class="resource-editor-field">
      <label for="resource-status">Status</label>
      <select id="resource-status" name="status">
        <option value="published" ${entry.status === "published" ? "selected" : ""}>Published</option>
        <option value="draft" ${entry.status === "draft" ? "selected" : ""}>Draft</option>
        <option value="archived" ${entry.status === "archived" ? "selected" : ""}>Archived</option>
      </select>
    </div>
  `;

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

    const editButton = event.target.closest("[data-resource-edit]");
    if (editButton) {
      const entry = activeEntries[Number(editButton.dataset.resourceEdit)] || {};
      openEditor(entry);
    }
  });
}

function renderSection(mount, division, section, entries, canWrite) {
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
            <h2 class="hub-title">${escapeHtml(titleForSection(section))}</h2>
          </div>
          <div>
            <span class="hub-kicker">Division</span>
            <span class="hub-value">${escapeHtml(division.shortName || division.name)}</span>
          </div>
        </div>
        <p class="hub-summary">${escapeHtml(descriptionForSection(division, section))}</p>
      </div>

      <section class="hub-panel">
        ${section === "trackers" ? "" : `
          <div class="hub-panel-head">
            <h3 class="hub-panel-title">${escapeHtml(titleForSection(section))}</h3>
            ${canWrite ? `<button type="button" class="hub-write-btn" data-resource-new>WRITE NEW</button>` : ""}
          </div>
        `}
        ${section === "reports"
          ? renderWeeklyReports(entries)
          : section === "trackers"
            ? renderTrackingRoster(entries)
            : renderEntries(section, entries)}
      </section>
    </section>
  `;

  bindEditorControls(mount);
}

async function hydrateSection(mount, division, section) {
  if (section === "trackers") {
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
  document.querySelector("[data-section-title]")?.replaceChildren(document.createTextNode(titleForSection(section)));
  document.querySelector("[data-division-node]")?.replaceChildren(document.createTextNode(division.node));

  renderSection(mount, division, section, [], false);
  await hydrateSection(mount, division, section);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDivisionSection);
} else {
  initDivisionSection();
}
