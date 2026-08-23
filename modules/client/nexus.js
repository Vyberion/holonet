function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No signal";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function normalizeTime(hours = 0, minutes = 0) {
  const totalMinutes = Math.max(0, Math.floor(Number(hours) || 0) * 60 + Math.floor(Number(minutes) || 0));
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60
  };
}

function divisionLabel(key) {
  return {
    reavers: "Reavers",
    dhg: "Dark Honor Guard",
    inquisitors: "Inquisitors",
    dreadmasters: "Dread Masters"
  }[key] || key;
}

function inspectionTemplate(division) {
  return {
    reavers: [
      ["Activity", 100, 10],
      ["Combat", "", 30],
      ["Assassinations", "", 30],
      ["Codex", "", 10],
      ["Formations", 40, 20]
    ],
    dhg: [
      ["Activity", 100, 10],
      ["Combat", "", 20],
      ["Jailing", "", 20],
      ["Guarding", "", 20],
      ["Codex", "", 20],
      ["Formations", 40, 10]
    ],
    dreadmasters: [
      ["Activity", 100, 10],
      ["Combat", "", 10],
      ["Lore", "", 20],
      ["Dread Lore", "", 20],
      ["Codex", "", 20],
      ["Formations", 40, 20]
    ],
    inquisitors: [
      ["Activity", 100, 10],
      ["Combat", "", 10],
      ["Mocks", "", 40],
      ["Codex", "", 30],
      ["Formations", 40, 10]
    ]
  }[division] || [["Activity", 100, 25], ["Combat", "", 25], ["Codex", "", 25], ["Formations", 40, 25]];
}

async function fetchNexus() {
  const response = await fetch("/api/nexus");
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "OVERVIEW_UNAVAILABLE");
  return payload;
}

async function saveInspection(data) {
  const response = await fetch("/api/inspections", {
    method: data.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "INSPECTION_SAVE_FAILED");
  return payload;
}

function renderReportSummary(division) {
  if (division.classified) {
    return `
      <article class="overview-report-card overview-report-card--classified">
        <div class="overview-card-head">
          <div>
            <span class="hub-kicker">${escapeHtml(division.node)} / CLASSIFIED</span>
            <strong>${escapeHtml(division.name)} Weekly Report</strong>
          </div>
          <span class="nexus-status">classified</span>
        </div>
        <div class="overview-total-strip overview-total-strip--classified">
          <span>REDACTED</span>
          <span>REDACTED</span>
          <span>REDACTED</span>
          <span>REDACTED</span>
        </div>
        <table class="overview-mini-table overview-table--classified" aria-label="Classified Inquisitors weekly report">
          <thead><tr><th>Member</th><th>Rank</th><th>Time</th><th>Hosted</th><th>Attended</th></tr></thead>
          <tbody>
            ${Array.from({ length: 4 }, () => `
              <tr>
                <td><span class="classified-bar classified-bar--wide"></span></td>
                <td><span class="classified-bar"></span></td>
                <td><span class="classified-bar classified-bar--short"></span></td>
                <td><span class="classified-bar classified-bar--short"></span></td>
                <td><span class="classified-bar classified-bar--short"></span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>
    `;
  }

  const report = division.latestReport;
  const totals = report?.totals || {};
  const totalTime = normalizeTime(totals.hours, totals.minutes);
  const members = Array.isArray(report?.members) ? report.members : [];

  if (!report) {
    return `
      <article class="overview-report-card overview-report-card--missing">
        <div class="overview-card-head">
          <span class="hub-kicker">${escapeHtml(division.node)}</span>
          <strong>${escapeHtml(division.name)}</strong>
        </div>
        <p class="hub-empty">No weekly report recorded.</p>
        ${division.canWriteReport ? `
          <div class="hub-card-actions">
            <a class="hub-write-btn" href="${escapeHtml(division.links.reports)}">WRITE REPORT</a>
          </div>
        ` : ""}
      </article>
    `;
  }

  const topRows = members.slice().sort((a, b) => (b.rank || 0) - (a.rank || 0)).map(member => {
    const memberTime = normalizeTime(member.hours, member.minutes);
    return `
      <tr>
        <td>${escapeHtml(member.username || member.displayName || member.robloxId)}</td>
        <td>${escapeHtml(member.role || "")}</td>
        <td>${escapeHtml(memberTime.hours)}h ${escapeHtml(memberTime.minutes)}m</td>
        <td>${escapeHtml(member.hostedCount || 0)}</td>
        <td>${escapeHtml(member.attendedCount || 0)}</td>
      </tr>
    `;
  }).join("");

  return `
    <article class="overview-report-card overview-report-card--${escapeHtml(division.id)}">
      <div class="overview-card-head">
        <div>
          <span class="hub-kicker">${escapeHtml(division.node)} / ${escapeHtml(formatDate(report.weekStart))}</span>
          <strong>${escapeHtml(division.name)} Weekly Report</strong>
        </div>
        <span class="nexus-status">${report.status || "logged"}</span>
      </div>
      <div class="overview-total-strip">
        <span>Total Time ${escapeHtml(totalTime.hours)}h ${escapeHtml(totalTime.minutes)}m</span>
        <span>Hosted ${escapeHtml(totals.hosted || 0)}</span>
        <span>Attended ${escapeHtml(totals.attended || 0)}</span>
        <span>Total Roster ${escapeHtml(members.length)}</span>
      </div>
      <table class="overview-mini-table" aria-label="${escapeHtml(division.name)} weekly report summary">
        <thead><tr><th>Member</th><th>Rank</th><th>Time</th><th>Hosted</th><th>Attended</th></tr></thead>
        <tbody>${topRows}</tbody>
      </table>
      <div class="hub-card-actions">
        <a class="hub-write-btn" href="${escapeHtml(division.links.reports)}">VIEW FULL REPORT</a>
      </div>
    </article>
  `;
}

function renderInspectionTable(inspection, divisionId) {
  if (!inspection) {
    return `<p class="hub-empty">No inspection score logged.</p>`;
  }

  const sections = Array.isArray(inspection.sections) ? inspection.sections : [];

  return `
    <table class="overview-inspection-table" aria-label="${escapeHtml(divisionId)} inspection sections">
      <thead>
        <tr>
          <th>Sections</th>
          <th>Out Of</th>
          <th>Weighted %</th>
          <th>Achieved</th>
          <th>Percentage</th>
        </tr>
      </thead>
      <tbody>
        ${sections.map(section => {
          const sectionName = section.name;
          const percentage = section.outOf && section.weightedPercentage
            ? ((Number(section.achievedScore || 0) / Number(section.outOf || 1)) * Number(section.weightedPercentage || 0)).toFixed(2)
            : "0.00";
          return `
            <tr>
              <td>${escapeHtml(sectionName)}</td>
              <td>${escapeHtml(section.outOf || 0)}</td>
              <td>${escapeHtml(section.weightedPercentage || 0)}</td>
              <td>${escapeHtml(section.achievedScore || 0)}</td>
              <td>${escapeHtml(percentage)}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderDivisionInspectionArchive(division, canInspect) {
  const inspections = Array.isArray(division.inspections) ? division.inspections : [];

  if (!inspections.length) {
    return `<p class="hub-empty">No archived inspections for ${escapeHtml(division.name)}.</p>`;
  }

  return `<div class="hub-list overview-inspection-archive-list">${inspections.map((inspection, index) => `
    <article class="hub-row hub-section-row" data-inspection-history="${escapeHtml(division.id)}" data-inspection-index="${index}">
      <strong>${escapeHtml(formatDate(inspection.heldOn))}</strong>
      <span>${escapeHtml(inspection.authorName || "Unknown inspector")}</span>
      <p>Score ${escapeHtml(inspection.overallScore ?? "--")} / Bonus ${escapeHtml(inspection.bonusPercentage || 0)}%</p>
      ${canInspect ? `<div class="hub-row-tools"><button type="button" class="hub-row-edit" data-inspection-edit="${escapeHtml(division.id)}" data-inspection-index="${index}">EDIT</button></div>` : ""}
    </article>
  `).join("")}</div>`;
}

function renderInspectionCard(division, canInspect) {
  if (division.classified) {
    return `
      <article class="overview-inspection-card overview-inspection-card--${escapeHtml(division.id)} overview-inspection-card--classified">
        <div class="overview-card-head">
          <div>
            <span class="hub-kicker">${escapeHtml(division.node)} / CLASSIFIED</span>
            <strong>${escapeHtml(division.name)} Checkups Score</strong>
          </div>
          <span class="overview-score">--</span>
        </div>
        <table class="overview-inspection-table overview-table--classified" aria-label="Classified Inquisitors inspection table">
          <thead>
            <tr>
              <th>Sections</th>
              <th>Out Of</th>
              <th>Weighted %</th>
              <th>Achieved</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: 5 }, () => `
              <tr>
                <td><span class="classified-bar classified-bar--wide"></span></td>
                <td><span class="classified-bar classified-bar--short"></span></td>
                <td><span class="classified-bar classified-bar--short"></span></td>
                <td><span class="classified-bar classified-bar--short"></span></td>
                <td><span class="classified-bar"></span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="overview-total-strip overview-total-strip--classified">
          <span>Bonus REDACTED</span>
          <span>Inspector REDACTED</span>
        </div>
      </article>
    `;
  }

  const inspection = division.latestInspection;

  return `
    <article class="overview-inspection-card overview-inspection-card--${escapeHtml(division.id)}">
      <div class="overview-card-head">
        <div>
          <span class="hub-kicker">${escapeHtml(division.node)} / ${inspection ? escapeHtml(formatDate(inspection.heldOn)) : "NO INSPECTION"}</span>
          <strong>${escapeHtml(division.name)} Checkups Score</strong>
        </div>
        <span class="overview-score">${inspection ? escapeHtml(inspection.overallScore) : "--"}</span>
      </div>
      ${renderInspectionTable(inspection, division.id)}
      <div class="overview-total-strip">
        <span>Bonus ${escapeHtml(inspection?.bonusPercentage || 0)}%</span>
        <span>${escapeHtml(inspection?.authorName || "No inspector logged")}</span>
      </div>
      ${inspection?.notes ? `<p class="hub-summary">${escapeHtml(inspection.notes)}</p>` : ""}
      <div class="hub-card-actions">
        <button type="button" class="hub-write-btn" data-inspection-archive-toggle="${escapeHtml(division.id)}">VIEW ARCHIVE</button>
        ${canInspect ? `<button type="button" class="hub-write-btn" data-inspection-write="${escapeHtml(division.id)}">WRITE INSPECTION</button>` : ""}
      </div>
      <div class="overview-inspection-archive" data-inspection-archive-panel="${escapeHtml(division.id)}" hidden>
        <h4 class="overview-archive-title">Inspection Archive</h4>
        ${renderDivisionInspectionArchive(division, canInspect)}
      </div>
    </article>
  `;
}

function ensureInspectionOverlay() {
  let overlay = document.getElementById("inspection-editor-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "inspection-editor-overlay";
  overlay.innerHTML = `
    <div class="resource-editor-container library-editor-container" role="dialog" aria-modal="true" aria-labelledby="inspection-editor-title">
      <div class="resource-editor-topbar">
        <span class="resource-editor-title" id="inspection-editor-title">WRITE INSPECTION</span>
        <button type="button" class="resource-editor-close" data-inspection-close>CLOSE</button>
      </div>
      <form class="resource-editor-form" id="inspection-editor-form"></form>
      <div class="resource-editor-actions">
        <span class="resource-editor-status" data-inspection-status></span>
        <button type="submit" class="resource-editor-submit" form="inspection-editor-form">SAVE SCORE</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-inspection-close]").addEventListener("click", () => overlay.classList.remove("active"));
  overlay.addEventListener("click", event => {
    if (event.target === overlay) overlay.classList.remove("active");
  });
  return overlay;
}

function openInspectionEditor(division, afterSave, entry = null) {
  const overlay = ensureInspectionOverlay();
  const form = overlay.querySelector("#inspection-editor-form");
  const status = overlay.querySelector("[data-inspection-status]");
  const title = overlay.querySelector("#inspection-editor-title");
  const template = inspectionTemplate(division.id);
  const existingSections = Array.isArray(entry?.sections) && entry.sections.length ? entry.sections : null;
  const sections = existingSections || template.map(([name, outOf, weightedPercentage]) => ({
    name,
    outOf,
    weightedPercentage,
    achievedScore: ""
  }));

  title.textContent = entry?.id ? "EDIT INSPECTION" : "WRITE INSPECTION";

  form.innerHTML = `
    <input type="hidden" name="id" value="${escapeHtml(entry?.id || "")}">
    <input type="hidden" name="division" value="${escapeHtml(division.id)}">
    <div class="resource-editor-field">
      <label>Held On</label>
      <input type="date" name="heldOn" value="${escapeHtml(entry?.heldOn || new Date().toISOString().slice(0, 10))}" required>
    </div>
    <div class="inspection-editor-grid">
      ${sections.map((section, index) => {
        const name = section.name;
        return `
          <div class="inspection-editor-row" data-inspection-section="${index}">
            <strong>${escapeHtml(name)} <span style="color:var(--text-faint); font-weight:normal; font-size:0.8em; margin-left:0.3rem;">(${escapeHtml(section.weightedPercentage)}%)</span></strong>
            <input type="hidden" name="name-${index}" value="${escapeHtml(name)}">
            <input type="hidden" name="weightedPercentage-${index}" value="${escapeHtml(section.weightedPercentage)}">
            <label>Achieved <input type="number" min="0" step="0.01" name="achievedScore-${index}" value="${escapeHtml(section.achievedScore ?? "")}" placeholder="0"></label>
            <label>Out Of <input type="number" min="0" step="0.01" name="outOf-${index}" value="${escapeHtml(section.outOf ?? "")}" placeholder="Out of"></label>
          </div>
        `;
      }).join("")}
    </div>
    <div class="resource-editor-field">
      <label>Bonus Percentage</label>
      <input type="number" step="0.01" name="bonusPercentage" value="${escapeHtml(entry?.bonusPercentage ?? 0)}">
    </div>
    <div class="resource-editor-field">
      <label>Notes</label>
      <textarea name="notes">${escapeHtml(entry?.notes || "")}</textarea>
    </div>
  `;

  status.textContent = "";
  form.onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const sectionRows = Array.from(form.querySelectorAll("[data-inspection-section]")).map((row, index) => ({
      name: data[`name-${index}`],
      outOf: Number(data[`outOf-${index}`]) || 0,
      weightedPercentage: Number(data[`weightedPercentage-${index}`]) || 0,
      achievedScore: Number(data[`achievedScore-${index}`]) || 0
    }));

    status.textContent = "Saving inspection...";
    try {
      await saveInspection({
        id: data.id || undefined,
        division: data.division,
        heldOn: data.heldOn,
        cadence: data.cadence,
        bonusPercentage: Number(data.bonusPercentage) || 0,
        notes: data.notes,
        sections: sectionRows
      });
      overlay.classList.remove("active");
      await afterSave();
    } catch (error) {
      status.textContent = error.message.replace(/_/g, " ");
    }
  };

  overlay.classList.add("active");
}

function renderNexus(mount, payload) {
  const divisions = payload.divisions || [];
  const current = divisions.filter(item => item.status === "current").length;
  const overdue = divisions.filter(item => item.status === "overdue").length;
  const missing = divisions.filter(item => item.status === "missing").length;

  mount.innerHTML = `
    <section class="nexus-shell">
      <div class="hub-hero">
        <div class="hub-identity">
          <div>
            <h2 class="hub-title">Overview</h2>
          </div>
          <div>
            <span class="hub-kicker">Status</span>
            <span class="hub-value">${overdue || missing ? "Incomplete" : "Stable"}</span>
          </div>
        </div>
        <p class="hub-summary">Divisional reports and inspection scores.</p>
        <div class="hub-status-grid">
          <div class="hub-status-cell"><span class="hub-label">Current Reports</span><span class="hub-value">${current}</span></div>
          <div class="hub-status-cell"><span class="hub-label">Overdue</span><span class="hub-value">${overdue}</span></div>
          <div class="hub-status-cell"><span class="hub-label">Missing</span><span class="hub-value">${missing}</span></div>
        </div>
      </div>

      <section class="hub-panel">
        <h3 class="hub-panel-title">Weekly Reports</h3>
        <div class="overview-report-grid">
          ${divisions.map(renderReportSummary).join("") || `<p class="hub-empty">No weekly report data available.</p>`}
        </div>
      </section>

      <section class="hub-panel">
        <h3 class="hub-panel-title">Inspections</h3>
        <div class="overview-inspection-grid">
          ${divisions.map(division => renderInspectionCard(division, payload.canInspect)).join("") || `<p class="hub-empty">No inspection data available.</p>`}
        </div>
      </section>
    </section>
  `;
}

async function initNexus() {
  const mount = document.querySelector("[data-nexus-console]");
  if (!mount || mount.dataset.nexusBound === "true") return;
  mount.dataset.nexusBound = "true";
  let latestPayload = null;

  async function hydrate() {
    latestPayload = await fetchNexus();
    renderNexus(mount, latestPayload);
  }

  try {
    await hydrate();
  } catch (error) {
    mount.innerHTML = `<p class="hub-empty">${escapeHtml(error.message.replace(/_/g, " "))}</p>`;
  }

  mount.addEventListener("click", event => {
    if (!latestPayload) return;

    const writeButton = event.target.closest("[data-inspection-write]");
    if (writeButton) {
      const division = (latestPayload.divisions || []).find(item => item.id === writeButton.dataset.inspectionWrite);
      if (division) openInspectionEditor(division, hydrate);
      return;
    }

    const editButton = event.target.closest("[data-inspection-edit]");
    if (editButton) {
      const division = (latestPayload.divisions || []).find(item => item.id === editButton.dataset.inspectionEdit);
      const inspection = division?.inspections?.[Number(editButton.dataset.inspectionIndex)];
      if (division && inspection) openInspectionEditor(division, hydrate, inspection);
      return;
    }

    const archiveToggle = event.target.closest("[data-inspection-archive-toggle]");
    if (archiveToggle) {
      const panel = mount.querySelector(`[data-inspection-archive-panel="${archiveToggle.dataset.inspectionArchiveToggle}"]`);
      if (!panel) return;
      const isOpen = !panel.hidden;
      panel.hidden = isOpen;
      archiveToggle.textContent = isOpen ? "VIEW ARCHIVE" : "HIDE ARCHIVE";
    }
  });
}

window.initHolonetNexus = initNexus;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNexus);
  } else {
    initNexus();
  }
