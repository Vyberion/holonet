export async function initWithSlotTabs(initPdfTabs) {
  await initPdfTabs?.();
}

window.initHolonetPdfTabsWithSlotTabs = initWithSlotTabs;
