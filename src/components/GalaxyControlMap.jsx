"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, OrbitControls, Text } from "@react-three/drei";
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { controlForSector, factionById, planetsForSector } from "../../modules/data/galaxy-control-map.js";

const CAMERA_HOME = new THREE.Vector3(0, 10.4, 9.2);
const TARGET_HOME = new THREE.Vector3(0, 0, 0);
const PLATE_HEIGHT = 0.16;
const MAP_SCALE = 0.92;

function makeShape(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x * MAP_SCALE, z * MAP_SCALE);
    else shape.lineTo(x * MAP_SCALE, z * MAP_SCALE);
  });
  shape.closePath();
  return shape;
}

function centroid(points) {
  const total = points.reduce((acc, [x, z]) => {
    acc.x += x * MAP_SCALE;
    acc.z += z * MAP_SCALE;
    return acc;
  }, { x: 0, z: 0 });
  return new THREE.Vector3(total.x / points.length, 0, total.z / points.length);
}

function boundsRadius(points, center) {
  return Math.max(...points.map(([x, z]) => center.distanceTo(new THREE.Vector3(x * MAP_SCALE, 0, z * MAP_SCALE))));
}

function linePoints(points, y = PLATE_HEIGHT + 0.018) {
  return [...points, points[0]].map(([x, z]) => new THREE.Vector3(x * MAP_SCALE, y, z * MAP_SCALE));
}

function ExtrudedSector({ map, sector, selected, dimmed, onSelect }) {
  const faction = factionById(map, sector.factionId);
  const meshRef = useRef(null);
  const borderRef = useRef(null);
  const center = useMemo(() => centroid(sector.points), [sector.points]);
  const radius = useMemo(() => boundsRadius(sector.points, center), [sector.points, center]);
  const geometry = useMemo(() => {
    const next = new THREE.ExtrudeGeometry(makeShape(sector.points), {
      depth: PLATE_HEIGHT,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      bevelSegments: 2
    });
    next.rotateX(Math.PI / 2);
    next.translate(0, PLATE_HEIGHT * 0.5, 0);
    return next;
  }, [sector.points]);
  const borderGeometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(linePoints(sector.points)), [sector.points]);

  useEffect(() => () => {
    geometry.dispose();
    borderGeometry.dispose();
  }, [geometry, borderGeometry]);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const pulse = selected ? 0.05 + Math.sin(clock.elapsedTime * 2.2) * 0.025 : 0;
      meshRef.current.position.y = selected ? 0.08 + pulse : 0;
    }
    if (borderRef.current) {
      borderRef.current.material.opacity = selected ? 0.95 : dimmed ? 0.2 : 0.52;
    }
  });

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        onClick={event => {
          event.stopPropagation();
          onSelect(sector.id);
        }}
        onPointerOver={event => {
          event.stopPropagation();
          document.body.style.cursor = "crosshair";
        }}
        onPointerOut={event => {
          event.stopPropagation();
          document.body.style.cursor = "";
        }}
      >
        <meshStandardMaterial
          color={faction?.color || "#777777"}
          emissive={faction?.glow || "#777777"}
          emissiveIntensity={selected ? 0.35 : 0.12}
          transparent
          opacity={selected ? 0.72 : dimmed ? 0.14 : 0.42}
          roughness={0.34}
          metalness={0.12}
        />
      </mesh>
      <line ref={borderRef} geometry={borderGeometry}>
        <lineBasicMaterial color={faction?.glow || "#ffffff"} transparent opacity={0.52} blending={THREE.AdditiveBlending} />
      </line>
      <Billboard position={[center.x, 0.32, center.z]}>
        <Text
          color={selected ? "#ffffff" : faction?.glow || "#ffffff"}
          fontSize={selected ? 0.19 : 0.13}
          maxWidth={radius * 1.35}
          outlineColor="#050204"
          outlineWidth={0.008}
          textAlign="center"
        >
          {sector.name}
        </Text>
      </Billboard>
    </group>
  );
}

function PlanetNode({ map, planet, selected, onSelect }) {
  const faction = factionById(map, planet.factionId);
  const groupRef = useRef(null);
  const [x, z] = planet.position;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 3.2) * 0.08;
    groupRef.current.scale.setScalar(selected ? 1.35 * pulse : pulse);
  });

  return (
    <group
      ref={groupRef}
      position={[x * MAP_SCALE, 0.42, z * MAP_SCALE]}
      onClick={event => {
        event.stopPropagation();
        onSelect(planet.id);
      }}
      onPointerOver={event => {
        event.stopPropagation();
        document.body.style.cursor = "crosshair";
      }}
      onPointerOut={event => {
        event.stopPropagation();
        document.body.style.cursor = "";
      }}
    >
      <mesh>
        <sphereGeometry args={[0.12, 32, 16]} />
        <meshStandardMaterial color={faction?.color || "#ffffff"} emissive={faction?.glow || "#ffffff"} emissiveIntensity={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.24, 48]} />
        <meshBasicMaterial color={faction?.glow || "#ffffff"} transparent opacity={0.68} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <Billboard position={[0, 0.35, 0]}>
        <Text color="#ffffff" fontSize={0.13} outlineColor="#050204" outlineWidth={0.008}>
          {planet.shortName || planet.name}
        </Text>
      </Billboard>
    </group>
  );
}

function RegionRings({ map }) {
  const rings = useMemo(() => (map.regions || [])
    .filter(region => region.radius?.[1])
    .map(region => ({
      ...region,
      radius: region.radius[1] * MAP_SCALE
    })), [map]);

  return (
    <group>
      {rings.map(region => (
        <group key={region.id}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.018, 0]}>
            <ringGeometry args={[Math.max(0.02, region.radius - 0.008), region.radius + 0.008, 192]} />
            <meshBasicMaterial color={region.id === "unknown-regions" ? "#777777" : "#b9f8ff"} transparent opacity={region.id === "unknown-regions" ? 0.09 : 0.18} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Starfield() {
  const geometry = useMemo(() => {
    const count = 850;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const radius = 7 + Math.random() * 12;
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = -0.6 + Math.random() * 5.6;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return next;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#dff9ff" size={0.026} transparent opacity={0.58} sizeAttenuation />
    </points>
  );
}

function CameraRig({ map, selectedSector, selectedPlanet }) {
  const { camera } = useThree();
  const targetRef = useRef(TARGET_HOME.clone());
  const cameraRef = useRef(CAMERA_HOME.clone());

  useEffect(() => {
    if (selectedPlanet) {
      const [x, z] = selectedPlanet.position;
      const target = new THREE.Vector3(x * MAP_SCALE, 0.28, z * MAP_SCALE);
      targetRef.current.copy(target);
      cameraRef.current.copy(target).add(new THREE.Vector3(0.85, 2.0, 1.35));
      return;
    }
    if (selectedSector) {
      const target = centroid(selectedSector.points);
      targetRef.current.copy(target);
      cameraRef.current.copy(target).add(new THREE.Vector3(0.2, 4.4, 3.9));
      return;
    }
    targetRef.current.copy(TARGET_HOME);
    cameraRef.current.copy(CAMERA_HOME);
  }, [selectedSector, selectedPlanet]);

  useFrame(() => {
    camera.position.lerp(cameraRef.current, 0.055);
  });

  return <OrbitControls makeDefault enableDamping dampingFactor={0.08} enablePan={false} minDistance={2.2} maxDistance={13.5} target={targetRef.current} />;
}

function GalaxyScene({ map, selectedSectorId, selectedPlanetId, onSelectSector, onSelectPlanet }) {
  const selectedSector = (map.sectors || []).find(sector => sector.id === selectedSectorId) || null;
  const selectedPlanet = (map.planets || []).find(planet => planet.id === selectedPlanetId) || null;
  const visiblePlanets = selectedSector ? planetsForSector(map, selectedSector.id) : [];

  return (
    <>
      <color attach="background" args={["#020407"]} />
      <fogExp2 attach="fog" args={["#041018", 0.018]} />
      <ambientLight intensity={0.36} color="#78eaff" />
      <directionalLight position={[4, 7, 5]} intensity={1.8} color="#ffffff" />
      <pointLight position={[0, 2.8, 0]} intensity={34} distance={12} color="#62f7ff" />
      <Starfield />
      <RegionRings map={map} />
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <circleGeometry args={[7.45 * MAP_SCALE, 160]} />
        <meshBasicMaterial color="#0a2733" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      {(map.sectors || []).map(sector => (
        <ExtrudedSector
          dimmed={Boolean(selectedSector && selectedSector.id !== sector.id)}
          key={sector.id}
          map={map}
          onSelect={onSelectSector}
          selected={selectedSector?.id === sector.id}
          sector={sector}
        />
      ))}
      {visiblePlanets.map(planet => (
        <PlanetNode
          key={planet.id}
          map={map}
          onSelect={onSelectPlanet}
          planet={planet}
          selected={selectedPlanet?.id === planet.id}
        />
      ))}
      <CameraRig map={map} selectedSector={selectedSector} selectedPlanet={selectedPlanet} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.52} luminanceThreshold={0.18} luminanceSmoothing={0.28} />
        <DepthOfField focusDistance={0.02} focalLength={0.012} bokehScale={0.22} height={420} />
        <ChromaticAberration offset={[0.0005, 0.00025]} />
        <Noise opacity={0.028} />
        <Vignette eskil={false} offset={0.18} darkness={0.52} />
      </EffectComposer>
    </>
  );
}

function ControlBars({ map, sector }) {
  const control = controlForSector(map, sector.id);

  return (
    <div className="gc-control-bars">
      {(map.factions || []).map(faction => (
        <div className="gc-control-row" key={faction.id}>
          <span>{faction.shortName}</span>
          <div><i style={{ width: `${control[faction.id] || 0}%`, "--faction": faction.color }} /></div>
          <strong>{control[faction.id] || 0}%</strong>
        </div>
      ))}
    </div>
  );
}

function IntelPanel({ map, selectedSector, selectedPlanet, onZoomOut }) {
  if (!selectedSector && !selectedPlanet) return null;
  const planetFaction = selectedPlanet ? factionById(map, selectedPlanet.factionId) : null;
  const sectorFaction = selectedSector ? factionById(map, selectedSector.factionId) : null;
  const sectorPlanets = selectedSector ? planetsForSector(map, selectedSector.id) : [];

  return (
    <aside className="gc-panel" aria-live="polite">
      <button className="gc-zoom" type="button" onClick={onZoomOut}>
        ZOOM OUT
      </button>
      <span className="gc-kicker">{selectedPlanet ? "Planet Intel" : "Sector Intel"}</span>
      <h1>{selectedPlanet?.name || selectedSector.name}</h1>
      <div className="gc-meta">
        <span>{selectedPlanet?.grid || selectedSector.grid}</span>
        <span>{selectedPlanet ? planetFaction?.name : sectorFaction?.name}</span>
      </div>
      {selectedPlanet ? (
        <>
          <p>{selectedPlanet.summary}</p>
          <div className="gc-stat-grid">
            <span>Control</span><strong>{planetFaction?.name || "Unknown"}</strong>
            <span>Contested</span><strong>{selectedPlanet.contested ? "Yes" : "No"}</strong>
            <span>Placement</span><strong>{selectedPlanet.placementConfidence}</strong>
          </div>
          <div className="gc-list">
            <span>Objectives</span>
            {(selectedPlanet.objectives || []).map(item => <p key={item}>{item}</p>)}
          </div>
          <div className="gc-list">
            <span>Locations</span>
            {(selectedPlanet.locations || []).map(item => <p key={item}>{item}</p>)}
          </div>
          {selectedPlanet.robloxLaunchUrl ? (
            <a className="gc-play" href={selectedPlanet.robloxLaunchUrl}>
              PLAY
            </a>
          ) : null}
        </>
      ) : (
        <>
          <p>{selectedSector.placementConfidence}</p>
          <ControlBars map={map} sector={selectedSector} />
          <div className="gc-stat-grid">
            <span>Planets</span><strong>{sectorPlanets.length}</strong>
            <span>Contested</span><strong>{sectorPlanets.filter(planet => planet.contested).length}</strong>
          </div>
          <div className="gc-list">
            <span>Active Objectives</span>
            {(selectedSector.objectives || []).map(item => <p key={item}>{item}</p>)}
          </div>
        </>
      )}
    </aside>
  );
}

export function GalaxyControlMap({ map }) {
  const [selectedSectorId, setSelectedSectorId] = useState(null);
  const [selectedPlanetId, setSelectedPlanetId] = useState(null);
  const selectedSector = (map.sectors || []).find(sector => sector.id === selectedSectorId) || null;
  const selectedPlanet = (map.planets || []).find(planet => planet.id === selectedPlanetId) || null;

  const selectSector = useCallback(id => {
    setSelectedSectorId(id);
    setSelectedPlanetId(null);
  }, []);

  const selectPlanet = useCallback(id => {
    setSelectedPlanetId(id);
  }, []);

  const zoomOut = useCallback(() => {
    if (selectedPlanetId) {
      setSelectedPlanetId(null);
      return;
    }
    setSelectedSectorId(null);
  }, [selectedPlanetId]);

  return (
    <section className="gc-root" aria-label="Galaxy control map">
      <div className="gc-stage">
        <Canvas camera={{ position: CAMERA_HOME.toArray(), fov: 48, near: 0.05, far: 80 }} dpr={[1, 1.65]} gl={{ antialias: true, powerPreference: "high-performance" }}>
          <GalaxyScene
            map={map}
            onSelectPlanet={selectPlanet}
            onSelectSector={selectSector}
            selectedPlanetId={selectedPlanetId}
            selectedSectorId={selectedSectorId}
          />
        </Canvas>
      </div>
      <div className="gc-scan" aria-hidden="true" />
      <header className="gc-header">
        <span>DIRECT NODE / HIDDEN</span>
        <strong>GALAXY</strong>
      </header>
      <IntelPanel map={map} onZoomOut={zoomOut} selectedPlanet={selectedPlanet} selectedSector={selectedSector} />
      <style>{STYLES}</style>
    </section>
  );
}

const STYLES = `
  html:has(.gc-root),
  body:has(.gc-root) {
    background: #020407;
    overflow: hidden;
  }

  .gc-root {
    background:
      radial-gradient(circle at 50% 46%, rgba(41, 228, 255, .08), transparent 46%),
      linear-gradient(180deg, #06101a 0%, #020407 70%);
    color: #fff;
    font-family: 'Share Tech Mono', monospace;
    height: 100dvh;
    inset: 0;
    overflow: hidden;
    position: fixed;
    width: 100vw;
  }

  .gc-stage,
  .gc-stage canvas,
  .gc-scan {
    inset: 0;
    position: absolute;
  }

  .gc-stage canvas {
    cursor: grab;
    height: 100% !important;
    width: 100% !important;
  }

  .gc-stage canvas:active {
    cursor: grabbing;
  }

  .gc-scan {
    background:
      repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(116, 245, 255, .035) 3px, rgba(116, 245, 255, .035) 5px),
      radial-gradient(circle at 50% 50%, transparent 0%, transparent 58%, rgba(0, 0, 0, .72) 100%);
    mix-blend-mode: screen;
    opacity: .8;
    pointer-events: none;
    z-index: 3;
  }

  .gc-header {
    background: rgba(3, 14, 20, .72);
    border: 1px solid rgba(93, 245, 255, .36);
    box-shadow: 0 0 24px rgba(93, 245, 255, .18), inset 0 0 24px rgba(93, 245, 255, .04);
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
    display: grid;
    gap: 3px;
    left: clamp(16px, 2.6vw, 34px);
    padding: 12px 15px;
    position: absolute;
    top: clamp(16px, 2.6vw, 34px);
    z-index: 5;
  }

  .gc-header span,
  .gc-kicker,
  .gc-meta,
  .gc-stat-grid span,
  .gc-list span {
    color: rgba(227, 254, 255, .78);
    font-size: .64rem;
    text-transform: uppercase;
  }

  .gc-header strong {
    color: #74f5ff;
    font-family: Orbitron, monospace;
    font-size: .92rem;
    text-shadow: 0 0 16px rgba(116, 245, 255, .45);
  }

  .gc-panel {
    background: rgba(3, 12, 18, .82);
    border: 1px solid rgba(93, 245, 255, .34);
    bottom: clamp(16px, 2.6vw, 34px);
    box-shadow: 0 0 34px rgba(93, 245, 255, .18), inset 0 0 26px rgba(255, 255, 255, .035);
    clip-path: polygon(0 0, calc(100% - 13px) 0, 100% 13px, 100% 100%, 13px 100%, 0 calc(100% - 13px));
    display: grid;
    gap: 12px;
    max-width: 380px;
    padding: 18px;
    position: absolute;
    right: clamp(16px, 2.6vw, 34px);
    width: calc(100vw - 32px);
    z-index: 6;
  }

  .gc-panel h1 {
    color: #fff;
    font-family: Cinzel, serif;
    font-size: 1.45rem;
    line-height: 1.05;
    text-transform: uppercase;
  }

  .gc-panel p {
    color: rgba(255, 255, 255, .82);
    font-size: .8rem;
    line-height: 1.45;
  }

  .gc-meta,
  .gc-stat-grid {
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr auto;
  }

  .gc-stat-grid {
    border-top: 1px solid rgba(93, 245, 255, .22);
    padding-top: 10px;
  }

  .gc-stat-grid strong {
    color: #fff;
    font-size: .7rem;
    text-align: right;
    text-transform: uppercase;
  }

  .gc-control-bars,
  .gc-list {
    display: grid;
    gap: 7px;
  }

  .gc-control-row {
    align-items: center;
    display: grid;
    gap: 8px;
    grid-template-columns: 78px 1fr 38px;
  }

  .gc-control-row span,
  .gc-control-row strong {
    color: rgba(255, 255, 255, .86);
    font-size: .66rem;
    text-transform: uppercase;
  }

  .gc-control-row div {
    background: rgba(255, 255, 255, .08);
    border: 1px solid rgba(255, 255, 255, .12);
    height: 8px;
    overflow: hidden;
  }

  .gc-control-row i {
    background: var(--faction);
    box-shadow: 0 0 16px var(--faction);
    display: block;
    height: 100%;
  }

  .gc-list {
    border-top: 1px solid rgba(93, 245, 255, .22);
    padding-top: 10px;
  }

  .gc-zoom,
  .gc-play {
    background: rgba(93, 245, 255, .08);
    border: 1px solid rgba(93, 245, 255, .44);
    color: #fff;
    cursor: crosshair;
    font: inherit;
    min-height: 38px;
    padding: 9px 12px;
    text-align: center;
    text-decoration: none;
    text-transform: uppercase;
  }

  .gc-zoom {
    justify-self: end;
  }

  .gc-play {
    background: rgba(255, 52, 72, .16);
    border-color: rgba(255, 52, 72, .82);
  }

  .gc-zoom:hover,
  .gc-zoom:focus-visible,
  .gc-play:hover,
  .gc-play:focus-visible {
    box-shadow: 0 0 20px rgba(93, 245, 255, .28);
    outline: none;
  }

  @media (max-width: 760px) {
    .gc-header {
      left: 12px;
      right: 12px;
      top: 12px;
    }

    .gc-panel {
      bottom: 0;
      left: 0;
      max-width: none;
      right: 0;
      width: 100%;
    }

    .gc-panel h1 {
      font-size: 1.16rem;
    }
  }
`;
