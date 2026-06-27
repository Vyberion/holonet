(function () {
  "use strict";

  const STYLE_ID = "holonet-hub-layout-fixes-style";

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

      #report-view-overlay {
        align-items: center;
        background: rgba(0, 0, 0, 0.8);
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureStyles);
  } else {
    ensureStyles();
  }
})();
