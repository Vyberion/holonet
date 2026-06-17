const controlState = {
  initialized: false,
  fitButton: null,
  fillButton: null
};

function cacheControls() {
  controlState.fitButton = document.querySelector("[data-pdf-fit-height]");
  controlState.fillButton = document.querySelector("[data-pdf-fit-width]");
}

function activePageIsLandscape() {
  const page = document.querySelector(".pdf-page");
  if (!page) return false;

  const rect = page.getBoundingClientRect();
  const width = rect.width || page.offsetWidth || 0;
  const height = rect.height || page.offsetHeight || 0;

  return width > height * 1.08;
}

function proxyLandscapeFit(event, targetButton) {
  if (!targetButton || !activePageIsLandscape()) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  targetButton.dataset.pdfFitProxyPass = "1";
  targetButton.click();
}

function setupLandscapeFitControls() {
  cacheControls();
  const { fitButton, fillButton } = controlState;
  if (!fitButton || !fillButton) return;

  fitButton.addEventListener("click", event => {
    if (fitButton.dataset.pdfFitProxyPass === "1") {
      delete fitButton.dataset.pdfFitProxyPass;
      return;
    }

    proxyLandscapeFit(event, fillButton);
  }, true);

  fillButton.addEventListener("click", event => {
    if (fillButton.dataset.pdfFitProxyPass === "1") {
      delete fillButton.dataset.pdfFitProxyPass;
      return;
    }

    proxyLandscapeFit(event, fitButton);
  }, true);
}

function initHolonetPdfViewerControls() {
  if (controlState.initialized) return;
  controlState.initialized = true;
  setupLandscapeFitControls();
}

window.initHolonetPdfViewerControls = initHolonetPdfViewerControls;
