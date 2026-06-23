import { Analytics } from "@vercel/analytics/next";
import { defaultMetadata } from "../lib/metadata.js";
import { criticalPreloadImages } from "../lib/preload-images.js";

import "../../css/style.css";
import "../../css/themes.css";
import "../../css/nav.css";
import "../../css/codex.css";
import "../../css/search.css";
import "../../css/document.css";
import "../../css/registry.css";
import "../../css/hub.css";
import "../../css/legal.css";
import "../../css/editor.css";
import "../../css/crt.css";
import "../../css/loader-overlays.css";

const PDFJS_MODULE_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";

const MOBILE_NAV_FULL_BLEED_CSS = `
@media (max-width: 700px) {
  .site-nav {
    left: 0 !important;
    right: 0 !important;
    width: 100vw !important;
    max-width: none !important;
  }

  .site-nav .nav-inner {
    left: 0 !important;
    right: auto !important;
    width: 100vw !important;
    max-width: none !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  .site-nav .nav-toggle {
    left: max(8px, env(safe-area-inset-left)) !important;
  }

  .site-nav .nav-left {
    left: calc(max(8px, env(safe-area-inset-left)) + 42px) !important;
  }

  .site-nav .nav-right {
    right: max(8px, env(safe-area-inset-right)) !important;
  }

  .site-nav .nav-center,
  .site-nav .nav-links,
  .site-nav .nav-item,
  .site-nav .nav-item--dropdown,
  .site-nav .nav-split {
    width: 100vw !important;
    max-width: none !important;
  }

  .site-nav .nav-links {
    left: 0 !important;
    right: auto !important;
  }

  .site-nav .nav-dropdown-menu {
    width: 100vw !important;
    max-width: none !important;
  }
}
`;

const MOBILE_TRACKER_TABLE_CSS = `
@media (max-width: 700px) {
  .hub-shell,
  .hub-grid,
  .hub-column,
  .hub-panel,
  .hub-list,
  .hub-section-row,
  .tracking-table-wrap {
    min-width: 0 !important;
    max-width: 100% !important;
  }

  .tracking-table-wrap {
    display: block !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    width: 100% !important;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-inline: contain;
  }

  .tracking-table {
    max-width: none !important;
    min-width: 560px;
    width: max-content;
  }

  .tracking-table th,
  .tracking-table td {
    white-space: nowrap;
  }
}
`;

const MOBILE_STATUS_BAR_CSS = `
@media (max-width: 700px) {
  .status-bar {
    display: none !important;
  }
}
`;

const MID_SIZE_HOME_NAV_CSS = `
@media (min-width: 1600px) and (max-width: 1899px) {
  .home-main {
    max-width: min(calc(100vw - 160px), 1240px) !important;
  }

  .home-main .nav-card {
    height: clamp(340px, 32vh, 460px) !important;
    min-height: 340px !important;
    padding: 38px 30px !important;
    padding-right: 16px !important;
  }

  .home-main .card-bg-glyph {
    font-size: clamp(11rem, 10vw, 13.5rem) !important;
  }

  .home-main .card-category {
    font-size: 0.58rem !important;
  }

  .home-main .card-title {
    font-size: clamp(1.75rem, 1.75vw, 2.25rem) !important;
  }

  .home-main .card-desc {
    font-size: 0.9rem !important;
  }

  .site-nav .nav-inner {
    height: 68px !important;
  }

  .site-nav .nav-link {
    padding: 12px 20px !important;
  }

  .site-nav .nav-link-prefix {
    font-size: 0.42rem !important;
  }

  .site-nav .nav-link-label {
    font-size: 0.86rem !important;
  }

  .nav-offset {
    padding-top: 68px !important;
  }
}
`;

const LIBRARY_EDITOR_ADMIN_THEME_CSS = `
#library-editor-overlay {
  --editor-accent: rgba(255, 108, 124, 0.68) !important;
  --editor-accent-soft: rgba(255, 132, 145, 0.78) !important;
  --editor-accent-dim: rgba(255, 66, 82, 0.3) !important;
  --editor-accent-glow: rgba(255, 0, 34, 0.1) !important;
  --editor-panel: var(--panel) !important;
  --editor-void: var(--void) !important;
  --editor-wash: rgba(255, 66, 82, 0.03) !important;
  --editor-border: rgba(255, 66, 82, 0.24) !important;
  --editor-label: rgba(255, 132, 145, 0.62) !important;
  --editor-field: linear-gradient(135deg, rgba(255, 66, 82, 0.035), transparent), var(--panel) !important;
  --editor-field-focus: linear-gradient(135deg, rgba(255, 66, 82, 0.055), transparent), var(--panel) !important;
}

#library-editor-overlay .resource-editor-container,
#library-editor-overlay .library-entry-editor {
  background:
    linear-gradient(135deg, rgba(255, 66, 82, 0.035), transparent),
    var(--panel) !important;
  border-color: rgba(255, 66, 82, 0.24) !important;
  box-shadow:
    0 0 18px rgba(255, 0, 34, 0.055),
    0 24px 70px rgba(0, 0, 0, 0.72),
    inset 0 0 20px rgba(255, 66, 82, 0.025) !important;
}

#library-editor-overlay .resource-editor-topbar,
#library-editor-overlay .resource-editor-actions,
#library-editor-overlay .resource-editor-footer,
#library-editor-overlay .library-entry-toolbar {
  background: rgba(0, 0, 0, 0.34) !important;
  border-color: rgba(255, 66, 82, 0.24) !important;
}

#library-editor-overlay .resource-editor-field {
  background:
    linear-gradient(135deg, rgba(255, 66, 82, 0.035), transparent),
    var(--panel) !important;
  border-color: rgba(255, 66, 82, 0.24) !important;
}

#library-editor-overlay .resource-editor-field label,
#library-editor-overlay .resource-editor-status,
#library-editor-overlay .resource-editor-hint,
#library-editor-overlay .library-entry-title {
  color: rgba(255, 132, 145, 0.62) !important;
}

#library-editor-overlay .resource-editor-actions::before,
#library-editor-overlay .resource-editor-field label::before {
  color: rgba(255, 108, 124, 0.62) !important;
  text-shadow: 0 0 6px rgba(255, 0, 34, 0.08) !important;
}

#library-editor-overlay .resource-editor-close,
#library-editor-overlay .resource-editor-submit,
#library-editor-overlay .library-inline-btn {
  background:
    linear-gradient(135deg, rgba(255, 66, 82, 0.045), transparent),
    rgba(0, 0, 0, 0.22) !important;
  border-color: rgba(255, 66, 82, 0.28) !important;
  box-shadow: 0 0 10px rgba(255, 0, 34, 0.055) !important;
  color: rgba(255, 132, 145, 0.78) !important;
}

#library-editor-overlay .resource-editor-close:hover,
#library-editor-overlay .resource-editor-submit:hover,
#library-editor-overlay .library-inline-btn:hover,
#library-editor-overlay .resource-editor-close:focus-visible,
#library-editor-overlay .resource-editor-submit:focus-visible,
#library-editor-overlay .library-inline-btn:focus-visible {
  background:
    linear-gradient(90deg, var(--theme-wash) 0%, transparent 50%, var(--theme-wash) 100%),
    rgba(0, 0, 0, 0.32) !important;
  border-color: var(--theme-accent-dim) !important;
  box-shadow:
    0 0 10px var(--theme-accent-glow),
    inset 0 0 14px rgba(192, 0, 26, 0.035) !important;
  color: var(--theme-accent-soft) !important;
  text-shadow: 0 0 6px var(--theme-accent-glow) !important;
}

#library-editor-overlay .resource-editor-field input,
#library-editor-overlay .resource-editor-field select,
#library-editor-overlay .resource-editor-field textarea {
  background:
    linear-gradient(135deg, rgba(255, 66, 82, 0.035), transparent),
    var(--panel) !important;
  border-color: rgba(255, 66, 82, 0.24) !important;
}
`;

function siteUrl() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";

  return url.startsWith("http") ? url : `https://${url}`;
}

export const metadata = {
  metadataBase: new URL(siteUrl()),
  ...defaultMetadata
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="modulepreload" href={PDFJS_MODULE_URL} crossOrigin="anonymous" />
        <link rel="modulepreload" href={PDFJS_WORKER_URL} crossOrigin="anonymous" />
        {criticalPreloadImages.map(src => (
          <link href={src} key={src} rel="preload" as="image" />
        ))}
        <style dangerouslySetInnerHTML={{ __html: `${MOBILE_NAV_FULL_BLEED_CSS}\n${MOBILE_TRACKER_TABLE_CSS}\n${MOBILE_STATUS_BAR_CSS}\n${MID_SIZE_HOME_NAV_CSS}\n${LIBRARY_EDITOR_ADMIN_THEME_CSS}` }} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
