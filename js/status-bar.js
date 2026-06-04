(function () {
  function updateSignalReadout() {
    const barsEl = document.getElementById('signal-bars');
    const percentEl = document.getElementById('signal-percent');
    if (!barsEl || !percentEl) return;

    const pct = 72 + Math.floor(Math.random() * 19);
    const lit = Math.max(0, Math.min(10, Math.round(pct / 10)));

    barsEl.innerHTML =
      '<span style="vertical-align:middle">' + '█'.repeat(lit) + '</span>' +
      '<span style="vertical-align:middle;opacity:0.35">' + '█'.repeat(10 - lit) + '</span>';

    percentEl.textContent = pct + '%';
  }

  function updateTimestamp() {
    const el = document.getElementById('timestamp');
    if (!el) return;
    const now = new Date();
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const ss = String(now.getUTCSeconds()).padStart(2, '0');
    el.textContent = '3958.001 / ' + hh + ':' + mm + ':' + ss + ' GST';
  }

  updateSignalReadout();
  updateTimestamp();
  setInterval(updateSignalReadout, 1000);
  setInterval(updateTimestamp, 1000);
})();