(function () {
  "use strict";

  const STYLE_ID = "holonet-latest-hub-tweaks-style";

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
    `;

    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureLatestHubTweaks);
  } else {
    ensureLatestHubTweaks();
  }
})();
