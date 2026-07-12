"use client";

import { useEffect } from "react";

export function GlobalPolish() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const activeOverlays = "#resource-editor-overlay, #library-editor-overlay, #inspection-editor-overlay, #council-editor-overlay, #timeline-editor-overlay, #cots-editor-overlay, #search-overlay";
    const editorPanels = ".resource-editor-container, .library-editor-container, #search-container, .search-container";
    let selectionGuard = false;

    function hasTextSelection() {
      const selection = window.getSelection?.();
      return Boolean(selection && !selection.isCollapsed && String(selection).trim());
    }

    const onPointerDown = (event) => {
      if (event.target.closest(editorPanels) || hasTextSelection()) {
        selectionGuard = true;
      }
    };

    const onClick = (event) => {
      if (!event.target.matches(activeOverlays)) {
        if (!event.target.closest(editorPanels)) selectionGuard = false;
        return;
      }

      if (selectionGuard || hasTextSelection()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        selectionGuard = false;
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);

    function isMobile() {
      return window.matchMedia?.("(max-width: 700px)").matches;
    }

    function searchShortcutAllowed() {
      const path = window.location.pathname.replace(/\/+$/, "") || "/";
      return path === "/codex" || path === "/archives" || path.endsWith("/handbooks");
    }

    function openPageSearch() {
      const handbookPath = window.location.pathname.replace(/\/+$/, "").endsWith("/handbooks");
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

    function tierAtLeast(value) {
      return ["member", "nco", "command", "leadership"].includes(String(value || "").toLowerCase());
    }

    let inquisitoriusAccessChecked = false;

    async function syncInquisitoriusDescription() {
      const path = window.location.pathname.replace(/\/+$/, "") || "/";
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

    bootPolish();
    if (document.body) observer.observe(document.body, observerOpts);

    window.addEventListener("resize", ensureMobileSearchShortcut);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("resize", ensureMobileSearchShortcut);
      observer.disconnect();
    };
  }, []);

  return null;
}
