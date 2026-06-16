import { HolonetFrame } from "../../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../../components/PageScripts.jsx";
import { ARCHIVE_MAP, archiveMapRoom } from "../../../../../modules/data/archive-map.js";
import { holonetMetadata } from "../../../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "Temple Map",
  description: "Interactive archive map of the Sith temple."
});

const INITIAL_ROOM_ID = "main-hall";

function roomCenter(room) {
  if (["circle", "dodecagon"].includes(room.shape)) return { x: room.cx, y: room.cy };
  return { x: room.x + room.width / 2, y: room.y + room.height / 2 };
}

function polygonPoints(room, offset = 0) {
  const sides = room.sides || 12;
  const radius = room.r + offset;

  return Array.from({ length: sides }, (_, index) => {
    const angle = (Math.PI * 2 * index) / sides - Math.PI / 2;
    const x = room.cx + Math.cos(angle) * radius;
    const y = room.cy + Math.sin(angle) * radius;
    return `${x},${y}`;
  }).join(" ");
}

function labelLines(label) {
  const parts = String(label || "").split(" ");
  if (parts.length < 2 || String(label).length < 12) return [label];
  const midpoint = Math.ceil(parts.length / 2);
  return [parts.slice(0, midpoint).join(" "), parts.slice(midpoint).join(" ")];
}

function RoomShape({ room }) {
  const active = room.id === INITIAL_ROOM_ID;
  const center = roomCenter(room);
  const label = labelLines(room.label || room.name);

  return (
    <g
      className={`archive-map-room${active ? " is-active" : ""}`}
      data-map-room={room.id}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={room.name}
    >
      <title>{room.name}</title>
      {room.shape === "circle" ? (
        <>
          <circle className="archive-map-room-shape archive-map-room-lava" cx={room.cx} cy={room.cy} r={room.r + 32} />
          <circle className="archive-map-room-shape" cx={room.cx} cy={room.cy} r={room.r} />
        </>
      ) : room.shape === "dodecagon" ? (
        <>
          <polygon className="archive-map-room-shape archive-map-room-lava" points={polygonPoints(room, 32)} />
          <polygon className="archive-map-room-shape" points={polygonPoints(room)} />
        </>
      ) : (
        <rect className="archive-map-room-shape" x={room.x} y={room.y} width={room.width} height={room.height} rx="3" />
      )}
      <text className="archive-map-label" x={center.x} y={center.y - (label.length > 1 ? 7 : 0)} textAnchor="middle">
        {label.map((line, index) => (
          <tspan x={center.x} dy={index ? 18 : 0} key={line}>{line}</tspan>
        ))}
      </text>
    </g>
  );
}

function DetailPanel({ room }) {
  return (
    <aside className="archive-map-detail" aria-live="polite">
      <span className="hub-kicker" data-map-zone>{room.zone}</span>
      <h2 className="hub-panel-title" data-map-name>{room.name}</h2>
      <p className="hub-summary" data-map-summary>{room.summary}</p>
      <div className="archive-map-connections">
        <span className="hub-label">Connected Nodes</span>
        <ul data-map-connections>
          {room.connections.map(connection => (
            <li key={connection}>{connection}</li>
          ))}
        </ul>
      </div>
      <div className="archive-map-room-list" aria-label="Map rooms">
        {ARCHIVE_MAP.rooms.map(mapRoom => (
          <button
            className={`archive-map-room-button${mapRoom.id === room.id ? " is-active" : ""}`}
            type="button"
            data-map-select={mapRoom.id}
            aria-pressed={mapRoom.id === room.id}
            key={mapRoom.id}
          >
            {mapRoom.name}
          </button>
        ))}
      </div>
    </aside>
  );
}

export default function ArchiveMapPage() {
  const initialRoom = archiveMapRoom(INITIAL_ROOM_ID);
  const { width, height } = ARCHIVE_MAP.viewBox;

  return (
    <HolonetFrame title="TEMPLE MAP" subtitle="ARCHIVE CARTOGRAPHY" footerNode="ARC-03">
      <section className="archive-map-shell" data-archive-map data-active-room={initialRoom.id}>
        <div className="hub-hero">
          <div className="hub-identity">
            <div>
              <span className="hub-kicker">Archives / Restricted Cartography</span>
              <h2 className="hub-title">{ARCHIVE_MAP.title}</h2>
            </div>
            <div className="hub-identity-aside">
              <a className="hub-inline-link" href="/archives">LORE ARCHIVES</a>
            </div>
          </div>
          <p className="hub-summary">A work-in-progress top-down schematic of the temple. Room geometry is placeholder-only until a Roblox reference map is supplied.</p>
        </div>

        <div className="archive-map-layout">
          <div className="archive-map-panel archive-map-viewport">
            <svg
              className="archive-map-svg"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-labelledby="archive-map-title archive-map-desc"
            >
              <title id="archive-map-title">{ARCHIVE_MAP.title}</title>
              <desc id="archive-map-desc">Interactive schematic of temple rooms and hallways.</desc>
              <defs>
                <filter id="archive-map-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="7" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="archive-map-floor" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3a1118" />
                  <stop offset="56%" stopColor="#160509" />
                  <stop offset="100%" stopColor="#090203" />
                </linearGradient>
                <radialGradient id="archive-map-lava" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#351018" />
                  <stop offset="68%" stopColor="#6e1718" />
                  <stop offset="100%" stopColor="#ff7a1f" />
                </radialGradient>
              </defs>

              <rect className="archive-map-grid-bg" x="0" y="0" width={width} height={height} />
              {ARCHIVE_MAP.baseImage ? (
                <image className="archive-map-base-image" href={ARCHIVE_MAP.baseImage} x="0" y="0" width={width} height={height} preserveAspectRatio="xMidYMid meet" />
              ) : null}
              <g className="archive-map-connectors" aria-hidden="true">
                <rect x="1240" y="590" width="170" height="160" />
                <rect x="940" y="380" width="140" height="40" />
                <rect x="940" y="920" width="140" height="60" />
                <rect x="960" y="1380" width="100" height="60" />
                <rect x="980" y="1630" width="60" height="44" />
                <rect x="320" y="615" width="80" height="25" />
                <rect x="505" y="615" width="80" height="25" />
                <rect x="675" y="615" width="80" height="25" />
              </g>

              <g className="archive-map-decor" aria-hidden="true">
                <rect className="archive-map-podium" x="1310" y="635" width="18" height="70" />
                <rect className="archive-map-podium" x="1355" y="635" width="18" height="70" />
                <rect className="archive-map-mat" x="840" y="210" width="340" height="90" />
                <rect className="archive-map-podium" x="945" y="140" width="130" height="30" />
                <line className="archive-map-guard-line" x1="840" y1="705" x2="840" y2="845" />
                <line className="archive-map-guard-line" x1="1180" y1="705" x2="1180" y2="845" />
                <rect className="archive-map-mat" x="815" y="1090" width="105" height="125" />
                <rect className="archive-map-mat" x="1100" y="1090" width="105" height="125" />
                <rect className="archive-map-mat" x="905" y="1260" width="210" height="46" />
                {[0, 1, 2].map(index => (
                  <g key={`shelf-${index}`}>
                    <rect className="archive-map-shelf" x="860" y={1480 + index * 42} width="86" height="18" />
                    <rect className="archive-map-shelf" x="1074" y={1480 + index * 42} width="86" height="18" />
                  </g>
                ))}
                {[0, 1, 2, 3].map(index => (
                  <g key={`throne-${index}`}>
                    <rect className="archive-map-throne" x="92" y={445 + index * 45} width="26" height="30" />
                    <rect className="archive-map-throne" x="202" y={445 + index * 45} width="26" height="30" />
                  </g>
                ))}
                <rect className="archive-map-emperor-throne" x="140" y="415" width="40" height="42" />
              </g>

              <g className="archive-map-rooms">
                {ARCHIVE_MAP.rooms.map(room => (
                  <RoomShape room={room} key={room.id} />
                ))}
              </g>
            </svg>
          </div>

          <DetailPanel room={initialRoom} />
        </div>
      </section>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/archive-map.js"]} />
    </HolonetFrame>
  );
}
