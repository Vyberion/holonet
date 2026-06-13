const HANDBOOK_RESOURCE_TYPES = new Set(["documents", "document", "handbooks", "handbook"]);

function isHandbookResourceRequest(input) {
  try {
    const url = new URL(typeof input === "string" ? input : input?.url, window.location.origin);
    return url.pathname === "/api/resources" && HANDBOOK_RESOURCE_TYPES.has(url.searchParams.get("type"));
  } catch {
    return false;
  }
}

function cloneHeaders(headers) {
  const cloned = new Headers(headers);
  cloned.set("Content-Type", "application/json");
  return cloned;
}

function slotOrder(slot) {
  return Number(slot?.order || 0) || 999;
}

function displayNameForResource(resource) {
  return resource?.fileName || resource?.title || resource?.storagePath?.split("/").pop() || "Published";
}

function normalizeHandbookPayload(payload, division = "") {
  const slotCatalog = Array.isArray(payload?.slotCatalog) ? payload.slotCatalog.slice().sort((a, b) => slotOrder(a) - slotOrder(b)) : [];
  const resources = Array.isArray(payload?.resources) ? payload.resources : [];
  const resourcesBySlot = new Map(resources.map(resource => [resource.slotKey, resource]));
  const uploadNames = {};

  const orderedResources = slotCatalog
    .map(slot => {
      const resource = resourcesBySlot.get(slot.key);
      if (!resource) return null;

      uploadNames[slot.key] = displayNameForResource(resource);

      return {
        ...resource,
        actualFileName: resource.fileName || "",
        actualTitle: resource.title || "",
        slotLabel: slot.label,
        meta: slot.label,
        fileName: slot.label,
        title: slot.label
      };
    })
    .filter(Boolean);

  window.__holonetPdfSlotUploadNames = window.__holonetPdfSlotUploadNames || {};
  window.__holonetPdfSlotUploadNames[division] = uploadNames;

  return {
    ...payload,
    slotCatalog,
    resources: orderedResources.reverse()
  };
}

function restoreUploadStripNames() {
  const tabStrip = document.querySelector("[data-pdf-tab-strip]");
  const division = tabStrip?.dataset.pdfDivision || "";
  const names = window.__holonetPdfSlotUploadNames?.[division] || {};

  document.querySelectorAll("[data-pdf-upload-slot]").forEach(button => {
    const label = names[button.dataset.pdfUploadSlot];
    const state = button.querySelector(".pdf-upload-state");
    if (label && state) state.textContent = label;
  });
}

export async function initWithSlotTabs(initPdfTabs) {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (!isHandbookResourceRequest(args[0])) return response;

    const payload = await response.clone().json().catch(() => null);
    if (!payload?.ok) return response;

    const url = new URL(typeof args[0] === "string" ? args[0] : args[0]?.url, window.location.origin);
    const normalized = normalizeHandbookPayload(payload, url.searchParams.get("division") || "");

    return new Response(JSON.stringify(normalized), {
      status: response.status,
      statusText: response.statusText,
      headers: cloneHeaders(response.headers)
    });
  };

  try {
    await initPdfTabs?.();
    restoreUploadStripNames();
  } finally {
    window.fetch = originalFetch;
  }
}

window.initHolonetPdfTabsWithSlotTabs = initWithSlotTabs;
