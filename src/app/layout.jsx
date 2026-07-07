import {
  EMBED_IMAGE_HEIGHT,
  EMBED_IMAGE_WIDTH,
  defaultMetadata,
  embedImageUrl,
  siteUrl
} from "../lib/metadata.js";
import { HolonetAudioController } from "../components/HolonetAudioController.jsx";
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

const HOLONET_GLOBAL_POLISH_CSS = `
#loader::before {
  background:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      color-mix(in srgb, var(--theme-accent, #ffffff) 10%, transparent) 2px,
      color-mix(in srgb, var(--theme-accent, #ffffff) 10%, transparent) 4px
    ),
    linear-gradient(90deg, color-mix(in srgb, var(--theme-accent, #ffffff) 5%, transparent), transparent 18%, transparent 82%, color-mix(in srgb, var(--theme-accent, #ffffff) 4%, transparent)) !important;
}

#loader::after {
  background:
    radial-gradient(ellipse 100% 100% at 50% 50%, transparent 34%, rgba(0, 0, 0, 0.72) 100%),
    radial-gradient(ellipse 62% 52% at 50% 50%, color-mix(in srgb, var(--theme-accent, #ffffff) 6%, transparent) 0%, transparent 66%),
    radial-gradient(ellipse 100% 90% at 50% 0%, color-mix(in srgb, var(--theme-accent, #ffffff) 5%, transparent) 0%, transparent 62%) !important;
}

body.theme-dhg #resource-editor-overlay,
body.theme-highranks #resource-editor-overlay,
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
  --editor-field: linear-gradient(135deg, rgba(255, 66, 82, 0.035), transparent), var(--panel) !important;
  --editor-field-focus: linear-gradient(135deg, rgba(255, 66, 82, 0.055), transparent), var(--panel) !important;
}

body.theme-dhg #resource-editor-overlay .resource-editor-container,
body.theme-highranks #resource-editor-overlay .resource-editor-container,
#inspection-editor-overlay .resource-editor-container {
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

.council-result-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
}

.council-result-grid > div:nth-child(4) {
  display: none !important;
}

[data-admin-root] .hub-layout {
  align-items: start;
  grid-auto-flow: row dense;
}

[data-admin-root] .hub-panel {
  align-self: start;
}

.hierarchy-rank-nav {
  align-items: stretch;
}

.hierarchy-rank-nav-link--next {
  flex: 1 1 0;
}

.mobile-search-shortcut {
  display: none;
}

@media (max-width: 700px) {
  .site-nav .nav-links.open {
    border-bottom: 1px solid var(--theme-accent-dim) !important;
    box-shadow:
      0 8px 40px var(--theme-body-glow-a),
      0 1px 0 var(--theme-accent-dim) !important;
  }

  .site-nav .account-icon,
  .site-nav .account-link,
  .site-nav .nav-toggle,
  .site-nav .nav-toggle span,
  .back-to-top-btn {
    color: var(--theme-accent-soft) !important;
    border-color: var(--theme-accent-dim) !important;
  }

  .site-nav .nav-toggle span {
    background: var(--theme-accent-dim) !important;
  }

  #resource-editor-overlay,
  #library-editor-overlay,
  #inspection-editor-overlay,
  #council-editor-overlay,
  #timeline-editor-overlay,
  #cots-editor-overlay {
    align-items: stretch !important;
    justify-content: stretch !important;
    padding: 0 !important;
  }

  #resource-editor-overlay.active,
  #library-editor-overlay.active,
  #inspection-editor-overlay.active,
  #council-editor-overlay.active,
  #timeline-editor-overlay.active,
  #cots-editor-overlay.active {
    display: flex !important;
  }

  #resource-editor-overlay .resource-editor-container,
  #library-editor-overlay .resource-editor-container,
  #inspection-editor-overlay .resource-editor-container,
  #council-editor-overlay .resource-editor-container,
  #timeline-editor-overlay .resource-editor-container,
  #cots-editor-overlay .resource-editor-container,
  #library-editor-overlay .library-editor-container,
  #inspection-editor-overlay .library-editor-container,
  #council-editor-overlay .library-editor-container,
  #timeline-editor-overlay .library-editor-container,
  #cots-editor-overlay .library-editor-container {
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

  #resource-editor-overlay .resource-editor-form,
  #library-editor-overlay .resource-editor-form,
  #inspection-editor-overlay .resource-editor-form,
  #council-editor-overlay .resource-editor-form,
  #timeline-editor-overlay .resource-editor-form,
  #cots-editor-overlay .resource-editor-form,
  #library-editor-overlay .library-editor-form {
    flex: 1 1 auto !important;
    max-height: none !important;
    overflow-y: auto !important;
  }

  .resource-editor-topbar {
    padding-top: max(12px, env(safe-area-inset-top)) !important;
  }

  .resource-editor-actions {
    padding-bottom: max(10px, env(safe-area-inset-bottom)) !important;
  }

  .resource-editor-footer,
  .search-footer {
    display: none !important;
  }

  .mobile-search-shortcut {
    align-items: center;
    background: rgba(0, 0, 0, 0.18);
    border: 1px solid var(--theme-accent-dim);
    bottom: 60px;
    box-shadow: none;
    clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px));
    color: var(--theme-accent-soft);
    cursor: crosshair;
    display: flex;
    height: 36px;
    justify-content: center;
    padding: 8px;
    position: fixed;
    right: 16px;
    transition: border-color 0.3s, box-shadow 0.3s, color 0.3s, filter 0.3s;
    width: 36px;
    z-index: 2100;
  }

  .mobile-search-shortcut svg {
    height: 20px;
    width: 20px;
  }

  .mobile-search-shortcut:hover,
  .mobile-search-shortcut:focus-visible,
  .mobile-search-shortcut:active {
    border-color: var(--theme-accent);
    box-shadow: 0 0 14px var(--theme-accent-glow);
    color: var(--theme-accent);
    filter: drop-shadow(0 0 6px var(--theme-accent-glow));
    outline: none;
  }

  .hub-grid {
    display: flex !important;
    flex-direction: column !important;
  }

  .hub-column {
    display: contents !important;
  }

  [data-hub-card="pages"] { order: 1; }
  [data-hub-card="documents"] { order: 2; }
  [data-hub-card="transmissions"] { order: 3; }
  [data-hub-card="activity"] { order: 4; }
  [data-hub-card="reports"] { order: 5; }

  .nexus-shell,
  .overview-report-card,
  .overview-inspection-card {
    min-width: 0 !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
  }

  .overview-mini-table,
  .overview-inspection-table {
    display: block !important;
    max-width: 100% !important;
    overflow-x: auto !important;
    width: 100% !important;
    -webkit-overflow-scrolling: touch;
  }

  .overview-mini-table thead,
  .overview-mini-table tbody,
  .overview-inspection-table thead,
  .overview-inspection-table tbody {
    display: table;
    min-width: 560px;
    width: 100%;
  }
}
`;

const HOLONET_GLOBAL_POLISH_JS = `
(function () {
  if (typeof window === "undefined") return;

  const activeOverlays = "#resource-editor-overlay, #library-editor-overlay, #inspection-editor-overlay, #council-editor-overlay, #timeline-editor-overlay, #cots-editor-overlay, #search-overlay";
  const editorPanels = ".resource-editor-container, .library-editor-container, #search-container, .search-container";
  let selectionGuard = false;

  function hasTextSelection() {
    const selection = window.getSelection?.();
    return Boolean(selection && !selection.isCollapsed && String(selection).trim());
  }

  document.addEventListener("pointerdown", event => {
    if (event.target.closest(editorPanels) || hasTextSelection()) {
      selectionGuard = true;
    }
  }, true);

  document.addEventListener("click", event => {
    if (!event.target.matches(activeOverlays)) {
      if (!event.target.closest(editorPanels)) selectionGuard = false;
      return;
    }

    if (selectionGuard || hasTextSelection()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      selectionGuard = false;
    }
  }, true);

  function isMobile() {
    return window.matchMedia?.("(max-width: 700px)").matches;
  }

  function searchShortcutAllowed() {
    const path = window.location.pathname.replace(/\\/+$/, "") || "/";
    return path === "/codex" || path === "/archives" || path.endsWith("/handbooks");
  }

  function openPageSearch() {
    const handbookPath = window.location.pathname.replace(/\\/+$/, "").endsWith("/handbooks");
    const handbookToggle = document.querySelector('[data-pdf-open-search], [data-pdf-search-toggle], [data-search-toggle], .pdf-search-toggle, .document-search-toggle, button[aria-label*="Search" i]');
    if (handbookPath && handbookToggle) {
      handbookToggle.click();
      return;
    }

    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "f",
      code: "KeyF",
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }));
  }

  function ensureMobileSearchShortcut() {
    const existing = document.querySelector(".mobile-search-shortcut");
    if (!isMobile() || !searchShortcutAllowed()) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mobile-search-shortcut";
    button.setAttribute("aria-label", "Open search");
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>';
    button.addEventListener("click", openPageSearch);
    document.body.appendChild(button);
  }

  function replaceExactText(selector, replacements) {
    document.querySelectorAll(selector).forEach(element => {
      const key = element.textContent.trim();
      if (Object.prototype.hasOwnProperty.call(replacements, key) && element.textContent !== replacements[key]) {
        element.textContent = replacements[key];
      }
    });
  }

  function syncSurfaceText() {
    replaceExactText(".personnel-empty", {
      "Awaiting personnel query.": "Awaiting query.",
      "Awaiting personnel query": "Awaiting query"
    });

    replaceExactText(".hub-panel-title, .hub-label, .hub-action strong, .hub-title, .nav-link-label", {
      "Trackers": "Activity",
      "Tracking": "Activity",
      "Open Tracking": "Open Activity"
    });

    document.querySelectorAll(".hub-kicker").forEach(kicker => {
      if (kicker.textContent.trim().toLowerCase() !== "status") return;
      const value = kicker.parentElement?.querySelector(".hub-value");
      if (value && value.textContent !== "ACTIVE") value.textContent = "ACTIVE";
    });

    replaceExactText(".council-floor-hero .hub-value", {
      "Council": "Dark Council",
      "Emperor's Powerbase": "High Command",
      "The Emperor's Voice": "High Command",
      "The Emperor's Wrath": "High Command",
      "Group Owner": "Owner"
    });
  }

  function tierAtLeast(value) {
    return ["member", "nco", "command", "leadership"].includes(String(value || "").toLowerCase());
  }

  let inquisitoriusAccessChecked = false;

  async function syncInquisitoriusDescription() {
    const path = window.location.pathname.replace(/\\/+$/, "") || "/";
    if (path !== "/inquisitors" && path !== "/inquisitors/info") return;

    const targets = Array.from(document.querySelectorAll(".reg-text, .hub-summary"));
    const target = targets.find(element => /Division information can be filled in here|REDACTED|Intelligence and background oversight/i.test(element.textContent));
    if (!target) return;

    const permittedText = "Intelligence and background oversight of the group to ensure high standards.";
    const redactedText = "REDACTED.";
    let permitted = false;

    try {
      const raw = sessionStorage.getItem("holonet:access:global");
      const cached = raw ? JSON.parse(raw) : null;
      const profile = cached?.profile;
      permitted = Boolean(profile?.isSuperUser || profile?.hasFullAccess || tierAtLeast(profile?.divisions?.inquisitors));
    } catch {}

    target.textContent = permitted ? permittedText : redactedText;
    if (inquisitoriusAccessChecked) return;
    inquisitoriusAccessChecked = true;

    try {
      const response = await fetch("/api/auth/check-access", { cache: "no-store" });
      const payload = await response.json();
      const profile = payload?.profile;
      const allowed = Boolean(profile?.isSuperUser || profile?.hasFullAccess || tierAtLeast(profile?.divisions?.inquisitors));
      target.textContent = allowed ? permittedText : redactedText;
    } catch {}
  }

  function sortWeeklyReportEditorRows() {
    document.querySelectorAll(".weekly-report-grid").forEach(grid => {
      const rows = Array.from(grid.querySelectorAll("[data-report-member]"));
      const sorted = rows.slice().sort((left, right) => {
        const leftRank = Number(left.querySelector('input[name^="rank-"]')?.value || 0);
        const rightRank = Number(right.querySelector('input[name^="rank-"]')?.value || 0);
        return rightRank - leftRank;
      });
      if (!sorted.some((row, index) => row !== rows[index])) return;
      sorted.forEach(row => grid.appendChild(row));
    });
  }

  function bootPolish() {
    ensureMobileSearchShortcut();
    syncSurfaceText();
    syncInquisitoriusDescription();
    sortWeeklyReportEditorRows();
  }

  let polishQueued = false;
  const observerOpts = { childList: true, subtree: true };

  function schedulePolish() {
    if (polishQueued) return;
    polishQueued = true;
    Promise.resolve().then(() => {
      polishQueued = false;
      observer.disconnect();
      bootPolish();
      if (document.body) observer.observe(document.body, observerOpts);
    });
  }

  const observer = new MutationObserver(schedulePolish);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bootPolish();
      if (document.body) observer.observe(document.body, observerOpts);
    });
  } else {
    bootPolish();
    if (document.body) observer.observe(document.body, observerOpts);
  }

  window.addEventListener("resize", ensureMobileSearchShortcut);
})();
`;

export const metadata = {
  metadataBase: new URL(siteUrl()),
  ...defaultMetadata
};

export default function RootLayout({ children }) {
  const embedImage = embedImageUrl();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta property="og:image" content={embedImage} />
        <meta property="og:image:secure_url" content={embedImage} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content={String(EMBED_IMAGE_WIDTH)} />
        <meta property="og:image:height" content={String(EMBED_IMAGE_HEIGHT)} />
        <meta name="twitter:image" content={embedImage} />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="modulepreload" href={PDFJS_MODULE_URL} crossOrigin="anonymous" />
        <link rel="modulepreload" href={PDFJS_WORKER_URL} crossOrigin="anonymous" />
        {criticalPreloadImages.map(src => (
          <link href={src} key={src} rel="preload" as="image" />
        ))}
        <style dangerouslySetInnerHTML={{ __html: `${MOBILE_NAV_FULL_BLEED_CSS}\n${MOBILE_TRACKER_TABLE_CSS}\n${MOBILE_STATUS_BAR_CSS}\n${MID_SIZE_HOME_NAV_CSS}\n${LIBRARY_EDITOR_ADMIN_THEME_CSS}\n${HOLONET_GLOBAL_POLISH_CSS}` }} />
      </head>
      <body>
        <HolonetAudioController />
        {children}
        <script dangerouslySetInnerHTML={{ __html: HOLONET_GLOBAL_POLISH_JS }} />
      </body>
    </html>
  );
}
