import { listDivisions } from "../data/divisions/index.js";

function setText(root, selector, value) {
  const element = root.querySelector(selector);
  if (element) element.textContent = value;
}

function statusLabel(status) {
  return status === "offline" ? "[ OFFLINE ]" : "[ RESTRICTED ]";
}

function nodeLabel(division) {
  return `NODE: ${division.status === "offline" ? "OFFLINE" : division.node}`;
}

function bindCardClick(card) {
  if (card.dataset.registryClickBound === "true") return;
  card.dataset.registryClickBound = "true";

  card.addEventListener("click", event => {
    if (card.dataset.status === "locked" || card.classList.contains("dir-card--locked")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.target.closest("a, button")) return;
    if (!card.dataset.href) return;
    window.location.href = card.dataset.href;
  });

  card.addEventListener("click", event => {
    if (card.dataset.status !== "locked" && !card.classList.contains("dir-card--locked")) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

async function canAccessPage(page) {
  try {
    const response = await fetch(`/api/auth/check-access?page=${encodeURIComponent(page)}`);
    const payload = await response.json();
    return Boolean(response.ok && payload.authorized);
  } catch {
    return false;
  }
}

function lockCard(card, label = "ACCESS DENIED") {
  card.classList.add("dir-card--locked");
  card.dataset.status = "locked";
  delete card.dataset.href;
  card.setAttribute("aria-label", label);

  const enter = card.querySelector(".dir-card-enter");
  if (enter) {
    enter.href = "#";
    enter.textContent = "ACCESS DENIED";
    enter.setAttribute("aria-hidden", "true");
    enter.setAttribute("aria-disabled", "true");
    enter.tabIndex = -1;
  }
}

async function initRegistryDirectory() {
  const divisions = listDivisions();

  const overview = document.querySelector(".dir-card--overview");
  if (overview) bindCardClick(overview);

  const divisionRows = divisions
    .map(division => ({ division, card: document.querySelector(`[data-registry-division="${division.id}"]`) }))
    .filter(row => row.card);

  divisionRows.forEach(({ division, card }) => {
    bindCardClick(card);
    setText(card, ".dir-card-title", division.shortName || division.name);
    setText(card, ".dir-card-desc", division.description);
    setText(card, ".dir-card-node", nodeLabel(division));

    const badge = card.querySelector(".dir-card-badge");
    if (badge) badge.textContent = statusLabel(division.status);
  });

  const [overviewAccess, divisionAccess] = await Promise.all([
    overview ? canAccessPage("nexus") : Promise.resolve(false),
    Promise.all(divisionRows.map(async ({ division }) => ({
      id: division.id,
      canAccess: division.status !== "offline" && await canAccessPage(division.access?.home || division.id)
    })))
  ]);

  if (overview) {
    if (overviewAccess) {
      overview.dataset.href = "/reports";
      const enter = overview.querySelector(".dir-card-enter");
      if (enter) {
        enter.href = "/reports";
        enter.textContent = "OPEN DATABASE >>";
        enter.setAttribute("aria-hidden", "false");
        enter.setAttribute("aria-disabled", "false");
        enter.tabIndex = 0;
      }
    } else {
      lockCard(overview, "Reports - access denied");
    }
  }

  const accessByDivision = new Map(divisionAccess.map(item => [item.id, item.canAccess]));

  divisionRows.forEach(({ division, card }) => {
    const isOffline = division.status === "offline";
    const canAccess = Boolean(accessByDivision.get(division.id));

    card.classList.toggle("dir-card--locked", isOffline || !canAccess);
    card.dataset.status = isOffline || !canAccess ? "locked" : "restricted";
    card.setAttribute("aria-label", `${division.name} - ${isOffline ? "offline" : canAccess ? "restricted" : "access denied"}`);

    if (isOffline || !canAccess) {
      delete card.dataset.href;
    } else {
      card.dataset.href = division.href;
    }

    const enter = card.querySelector(".dir-card-enter");
    if (enter) {
      enter.href = isOffline || !canAccess ? "#" : division.href;
      enter.textContent = isOffline ? "NODE OFFLINE" : canAccess ? "OPEN DATABASE >>" : "ACCESS DENIED";
      enter.setAttribute("aria-hidden", isOffline || !canAccess ? "true" : "false");
      enter.setAttribute("aria-disabled", isOffline || !canAccess ? "true" : "false");
      enter.tabIndex = isOffline || !canAccess ? -1 : 0;
    }

  });
}

window.initHolonetRegistryDirectory = initRegistryDirectory;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRegistryDirectory);
  } else {
    initRegistryDirectory();
  }
