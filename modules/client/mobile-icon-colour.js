(function () {
  "use strict";

  const STYLE_ID = "holonet-mobile-icon-colour-style";

  function ensureMobileIconColour() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @media (max-width: 700px) {
        :root {
          --holonet-mobile-icon-colour: color-mix(in srgb, var(--theme-accent, #ffffff) 72%, var(--text-dim) 28%);
          --holonet-mobile-icon-border: color-mix(in srgb, var(--theme-accent, #ffffff) 54%, var(--theme-accent-dim) 46%);
        }

        body:not([class*="theme-"]) .site-nav .account-icon,
        body:not([class*="theme-"]) .site-nav .account-icon svg,
        body:not([class*="theme-"]) .site-nav .account-icon svg *,
        body:not([class*="theme-"]) .site-nav .nav-toggle,
        body:not([class*="theme-"]) .site-nav .nav-dropdown-toggle,
        body:not([class*="theme-"]) .site-nav .nav-dropdown-toggle svg,
        body:not([class*="theme-"]) .site-nav .nav-dropdown-toggle svg *,
        body:not([class*="theme-"]) .back-to-top-btn,
        body:not([class*="theme-"]) .back-to-top-btn svg,
        body:not([class*="theme-"]) .back-to-top-btn svg * {
          color: var(--holonet-mobile-icon-colour) !important;
          stroke: var(--holonet-mobile-icon-colour) !important;
        }

        body:not([class*="theme-"]) .site-nav .account-link,
        body:not([class*="theme-"]) .site-nav .nav-toggle,
        body:not([class*="theme-"]) .site-nav .nav-dropdown-toggle,
        body:not([class*="theme-"]) .back-to-top-btn {
          border-color: var(--holonet-mobile-icon-border) !important;
        }

        body:not([class*="theme-"]) .site-nav .nav-toggle span {
          background: var(--holonet-mobile-icon-colour) !important;
          color: var(--holonet-mobile-icon-colour) !important;
        }

        body:not([class*="theme-"]) .site-nav .account-link:active .account-icon,
        body:not([class*="theme-"]) .site-nav .account-link.active .account-icon,
        body:not([class*="theme-"]) .site-nav .nav-dropdown-toggle:active,
        body:not([class*="theme-"]) .site-nav .nav-dropdown-toggle[aria-expanded="true"],
        body:not([class*="theme-"]) .back-to-top-btn:active,
        body:not([class*="theme-"]) .back-to-top-btn:active svg,
        body:not([class*="theme-"]) .back-to-top-btn:active svg * {
          color: var(--theme-accent) !important;
          stroke: var(--theme-accent) !important;
        }

        body:not([class*="theme-"]) .site-nav .nav-toggle:active span,
        body:not([class*="theme-"]) .site-nav .nav-toggle[aria-expanded="true"] span {
          background: var(--theme-accent) !important;
          color: var(--theme-accent) !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", ensureMobileIconColour);
    } else {
      ensureMobileIconColour();
    }
  } else {
    ensureMobileIconColour();
  }
})();
