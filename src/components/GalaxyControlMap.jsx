"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Billboard, OrbitControls, Sparkles, Stars, Text } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const TAU = Math.PI * 2;
const GALAXY_RADIUS = 5.7;
const GALAXY_FLATTEN = 1;
const SPIRAL_ARM_COUNT = 4;
// Real disk galaxies trace logarithmic spirals with a pitch angle of roughly 10-25deg
// (tight near the core, opening up toward the rim). This replaces the old linear
// "angle = radius * sweep" model, which wound at a constant rate everywhere and
// didn't match how actual spiral arms behave.
const SPIRAL_PITCH_DEG = 21.5;
const SPIRAL_B = Math.tan(THREE.MathUtils.degToRad(SPIRAL_PITCH_DEG));
// Was 0.78, which squashed the star field into an ellipse that didn't match the
// perfectly circular sector grid (GALAXY_FLATTEN = 1). Keeping both at 1 makes the
// galaxy a true circle in its own plane; the tilt/perspective from camera framing
// is what should account for any apparent ellipse, not a baked-in squash.
const GALAXY_VISUAL_FLATTEN = 1;
const CORE_RADIUS = 1.08;
const GALAXY_BASE_ROTATION_X = -0.045;
const GALAXY_BASE_ROTATION_Y = -0.32;
const GALAXY_BASE_ROTATION_Z = 0.02;
const GALAXY_BASE_ROTATION = new THREE.Euler(GALAXY_BASE_ROTATION_X, GALAXY_BASE_ROTATION_Y, GALAXY_BASE_ROTATION_Z);
const WIDE_CAMERA = new THREE.Vector3(0, 16.8, 15.4);
const WIDE_TARGET = new THREE.Vector3(0.18, 0, -0.36);
const SECTOR_CAMERA_LIFT = 5.7;
const SECTOR_CAMERA_PULLBACK = 6.6;
const PLANET_APPROACH_DISTANCE = 2.15;
const PLANET_ENTRY_DISTANCE = 54;
const BODY_Y_OFFSET = 0.05;
const PARTICLE_COUNTS = {
  high: { stars: 24500, dust: 36000, sky: 7200, sparkles: 340, streaks: 1900 },
  balanced: { stars: 12800, dust: 18000, sky: 3400, sparkles: 150, streaks: 1150 },
  reduced: { stars: 8800, dust: 9000, sky: 2200, sparkles: 90, streaks: 620 }
};
const KORRIBAN_TEXTURE_URLS = [
  "/assets/galaxy/korriban/diffuse.png",
  "/assets/galaxy/korriban/bump.png",
  "/assets/galaxy/korriban/elevation.png",
  "/assets/galaxy/korriban/roughness.png",
  "/assets/galaxy/korriban/clouds.png"
];
const DEFAULT_FACTIONS = [
  {
    id: "sith-empire",
    name: "Sith Empire",
    shortName: "Sith",
    color: "#d8162a",
    glow: "#ff2438",
    fill: "#7d0611"
  },
  {
    id: "jedi-republic",
    name: "Jedi / Republic",
    shortName: "Republic",
    color: "#2f9cff",
    glow: "#61d9ff",
    fill: "#0e4f89"
  },
  {
    id: "neutral",
    name: "Neutral / Unknown",
    shortName: "Neutral",
    color: "#767676",
    glow: "#c0c0c0",
    fill: "#2a2a2a"
  }
];

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rnd, min, max) {
  return min + rnd() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function idSeed(id = "galaxy") {
  return Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function colorWithAlpha(hex, alpha) {
  const color = new THREE.Color(hex || "#ffffff");
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
}

function makeTextureFromCanvas(draw, width = 1024, height = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function makeGlowTexture(inner = "rgba(255,255,255,1)", mid = "rgba(255,61,68,.42)") {
  return makeTextureFromCanvas((ctx, width, height) => {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.23, "rgba(255, 220, 160, .8)");
    gradient.addColorStop(0.5, mid);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }, 512, 512);
}

function configurePlanetTexture(texture, { color = false, anisotropy = 8 } = {}) {
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

function factionById(map, id) {
  const factions = map?.factions?.length ? map.factions : DEFAULT_FACTIONS;
  return factions.find(faction => faction.id === id) || factions[0] || DEFAULT_FACTIONS[0];
}

function planetsForSector(map, sectorId) {
  return (map?.planets || []).filter(planet => planet.sectorId === sectorId);
}

function controlForSector(map, sectorId) {
  const planets = planetsForSector(map, sectorId);
  const factions = map?.factions?.length ? map.factions : DEFAULT_FACTIONS;
  const totals = Object.fromEntries(factions.map(faction => [faction.id, 0]));
  if (!planets.length) return totals;
  planets.forEach(planet => {
    totals[planet.factionId] = (totals[planet.factionId] || 0) + 1;
  });
  Object.keys(totals).forEach(key => {
    totals[key] = Math.round((totals[key] / planets.length) * 100);
  });
  return totals;
}

function getGuideRadius(map) {
  return map?.guide?.radius || 6.74;
}

function getMapScale(map) {
  return GALAXY_RADIUS / getGuideRadius(map);
}

function polarToScene(angleDeg, radius, map) {
  const angle = THREE.MathUtils.degToRad(angleDeg);
  const scaledRadius = radius * getMapScale(map);
  return new THREE.Vector3(
    Math.cos(angle) * scaledRadius,
    0,
    Math.sin(angle) * scaledRadius * GALAXY_FLATTEN
  );
}

function mapPointToScene(position, map, y = BODY_Y_OFFSET) {
  const scale = getMapScale(map);
  return new THREE.Vector3(
    (position?.[0] || 0) * scale,
    y,
    (position?.[1] || position?.[2] || 0) * scale * GALAXY_FLATTEN
  );
}

function mapLocalToWorld(point) {
  return point.clone().applyEuler(GALAXY_BASE_ROTATION);
}

function mapPointToWorld(position, map, y = BODY_Y_OFFSET) {
  return mapLocalToWorld(mapPointToScene(position, map, y));
}

function sectorMidAngle(sector) {
  return ((sector.startAngleDeg || 0) + (sector.endAngleDeg || 0)) / 2;
}

function sectorMidRadius(sector) {
  return ((sector.innerRadius || CORE_RADIUS) + (sector.outerRadius || getGuideRadius())) / 2;
}

function sectorSceneCenter(sector, map) {
  return polarToScene(sectorMidAngle(sector), sectorMidRadius(sector), map);
}

function makeLineGeometry(points) {
  return new THREE.BufferGeometry().setFromPoints(points);
}

function LineGeometry({ points }) {
  const geometry = useMemo(() => makeLineGeometry(points), [points]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive attach="geometry" object={geometry} />;
}

function TubeGeometry({ points, radius = 0.026 }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, Math.max(64, points.length * 2), radius, 8, false);
  }, [points, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive attach="geometry" object={geometry} />;
}

function makeEllipsePoints(radiusX, radiusZ, segments = 240, start = 0, end = TAU, y = 0) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = start + ((end - start) * i) / segments;
    points.push(new THREE.Vector3(Math.cos(angle) * radiusX, y, Math.sin(angle) * radiusZ));
  }
  return points;
}

function spiralAngle(radius, arm, armCount = SPIRAL_ARM_COUNT) {
  const base = (arm / armCount) * TAU;
  const r = Math.max(radius, CORE_RADIUS);
  // theta = theta0 + ln(r / r0) / tan(pitch) - a true logarithmic spiral.
  // Near the core the angle changes fast (tight winding); further out it changes
  // slowly (loose, open winding) - exactly how real spiral arms are shaped.
  return base + Math.log(r / CORE_RADIUS) / SPIRAL_B;
}

function makeSpiralArmPoints(arm, radiusStart = 1.1, radiusEnd = GALAXY_RADIUS, segments = 96, offset = 0) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const radius = radiusStart + (radiusEnd - radiusStart) * t;
    const angle = spiralAngle(radius, arm) + offset;
    const widthWave = Math.sin(t * Math.PI) * 0.18;
    points.push(new THREE.Vector3(
      Math.cos(angle) * (radius + widthWave),
      0.032 + Math.sin(t * TAU + arm) * 0.018,
      Math.sin(angle) * (radius + widthWave) * GALAXY_VISUAL_FLATTEN
    ));
  }
  return points;
}

function SpiralArmRibbons({ opacity = 1 }) {
  const arms = useMemo(() => {
    const rows = [];
    for (let arm = 0; arm < SPIRAL_ARM_COUNT; arm += 1) {
      rows.push({
        key: `glow-${arm}`,
        points: makeSpiralArmPoints(arm, CORE_RADIUS * 1.08, GALAXY_RADIUS * 0.96, 110, 0),
        color: arm % 2 ? "#ff3b4f" : "#ffd08c",
        opacity: arm % 2 ? 0.16 : 0.12,
        radius: arm % 2 ? 0.026 : 0.022
      });
      rows.push({
        key: `dust-${arm}`,
        points: makeSpiralArmPoints(arm, CORE_RADIUS * 1.32, GALAXY_RADIUS * 0.925, 92, -0.18),
        color: "#7c1020",
        opacity: 0.24,
        radius: 0.028
      });
    }
    return rows;
  }, []);

  return (
    <group>
      {arms.map(arm => (
        <mesh key={arm.key}>
          <TubeGeometry points={arm.points} radius={arm.radius} />
          <meshBasicMaterial color={arm.color} transparent opacity={arm.opacity * opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function makeSpiralGalaxyGeometry(count, seed, mode = "stars") {
  const rnd = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const coreChance = mode === "stars" ? 0.012 : mode === "dust" ? 0.028 : 0.11;
    const isCore = mode === "core" || rnd() < coreChance;
    const arm = i % SPIRAL_ARM_COUNT;
    const armStart = mode === "dust" ? CORE_RADIUS * 1.18 : CORE_RADIUS * 1.34;
    const radius = isCore
      ? Math.pow(rnd(), 1.9) * CORE_RADIUS
      : Math.pow(rnd(), mode === "dust" ? 0.72 : 0.62) * (GALAXY_RADIUS - armStart) + armStart;
    const armAngle = spiralAngle(radius, arm);
    // Arms stay narrow near the core and relax into wider bands further out -
    // real arms have roughly constant angular width in radians, not linear width,
    // so the physical band gets wider (in distance) as radius grows.
    const armWidth = mode === "dust" ? 0.15 + radius * 0.019 : 0.07 + radius * 0.01;
    const jitter = isCore ? randRange(rnd, -TAU, TAU) : randRange(rnd, -armWidth, armWidth);
    const angle = isCore ? rnd() * TAU : armAngle + jitter;
    const spread = mode === "dust" ? 0.3 + radius * 0.03 : 0.025 + radius * 0.006;
    const x = Math.cos(angle) * radius + randRange(rnd, -spread, spread);
    const z = Math.sin(angle) * radius * GALAXY_VISUAL_FLATTEN + randRange(rnd, -spread, spread);
    const y = randRange(rnd, -0.055, 0.055) * (1 + radius * 0.045);
    const rimFade = Math.min(1, radius / GALAXY_RADIUS);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const palette = isCore
      ? (rnd() > 0.28 ? "#ffe2a0" : "#ff563f")
      : rnd() > 0.94 ? "#ff5fae" : rnd() > 0.87 ? "#ff3b4f" : rnd() > 0.62 ? "#ffd58a" : rnd() > 0.32 ? "#f9fbff" : "#9feeff";
    color.set(palette);
    if (!isCore && rnd() > 0.88) color.lerp(new THREE.Color("#526cff"), 0.22);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i] = mode === "dust"
      ? randRange(rnd, 0.065, 0.21) * (1.28 - rimFade * 0.18)
      : randRange(rnd, 0.014, 0.075) * (isCore ? 0.85 : 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  return geometry;
}

const NEBULA_PALETTE = ["#ff2f6b", "#ff6fae", "#4fd8ff", "#8f6bff", "#ffb45c"];

function makeNebulaCloudTexture(hex) {
  return makeTextureFromCanvas((ctx, width, height) => {
    const c = new THREE.Color(hex);
    const rgb = `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`;
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, `rgba(${rgb}, 0.85)`);
    gradient.addColorStop(0.32, `rgba(${rgb}, 0.4)`);
    gradient.addColorStop(0.65, `rgba(${rgb}, 0.12)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }, 256, 256);
}

// Soft, irregular gas-cloud clumps scattered along the spiral arms - the "nebulaic"
// haze real galaxy photos show around star-forming regions. Cheap (one sprite each),
// additively blended so overlap only adds glow rather than causing z-fighting.
function NebulaClouds({ opacity = 1, count = 46, seed = 6410 }) {
  const textures = useMemo(() => NEBULA_PALETTE.map(hex => makeNebulaCloudTexture(hex)), []);
  useEffect(() => () => textures.forEach(texture => texture.dispose()), [textures]);

  const clumps = useMemo(() => {
    const rnd = seededRandom(seed);
    const rows = [];
    for (let i = 0; i < count; i += 1) {
      const arm = i % SPIRAL_ARM_COUNT;
      const radius = randRange(rnd, CORE_RADIUS * 1.5, GALAXY_RADIUS * 0.92);
      const angle = spiralAngle(radius, arm) + randRange(rnd, -0.24, 0.24);
      const wobble = randRange(rnd, -0.4, 0.4);
      const x = Math.cos(angle) * radius + wobble;
      const z = Math.sin(angle) * radius * GALAXY_VISUAL_FLATTEN + wobble;
      const scale = randRange(rnd, 0.6, 1.75) * (0.55 + (radius / GALAXY_RADIUS) * 0.5);
      rows.push({
        position: [x, randRange(rnd, -0.02, 0.05), z],
        scaleX: scale * randRange(rnd, 0.85, 1.5),
        scaleY: scale,
        rotation: randRange(rnd, 0, TAU),
        textureIndex: Math.floor(rnd() * NEBULA_PALETTE.length),
        baseOpacity: randRange(rnd, 0.14, 0.3)
      });
    }
    return rows;
  }, [count, seed]);

  return (
    <group>
      {clumps.map((clump, index) => (
        <sprite key={index} position={clump.position} scale={[clump.scaleX, clump.scaleY, 1]}>
          <spriteMaterial
            map={textures[clump.textureIndex]}
            rotation={clump.rotation}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={clump.baseOpacity * opacity}
          />
        </sprite>
      ))}
    </group>
  );
}

function GalaxyParticles({ mode, count, seed, opacity, sizeScale = 1 }) {
  const geometry = useMemo(() => makeSpiralGalaxyGeometry(count, seed, mode), [count, seed, mode]);
  const materialRef = useRef(null);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime;
      materialRef.current.uniforms.uOpacity.value = opacity;
    }
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uOpacity: { value: opacity },
          uScale: { value: sizeScale }
        }}
        vertexShader={`
          attribute float aSize;
          uniform float uTime;
          uniform float uScale;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec3 pos = position;
            float breath = sin(uTime * 0.24 + position.x * 1.8 + position.z * 1.3) * 0.018;
            pos.y += breath;
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = aSize * uScale * (440.0 / max(6.0, -mvPosition.z));
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uOpacity;
          varying vec3 vColor;
          void main() {
            vec2 uv = gl_PointCoord * 2.0 - 1.0;
            float d = length(uv);
            float core = 1.0 - smoothstep(0.0, 0.18, d);
            float glow = 1.0 - smoothstep(0.12, 1.0, d);
            float twinkle = 0.75 + 0.25 * sin(uTime * 1.8 + vColor.r * 17.0);
            gl_FragColor = vec4(vColor, (core + glow * 0.62) * uOpacity * twinkle);
          }
        `}
      />
    </points>
  );
}

function SectorGrid({ opacity = 1 }) {
  const radialLines = useMemo(() => {
    const lines = [];
    for (let i = 0; i < 24; i += 1) {
      const angle = (i / 24) * TAU;
      lines.push([
        new THREE.Vector3(Math.cos(angle) * CORE_RADIUS, 0.018, Math.sin(angle) * CORE_RADIUS * GALAXY_FLATTEN),
        new THREE.Vector3(Math.cos(angle) * GALAXY_RADIUS, 0.018, Math.sin(angle) * GALAXY_RADIUS * GALAXY_FLATTEN)
      ]);
    }
    return lines;
  }, []);

  return (
    <group>
      {[1.2, 2.25, 3.4, 4.6, 5.625].map((radius, index) => (
        <line key={radius} position={[0, 0.02 + index * 0.002, 0]}>
          <LineGeometry points={makeEllipsePoints(radius, radius * GALAXY_FLATTEN, 260)} />
          <lineBasicMaterial color={index === 4 ? "#ff3b4f" : "#7a1a28"} transparent opacity={(index === 4 ? 0.24 : 0.1) * opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
        </line>
      ))}
      {radialLines.map((points, index) => (
        <line key={index}>
          <LineGeometry points={points} />
          <lineBasicMaterial color={index % 3 === 0 ? "#ff3b4f" : "#5f1b25"} transparent opacity={(index % 3 === 0 ? 0.14 : 0.06) * opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
        </line>
      ))}
    </group>
  );
}

function GalacticCore({ opacity = 1 }) {
  const glow = useMemo(() => makeGlowTexture("rgba(255,255,255,1)", "rgba(255,83,45,.58)"), []);
  useEffect(() => () => glow.dispose(), [glow]);

  return (
    <group>
      <sprite position={[0, 0.08, 0]} scale={[4.4, 4.4, 1]}>
        <spriteMaterial map={glow} color="#ffcf91" transparent opacity={0.34 * opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.34, 48, 24]} />
        <meshBasicMaterial color="#ffe1a0" transparent opacity={0.94 * opacity} blending={THREE.AdditiveBlending} />
      </mesh>
      <Sparkles count={90} scale={[2.4, 0.9, 2.4]} size={3.6} speed={0.35} color="#ffd38a" opacity={0.84 * opacity} />
    </group>
  );
}

function LabelBackdrop({ width, height, color, opacity = 1 }) {
  const borderPoints = useMemo(() => {
    const x = width / 2;
    const y = height / 2;
    return [
      new THREE.Vector3(-x, -y, 0),
      new THREE.Vector3(x, -y, 0),
      new THREE.Vector3(x, y, 0),
      new THREE.Vector3(-x, y, 0),
      new THREE.Vector3(-x, -y, 0)
    ];
  }, [width, height]);

  return (
    <group position={[0, 0, -0.02]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#070104" transparent opacity={0.62 * opacity} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
      <line>
        <LineGeometry points={borderPoints} />
        <lineBasicMaterial color={color} transparent opacity={0.5 * opacity} depthWrite={false} depthTest={false} />
      </line>
    </group>
  );
}

function SectorVectorLabel({ sector, faction, dominant, active, dimmed, position, onSelect }) {
  const color = faction.glow || faction.color;
  const opacity = dimmed ? 0.28 : active ? 1 : 0.82;

  const handleClick = event => {
    event.stopPropagation();
    onSelect(sector.id);
  };

  return (
    <Billboard position={[position.x, 0.58, position.z]} follow>
      <group onClick={handleClick} onPointerOver={event => event.stopPropagation()}>
        <LabelBackdrop width={2.15} height={0.72} color={color} opacity={opacity} />
        <Text position={[0, 0.2, 0]} fontSize={0.105} anchorX="center" anchorY="middle" color={color} outlineWidth={0.004} outlineColor="#000000" material-depthTest={false} material-depthWrite={false} material-toneMapped={false}>
          {sector.grid || "SECTOR"}
        </Text>
        <Text position={[0, 0.02, 0]} fontSize={0.16} maxWidth={1.92} anchorX="center" anchorY="middle" color="#fff2df" outlineWidth={0.007} outlineColor="#000000" material-depthTest={false} material-depthWrite={false} material-toneMapped={false}>
          {sector.name}
        </Text>
        <Text position={[0, -0.2, 0]} fontSize={0.092} anchorX="center" anchorY="middle" color={color} outlineWidth={0.004} outlineColor="#000000" material-depthTest={false} material-depthWrite={false} material-toneMapped={false}>
          {dominant || 100}% {faction.shortName || faction.name}
        </Text>
      </group>
    </Billboard>
  );
}

function PlanetVectorLabel({ body }) {
  const color = body.colors.glow;

  return (
    <Billboard position={[0, Math.max(body.visualRadius * 2.35, 0.22), 0]} follow>
      <group>
        <LabelBackdrop width={0.98} height={0.34} color={color} opacity={0.86} />
        <Text position={[0, 0.08, 0]} fontSize={0.058} anchorX="center" anchorY="middle" color={color} outlineWidth={0.003} outlineColor="#000000" material-depthTest={false} material-depthWrite={false} material-toneMapped={false}>
          {body.grid || "R-5"}
        </Text>
        <Text position={[0, -0.045, 0]} fontSize={0.102} maxWidth={0.86} anchorX="center" anchorY="middle" color="#fff2df" outlineWidth={0.005} outlineColor="#000000" material-depthTest={false} material-depthWrite={false} material-toneMapped={false}>
          {body.shortName || body.name}
        </Text>
      </group>
    </Billboard>
  );
}

function makeSectorGeometry(sector, map) {
  const seed = idSeed(sector.id);
  const rnd = seededRandom(seed + 9941);
  const start = sector.startAngleDeg || 0;
  const end = sector.endAngleDeg || start + 22;
  const inner = sector.innerRadius || 0.82;
  const outer = sector.outerRadius || getGuideRadius(map);
  const steps = Math.max(9, Math.ceil(Math.abs(end - start) / 3));
  const vectors = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = start + (end - start) * t;
    const edgeSpike = Math.sin(t * Math.PI) * 0.08;
    const cellStep = Math.floor(t * 7);
    const jigsaw = (Math.sin((cellStep + seed) * 2.17) * 0.16 + Math.sin((t + seed) * 9.2) * 0.055 + randRange(rnd, -0.025, 0.025)) * getMapScale(map);
    const radius = outer + edgeSpike + jigsaw;
    vectors.push(polarToScene(angle, radius, map));
  }

  for (let i = steps; i >= 0; i -= 1) {
    const t = i / steps;
    const angle = start + (end - start) * t;
    const bite = Math.sin((Math.floor(t * 6) + seed) * 1.9) * 0.08 + Math.sin(t * Math.PI * 3) * 0.035;
    const radius = inner + bite;
    vectors.push(polarToScene(angle, radius, map));
  }

  const shape = new THREE.Shape(vectors.map(point => new THREE.Vector2(point.x, point.z)));
  const geometry = new THREE.ShapeGeometry(shape, 2);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getY(i);
    position.setXYZ(i, x, -0.055, z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return { geometry, edgePoints: vectors.map(point => new THREE.Vector3(point.x, -0.026, point.z)) };
}

function SectorControlZone({ map, sector, active, dimmed, labelVisible, onSelect }) {
  const faction = factionById(map, sector.factionId);
  const { geometry, edgePoints } = useMemo(() => makeSectorGeometry(sector, map), [sector, map]);
  const center = useMemo(() => sectorSceneCenter(sector, map), [sector, map]);
  const controls = useMemo(() => controlForSector(map, sector.id), [map, sector.id]);
  const dominant = controls[sector.factionId] || 0;

  useEffect(() => () => geometry.dispose(), [geometry]);

  const handleClick = event => {
    event.stopPropagation();
    onSelect(sector.id);
  };

  return (
    <group>
      <mesh geometry={geometry} onClick={handleClick} onPointerOver={event => event.stopPropagation()}>
        <meshBasicMaterial
          color={faction.fill || faction.color}
          transparent
          opacity={active ? 0.38 : dimmed ? 0.045 : 0.24}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <line>
        <LineGeometry points={[...edgePoints, edgePoints[0]]} />
        <lineBasicMaterial color={faction.glow || faction.color} transparent opacity={active ? 0.9 : dimmed ? 0.12 : 0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
      {labelVisible ? (
        <SectorVectorLabel
          sector={sector}
          faction={faction}
          dominant={dominant}
          active={active}
          dimmed={dimmed}
          position={center}
          onSelect={onSelect}
        />
      ) : null}
    </group>
  );
}

function makePlanetTextures(body) {
  const seed = idSeed(body.id);
  const rnd = seededRandom(seed + 1447);
  const base = body.colors?.surface || "#7a301f";
  const dark = body.colors?.surfaceDark || "#140607";
  const accent = body.colors?.accent || "#ffb36d";

  const map = makeTextureFromCanvas((ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, dark);
    gradient.addColorStop(0.25, base);
    gradient.addColorStop(0.55, dark);
    gradient.addColorStop(0.8, base);
    gradient.addColorStop(1, accent);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 320; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.045, 0.2);
      ctx.fillStyle = rnd() > 0.56 ? accent : dark;
      ctx.fillRect(0, rnd() * height, width, randRange(rnd, body.id === "korriban" ? 1 : 1, body.id === "korriban" ? 24 : 12));
    }

    for (let i = 0; i < 260; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.04, 0.22);
      ctx.fillStyle = rnd() > 0.5 ? colorWithAlpha(accent, 1) : colorWithAlpha(dark, 1);
      ctx.beginPath();
      ctx.ellipse(
        rnd() * width,
        rnd() * height,
        randRange(rnd, body.id === "korriban" ? 8 : 4, body.id === "korriban" ? 86 : 42),
        randRange(rnd, 2, body.id === "korriban" ? 26 : 14),
        rnd() * TAU,
        0,
        TAU
      );
      ctx.fill();
    }

    if (body.id === "korriban") {
      for (let i = 0; i < 78; i += 1) {
        ctx.globalAlpha = randRange(rnd, 0.07, 0.18);
        ctx.strokeStyle = colorWithAlpha("#ffd0a0", 1);
        ctx.lineWidth = randRange(rnd, 1, 4);
        ctx.beginPath();
        const y = rnd() * height;
        ctx.moveTo(-40, y);
        for (let x = 0; x <= width + 80; x += 80) {
          ctx.lineTo(x, y + Math.sin(x * 0.015 + rnd() * TAU) * randRange(rnd, 3, 18));
        }
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  });

  const bumpMap = makeTextureFromCanvas((ctx, width, height) => {
    ctx.fillStyle = "#777";
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 540; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.035, 0.18);
      ctx.fillStyle = rnd() > 0.5 ? "#fff" : "#111";
      ctx.beginPath();
      ctx.ellipse(rnd() * width, rnd() * height, randRange(rnd, 4, 64), randRange(rnd, 2, 20), rnd() * TAU, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  const cloudMap = makeTextureFromCanvas((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < 260; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.014, 0.07);
      ctx.fillStyle = "#ffd9bf";
      ctx.beginPath();
      ctx.ellipse(rnd() * width, rnd() * height, randRange(rnd, 18, 110), randRange(rnd, 3, 20), rnd() * TAU, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  return { map, bumpMap, cloudMap };
}

function normalizePlanet(map, planet) {
  const faction = factionById(map, planet.factionId);
  return {
    ...planet,
    kind: planet.kind || "Strategic World",
    region: planet.region || planet.regionId || "Outer Rim",
    colors: {
      surface: planet.colors?.surface || "#7d3521",
      surfaceDark: planet.colors?.surfaceDark || "#160607",
      accent: planet.colors?.accent || "#d08a54",
      glow: planet.colors?.glow || faction.glow || faction.color
    },
    scenePosition: mapPointToScene(planet.position || planet.mapPosition || [0, 0], map, BODY_Y_OFFSET),
    visualRadius: Math.max(0.07, (planet.radius || 0.065) * getMapScale(map) * 2.35)
  };
}

function useKorribanTextureSet() {
  const [map, normalMap, elevationMap, roughnessMap, cloudMap] = useLoader(THREE.TextureLoader, KORRIBAN_TEXTURE_URLS);
  const maxAnisotropy = useThree(state => Math.min(12, state.gl.capabilities.getMaxAnisotropy?.() || 8));

  useEffect(() => {
    configurePlanetTexture(map, { color: true, anisotropy: maxAnisotropy });
    configurePlanetTexture(normalMap, { anisotropy: maxAnisotropy });
    configurePlanetTexture(elevationMap, { anisotropy: maxAnisotropy });
    configurePlanetTexture(roughnessMap, { anisotropy: maxAnisotropy });
    configurePlanetTexture(cloudMap, { color: true, anisotropy: maxAnisotropy });
  }, [map, normalMap, elevationMap, roughnessMap, cloudMap, maxAnisotropy]);

  return { map, normalMap, elevationMap, roughnessMap, cloudMap };
}

function KorribanTexturePreloader({ onReady }) {
  useKorribanTextureSet();

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  return null;
}

function PlanetBody({ map, planet, mode, active, hovered, onSelect, onHover }) {
  const body = useMemo(() => normalizePlanet(map, planet), [map, planet]);
  const groupRef = useRef(null);
  const planetRef = useRef(null);
  const cloudsRef = useRef(null);
  const scanRef = useRef(null);
  const korribanTextures = useKorribanTextureSet();
  const generatedTextures = useMemo(() => body.id === "korriban" ? null : makePlanetTextures(body), [body]);
  const hasKorribanTextures = body.id === "korriban";
  const textures = hasKorribanTextures ? korribanTextures : generatedTextures;
  const haloTexture = useMemo(() => makeGlowTexture("rgba(255,255,255,1)", colorWithAlpha(body.colors.glow, 0.58)), [body.colors.glow]);
  const isGalaxy = mode === "galaxy";
  const targetScale = active ? 7.4 : mode === "sector" ? (hovered ? 1.35 : 1.08) : isGalaxy ? 0.34 : 2.15;
  const labelVisible = mode === "sector";
  const sectorMarkerVisible = mode === "sector";

  useEffect(() => () => {
    if (generatedTextures) {
      generatedTextures.map.dispose();
      generatedTextures.bumpMap.dispose();
      generatedTextures.cloudMap.dispose();
    }
    haloTexture.dispose();
  }, [generatedTextures, haloTexture]);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (groupRef.current) {
      const next = new THREE.Vector3(targetScale, targetScale, targetScale);
      groupRef.current.scale.lerp(next, 0.075);
      const emergence = mode === "sector" || active ? Math.sin(t * 0.7 + idSeed(body.id)) * 0.035 : 0;
      groupRef.current.position.y = body.scenePosition.y + emergence;
    }
    if (planetRef.current) {
      planetRef.current.rotation.y += (active ? 0.05 : 0.035) * delta;
      planetRef.current.rotation.x = THREE.MathUtils.lerp(planetRef.current.rotation.x, 0.018, 0.025);
    }
    if (cloudsRef.current) cloudsRef.current.rotation.y += (active ? 0.072 : 0.052) * delta;
    if (scanRef.current) {
      scanRef.current.visible = sectorMarkerVisible;
      if (!sectorMarkerVisible) return;
      const pulse = 0.5 + Math.sin(t * 3.2) * 0.5;
      scanRef.current.rotation.z += active ? 0.028 : 0.012;
      scanRef.current.material.opacity = (hovered ? 0.44 : 0.18) + pulse * 0.06;
    }
  });

  const handlePointerOver = event => {
    event.stopPropagation();
    onHover(body.id);
  };
  const handlePointerOut = event => {
    event.stopPropagation();
    onHover(null);
  };
  const handleClick = event => {
    event.stopPropagation();
    onSelect(body.id);
  };

  return (
    <group ref={groupRef} position={body.scenePosition.toArray()}>
      <mesh ref={planetRef} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onClick={handleClick}>
        <sphereGeometry args={[body.visualRadius, 96, 48]} />
        {hasKorribanTextures ? (
          <meshStandardMaterial
            map={textures.map}
            roughnessMap={textures.roughnessMap}
            roughness={0.9}
            metalness={0}
            emissive={body.colors.surfaceDark}
            emissiveIntensity={active ? 0.12 : 0.03}
          />
        ) : (
          <meshStandardMaterial
            map={textures.map}
            bumpMap={textures.bumpMap}
            bumpScale={0.04}
            roughness={0.82}
            metalness={0.02}
            emissive={body.colors.surfaceDark}
            emissiveIntensity={active ? 0.24 : 0.06}
          />
        )}
      </mesh>
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[body.visualRadius * (hasKorribanTextures ? 1.0015 : 1.004), 96, 48]} />
        {hasKorribanTextures ? (
          <meshStandardMaterial
            map={textures.cloudMap}
            alphaMap={textures.cloudMap}
            color="#fff7ef"
            transparent
            opacity={0.42}
            alphaTest={0.035}
            roughness={1}
            metalness={0}
            depthWrite={false}
          />
        ) : (
          <meshStandardMaterial map={textures.cloudMap} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
        )}
      </mesh>
      {sectorMarkerVisible ? (
        <>
          <mesh scale={1.18}>
            <sphereGeometry args={[body.visualRadius * 1.16, 96, 36]} />
            <meshBasicMaterial color={body.colors.glow} transparent opacity={hovered ? 0.16 : 0.08} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide} />
          </mesh>
          <sprite scale={[body.visualRadius * 6.8, body.visualRadius * 6.8, 1]}>
            <spriteMaterial map={haloTexture} color={body.colors.glow} transparent opacity={hovered ? 0.24 : 0.12} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
          <line ref={scanRef} rotation={[Math.PI / 2, 0, 0]}>
            <LineGeometry points={makeEllipsePoints(body.visualRadius * 2.55, body.visualRadius * 2.55, 150)} />
            <lineBasicMaterial color={body.colors.glow} transparent opacity={0.24} blending={THREE.AdditiveBlending} depthWrite={false} />
          </line>
        </>
      ) : null}
      {labelVisible ? <PlanetVectorLabel body={body} /> : null}
    </group>
  );
}

function SectorPlanetField({ map, view, hoveredPlanetId, onSelectPlanet, onHoverPlanet }) {
  const sectorPlanets = useMemo(() => {
    if (!view.sectorId && view.mode !== "planet") return [];
    if (view.mode === "planet") return map.planets || [];
    return planetsForSector(map, view.sectorId);
  }, [map, view.mode, view.sectorId]);

  if (view.mode === "galaxy") return null;

  return (
    <group>
      {sectorPlanets.map(planet => {
        if (view.mode === "planet" && planet.id !== view.planetId) return null;
        return (
          <PlanetBody
            key={planet.id}
            map={map}
            planet={planet}
            mode={view.mode}
            active={view.planetId === planet.id}
            hovered={hoveredPlanetId === planet.id}
            onSelect={onSelectPlanet}
            onHover={onHoverPlanet}
          />
        );
      })}
    </group>
  );
}

function GalaxyControlMap({ map, view, onSelectSector, quality }) {
  const mode = view.mode;
  const opacity = mode === "galaxy" ? 1 : mode === "sector" ? 0.28 : 0;
  const sectorOpacity = mode === "galaxy" ? 1 : mode === "sector" ? 0.58 : 0;
  const counts = PARTICLE_COUNTS[quality] || PARTICLE_COUNTS.balanced;

  return (
    <group visible={opacity > 0.001}>
      <SectorGrid opacity={opacity} />
      <group position={[0, -0.005, 0]}>
        {(map.sectors || []).map(sector => (
          <SectorControlZone
            key={sector.id}
            map={map}
            sector={sector}
            active={view.sectorId === sector.id}
            dimmed={mode !== "galaxy" && view.sectorId !== sector.id}
            labelVisible={mode === "galaxy"}
            onSelect={onSelectSector}
          />
        ))}
      </group>
      <SpiralArmRibbons opacity={opacity} />
      <GalaxyParticles mode="stars" count={counts.stars} seed={4321} opacity={0.88 * opacity} sizeScale={0.92} />
      <GalaxyParticles mode="dust" count={counts.dust} seed={8827} opacity={0.24 * opacity} sizeScale={1.75} />
      <GalacticCore opacity={0.62 * sectorOpacity} />
    </group>
  );
}

function makeHyperspaceGeometry(count, seed) {
  const rnd = seededRandom(seed);
  const positions = new Float32Array(count * 2 * 3);
  const colors = new Float32Array(count * 2 * 3);
  const streaks = [];

  for (let i = 0; i < count; i += 1) {
    const angle = rnd() * TAU;
    const radius = randRange(rnd, 0.75, 19);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * randRange(rnd, 0.52, 0.9);
    const z = randRange(rnd, -86, -3);
    const length = randRange(rnd, 3.8, 12.5);
    const speed = randRange(rnd, 34, 72);
    const idx = i * 6;
    streaks.push({ x, y, z, length, speed, radius });

    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
    positions[idx + 3] = x;
    positions[idx + 4] = y;
    positions[idx + 5] = z - length;

    colors[idx] = 1;
    colors[idx + 1] = 1;
    colors[idx + 2] = 1;
    colors[idx + 3] = 1;
    colors[idx + 4] = 1;
    colors[idx + 5] = 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  return { geometry, streaks };
}

function HyperspaceTunnel({ active, quality, reducedMotion }) {
  const count = (PARTICLE_COUNTS[quality] || PARTICLE_COUNTS.balanced).streaks;
  const { geometry, streaks } = useMemo(() => makeHyperspaceGeometry(count, 7717), [count]);
  const ref = useRef(null);
  const materialRef = useRef(null);
  const opacityRef = useRef(0);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ camera, clock }, delta) => {
    if (!ref.current || !materialRef.current) return;
    const targetOpacity = active ? (reducedMotion ? 0.48 : 0.88) : 0;
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, active ? 0.18 : 0.12);
    ref.current.visible = opacityRef.current > 0.01;
    ref.current.position.copy(camera.position);
    ref.current.quaternion.copy(camera.quaternion);
    ref.current.rotation.z += Math.sin(clock.elapsedTime * 0.8) * 0.0008;

    const position = geometry.getAttribute("position");
    const array = position.array;
    const speedScale = active ? (reducedMotion ? 0.48 : 1) : 0.18;
    for (let i = 0; i < streaks.length; i += 1) {
      const streak = streaks[i];
      streak.z += streak.speed * delta * speedScale;
      if (streak.z > 2) {
        streak.z = randRange(seededRandom(i + 919), -92, -62);
      }

      const stretch = streak.length * (1 + opacityRef.current * (reducedMotion ? 0.7 : 2.15));
      const pulse = 1 + Math.sin(clock.elapsedTime * 1.8 + i) * 0.018;
      const idx = i * 6;
      array[idx] = streak.x * pulse;
      array[idx + 1] = streak.y * pulse;
      array[idx + 2] = streak.z;
      array[idx + 3] = streak.x * (pulse + 0.015);
      array[idx + 4] = streak.y * (pulse + 0.015);
      array[idx + 5] = streak.z - stretch;
    }
    position.needsUpdate = true;
    materialRef.current.opacity = opacityRef.current;
  });

  return (
    <lineSegments ref={ref} geometry={geometry} visible={false}>
      <lineBasicMaterial ref={materialRef} vertexColors transparent opacity={0} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </lineSegments>
  );
}

function resolveFocus(view, map) {
  if (view.mode === "planet") {
    const planet = (map.planets || []).find(item => item.id === view.planetId);
    return planet ? mapPointToWorld(planet.position || planet.mapPosition || [0, 0], map, BODY_Y_OFFSET) : WIDE_TARGET.clone();
  }
  if (view.mode === "sector") {
    const sector = (map.sectors || []).find(item => item.id === view.sectorId);
    return sector ? mapLocalToWorld(sectorSceneCenter(sector, map)) : WIDE_TARGET.clone();
  }
  return WIDE_TARGET.clone();
}

function horizontalApproachDirection(focus) {
  const direction = new THREE.Vector3(focus.x, 0, focus.z);
  if (direction.lengthSq() < 0.01) direction.set(0, 0, 1);
  return direction.normalize();
}

function resolveCamera(view, map, previousCamera) {
  const focus = resolveFocus(view, map);
  if (view.mode === "planet") {
    const outward = horizontalApproachDirection(focus);
    return focus.clone().add(outward.multiplyScalar(PLANET_APPROACH_DISTANCE));
  }
  if (view.mode === "sector") {
    const outward = focus.clone().sub(new THREE.Vector3(0, 0, 0));
    if (outward.lengthSq() < 0.01) outward.set(1, 0, 1);
    outward.normalize();
    return focus.clone().add(outward.multiplyScalar(SECTOR_CAMERA_PULLBACK)).add(new THREE.Vector3(0, SECTOR_CAMERA_LIFT, 2.4));
  }
  return WIDE_CAMERA.clone();
}

function CameraRig({ map, view, transition, controlsRef }) {
  const { camera } = useThree();
  const activeTransition = useRef(null);
  const lastKey = useRef(null);
  const lastStableView = useRef(view);

  useEffect(() => {
    const key = `${view.mode}:${view.sectorId || ""}:${view.planetId || ""}:${transition.token}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    const focus = resolveFocus(view, map);
    const targetCamera = resolveCamera(view, map, camera.position);
    const controls = controlsRef.current;
    const kind = transition.kind || view.mode;
    const isPlanetEntry = kind === "planet" && view.mode === "planet";
    const entryDirection = isPlanetEntry ? horizontalApproachDirection(focus) : camera.position.clone().sub(focus);
    if (entryDirection.lengthSq() < 0.01) entryDirection.set(1.8, 0.6, 1.8);
    entryDirection.normalize();
    const entryDistance = transition.reducedMotion ? 18 : PLANET_ENTRY_DISTANCE;
    const fromCamera = isPlanetEntry
      ? focus.clone().add(entryDirection.multiplyScalar(entryDistance))
      : camera.position.clone();

    activeTransition.current = {
      kind,
      startedAt: performance.now(),
      duration: isPlanetEntry ? transition.flightDuration || 1850 : transition.duration || 980,
      fromCamera,
      toCamera: targetCamera,
      fromTarget: controls?.target?.clone?.() || WIDE_TARGET.clone(),
      toTarget: focus,
      recoil: isPlanetEntry ? transition.reducedMotion ? 0.12 : 0.95 : 0.08,
      reducedMotion: !!transition.reducedMotion
    };

    if (controls) {
      controls.enabled = false;
      controls.autoRotate = false;
    }
  }, [view, transition, map, camera.position, controlsRef]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const current = activeTransition.current;
    if (current) {
      const raw = (performance.now() - current.startedAt) / current.duration;
      const capped = Math.min(1, raw);
      const isPlanetEntry = current.kind === "planet" && view.mode === "planet";
      const t = isPlanetEntry ? 1 - Math.pow(1 - capped, 3.4) : smoothstep(0, 1, raw);
      const recoil = isPlanetEntry
        ? Math.sin(capped * Math.PI * 3.1) * current.recoil * (1 - t * 0.62)
        : Math.sin(capped * Math.PI * 2.6) * current.recoil * (1 - t);
      camera.position.copy(current.fromCamera).lerp(current.toCamera, t);
      const recoilDirection = current.toCamera.clone().sub(current.toTarget).normalize();
      camera.position.add(recoilDirection.multiplyScalar(recoil));
      if (isPlanetEntry && !current.reducedMotion) {
        const shake = Math.sin(capped * Math.PI) * (1 - t * 0.45) * 0.075;
        camera.position.x += Math.sin(raw * 74) * shake;
        camera.position.y += Math.cos(raw * 61) * shake * 0.55;
      }
      controls.target.copy(current.fromTarget).lerp(current.toTarget, t);
      controls.update();

      if (raw >= 1) {
        activeTransition.current = null;
        lastStableView.current = view;
        controls.enabled = true;
        controls.autoRotate = true;
        controls.autoRotateSpeed = view.mode === "galaxy" ? 0.18 : view.mode === "sector" ? 0.28 : 0.2;
        controls.target.copy(current.toTarget);
        controls.update();
      }
      return;
    }

    if (lastStableView.current.mode !== view.mode) lastStableView.current = view;
    controls.autoRotate = true;
    controls.autoRotateSpeed = view.mode === "galaxy" ? 0.18 : view.mode === "sector" ? 0.28 : 0.2;
    controls.update();
  });

  return null;
}

function CameraAnchoredStars({ count }) {
  const ref = useRef(null);

  useFrame(({ camera }) => {
    if (ref.current) ref.current.position.copy(camera.position);
  });

  return (
    <group ref={ref}>
      <Stars radius={82} depth={42} count={count} factor={5.6} saturation={0.62} fade speed={0.26} />
    </group>
  );
}

function GalaxyScene({ map, view, hoveredPlanetId, onSelectSector, onSelectPlanet, onHoverPlanet, onAssetsReady, transition, quality, reducedMotion }) {
  const controlsRef = useRef(null);
  const galaxyRef = useRef(null);
  const selectedPlanet = useMemo(() => (map.planets || []).find(planet => planet.id === view.planetId), [map.planets, view.planetId]);
  const selectedPlanetScenePosition = useMemo(() => selectedPlanet ? mapPointToWorld(selectedPlanet.position || selectedPlanet.mapPosition || [0, 0], map, BODY_Y_OFFSET) : null, [selectedPlanet, map]);
  const hyperspaceActive = transition.kind === "planet" && transition.active && (transition.phase === "hyperspace" || transition.phase === "arrival");
  const counts = PARTICLE_COUNTS[quality] || PARTICLE_COUNTS.balanced;

  useFrame(() => {
    if (!galaxyRef.current) return;
    galaxyRef.current.rotation.set(GALAXY_BASE_ROTATION_X, GALAXY_BASE_ROTATION_Y, GALAXY_BASE_ROTATION_Z);
  });

  return (
    <>
      <color attach="background" args={["#030105"]} />
      <KorribanTexturePreloader onReady={onAssetsReady} />
      <fogExp2 attach="fog" args={["#050107", view.mode === "planet" ? 0.0012 : 0.003]} />
      <ambientLight intensity={view.mode === "planet" ? 0.34 : 0.2} color="#4d1b20" />
      <directionalLight position={[4.8, 8.2, 5.4]} intensity={view.mode === "planet" ? 3.8 : 3.2} color="#ffd8a8" />
      <pointLight position={[0, 1.4, 0]} intensity={view.mode === "planet" ? 0 : 88} distance={19} color="#ffb168" />
      {selectedPlanetScenePosition ? (
        <pointLight position={selectedPlanetScenePosition.clone().add(new THREE.Vector3(3.4, 2.2, 2.6)).toArray()} intensity={68} distance={12} color={view.mode === "planet" ? "#ffe2bd" : normalizePlanet(map, selectedPlanet).colors.glow} />
      ) : null}

      <CameraAnchoredStars count={counts.sky} />
      <Sparkles count={view.mode === "planet" ? 0 : counts.sparkles} scale={[24, 5.4, 18]} size={1.55} speed={0.44} color="#ff9a3d" opacity={0.72} />
      <HyperspaceTunnel active={hyperspaceActive} quality={quality} reducedMotion={reducedMotion} />

      <group ref={galaxyRef} rotation={[GALAXY_BASE_ROTATION_X, GALAXY_BASE_ROTATION_Y, GALAXY_BASE_ROTATION_Z]}>
        <GalaxyControlMap map={map} view={view} onSelectSector={onSelectSector} quality={quality} />
        <SectorPlanetField
          map={map}
          view={view}
          hoveredPlanetId={hoveredPlanetId}
          onSelectPlanet={onSelectPlanet}
          onHoverPlanet={onHoverPlanet}
        />
      </group>

      <CameraRig map={map} view={view} transition={transition} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.07}
        enablePan={false}
        minDistance={view.mode === "planet" ? 1.2 : view.mode === "sector" ? 3.2 : 4.2}
        maxDistance={view.mode === "planet" ? 10.5 : view.mode === "sector" ? 18 : 34}
        autoRotate
        autoRotateSpeed={view.mode === "galaxy" ? 0.18 : view.mode === "sector" ? 0.28 : 0.2}
        target={WIDE_TARGET}
      />
      {view.mode === "planet" ? (
        <EffectComposer multisampling={0}>
          <Bloom intensity={quality === "high" ? 0.32 : 0.2} luminanceThreshold={0.42} luminanceSmoothing={0.22} />
          <DepthOfField focusDistance={0} focalLength={0.015} bokehScale={quality === "high" ? 0.24 : 0.14} height={480} />
          <Noise opacity={0.032} />
          <Vignette eskil={false} offset={0.2} darkness={0.58} />
        </EffectComposer>
      ) : null}
    </>
  );
}

function normalizeMap(map) {
  const factions = map?.factions?.length ? map.factions : DEFAULT_FACTIONS;
  const sectors = map?.sectors?.length ? map.sectors : [];
  const planets = map?.planets?.length
    ? map.planets
    : (map?.bodies || []).filter(body => body.selectable).map(body => ({
      id: body.id,
      name: body.name,
      shortName: body.shortName,
      sectorId: sectors[0]?.id || "default-sector",
      regionId: body.regionId || "outer-rim",
      factionId: body.factionId || factions[0]?.id,
      grid: body.grid,
      position: body.mapPosition || body.position || body.localPosition || [0, 0],
      radius: body.radius || 0.065,
      summary: body.summary,
      locations: body.locations,
      objectives: body.objectives,
      robloxLaunchUrl: body.robloxLaunchUrl,
      colors: body.colors
    }));

  const fallbackSector = sectors.length ? sectors : [{
    id: "default-sector",
    name: map?.focus?.name || "Esstran Sector",
    regionId: "outer-rim",
    grid: "R-5",
    factionId: factions[0]?.id,
    innerRadius: 4.86,
    outerRadius: 6.24,
    startAngleDeg: -60,
    endAngleDeg: -30
  }];

  return {
    ...map,
    factions,
    sectors: fallbackSector,
    planets,
    guide: map?.guide || { radius: 6.74, spokeStepDeg: 15, spokeOffsetDeg: 0 },
    title: map?.title || "Galaxy"
  };
}

function getSectorSummary(map, sectorId) {
  const sector = (map.sectors || []).find(item => item.id === sectorId);
  if (!sector) return null;
  const faction = factionById(map, sector.factionId);
  const planets = planetsForSector(map, sector.id);
  return { sector, faction, planets, control: controlForSector(map, sector.id) };
}

function getPlanetSummary(map, planetId) {
  const planet = (map.planets || []).find(item => item.id === planetId);
  if (!planet) return null;
  const faction = factionById(map, planet.factionId);
  const sector = (map.sectors || []).find(item => item.id === planet.sectorId);
  return { planet, faction, sector };
}

export function GalaxyMapExperience({ map }) {
  const normalizedMap = useMemo(() => normalizeMap(map || {}), [map]);
  const [canvasReady, setCanvasReady] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [view, setView] = useState({ mode: "galaxy", sectorId: null, planetId: null });
  const [hoveredPlanetId, setHoveredPlanetId] = useState(null);
  const [quality, setQuality] = useState("high");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [transition, setTransition] = useState({ kind: "galaxy", token: 0, active: false, phase: "idle" });
  const transitionTimersRef = useRef([]);
  const sectorSummary = getSectorSummary(normalizedMap, view.sectorId);
  const planetSummary = getPlanetSummary(normalizedMap, view.planetId);
  const panelFaction = planetSummary?.faction || sectorSummary?.faction || null;
  const ready = canvasReady && assetsReady;

  const clearTransitionTimers = useCallback(() => {
    transitionTimersRef.current.forEach(timer => window.clearTimeout(timer));
    transitionTimersRef.current = [];
  }, []);

  const queueTransitionTimer = useCallback((callback, delay) => {
    const timer = window.setTimeout(() => {
      transitionTimersRef.current = transitionTimersRef.current.filter(item => item !== timer);
      callback();
    }, delay);
    transitionTimersRef.current.push(timer);
  }, []);

  const markGalaxyAssetsReady = useCallback(() => {
    setAssetsReady(true);
  }, []);

  useEffect(() => {
    const isReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const isCompact = window.matchMedia?.("(max-width: 760px)")?.matches;
    const cores = window.navigator?.hardwareConcurrency || 8;
    setReducedMotion(!!isReducedMotion);
    setQuality(isReducedMotion || isCompact || cores <= 4 ? "reduced" : cores <= 6 ? "balanced" : "high");
  }, []);

  useEffect(() => () => clearTransitionTimers(), [clearTransitionTimers]);

  const beginTransition = useCallback(kind => {
    clearTransitionTimers();
    const duration = reducedMotion ? 620 : 980;
    setTransition(current => ({ kind, token: current.token + 1, active: true, phase: "settle", duration, reducedMotion }));
    queueTransitionTimer(() => {
      setTransition(current => ({ ...current, active: false, phase: "idle" }));
    }, duration);
  }, [clearTransitionTimers, queueTransitionTimer, reducedMotion]);

  const selectSector = useCallback(sectorId => {
    setHoveredPlanetId(null);
    setView({ mode: "sector", sectorId, planetId: null });
    beginTransition("sector");
  }, [beginTransition]);

  const selectPlanet = useCallback(planetId => {
    const planet = (normalizedMap.planets || []).find(item => item.id === planetId);
    if (!planet) return;
    clearTransitionTimers();
    setHoveredPlanetId(null);
    const wipeDuration = reducedMotion ? 450 : 900;
    const flightDuration = reducedMotion ? 900 : 1850;
    const arrivalPhaseDelay = reducedMotion ? 240 : 680;

    setTransition(current => ({
      kind: "planet",
      token: current.token,
      active: true,
      phase: "wipe",
      wipeDuration,
      flightDuration,
      reducedMotion
    }));

    queueTransitionTimer(() => {
      setView({ mode: "planet", sectorId: planet.sectorId, planetId });
      setTransition(current => ({
        ...current,
        kind: "planet",
        token: current.token + 1,
        active: true,
        phase: "hyperspace",
        duration: flightDuration,
        flightDuration,
        reducedMotion
      }));
    }, wipeDuration);

    queueTransitionTimer(() => {
      setTransition(current => current.kind === "planet" ? { ...current, phase: "arrival" } : current);
    }, wipeDuration + arrivalPhaseDelay);

    queueTransitionTimer(() => {
      setTransition(current => current.kind === "planet" ? { ...current, active: false, phase: "idle" } : current);
    }, wipeDuration + flightDuration);
  }, [normalizedMap.planets, clearTransitionTimers, queueTransitionTimer, reducedMotion]);

  const zoomOut = useCallback(() => {
    if (view.mode === "planet") {
      setView({ mode: "sector", sectorId: view.sectorId, planetId: null });
      beginTransition("sector");
      return;
    }
    setView({ mode: "galaxy", sectorId: null, planetId: null });
    setHoveredPlanetId(null);
    beginTransition("galaxy");
  }, [view.mode, view.sectorId, beginTransition]);

  const panelTitle = planetSummary?.planet?.shortName || planetSummary?.planet?.name || sectorSummary?.sector?.name || normalizedMap.title;
  const panelKicker = planetSummary
    ? `${planetSummary.sector?.name || "Sector"} • ${planetSummary.planet.grid || "R-5"}`
    : sectorSummary
      ? `${sectorSummary.sector.grid || "Sector"} • ${sectorSummary.sector.regionId || "Outer Rim"}`
      : "Strategic Control Map";
  const panelSummary = planetSummary?.planet?.summary
    || sectorSummary?.sector?.objectives?.[0]
  const wipeClass = transition.kind === "planet" && transition.active && transition.phase === "wipe"
    ? " is-wiping"
    : transition.kind === "planet" && transition.active && transition.phase === "hyperspace"
      ? " is-revealing"
      : "";
  const dpr = quality === "high" ? [1, 2] : quality === "balanced" ? [1, 1.5] : [1, 1.15];

  return (
    <section className={`gm-root${ready ? " gm-root--ready" : ""}${transition.active ? " is-transitioning" : ""}`} aria-label="Hidden Archives Galaxy Map">
      <div className="gm-stage" aria-hidden="true">
        <Canvas
          camera={{ position: WIDE_CAMERA.toArray(), fov: 45, near: 0.04, far: 180 }}
          dpr={dpr}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance", stencil: false }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor(new THREE.Color("#030105"), 1);
            gl.setClearAlpha(1);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.9;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            scene.background = new THREE.Color("#030105");
            setCanvasReady(true);
          }}
        >
          <GalaxyScene
            map={normalizedMap}
            view={view}
            hoveredPlanetId={hoveredPlanetId}
            onSelectSector={selectSector}
            onSelectPlanet={selectPlanet}
            onHoverPlanet={setHoveredPlanetId}
            onAssetsReady={markGalaxyAssetsReady}
            transition={transition}
            quality={quality}
            reducedMotion={reducedMotion}
          />
        </Canvas>
      </div>

      <div className={`gm-wipe${wipeClass}`} aria-hidden="true" style={{ "--wipe-duration": `${transition.wipeDuration || 900}ms` }} />
      <div className="gm-scan" aria-hidden="true" />
      <div className="gm-vignette" aria-hidden="true" />

      <header className="gm-topbar">
        <button className="gm-back" type="button" aria-label="Step back" onClick={zoomOut}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12h16" />
            <path d="m8 8-4 4 4 4" />
            <path d="m16 8 4 4-4 4" />
          </svg>
        </button>
        <div className="gm-lockup">
          <span>{view.mode === "galaxy" ? "Galactic Theatre" : view.mode === "sector" ? "Sector Entry" : "Hyperspace Approach"}</span>
          <strong>{view.mode === "planet" ? "Planetary Orbit" : normalizedMap.title}</strong>
        </div>
      </header>

      <aside className={`gm-panel is-${view.mode}`} aria-live="polite" style={{ "--panel-color": panelFaction?.glow || "#ff3b4f" }}>
        <div className="gm-panel-title">{view.mode === "galaxy" ? "Control Overview" : view.mode === "sector" ? "Sector Command" : "Orbital Focus"}</div>
        <div className="gm-kicker">{panelKicker}</div>
        <h1>{panelTitle}</h1>
        <div className="gm-kind">{panelFaction?.name || "Unknown Control"}</div>
        <p>{panelSummary}</p>

        {view.mode === "galaxy" ? (
          <div className="gm-selectors" aria-label="Galaxy sectors">
            {(normalizedMap.sectors || []).map(sector => {
              const faction = factionById(normalizedMap, sector.factionId);
              return (
                <button className="gm-selector" type="button" key={sector.id} onClick={() => selectSector(sector.id)}>
                  <span className="gm-selector-dot" style={{ "--body-color": faction.glow || faction.color }} />
                  <span>{sector.name}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {view.mode === "sector" && sectorSummary ? (
          <div className="gm-selectors" aria-label="Sector planets">
            {sectorSummary.planets.map(planet => {
              const faction = factionById(normalizedMap, planet.factionId);
              return (
                <button
                  className={`gm-selector${hoveredPlanetId === planet.id ? " is-hovered" : ""}`}
                  type="button"
                  key={planet.id}
                  onClick={() => selectPlanet(planet.id)}
                  onPointerEnter={() => setHoveredPlanetId(planet.id)}
                  onPointerLeave={() => setHoveredPlanetId(null)}
                >
                  <span className="gm-selector-dot" style={{ "--body-color": faction.glow || faction.color }} />
                  <span>{planet.shortName || planet.name}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {view.mode === "planet" && planetSummary?.planet?.robloxLaunchUrl ? (
          <a className="gm-launch" href={planetSummary.planet.robloxLaunchUrl}>Launch world</a>
        ) : null}
      </aside>

      {!ready ? (
        <div className="gm-loading">
          <span />
          <strong>CALIBRATING ARCHIVE MAP</strong>
        </div>
      ) : null}

      <style>{STYLES}</style>
    </section>
  );
}

const STYLES = `
  html:has(.gm-root),
  body:has(.gm-root) {
    background: #050204;
    overflow: hidden;
  }

  .gm-root {
    --gm-panel: color-mix(in srgb, var(--theme-panel, rgba(22, 7, 12, .88)) 76%, transparent);
    --gm-display-font: Orbitron, Rajdhani, "Eurostile Extended", "Bank Gothic", "Trebuchet MS", system-ui, sans-serif;
    --gm-serif-font: Cinzel, "Trajan Pro", Georgia, serif;
    background:
      radial-gradient(ellipse 56% 46% at 50% 46%, rgba(160, 0, 22, .08), transparent 66%),
      linear-gradient(180deg, #050204 0%, #050204 58%, #000000 100%);
    color: var(--text, #fff7f7);
    font-family: var(--gm-display-font);
    height: 100dvh;
    inset: 0;
    isolation: isolate;
    overflow: hidden;
    position: fixed;
    width: 100vw;
    z-index: 0;
  }

  .gm-root *,
  .gm-root *::before,
  .gm-root *::after {
    box-sizing: border-box;
  }

  .gm-stage,
  .gm-stage canvas,
  .gm-scan,
  .gm-vignette,
  .gm-wipe {
    inset: 0;
    position: absolute;
  }

  .gm-stage {
    z-index: 1;
  }

  .gm-stage canvas {
    background: #030105;
    cursor: grab;
    display: block;
    height: 100% !important;
    outline: none;
    width: 100% !important;
  }

  .gm-stage canvas:active {
    cursor: grabbing;
  }

  .gm-scan {
    background:
      repeating-linear-gradient(0deg, transparent 0, transparent 2px, var(--scanline, rgba(255, 210, 210, .018)) 2px, var(--scanline, rgba(255, 210, 210, .018)) 4px),
      linear-gradient(90deg, var(--theme-wash, rgba(192, 0, 26, .025)), transparent 18%, transparent 82%, var(--theme-wash, rgba(192, 0, 26, .025)));
    mix-blend-mode: screen;
    opacity: .58;
    pointer-events: none;
    z-index: 3;
  }

  .gm-vignette {
    background:
      radial-gradient(circle at 52% 48%, transparent 0%, transparent 54%, rgba(0, 0, 0, .76) 100%),
      linear-gradient(90deg, rgba(0, 0, 0, .72), transparent 24%, transparent 76%, rgba(0, 0, 0, .78));
    pointer-events: none;
    z-index: 4;
  }

  .gm-wipe {
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 10;
  }

  .gm-wipe::before {
    background: #000;
    bottom: -76vmax;
    content: "";
    height: 220vmax;
    position: absolute;
    right: -76vmax;
    transform: translate(72%, 72%) rotate(45deg);
    transform-origin: center;
    width: 220vmax;
  }

  .gm-wipe.is-wiping {
    opacity: 1;
  }

  .gm-wipe.is-wiping::before {
    animation: gm-wipe-in var(--wipe-duration, 900ms) cubic-bezier(.77,0,.18,1) both;
  }

  .gm-wipe.is-revealing {
    animation: gm-wipe-reveal .44s ease both;
    opacity: 1;
  }

  .gm-wipe.is-revealing::before {
    transform: translate(0, 0) rotate(45deg);
  }

  .gm-topbar {
    align-items: center;
    display: flex;
    gap: 12px;
    left: clamp(14px, 2.2vw, 28px);
    max-width: calc(100vw - 44px);
    position: absolute;
    top: clamp(14px, 2.2vw, 28px);
    z-index: 8;
  }

  .gm-back,
  .gm-sector-label,
  .gm-planet-label,
  .gm-selector,
  .gm-launch {
    font-family: var(--gm-display-font);
  }

  .gm-back {
    align-items: center;
    appearance: none;
    background:
      linear-gradient(90deg, var(--theme-wash, rgba(192, 0, 26, .03)), transparent 62%),
      var(--gm-panel);
    border: 1px solid var(--theme-accent-dim, #7a1a28);
    box-shadow: 0 0 28px var(--theme-accent-glow, rgba(255, 59, 79, .26)), inset 0 0 24px rgba(255, 255, 255, .025);
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
    color: var(--theme-accent, #ff3b4f);
    cursor: crosshair;
    display: inline-flex;
    height: 42px;
    justify-content: center;
    padding: 0;
    transition: border-color .18s ease, box-shadow .18s ease, color .18s ease, transform .18s ease;
    width: 42px;
  }

  .gm-back svg {
    fill: none;
    height: 22px;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.8;
    width: 22px;
  }

  .gm-back:hover,
  .gm-back:focus-visible {
    border-color: var(--theme-accent, #ff3b4f);
    box-shadow: 0 0 34px var(--theme-accent-glow, rgba(255, 59, 79, .32)), inset 0 0 28px rgba(255, 255, 255, .04);
    color: var(--theme-accent-soft, #ff6878);
    outline: none;
    transform: translateY(-1px);
  }

  .gm-lockup,
  .gm-panel,
  .gm-loading {
    background:
      linear-gradient(135deg, var(--theme-wash, rgba(192, 0, 26, .035)), transparent 62%),
      var(--gm-panel);
    border: 1px solid var(--theme-accent-dim, #7a1a28);
    box-shadow: 0 0 30px var(--theme-accent-glow, rgba(255, 59, 79, .18)), inset 0 0 34px rgba(255, 255, 255, .02);
    clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
  }

  .gm-lockup {
    display: grid;
    gap: 3px;
    min-width: min(310px, calc(100vw - 74px));
    padding: 10px 14px;
  }

  .gm-lockup span,
  .gm-kicker,
  .gm-kind {
    color: var(--text-dim, #f2d8d8);
    font-size: .66rem;
    letter-spacing: .18em;
    text-transform: uppercase;
  }

  .gm-lockup strong,
  .gm-panel-title {
    color: var(--theme-accent, #ff3b4f);
    font-size: .78rem;
    font-weight: 800;
    letter-spacing: .2em;
    text-transform: uppercase;
    text-shadow: 0 0 12px var(--theme-accent-glow, rgba(255, 59, 79, .32));
  }

  .gm-panel {
    --panel-color: var(--theme-accent, #ff3b4f);
    bottom: clamp(18px, 3vw, 32px);
    max-width: 360px;
    padding: 15px;
    position: absolute;
    right: clamp(18px, 3vw, 32px);
    width: calc(100vw - 36px);
    z-index: 8;
  }

  .gm-panel.is-planet {
    bottom: auto;
    left: clamp(56px, 10vw, 168px);
    max-width: 480px;
    padding: 22px;
    right: auto;
    top: 50%;
    transform: translateY(-50%);
    width: min(480px, calc(100vw - 36px));
  }

  .gm-panel-title {
    border-bottom: 1px solid color-mix(in srgb, var(--panel-color) 52%, transparent);
    margin-bottom: 11px;
    padding-bottom: 9px;
  }

  .gm-kicker,
  .gm-kind {
    line-height: 1.45;
  }

  .gm-panel h1 {
    color: #fff6e8;
    font-family: var(--gm-serif-font);
    font-size: 1.48rem;
    letter-spacing: .08em;
    line-height: 1.1;
    margin: 7px 0 6px;
    text-transform: uppercase;
    text-shadow: 0 0 22px color-mix(in srgb, var(--panel-color) 58%, transparent), 0 1px 0 #000;
  }

  .gm-panel p {
    color: var(--text-dim, #f2d8d8);
    font-size: .82rem;
    line-height: 1.5;
    margin: 12px 0 0;
  }

  .gm-panel.is-planet h1 {
    font-size: clamp(1.62rem, 2.4vw, 2.12rem);
    margin: 10px 0 8px;
  }

  .gm-panel.is-planet p {
    font-size: .92rem;
    line-height: 1.58;
  }

  .gm-selectors {
    display: grid;
    gap: 7px;
    margin-top: 14px;
  }

  .gm-selector,
  .gm-launch {
    align-items: center;
    appearance: none;
    background: color-mix(in srgb, var(--theme-bg, #050204) 62%, transparent);
    border: 1px solid var(--theme-accent-dim, #7a1a28);
    color: var(--text-dim, #f2d8d8);
    cursor: crosshair;
    display: flex;
    font-size: .76rem;
    font-weight: 800;
    gap: 10px;
    letter-spacing: .12em;
    min-height: 36px;
    padding: 8px 10px;
    text-align: left;
    text-decoration: none;
    text-transform: uppercase;
    transition: background .18s ease, border-color .18s ease, box-shadow .18s ease, color .18s ease;
    width: 100%;
  }

  .gm-selector-dot {
    background: var(--body-color);
    border-radius: 999px;
    box-shadow: 0 0 16px var(--body-color);
    flex: 0 0 auto;
    height: 9px;
    width: 9px;
  }

  .gm-selector:hover,
  .gm-selector:focus-visible,
  .gm-selector.is-hovered,
  .gm-launch:hover,
  .gm-launch:focus-visible {
    border-color: var(--theme-accent, #ff3b4f);
    box-shadow: 0 0 22px var(--theme-accent-glow, rgba(255, 59, 79, .22));
    color: var(--text, #fff);
    outline: none;
  }

  .gm-launch {
    justify-content: center;
    margin-top: 14px;
  }

  .gm-sector-label,
  .gm-planet-label {
    appearance: none;
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--sector-color, var(--planet-color, #ff3b4f)) 18%, transparent), rgba(0,0,0,.16)),
      rgba(8, 1, 4, .72);
    border: 1px solid color-mix(in srgb, var(--sector-color, var(--planet-color, #ff3b4f)) 72%, transparent);
    box-shadow: 0 0 18px color-mix(in srgb, var(--sector-color, var(--planet-color, #ff3b4f)) 42%, transparent), inset 0 0 18px rgba(255,255,255,.04);
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
    color: #fff3e6;
    cursor: crosshair;
    display: grid;
    gap: 2px;
    letter-spacing: .14em;
    min-width: 132px;
    padding: 7px 10px;
    pointer-events: auto;
    text-align: left;
    text-shadow: 0 0 10px color-mix(in srgb, var(--sector-color, var(--planet-color, #ff3b4f)) 65%, transparent);
    text-transform: uppercase;
    transform: translateZ(0);
  }

  .gm-sector-label span,
  .gm-sector-label em,
  .gm-planet-label span {
    color: color-mix(in srgb, var(--sector-color, var(--planet-color, #ff3b4f)) 80%, white);
    font-size: .52rem;
    font-style: normal;
    font-weight: 900;
    letter-spacing: .2em;
  }

  .gm-sector-label strong,
  .gm-planet-label strong {
    font-size: .68rem;
    font-weight: 900;
    letter-spacing: .16em;
    white-space: nowrap;
  }

  .gm-sector-label.is-active,
  .gm-planet-label.is-active {
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--sector-color, var(--planet-color, #ff3b4f)) 28%, transparent), rgba(0,0,0,.24)),
      rgba(16, 2, 6, .86);
  }

  .gm-sector-label.is-dimmed {
    opacity: .24;
  }

  .gm-loading {
    align-items: center;
    color: var(--text, #fff);
    display: flex;
    gap: 12px;
    left: 50%;
    padding: 14px 17px;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 12;
  }

  .gm-loading span {
    animation: gm-spin 1.1s linear infinite;
    border: 2px solid var(--theme-accent-dim, #7a1a28);
    border-top-color: var(--theme-accent, #ff3b4f);
    border-radius: 999px;
    height: 18px;
    width: 18px;
  }

  .gm-loading strong {
    font-size: .76rem;
    letter-spacing: .18em;
    text-transform: uppercase;
  }

  @keyframes gm-spin {
    to { transform: rotate(360deg); }
  }

  @keyframes gm-wipe-in {
    0% { transform: translate(72%, 72%) rotate(45deg); }
    100% { transform: translate(0, 0) rotate(45deg); }
  }

  @keyframes gm-wipe-reveal {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }

  @media (max-width: 760px) {
    .gm-topbar {
      left: 14px;
      right: 14px;
      top: 14px;
    }

    .gm-lockup {
      flex: 1;
      min-width: 0;
      width: 100%;
    }

    .gm-panel {
      bottom: 14px;
      left: 14px;
      max-width: none;
      padding: 14px;
      right: 14px;
      width: auto;
    }

    .gm-panel.is-planet {
      bottom: 14px;
      left: 14px;
      max-width: none;
      padding: 14px;
      right: 14px;
      top: auto;
      transform: none;
      width: auto;
    }

    .gm-panel h1 {
      font-size: 1.14rem;
      margin: 6px 0;
    }

    .gm-panel p {
      font-size: .78rem;
      line-height: 1.42;
      margin-top: 9px;
    }

    .gm-selectors {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 11px;
    }

    .gm-selector {
      font-size: .68rem;
      min-height: 34px;
      padding: 8px;
    }
  }

  @media (max-width: 420px) {
    .gm-lockup span,
    .gm-kicker,
    .gm-kind {
      font-size: .58rem;
    }

    .gm-lockup strong,
    .gm-panel-title {
      font-size: .68rem;
    }

    .gm-panel h1 {
      font-size: 1.02rem;
    }

    .gm-selectors {
      grid-template-columns: 1fr;
    }
  }
`;
