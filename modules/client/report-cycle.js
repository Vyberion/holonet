const EASTERN_TIME_ZONE = "America/New_York";
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function easternParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date).reduce((map, part) => {
    if (part.type !== "literal") map[part.type] = part.value;
    return map;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0
  };
}

function dateKeyFromParts({ year, month, day }) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function reportCycleFor(now = new Date()) {
  const parts = easternParts(now);
  const todayKey = dateKeyFromParts(parts);
  const daysSinceMonday = (parts.weekday + 6) % 7;
  const weekStartKey = addDaysToDateKey(todayKey, -daysSinceMonday);

  return {
    weekStartKey,
    nextWeekStartKey: addDaysToDateKey(weekStartKey, 7),
    missingPhase: parts.weekday === 1
  };
}

function easternDateKey(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) return text.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";

  return dateKeyFromParts(easternParts(date));
}

function reportIsInCurrentCycle(report, cycle) {
  if (!report) return false;

  return [report.weekStart, report.submittedAt, report.createdAt, report.updatedAt]
    .map(easternDateKey)
    .some(key => key && key >= cycle.weekStartKey && key < cycle.nextWeekStartKey);
}

function weeklyStatusForDivision(division, cycle) {
  if (division?.classified || division?.status === "classified") return "classified";
  return reportIsInCurrentCycle(division?.latestReport, cycle)
    ? "current"
    : cycle.missingPhase
      ? "missing"
      : "overdue";
}

function reportCycleCounts(divisions = [], cycle = reportCycleFor()) {
  return divisions.reduce((counts, division) => {
    const status = weeklyStatusForDivision(division, cycle);
    if (status === "current") counts.current += 1;
    if (status === "overdue") counts.overdue += 1;
    if (status === "missing") counts.missing += 1;
    return counts;
  }, { current: 0, overdue: 0, missing: 0 });
}

async function fetchNexusPayload() {
  const response = await fetch("/api/nexus");
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || "OVERVIEW_UNAVAILABLE");
  return payload;
}

function updateStatusCells(mount, counts) {
  const values = {
    "Current Reports": counts.current,
    Overdue: counts.overdue,
    Missing: counts.missing
  };

  mount.querySelectorAll(".hub-status-cell").forEach(cell => {
    const label = cell.querySelector(".hub-label")?.textContent?.trim();
    if (!Object.hasOwn(values, label)) return;
    const value = String(values[label]);
    const valueElement = cell.querySelector(".hub-value");
    if (valueElement && valueElement.textContent !== value) {
      valueElement.replaceChildren(document.createTextNode(value));
    }
  });

  const statusValue = mount.querySelector(".hub-identity > div:last-child .hub-value");
  const statusText = counts.overdue || counts.missing ? "Incomplete" : "Stable";
  if (statusValue && statusValue.textContent !== statusText) {
    statusValue.replaceChildren(document.createTextNode(statusText));
  }
}

let refreshTimer = null;

async function refreshReportCycleCards(mount) {
  if (!mount.querySelector(".hub-status-grid")) return;

  try {
    const payload = await fetchNexusPayload();
    updateStatusCells(mount, reportCycleCounts(payload.divisions || []));
  } catch (error) {
    console.warn("Report cycle status refresh failed", error);
  }
}

function scheduleRefresh(mount) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => refreshReportCycleCards(mount), 50);
}

function initReportCycle() {
  const mount = document.querySelector("[data-nexus-console]");
  if (!mount || mount.dataset.reportCycleBound === "true") return;
  mount.dataset.reportCycleBound = "true";

  const observer = new MutationObserver(() => scheduleRefresh(mount));
  observer.observe(mount, { childList: true, subtree: true });
  scheduleRefresh(mount);
}

window.initHolonetReportCycle = initReportCycle;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initReportCycle);
} else {
  initReportCycle();
}
