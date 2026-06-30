"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, OrbitControls, Text } from "@react-three/drei";
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { controlForSector, factionById, planetsForSector } from "../../modules/data/galaxy-control-map.js";

const TAU = Math.PI * 2;
const MAP_SCALE = 0.96;
const PLATE_HEIGHT = 0.12;
const HOME_TARGET = new THREE.Vector3(0, 0, 0);
const HOME_CAMERA = new THREE.Vector3(0, 8.4, 8.2);
const CORE_RADIUS = 0.55;

function degToRad(deg) {
  return THREE.MathUtils.degToRad(deg);
}

function polar(radius, angleDeg, y = 0) {
  const angle = degToRad(angleDeg);
  return new THREE.Vector3(Math.cos(angle) * radius * MAP_SCALE, y, Math.sin(angle) * radius * MAP_SCALE);
}

function sectorCenter(sector, y = 0) {
  return polar((sector.innerRadius + sector.outerRadius) * 0.5, (sector.startAngleDeg + sector.endAngleDeg) * 0.5, y);
}

function planetVector(planet, y = 0) {
  return new THREE.Vector3(planet.position[0] * MAP_SCALE, y, planet.position[1] * MAP_SCALE);
}

function makeSectorShape(sector, inset = 0) {
  const innerRadius = Math.max(0.05, sector.innerRadius + inset);
  const outerRadius = Math.max(innerRadius + 0.05, sector.outerRadius - inset);
  const start = sector.startAngleDeg + inset * 1.7;
  const end = sector.endAngleDeg - inset * 1.7;
  const steps = 34;
  const shape = new THREE.Shape();

  for (let index = 0; index <= steps; index += 1) {
    const angle = start + ((end - start) * index) / steps;
    const point = polar(outerRadius, angle);
    if (index === 0) shape.moveTo(point.x, point.z);
    else shape.lineTo(point.x, point.z);
  }

  for (let index = steps; index >= 0; index -= 1) {
    const angle = start + ((end - start) * index) / steps;
    const point = polar(innerRadius, angle);
    shape.lineTo(point.x, point.z);
  }

  shape.closePath();
  return shape;
}

function makeSectorBoundaryPoints(sector, y = PLATE_HEIGHT + 0.018, inset = 0) {
  const innerRadius = Math.max(0.05, sector.innerRadius + inset);
  const outerRadius = Math.max(innerRadius + 0.05, sector.outerRadius - inset);
  const start = sector.startAngleDeg + inset * 1.7;
  const end = sector.endAngleDeg - inset * 1.7;
  const steps = 42;
  const points = [];

  for (let index = 0; index <= steps; index += 1) {
    points.push(polar(outerRadius, start + ((end - start) * index) / steps, y));
  }
  for (let index = steps; index >= 0; index -= 1) {
    points.push(polar(innerRadius, start + ((end - start) * index) / steps, y));
  }
  points.push(points[0].clone());
  return points;
}

function makeLineGeometry(points) {
  return new THREE.BufferGeometry().setFromPoints(points);
}

function makeRingPoints(radius, startDeg = 0, endDeg = 360, y = 0.002, steps = 220) {
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    points.push(polar(radius, startDeg + ((endDeg - startDeg) * index) / steps, y));
  }
  return points;
}

function makePlanetTexture(planet) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#3b0608");
  gradient.addColorStop(0.35, "#8f271a");
  gradient.addColorStop(0.62, "#1b0405");
  gradient.addColorStop(1, "#d16435");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 80; index += 1) {
    const y = (index * 37) % canvas.height;
    ctx.globalAlpha = 0.08 + ((index * 13) % 9) * 0.008;
    ctx.fillStyle = index % 2 ? "#ffad66" : "#1a0203";
    ctx.fillRect(0, y, canvas.width, 2 + (index % 7));
  }

  for (let index = 0; index < 58; index += 1) {
    const x = (index * 89) % canvas.width;
    const y = (index * 53) % canvas.height;
    ctx.globalAlpha = 0.11;
    ctx.fillStyle = index % 3 ? "#f05d32" : "#120203";
    ctx.beginPath();
    ctx.ellipse(x, y, 18 + (index % 28), 4 + (index % 9), (index * 0.4) % TAU, 0, TAU);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function useMaterialColor(hex, fallback = "#ffffff") {
  return hex || fallback;
}

function SectorPlate({ map, sector, selected, entered, onSelect }) {
  const faction = factionById(map, sector.factionId);
  const meshRef = useRef(null);
  const borderRef = useRef(null);
  const geometry = useMemo(() => {
    const next = new THREE.ExtrudeGeometry(makeSectorShape(sector, 0.012), {
      depth: PLATE_HEIGHT,
      bevelEnabled: true,
      bevelSize: 0.018,
      bevelThickness: 0.018,
      bevelSegments: 2
    });
    next.rotateX(Math.PI / 2);
    next.translate(0, PLATE_HEIGHT * 0.5, 0);
    return next;
  }, [sector]);
  const borderGeometry = useMemo(() => makeLineGeometry(makeSectorBoundaryPoints(sector, PLATE_HEIGHT + 0.034, 0.018)), [sector]);

  useEffect(() => () => {
    geometry.dispose();
    borderGeometry.dispose();
  }, [geometry, borderGeometry]);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.position.y = selected ? 0.08 + Math.sin(clock.elapsedTime * 2.4) * 0.018 : 0;
    }
    if (borderRef.current) {
      borderRef.current.material.opacity = selected ? 0.96 : entered ? 0.18 : 0.62;
    }
  });

  const fillOpacity = selected ? 0.08 : entered ? 0.02 : 0.5;

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
          color={useMaterialColor(faction?.fill, "#7d0611")}
          emissive={useMaterialColor(faction?.glow, "#ff2438")}
          emissiveIntensity={selected ? 0.36 : 0.16}
          metalness={0.08}
          opacity={fillOpacity}
          roughness={0.42}
          transparent
        />
      </mesh>
      <line ref={borderRef} geometry={borderGeometry}>
        <lineBasicMaterial color={useMaterialColor(faction?.glow, "#ff2438")} transparent opacity={0.62} blending={THREE.AdditiveBlending} />
      </line>
      <SectorHatching sector={sector} selected={selected} entered={entered} color={useMaterialColor(faction?.glow, "#ff2438")} />
      {!entered ? (
        <Billboard position={sectorCenter(sector, 0.34)}>
          <Text color="#ffb7bc" fontSize={0.13} outlineColor="#070102" outlineWidth={0.008} textAlign="center">
            {sector.name}
          </Text>
        </Billboard>
      ) : null}
    </group>
  );
}

function SectorHatching({ sector, selected, entered, color }) {
  const geometry = useMemo(() => {
    const positions = [];
    const lines = 28;
    for (let index = 0; index <= lines; index += 1) {
      const angle = sector.startAngleDeg + ((sector.endAngleDeg - sector.startAngleDeg) * index) / lines;
      const inner = polar(sector.innerRadius + 0.08, angle, PLATE_HEIGHT + 0.045);
      const outer = polar(sector.outerRadius - 0.08, angle, PLATE_HEIGHT + 0.045);
      positions.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return next;
  }, [sector]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={selected ? 0.5 : entered ? 0.1 : 0.26} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}

function GuideGrid({ map, entered }) {
  const ringGeometries = useMemo(() => (map.regions || []).map(region => ({
    id: region.id,
    geometry: makeLineGeometry(makeRingPoints(region.radius[1], 0, 360, 0.01, 260)),
    unknown: region.id === "wild-space"
  })), [map]);
  const spokeGeometries = useMemo(() => {
    const known = (map.guide?.knownSpaceSpokes || []).map(angle => ({
      id: `known-${angle}`,
      geometry: makeLineGeometry([polar(CORE_RADIUS, angle, 0.016), polar(map.guide.radius, angle, 0.016)]),
      opacity: 0.26
    }));
    const sparse = (map.guide?.sparseSpokes || []).map(angle => ({
      id: `sparse-${angle}`,
      geometry: makeLineGeometry([polar(2.7, angle, 0.014), polar(map.guide.radius, angle, 0.014)]),
      opacity: 0.11
    }));
    return [...known, ...sparse];
  }, [map]);
  const unknownShape = useMemo(() => makeSectorShape({
    innerRadius: 2.8,
    outerRadius: map.guide.radius,
    startAngleDeg: map.guide.unknownRegion.startAngleDeg,
    endAngleDeg: map.guide.unknownRegion.endAngleDeg
  }), [map]);
  const unknownGeometry = useMemo(() => {
    const next = new THREE.ShapeGeometry(unknownShape);
    next.rotateX(Math.PI / 2);
    return next;
  }, [unknownShape]);

  useEffect(() => () => {
    ringGeometries.forEach(item => item.geometry.dispose());
    spokeGeometries.forEach(item => item.geometry.dispose());
    unknownGeometry.dispose();
  }, [ringGeometries, spokeGeometries, unknownGeometry]);

  const opacityScale = entered ? 0.18 : 1;

  return (
    <group>
      <mesh geometry={unknownGeometry} position={[0, -0.01, 0]}>
        <meshBasicMaterial color="#1a1a1a" transparent opacity={0.38 * opacityScale} side={THREE.DoubleSide} />
      </mesh>
      {ringGeometries.map(item => (
        <line key={item.id} geometry={item.geometry}>
          <lineBasicMaterial color={item.unknown ? "#777777" : "#9a3338"} transparent opacity={(item.unknown ? 0.12 : 0.23) * opacityScale} />
        </line>
      ))}
      {spokeGeometries.map(item => (
        <line key={item.id} geometry={item.geometry}>
          <lineBasicMaterial color="#b63a41" transparent opacity={item.opacity * opacityScale} />
        </line>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
        <circleGeometry args={[map.guide.radius * MAP_SCALE, 192]} />
        <meshBasicMaterial color="#110205" transparent opacity={entered ? 0.08 : 0.22} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.22, 32, 16]} />
        <meshBasicMaterial color="#fff4d8" transparent opacity={0.9} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.052, 0]}>
        <ringGeometry args={[0.33, 0.39, 72]} />
        <meshBasicMaterial color="#d9a52d" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function SectorSurveyStars({ sector, visible }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array((sector.surveyStars || []).length * 3);
    (sector.surveyStars || []).forEach((star, index) => {
      positions[index * 3] = star.position[0] * MAP_SCALE;
      positions[index * 3 + 1] = PLATE_HEIGHT + 0.1;
      positions[index * 3 + 2] = star.position[1] * MAP_SCALE;
    });
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return next;
  }, [sector]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  if (!visible) return null;

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#ffd8cf" size={0.075} transparent opacity={0.82} sizeAttenuation />
    </points>
  );
}

function BackdropStars({ entered }) {
  const geometry = useMemo(() => {
    let state = 7357;
    const rnd = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const count = 140;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = 7.4 + rnd() * 9.5;
      const angle = rnd() * TAU;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = -0.4 + rnd() * 4.2;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return next;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#fff1f2" size={0.025} transparent opacity={entered ? 0.12 : 0.34} sizeAttenuation />
    </points>
  );
}

function PlanetNode({ map, planet, selected, onSelect }) {
  const faction = factionById(map, planet.factionId);
  const groupRef = useRef(null);
  const texture = useMemo(() => makePlanetTexture(planet), [planet]);
  const position = useMemo(() => planetVector(planet, PLATE_HEIGHT + 0.28), [planet]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += 0.006;
    const scale = selected ? 1.38 : 1;
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.8) * 0.035;
    groupRef.current.scale.setScalar(scale * pulse);
  });

  return (
    <group
      position={position.toArray()}
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
      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[planet.radius || 0.2, 64, 32]} />
          <meshStandardMaterial map={texture} roughness={0.78} emissive="#240204" emissiveIntensity={0.12} />
        </mesh>
        <mesh scale={1.08}>
          <sphereGeometry args={[(planet.radius || 0.2) * 1.02, 48, 24]} />
          <meshBasicMaterial color={faction?.glow || "#ff2438"} transparent opacity={selected ? 0.2 : 0.11} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
        </mesh>
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.34, 72]} />
        <meshBasicMaterial color={faction?.glow || "#ff2438"} transparent opacity={selected ? 0.74 : 0.46} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <Billboard position={[0, 0.48, 0]}>
        <Text color="#ffffff" fontSize={0.13} outlineColor="#080102" outlineWidth={0.008} textAlign="center">
          {planet.shortName || planet.name}
        </Text>
      </Billboard>
    </group>
  );
}

function CameraRig({ selectedSector, selectedPlanet }) {
  const { camera } = useThree();
  const controlsRef = useRef(null);
  const desiredTarget = useRef(HOME_TARGET.clone());
  const desiredCamera = useRef(HOME_CAMERA.clone());
  const travelling = useRef(true);
  const selectedKey = selectedPlanet?.id || selectedSector?.id || "home";

  useEffect(() => {
    if (selectedPlanet) {
      const target = planetVector(selectedPlanet, PLATE_HEIGHT + 0.2);
      desiredTarget.current.copy(target);
      desiredCamera.current.copy(target).add(new THREE.Vector3(0.85, 1.65, 1.2));
    } else if (selectedSector) {
      const target = sectorCenter(selectedSector, PLATE_HEIGHT + 0.08);
      desiredTarget.current.copy(target);
      desiredCamera.current.copy(target).add(new THREE.Vector3(0.28, 3.1, 2.8));
    } else {
      desiredTarget.current.copy(HOME_TARGET);
      desiredCamera.current.copy(HOME_CAMERA);
    }
    travelling.current = true;
  }, [selectedKey, selectedSector, selectedPlanet]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (travelling.current) {
      camera.position.lerp(desiredCamera.current, 0.075);
      controls.target.lerp(desiredTarget.current, 0.09);
      if (camera.position.distanceTo(desiredCamera.current) < 0.045 && controls.target.distanceTo(desiredTarget.current) < 0.035) {
        camera.position.copy(desiredCamera.current);
        controls.target.copy(desiredTarget.current);
        travelling.current = false;
      }
    }
    controls.update();
  });

  const focused = Boolean(selectedSector || selectedPlanet);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      enablePan={false}
      enableRotate
      enableZoom
      dampingFactor={0.08}
      minDistance={focused ? 1.15 : 4.6}
      maxDistance={selectedPlanet ? 3.8 : selectedSector ? 6.2 : 12.5}
      rotateSpeed={0.72}
      target={HOME_TARGET}
    />
  );
}

function GalaxyScene({ map, selectedSectorId, selectedPlanetId, onSelectSector, onSelectPlanet }) {
  const selectedSector = (map.sectors || []).find(sector => sector.id === selectedSectorId) || null;
  const selectedPlanet = (map.planets || []).find(planet => planet.id === selectedPlanetId) || null;
  const entered = Boolean(selectedSector);
  const visiblePlanets = selectedSector ? planetsForSector(map, selectedSector.id) : [];

  return (
    <>
      <color attach="background" args={["#070102"]} />
      <fogExp2 attach="fog" args={["#080102", 0.012]} />
      <ambientLight intensity={0.32} color="#ffb0b8" />
      <directionalLight position={[4.2, 6.4, 5.2]} intensity={1.35} color="#fff1e6" />
      <pointLight position={[0, 1.8, 0]} intensity={22} distance={12} color="#ffb22e" />
      <pointLight position={selectedSector ? sectorCenter(selectedSector, 1.1).toArray() : [4.5, 1.1, -4.2]} intensity={selectedSector ? 34 : 18} distance={8} color="#ff2438" />
      <BackdropStars entered={entered} />
      <GuideGrid map={map} entered={entered} />
      {(map.sectors || []).map(sector => (
        <SectorPlate
          entered={entered}
          key={sector.id}
          map={map}
          onSelect={onSelectSector}
          selected={selectedSector?.id === sector.id}
          sector={sector}
        />
      ))}
      {(map.sectors || []).map(sector => (
        <SectorSurveyStars key={`${sector.id}-survey`} sector={sector} visible={selectedSector?.id === sector.id} />
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
      <CameraRig selectedPlanet={selectedPlanet} selectedSector={selectedSector} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.44} luminanceThreshold={0.18} luminanceSmoothing={0.34} />
        <DepthOfField focusDistance={0.018} focalLength={0.01} bokehScale={0.18} height={420} />
        <ChromaticAberration offset={[0.00035, 0.00018]} />
        <Noise opacity={0.024} />
        <Vignette eskil={false} offset={0.2} darkness={0.5} />
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
      <button className="gc-zoom" type="button" onClick={onZoomOut}>ZOOM OUT</button>
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
          {selectedPlanet.robloxLaunchUrl ? <a className="gc-play" href={selectedPlanet.robloxLaunchUrl}>PLAY</a> : null}
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
        <Canvas camera={{ position: HOME_CAMERA.toArray(), fov: 47, near: 0.04, far: 80 }} dpr={[1, 1.65]} gl={{ antialias: true, powerPreference: "high-performance" }}>
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
    background: #070102;
    overflow: hidden;
  }

  .gc-root {
    background:
      radial-gradient(circle at 50% 46%, rgba(255, 36, 56, .09), transparent 42%),
      linear-gradient(180deg, #130306 0%, #070102 72%);
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
    touch-action: none;
    width: 100% !important;
  }

  .gc-stage canvas:active {
    cursor: grabbing;
  }

  .gc-scan {
    background:
      repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(255, 165, 170, .026) 3px, rgba(255, 165, 170, .026) 5px),
      radial-gradient(circle at 50% 50%, transparent 0%, transparent 58%, rgba(0, 0, 0, .74) 100%);
    mix-blend-mode: screen;
    opacity: .74;
    pointer-events: none;
    z-index: 3;
  }

  .gc-header {
    background: rgba(18, 2, 5, .76);
    border: 1px solid rgba(255, 36, 56, .46);
    box-shadow: 0 0 24px rgba(255, 36, 56, .22), inset 0 0 24px rgba(255, 255, 255, .025);
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
    color: rgba(255, 220, 222, .78);
    font-size: .64rem;
    text-transform: uppercase;
  }

  .gc-header strong {
    color: #ff5263;
    font-family: Orbitron, monospace;
    font-size: .92rem;
    text-shadow: 0 0 16px rgba(255, 36, 56, .48);
  }

  .gc-panel {
    background: rgba(16, 2, 5, .84);
    border: 1px solid rgba(255, 36, 56, .42);
    bottom: clamp(16px, 2.6vw, 34px);
    box-shadow: 0 0 34px rgba(255, 36, 56, .22), inset 0 0 26px rgba(255, 255, 255, .026);
    clip-path: polygon(0 0, calc(100% - 13px) 0, 100% 13px, 100% 100%, 13px 100%, 0 calc(100% - 13px));
    display: grid;
    gap: 12px;
    max-width: 390px;
    padding: 18px;
    position: absolute;
    right: clamp(16px, 2.6vw, 34px);
    width: calc(100vw - 32px);
    z-index: 6;
  }

  .gc-panel h1 {
    color: #fff;
    font-family: Cinzel, serif;
    font-size: 1.42rem;
    line-height: 1.05;
    text-transform: uppercase;
  }

  .gc-panel p {
    color: rgba(255, 235, 236, .82);
    font-size: .8rem;
    line-height: 1.45;
  }

  .gc-meta,
  .gc-stat-grid {
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr auto;
  }

  .gc-stat-grid,
  .gc-list {
    border-top: 1px solid rgba(255, 36, 56, .24);
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
    grid-template-columns: 76px 1fr 38px;
  }

  .gc-control-row span,
  .gc-control-row strong {
    color: rgba(255, 236, 238, .86);
    font-size: .66rem;
    text-transform: uppercase;
  }

  .gc-control-row div {
    background: rgba(255, 255, 255, .075);
    border: 1px solid rgba(255, 255, 255, .1);
    height: 8px;
    overflow: hidden;
  }

  .gc-control-row i {
    background: var(--faction);
    box-shadow: 0 0 16px var(--faction);
    display: block;
    height: 100%;
  }

  .gc-zoom,
  .gc-play {
    background: rgba(255, 36, 56, .08);
    border: 1px solid rgba(255, 36, 56, .48);
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
    background: rgba(255, 36, 56, .17);
    border-color: rgba(255, 36, 56, .88);
  }

  .gc-zoom:hover,
  .gc-zoom:focus-visible,
  .gc-play:hover,
  .gc-play:focus-visible {
    box-shadow: 0 0 20px rgba(255, 36, 56, .32);
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
