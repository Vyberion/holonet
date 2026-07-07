import { ARCHIVE_MAP, archiveMapRoom } from "../data/archive-map.js";

function setText(target, value) {
  if (target) target.textContent = value || "";
}

function renderConnections(target, connections = []) {
  if (!target) return;
  target.innerHTML = "";
  connections.forEach(connection => {
    const item = document.createElement("li");
    item.textContent = connection;
    target.appendChild(item);
  });
}

function initArchiveMap() {
  const mount = document.querySelector("[data-archive-map]");
  if (!mount || mount.dataset.archiveMapBound === "true") return;
  mount.dataset.archiveMapBound = "true";

  const rooms = new Map(ARCHIVE_MAP.rooms.map(room => [room.id, room]));
  const mapRooms = Array.from(mount.querySelectorAll("[data-map-room]"));
  const roomButtons = Array.from(mount.querySelectorAll("[data-map-select]"));
  const zone = mount.querySelector("[data-map-zone]");
  const name = mount.querySelector("[data-map-name]");
  const summary = mount.querySelector("[data-map-summary]");
  const connections = mount.querySelector("[data-map-connections]");

  function setActiveRoom(roomId) {
    const room = rooms.get(roomId) || archiveMapRoom(roomId);
    mount.dataset.activeRoom = room.id;

    mapRooms.forEach(node => {
      const active = node.dataset.mapRoom === room.id;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-pressed", active ? "true" : "false");
    });

    roomButtons.forEach(button => {
      const active = button.dataset.mapSelect === room.id;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    setText(zone, room.zone);
    setText(name, room.name);
    setText(summary, room.summary);
    renderConnections(connections, room.connections);
  }

  mapRooms.forEach(node => {
    node.addEventListener("click", () => setActiveRoom(node.dataset.mapRoom));
    node.addEventListener("keydown", event => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      setActiveRoom(node.dataset.mapRoom);
    });
  });

  roomButtons.forEach(button => {
    button.addEventListener("click", () => setActiveRoom(button.dataset.mapSelect));
  });

  setActiveRoom(mount.dataset.activeRoom || "main-hall");
}

window.initHolonetArchiveMap = initArchiveMap;

if (document.readyState === "loading") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initArchiveMap);
  } else {
    initArchiveMap();
  }
} else {
  initArchiveMap();
}
