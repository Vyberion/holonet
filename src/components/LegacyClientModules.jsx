"use client";

import { useEffect } from "react";

function normalizedFetchPath(input) {
  const value = typeof input === "string" ? input : input?.url || "";
  if (!value) return "";

  try {
    const url = new URL(value, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

function installSiteImportBudgetGuard() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return () => {};

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const path = normalizedFetchPath(input);
    const pathname = window.location.pathname.replace(/\/$/, "") || "/";
    const isCanonPage = pathname === "/codex" || pathname === "/archives";
    const isCanonWarmup = init?.cache === "no-store"
      && (path === "/api/archives" || path.startsWith("/api/library?library=codex"));
    const isGuardedAccessWarmup = path === "/api/auth/check-access"
      && document.documentElement.classList.contains("access-pending");

    if (isCanonWarmup && !isCanonPage) {
      return Promise.resolve(new Response(JSON.stringify({ ok: false, reason: "WARMUP_SUPPRESSED" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    }

    if (isGuardedAccessWarmup) {
      return Promise.resolve(new Response("null", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    }

    return originalFetch(input, init);
  };

  return () => {
    window.fetch = originalFetch;
  };
}

const moduleLoaders = {
  "/js/main.js": () => import("../../js/main.js"),
  "/modules/client/access-guard.js": () => import("../../modules/client/access-guard.js"),
  "/modules/client/account.js": () => import("../../modules/client/account.js"),
  "/modules/client/admin.js": () => import("../../modules/client/admin.js"),
  "/modules/client/archive-map.js": () => import("../../modules/client/archive-map.js"),
  "/modules/client/board.js": () => import("../../modules/client/board.js"),
  "/modules/client/council-floor.js": () => import("../../modules/client/council-floor.js"),
  "/modules/client/division-hub.js": () => import("../../modules/client/division-hub.js"),
  "/modules/client/division-section.js": () => import("../../modules/client/division-section.js"),
  "/modules/client/library-view.js": async () => {
    await import("../../modules/client/library-regulations.js");
    return import("../../modules/client/library-view.js");
  },
  "/modules/client/nexus.js": () => import("../../modules/client/nexus.js"),
  "/modules/client/pdf-tabs.js": async () => {
    await import("../../modules/client/pdf-slot-tabs.js");
    await import("../../modules/client/pdf-viewer-controls.js");
    return import("../../modules/client/pdf-tabs.js");
  },
  "/modules/client/personnel.js": () => import("../../modules/client/personnel.js"),
  "/modules/client/registry-directory.js": () => import("../../modules/client/registry-directory.js"),
  "/modules/client/group-timeline.js": () => import("../../modules/client/group-timeline.js"),
  "/modules/client/site.js": async () => {
    await import("../../modules/client/intro-toggle.js");
    const restoreBudgetGuard = installSiteImportBudgetGuard();
    try {
      await import("../../modules/client/site.js");
    } finally {
      window.setTimeout(restoreBudgetGuard, 0);
    }
    return import("../../modules/client/developer-notice-delay.js");
  }
};

function runModuleInit(modulePath) {
  const initializers = {
    "/modules/client/library-view.js": () => window.initHolonetLibraryView?.(),
    "/modules/client/nexus.js": () => window.initHolonetNexus?.(),
    "/modules/client/account.js": () => window.initHolonetAccount?.(),
    "/modules/client/admin.js": () => window.initHolonetAdmin?.(),
    "/modules/client/archive-map.js": () => window.initHolonetArchiveMap?.(),
    "/modules/client/board.js": () => window.initHolonetBoard?.(),
    "/modules/client/council-floor.js": () => window.initHolonetCouncilFloor?.(),
    "/modules/client/personnel.js": () => window.initHolonetPersonnel?.(),
    "/modules/client/registry-directory.js": () => window.initHolonetRegistryDirectory?.(),
    "/modules/client/group-timeline.js": () => window.initHolonetGroupTimeline?.(),
    "/modules/client/division-hub.js": () => window.initHolonetDivisionHub?.(),
    "/modules/client/division-section.js": () => window.initHolonetDivisionSection?.(),
    "/modules/client/pdf-tabs.js": () => {
      const initResult = window.initHolonetPdfTabsWithSlotTabs?.(window.initHolonetPdfTabs) ?? window.initHolonetPdfTabs?.();
      Promise.resolve(initResult).then(() => window.initHolonetPdfViewerControls?.());
      return initResult;
    }
  };

  initializers[modulePath]?.();
}

export function LegacyClientModules({ modules = [], guarded = false }) {
  useEffect(() => {
    let cancelled = false;

    async function loadModules() {
      const queue = guarded
        ? ["/modules/client/access-guard.js", ...modules]
        : modules;

      for (const modulePath of queue) {
        if (cancelled) return;
        const load = moduleLoaders[modulePath];
        if (load) {
          await load();
          if (!cancelled) runModuleInit(modulePath);
        }
      }
    }

    loadModules().catch(error => {
      console.error("Holonet client module failed:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [guarded, modules.join("|")]);

  return null;
}
