(function () {
  "use strict";

  const STYLE_ID = "holonet-mobile-ui-polish-style";
  const SEARCH_BUTTON_CLASS = "mobile-search-shortcut";
  let observer = null;
  let sortQueued = false;

  function isMobile() {
    return window.matchMedia?.("(max-width: 700px)").matches;
  }

  function normalizedPath() {
    return window.location.pathname.replace(/\/+$/, "") || "/";
  }

  function searchShortcutAllowed() {
    const path = normalizedPath();
    return path === "/codex" || path === "/archives" || path.endsWith("/handbooks");
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @media (max-width: 700px) {
        .mobile-search-shortcut {
          align-items: center !important;
          background: rgba(0, 0, 0, 0.18) !important;
          border: 1px solid color-mix(in srgb, var(--theme-accent, #ffffff) 54%, var(--theme-accent-dim) 46%) !important;
          bottom: 60px !important;
          box-shadow: none !important;
          clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px)) !important;
          color: color-mix(in srgb, var(--theme-accent, #ffffff) 72%, var(--text-dim) 28%) !important;
          cursor: crosshair !important;
          display: flex !important;
          height: 36px !important;
          justify-content: center !important;
          padding: 8px !important;
          position: fixed !important;
          right: 16px !important;
          transition: border-color 0.3s, box-shadow 0.3s, color 0.3s, filter 0.3s !important;
          width: 36px !important;
          z-index: 2200 !important;
        }

        .mobile-search-shortcut svg {
          height: 20px !important;
          width: 20px !important;
        }

        .mobile-search-shortcut:hover,
        .mobile-search-shortcut:focus-visible,
        .mobile-search-shortcut:active,
        .mobile-search-shortcut.is-active {
          border-color: var(--theme-accent) !important;
          box-shadow: 0 0 14px var(--theme-accent-glow) !important;
          color: var(--theme-accent) !important;
          filter: drop-shadow(0 0 6px var(--theme-accent-glow)) brightness(1.15) !important;
          outline: none !important;
        }

        .site-nav .account-icon,
        .site-nav .account-link,
        .site-nav .nav-toggle,
        .site-nav .nav-toggle span,
        .site-nav .nav-dropdown-toggle,
        .back-to-top-btn {
          color: color-mix(in srgb, var(--theme-accent, #ffffff) 72%, var(--text-dim) 28%) !important;
          border-color: color-mix(in srgb, var(--theme-accent, #ffffff) 54%, var(--theme-accent-dim) 46%) !important;
        }

        .site-nav .nav-toggle span {
          background: color-mix(in srgb, var(--theme-accent, #ffffff) 72%, var(--theme-accent-dim) 28%) !important;
        }

        .site-nav .account-link:hover,
        .site-nav .account-link:focus-visible,
        .site-nav .account-link:active,
        .site-nav .account-link.active,
        .site-nav .nav-toggle:hover,
        .site-nav .nav-toggle:focus-visible,
        .site-nav .nav-toggle:active,
        .site-nav .nav-toggle[aria-expanded="true"],
        .site-nav .nav-dropdown-toggle:hover,
        .site-nav .nav-dropdown-toggle:focus-visible,
        .site-nav .nav-dropdown-toggle:active,
        .site-nav .nav-dropdown-toggle[aria-expanded="true"],
        .back-to-top-btn:hover,
        .back-to-top-btn:focus-visible,
        .back-to-top-btn:active {
          border-color: var(--theme-accent) !important;
          box-shadow: 0 0 14px var(--theme-accent-glow) !important;
          color: var(--theme-accent) !important;
          filter: drop-shadow(0 0 6px var(--theme-accent-glow)) brightness(1.15) !important;
        }

        .site-nav .account-link:hover .account-icon,
        .site-nav .account-link:focus-visible .account-icon,
        .site-nav .account-link:active .account-icon,
        .site-nav .account-link.active .account-icon {
          color: var(--theme-accent) !important;
          filter: drop-shadow(0 0 7px var(--theme-accent-glow)) brightness(1.2) !important;
        }

        .site-nav .nav-toggle:hover span,
        .site-nav .nav-toggle:focus-visible span,
        .site-nav .nav-toggle:active span,
        .site-nav .nav-toggle[aria-expanded="true"] span {
          background: var(--theme-accent) !important;
        }

        body.holonet-admin-mobile #app {
          align-items: stretch !important;
          padding-left: 12px !important;
          padding-right: 12px !important;
        }

        body.holonet-admin-mobile main {
          max-width: none !important;
          width: 100% !important;
        }

        body.holonet-admin-mobile [data-admin-root],
        body.holonet-admin-mobile [data-admin-root].hub-shell {
          justify-self: stretch !important;
          max-width: none !important;
          min-width: 0 !important;
          width: 100% !important;
        }

        body.holonet-admin-mobile [data-admin-root] .hub-layout {
          display: grid !important;
          grid-template-columns: 1fr !important;
          max-width: none !important;
          min-width: 0 !important;
          width: 100% !important;
        }

        body.holonet-admin-mobile [data-admin-root] .hub-panel {
          max-width: none !important;
          min-width: 0 !important;
          width: 100% !important;
        }

        .nexus-shell .overview-report-grid {
          grid-template-columns: 1fr !important;
          min-width: 0 !important;
        }

        .nexus-shell .overview-card-head {
          display: grid !important;
          gap: 8px !important;
          grid-template-columns: 1fr !important;
          min-width: 0 !important;
        }

        .nexus-shell .overview-card-head > div {
          min-width: 0 !important;
        }

        .nexus-shell .overview-card-head strong {
          display: block !important;
          font-size: clamp(0.8rem, 3.6vw, 1rem) !important;
          letter-spacing: 0.08em !important;
          line-height: 1.25 !important;
          max-width: 100% !important;
          overflow-wrap: anywhere !important;
          word-break: normal !important;
        }

        .nexus-shell .hub-kicker,
        .nexus-shell .nexus-status,
        .nexus-shell .overview-score {
          max-width: 100% !important;
          overflow-wrap: anywhere !important;
        }

        .nexus-shell .nexus-status {
          font-size: 0.58rem !important;
          letter-spacing: 0.14em !important;
        }

        .nexus-shell .overview-score {
          font-size: 1rem !important;
          letter-spacing: 0.12em !important;
        }

        .nexus-shell .overview-total-strip {
          gap: 8px 12px !important;
        }
      }

      #inspection-editor-overlay {
        --editor-accent: rgba(255, 108, 124, 0.68) !important;
        --editor-accent-soft: rgba(255, 132, 145, 0.78) !important;
        --editor-accent-dim: rgba(255, 66, 82, 0.3) !important;
        --editor-accent-glow: rgba(255, 0, 34, 0.1) !important;
        --editor-panel: var(--panel) !important;
        --editor-void: var(--void) !important;
        --editor-wash: rgba(255, 66, 82, 0.03) !important;
        --editor-border: rgba(255, 66, 82, 0.24) !important;
        --editor-label: rgba(255, 132, 145, 0.62) !important;
      }

      #inspection-editor-overlay .resource-editor-container,
      #inspection-editor-overlay .library-editor-container {
        background:
          radial-gradient(ellipse 90% 80% at 100% 0%, rgba(255, 66, 82, 0.035), transparent 68%),
          linear-gradient(135deg, rgba(255, 66, 82, 0.035), transparent),
          var(--panel) !important;
        border-color: rgba(255, 66, 82, 0.24) !important;
        box-shadow:
          0 0 18px rgba(255, 0, 34, 0.055),
          0 24px 70px rgba(0, 0, 0, 0.72),
          inset 0 0 20px rgba(255, 66, 82, 0.025) !important;
      }

      #inspection-editor-overlay .resource-editor-topbar,
      #inspection-editor-overlay .resource-editor-actions,
      #inspection-editor-overlay .resource-editor-form,
      #inspection-editor-overlay .inspection-editor-grid {
        border-color: rgba(255, 66, 82, 0.24) !important;
      }

      #inspection-editor-overlay .resource-editor-topbar,
      #inspection-editor-overlay .resource-editor-actions {
        background: rgba(0, 0, 0, 0.34) !important;
      }

      #inspection-editor-overlay .resource-editor-title,
      #inspection-editor-overlay .resource-editor-status,
      #inspection-editor-overlay .resource-editor-field label,
      #inspection-editor-overlay .inspection-editor-row label {
        color: rgba(255, 132, 145, 0.72) !important;
      }

      #inspection-editor-overlay .inspection-editor-row strong {
        color: rgba(255, 255, 255, 0.92) !important;
        text-shadow: 0 0 8px rgba(255, 0, 34, 0.08) !important;
      }

      #inspection-editor-overlay .resource-editor-field,
      #inspection-editor-overlay .inspection-editor-row {
        background:
          linear-gradient(135deg, rgba(255, 66, 82, 0.035), transparent),
          var(--panel) !important;
        border-color: rgba(255, 66, 82, 0.24) !important;
        box-shadow: inset 0 0 18px rgba(255, 66, 82, 0.018) !important;
      }

      #inspection-editor-overlay .resource-editor-field input,
      #inspection-editor-overlay .resource-editor-field textarea,
      #inspection-editor-overlay .inspection-editor-row input,
      #inspection-editor-overlay .inspection-editor-row textarea {
        background:
          linear-gradient(135deg, rgba(255, 66, 82, 0.035), transparent),
          rgba(12, 4, 7, 0.68) !important;
        border-color: rgba(255, 66, 82, 0.24) !important;
        color: var(--text) !important;
      }

      #inspection-editor-overlay .resource-editor-field input:focus,
      #inspection-editor-overlay .resource-editor-field textarea:focus,
      #inspection-editor-overlay .inspection-editor-row input:focus,
      #inspection-editor-overlay .inspection-editor-row textarea:focus {
        border-color: rgba(255, 132, 145, 0.52) !important;
        box-shadow: 0 0 10px rgba(255, 0, 34, 0.08) !important;
        outline: none !important;
      }

      #inspection-editor-overlay .resource-editor-close,
      #inspection-editor-overlay .resource-editor-submit {
        background:
          linear-gradient(135deg, rgba(255, 66, 82, 0.045), transparent),
          rgba(0, 0, 0, 0.22) !important;
        border-color: rgba(255, 66, 82, 0.28) !important;
        box-shadow: 0 0 10px rgba(255, 0, 34, 0.055) !important;
        color: rgba(255, 132, 145, 0.78) !important;
      }

      #inspection-editor-overlay .resource-editor-close:hover,
      #inspection-editor-overlay .resource-editor-close:focus-visible,
      #inspection-editor-overlay .resource-editor-submit:hover,
      #inspection-editor-overlay .resource-editor-submit:focus-visible {
        border-color: var(--theme-accent-dim) !important;
        color: var(--theme-accent-soft) !important;
        text-shadow: 0 0 6px var(--theme-accent-glow) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function openPageSearch() {
    const path = normalizedPath();
    const isHandbook = path.endsWith("/handbooks");
    const handbookToggle = document.querySelector("[data-pdf-open-search], [data-pdf-search-toggle], [data-search-toggle], .pdf-search-toggle, .document-search-toggle");

    if (isHandbook && handbookToggle) {
      handbookToggle.click();
      return;
    }

    const keyboardInit = {
      key: "f",
      code: "KeyF",
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    };

    document.dispatchEvent(new KeyboardEvent("keydown", keyboardInit));
    window.dispatchEvent(new KeyboardEvent("keydown", keyboardInit));

    requestAnimationFrame(() => {
      const overlay = document.getElementById("search-overlay");
      const input = document.getElementById("search-input");
      if (overlay && input && !overlay.classList.contains("active")) {
        overlay.classList.add("active");
        input.focus();
        input.select();
      }
    });
  }

  function ensureMobileSearchShortcut() {
    ensureStyles();

    const existing = document.querySelector(`.${SEARCH_BUTTON_CLASS}`);
    if (!isMobile() || !searchShortcutAllowed()) {
      existing?.remove();
      return;
    }

    if (existing) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = SEARCH_BUTTON_CLASS;
    button.setAttribute("aria-label", "Open search");
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>';
    button.addEventListener("click", openPageSearch);
    document.body.appendChild(button);
  }

  function numericRank(row) {
    const rankInput = row.querySelector('input[name^="rank-"]');
    const rank = Number(rankInput?.value || 0);
    if (Number.isFinite(rank) && rank > 0) return rank;

    const role = String(
      row.querySelector('input[name^="role-"]')?.value ||
      row.querySelector("span")?.textContent ||
      ""
    ).toLowerCase();

    const roleRanks = [
      ["commander", 1000],
      ["command", 940],
      ["overseer", 900],
      ["captain", 840],
      ["officer", 780],
      ["master", 700],
      ["lord", 640],
      ["darth", 620],
      ["marauder", 560],
      ["seer", 540],
      ["warrior", 500],
      ["sorcerer", 480],
      ["adept", 420],
      ["apprentice", 360],
      ["prospect", 300],
      ["acolyte", 260],
      ["initiate", 220],
      ["neophyte", 180],
      ["hopeful", 140],
      ["tyro", 100],
      ["grotthu", 60]
    ];

    return roleRanks.find(([token]) => role.includes(token))?.[1] || 0;
  }

  function rowIdentity(row) {
    return String(
      row.querySelector('input[name^="robloxId-"]')?.value ||
      row.querySelector('input[name^="username-"]')?.value ||
      row.textContent ||
      ""
    ).trim();
  }

  function reindexReportRow(row, index) {
    row.dataset.reportMember = String(index);
    row.querySelectorAll("input[name]").forEach(input => {
      input.name = input.name.replace(/-\d+$/, `-${index}`);
    });
  }

  function sortWeeklyReportRows() {
    document.querySelectorAll(".weekly-report-grid").forEach(grid => {
      const rows = Array.from(grid.querySelectorAll("[data-report-member]"));
      if (rows.length < 2) {
        rows.forEach(reindexReportRow);
        return;
      }

      const sorted = rows.slice().sort((left, right) => {
        const rankDiff = numericRank(right) - numericRank(left);
        if (rankDiff) return rankDiff;
        return rowIdentity(left).localeCompare(rowIdentity(right));
      });

      const orderChanged = sorted.some((row, index) => row !== rows[index]);
      const indexChanged = sorted.some((row, index) => {
        return row.dataset.reportMember !== String(index) ||
          Array.from(row.querySelectorAll("input[name]")).some(input => !input.name.endsWith(`-${index}`));
      });

      if (!orderChanged && !indexChanged) return;

      sorted.forEach((row, index) => {
        reindexReportRow(row, index);
        if (orderChanged) grid.appendChild(row);
      });
    });
  }

  function syncAdminMobileClass() {
    document.body.classList.toggle("holonet-admin-mobile", Boolean(document.querySelector("[data-admin-root]")));
  }

  function queueSortWeeklyReportRows() {
    if (sortQueued) return;
    sortQueued = true;
    requestAnimationFrame(() => {
      sortQueued = false;
      sortWeeklyReportRows();
    });
  }

  function boot() {
    ensureStyles();
    ensureMobileSearchShortcut();
    syncAdminMobileClass();
    sortWeeklyReportRows();

    if (!observer) {
      observer = new MutationObserver(() => {
        ensureMobileSearchShortcut();
        syncAdminMobileClass();
        queueSortWeeklyReportRows();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("resize", ensureMobileSearchShortcut);
  window.addEventListener("popstate", ensureMobileSearchShortcut);
})();
