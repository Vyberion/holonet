(function () {
  "use strict";

  const STYLE_ID = "holonet-latest-hub-tweaks-style";

  function toRoman(value) {
    const number = Math.max(1, Math.min(3999, Number(value) || 1));
    const numerals = [
      [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
      [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
      [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
    ];
    let remaining = number;
    let result = "";
    numerals.forEach(([amount, glyph]) => {
      while (remaining >= amount) {
        result += glyph;
        remaining -= amount;
      }
    });
    return result;
  }

  function ensureLatestHubTweaks() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-hub-card="documents"] .hub-row {
        gap: 6px !important;
      }

      [data-hub-card="documents"] .hub-row > .hub-timestamp {
        margin-bottom: 0 !important;
        padding-bottom: 0 !important;
      }

      [data-hub-card="documents"] .hub-row > .hub-card-actions {
        margin-top: 2px !important;
        padding-top: 6px !important;
      }

      .council-result-panel {
        margin-left: 0 !important;
        margin-right: 0 !important;
        max-width: none !important;
        width: auto !important;
      }

      .council-result-grid {
        max-width: none !important;
        width: 100% !important;
      }

      .council-result-grid > div,
      .council-actions button,
      .council-actions .hub-write-btn,
      .council-actions .hub-row-edit {
        box-sizing: border-box !important;
        padding-left: clamp(14px, 1.6vw, 22px) !important;
        padding-right: clamp(14px, 1.6vw, 22px) !important;
        text-align: center !important;
      }

      .tracking-table {
        border-collapse: collapse !important;
        table-layout: fixed !important;
        width: 100% !important;
      }

      .tracking-table th,
      .tracking-table td {
        box-sizing: border-box !important;
        line-height: 1.45 !important;
        overflow-wrap: anywhere !important;
        padding: 10px 12px !important;
        text-align: left !important;
        vertical-align: top !important;
        white-space: normal !important;
      }

      .tracking-table th:nth-child(1),
      .tracking-table td:nth-child(1) {
        width: 46% !important;
      }

      .tracking-table th:nth-child(2),
      .tracking-table td:nth-child(2) {
        width: 32% !important;
      }

      .tracking-table th:nth-child(3),
      .tracking-table td:nth-child(3) {
        width: 22% !important;
      }

      .tracking-table td:first-child strong,
      .tracking-table td:first-child span {
        display: block !important;
        min-width: 0 !important;
        overflow-wrap: anywhere !important;
      }

      #report-view-overlay .tracking-table th:nth-child(1),
      #report-view-overlay .tracking-table td:nth-child(1) {
        width: 34% !important;
      }

      #report-view-overlay .tracking-table th:nth-child(2),
      #report-view-overlay .tracking-table td:nth-child(2) {
        width: 24% !important;
      }

      #report-view-overlay .tracking-table th:nth-child(3),
      #report-view-overlay .tracking-table td:nth-child(3),
      #report-view-overlay .tracking-table th:nth-child(4),
      #report-view-overlay .tracking-table td:nth-child(4),
      #report-view-overlay .tracking-table th:nth-child(5),
      #report-view-overlay .tracking-table td:nth-child(5) {
        width: 14% !important;
      }

      .weekly-report-member {
        align-items: center !important;
        display: grid !important;
        gap: 10px !important;
        grid-template-columns: minmax(220px, 2fr) repeat(4, minmax(106px, 1fr)) !important;
      }

      .weekly-report-member > div {
        display: grid !important;
        gap: 4px !important;
        min-width: 0 !important;
      }

      .weekly-report-member strong,
      .weekly-report-member span {
        overflow-wrap: anywhere !important;
      }

      .weekly-report-member label {
        align-items: center !important;
        display: grid !important;
        gap: 5px !important;
        grid-template-columns: auto minmax(0, 1fr) !important;
        min-width: 0 !important;
      }

      @media (max-width: 700px) {
        .tracking-table {
          min-width: 620px !important;
          width: 100% !important;
        }

        .weekly-report-member {
          grid-template-columns: 1fr 1fr !important;
        }

        .weekly-report-member > div {
          grid-column: 1 / -1 !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function romanizeCodexSubsections(root = document) {
    root.querySelectorAll?.(".sub-marker").forEach(marker => {
      marker.textContent = marker.textContent.replace(/Sub-Section\s+(\d+)/i, (_, value) => `Sub-Section ${toRoman(value)}`);
    });
  }

  function hideDarkCouncilManagersFromActivity(root = document) {
    const mount = document.querySelector('[data-division="darkCouncil"][data-division-section="trackers"]');
    if (!mount) return;

    mount.querySelectorAll(".tracking-table tbody tr").forEach(row => {
      const rankCell = row.querySelector("td:nth-child(2)");
      const rankText = String(rankCell?.textContent || "").toLowerCase();
      if (/\b(project\s*manager|group\s*owner|owner|manager)\b/.test(rankText)) {
        row.remove();
      }
    });
  }

  function applyTweaks(root = document) {
    ensureLatestHubTweaks();
    romanizeCodexSubsections(root);
    hideDarkCouncilManagersFromActivity(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyTweaks();
      new MutationObserver(mutations => {
        mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) applyTweaks(node);
        }));
        hideDarkCouncilManagersFromActivity();
      }).observe(document.body, { childList: true, subtree: true });
    });
  } else {
    applyTweaks();
    new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) applyTweaks(node);
      }));
      hideDarkCouncilManagersFromActivity();
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
