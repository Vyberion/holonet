(function () {
  "use strict";

  const STYLE_ID = "holonet-hub-layout-fixes-style";
  const reportPageState = {
    division: "",
    reports: [],
    loading: null,
    bound: false
  };

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

  function reportMemberIdentity(member = {}) {
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

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .council-floor-shell {
        max-width: min(1120px, calc(100vw - 24px)) !important;
        width: 100% !important;
      }

      .council-proposal {
        padding-left: clamp(14px, 2vw, 22px) !important;
        padding-right: clamp(14px, 2vw, 22px) !important;
      }

      .council-result-panel {
        margin-left: auto !important;
        margin-right: auto !important;
        padding-left: clamp(12px, 2vw, 18px) !important;
        padding-right: clamp(12px, 2vw, 18px) !important;
        width: min(100%, 760px) !important;
      }

      .council-result-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        justify-items: center !important;
        text-align: center !important;
      }

      .council-result-grid > div:nth-child(1) { order: 1; }
      .council-result-grid > div:nth-child(2) { order: 3; }
      .council-result-grid > div:nth-child(3) { order: 2; }
      .council-result-grid > div:nth-child(4) { display: none !important; }

      .council-actions {
        justify-content: center !important;
        padding-left: clamp(10px, 2vw, 18px) !important;
        padding-right: clamp(10px, 2vw, 18px) !important;
      }

      .council-actions [data-council-vote="yes"] { order: 1; }
      .council-actions [data-council-vote="abstain"] { order: 2; }
      .council-actions [data-council-vote="no"] { order: 3; }
      .council-actions [data-council-veto] { order: 4; }

      .division-section-status-grid {
        margin-top: 0 !important;
      }

      [data-hub-card="documents"] .hub-row > span:not(.hub-timestamp) {
        display: none !important;
      }

      #report-view-overlay {
        align-items: center;
        -webkit-backdrop-filter: blur(16px) saturate(1.15);
        backdrop-filter: blur(16px) saturate(1.15);
        background:
          radial-gradient(ellipse 90% 80% at 50% 12%, rgba(255, 66, 82, 0.055), transparent 62%),
          rgba(0, 0, 0, 0.78);
        box-sizing: border-box;
        display: none;
        inset: 0;
        justify-content: center;
        overflow-y: auto;
        padding: 1rem;
        position: fixed;
        z-index: 1000;
      }

      #report-view-overlay.active {
        display: flex;
      }

      #report-view-overlay .resource-editor-container {
        max-width: min(920px, calc(100vw - 28px));
      }

      #report-view-overlay .report-view-body {
        display: grid;
        gap: 14px;
        padding: 14px;
      }

      #report-view-overlay .tracking-table-wrap {
        max-height: min(58vh, 620px);
        overflow: auto;
      }

      #report-view-overlay .tracking-table {
        min-width: 720px;
      }

      @media (max-width: 700px) {
        #report-view-overlay {
          align-items: stretch !important;
          justify-content: stretch !important;
          padding: 0 !important;
        }

        #report-view-overlay.active {
          display: flex !important;
        }

        #report-view-overlay .resource-editor-container {
          border-left: 0 !important;
          border-right: 0 !important;
          clip-path: none !important;
          display: flex !important;
          flex-direction: column !important;
          height: 100dvh !important;
          margin: 0 !important;
          max-height: none !important;
          max-width: none !important;
          width: 100vw !important;
        }

        #report-view-overlay .report-view-body {
          flex: 1 1 auto !important;
          overflow-y: auto !important;
        }
      }
    `;

    document.head.appendChild(style);
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
          <thead>
            <tr>
              <th>Member</th>
              <th>Rank</th>
              <th>Tracked Time</th>
              <th>Hosted</th>
              <th>Attended</th>
            </tr>
          </thead>
          <tbody>${reportMemberRows(members)}</tbody>
        </table>
      </div>
    `;

    overlay.classList.add("active");
  }

  async function loadReportsForPage(division) {
    if (reportPageState.division === division && reportPageState.reports.length) return reportPageState.reports;
    if (reportPageState.loading && reportPageState.division === division) return reportPageState.loading;

    reportPageState.division = division;
    reportPageState.loading = fetch(`/api/weekly-reports?division=${encodeURIComponent(division)}`)
      .then(response => response.json())
      .then(payload => {
        reportPageState.reports = payload?.ok ? (payload.reports || []) : [];
        return reportPageState.reports;
      })
      .catch(() => {
        reportPageState.reports = [];
        return [];
      })
      .finally(() => {
        reportPageState.loading = null;
      });

    return reportPageState.loading;
  }

  function addReportViewButtons(mount, reports) {
    const rows = Array.from(mount.querySelectorAll(".hub-section-row"));
    rows.forEach((row, index) => {
      const report = reports[index];
      if (!report || row.querySelector("[data-section-report-view]")) return;

      let tools = row.querySelector(".hub-row-tools");
      if (!tools) {
        tools = document.createElement("div");
        tools.className = "hub-row-tools";
        row.appendChild(tools);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "hub-write-btn";
      button.dataset.sectionReportView = String(index);
      button.textContent = "VIEW REPORT";
      tools.prepend(button);
    });
  }

  async function enhanceReportsPage() {
    const mount = document.querySelector('[data-division-section="reports"][data-division]');
    if (!mount) return;

    const division = mount.dataset.division || "";
    const reports = await loadReportsForPage(division);
    addReportViewButtons(mount, reports);
  }

  function rewriteActivityLinks() {
    document.querySelectorAll('a[href$="/trackers"]').forEach(link => {
      link.href = link.getAttribute("href").replace(/\/trackers$/, "/activity");
    });
  }

  function renameActivitySurface(mount) {
    if (mount.dataset.divisionSection !== "trackers") return;

    document.querySelectorAll("[data-section-title]").forEach(node => {
      node.textContent = node.textContent.replace(/Tracking/g, "Activity");
    });

    mount.querySelectorAll(".hub-title, .hub-panel-title").forEach(node => {
      node.textContent = node.textContent.replace(/Tracking/g, "Activity");
    });

    mount.querySelectorAll(".hub-summary").forEach(node => {
      node.textContent = node.textContent
        .replace(/Current tracked shifts/g, "Current activity")
        .replace(/tracking console/gi, "activity console")
        .replace(/Tracking/g, "Activity")
        .replace(/tracking/g, "activity");
    });
  }

  function statusCountForSection(mount, section) {
    if (section === "trackers") {
      const rows = mount.querySelectorAll(".tracking-table tbody tr");
      return rows.length ? `${rows.length} MEMBERS` : "LOADING";
    }

    return `${mount.querySelectorAll(".hub-section-row").length} ENTRIES`;
  }

  function syncDivisionSectionStatus() {
    const mount = document.querySelector("[data-division-section][data-division]");
    if (!mount) return;

    const section = mount.dataset.divisionSection;
    if (!["transmissions", "reports", "trackers"].includes(section)) return;

    renameActivitySurface(mount);
    const hero = mount.querySelector(".hub-hero");
    if (!hero) return;

    let grid = mount.querySelector("[data-section-status-grid]");
    if (!grid) {
      grid = document.createElement("div");
      grid.className = "hub-status-grid division-section-status-grid";
      grid.dataset.sectionStatusGrid = "true";
      hero.insertAdjacentElement("afterend", grid);
    } else if (grid.previousElementSibling !== hero) {
      hero.insertAdjacentElement("afterend", grid);
    }

    const label = section === "trackers" ? "Activity" : section;
    const count = statusCountForSection(mount, section);
    const signature = `${label}:${count}`;
    if (grid.dataset.signature === signature) return;
    grid.dataset.signature = signature;
    grid.innerHTML = `
      <div class="hub-status-cell">
        <span class="hub-label">Status</span>
        <span class="hub-value">ACTIVE</span>
      </div>
      <div class="hub-status-cell">
        <span class="hub-label">Division</span>
        <span class="hub-value">${escapeHtml(mount.dataset.divisionTitle || mount.dataset.division || "Division")}</span>
      </div>
      <div class="hub-status-cell">
        <span class="hub-label">${escapeHtml(label)}</span>
        <span class="hub-value">${escapeHtml(count)}</span>
      </div>
    `;
  }

  function bindReportViewerControls() {
    if (reportPageState.bound) return;
    reportPageState.bound = true;

    document.addEventListener("click", async event => {
      const button = event.target.closest("[data-section-report-view]");
      if (!button) return;

      const mount = button.closest('[data-division-section="reports"][data-division]');
      const division = mount?.dataset.division || reportPageState.division;
      const reports = division ? await loadReportsForPage(division) : reportPageState.reports;
      const report = reports[Number(button.dataset.sectionReportView || -1)];
      if (report) openReportViewer(report);
    });
  }

  function boot() {
    ensureStyles();
    bindReportViewerControls();
    rewriteActivityLinks();
    syncDivisionSectionStatus();
    enhanceReportsPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot();
      new MutationObserver(boot).observe(document.body, { childList: true, subtree: true });
    });
  } else {
    boot();
    new MutationObserver(boot).observe(document.body, { childList: true, subtree: true });
  }
})();
