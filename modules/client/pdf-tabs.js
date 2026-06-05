(function () {
  function initPdfTabs() {
    const tabs = Array.from(document.querySelectorAll("[data-pdf-tab]"));
    const frame = document.querySelector("[data-pdf-frame]");
    const title = document.querySelector("[data-pdf-title]");
    const meta = document.querySelector("[data-pdf-meta]");

    if (!tabs.length || !frame) return;

    function activateTab(tab) {
      const source = tab.dataset.pdfSrc;
      if (!source) return;

      tabs.forEach(item => {
        const isActive = item === tab;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-selected", String(isActive));
      });

      frame.src = source;
      frame.title = tab.dataset.pdfTitle || "Reaver handbook";

      if (title) title.textContent = tab.dataset.pdfTitle || tab.textContent.trim();
      if (meta) meta.textContent = tab.dataset.pdfMeta || "PDF archive";
    }

    tabs.forEach(tab => {
      tab.addEventListener("click", () => activateTab(tab));
    });

    activateTab(tabs.find(tab => tab.classList.contains("is-active")) || tabs[0]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPdfTabs);
  } else {
    initPdfTabs();
  }
})();
