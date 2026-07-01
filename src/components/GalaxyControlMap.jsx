"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const TAU = Math.PI * 2;
const GALAXY_RADIUS = 5.7;
const GALAXY_FLATTEN = 1;
const SPIRAL_ARM_COUNT = 5;
// Real disk galaxies trace logarithmic spirals with a pitch angle of roughly 10-25deg
// (tight near the core, opening up toward the rim). This replaces the old linear
// "angle = radius * sweep" model, which wound at a constant rate everywhere and
// didn't match how actual spiral arms behave.
const SPIRAL_PITCH_DEG = 21.5;
const SPIRAL_B = Math.tan(THREE.MathUtils.degToRad(SPIRAL_PITCH_DEG));
const SPIRAL_ARM_PROFILES = [
  { radiusStart: 1.04, radiusEnd: 5.62, angleOffset: -0.08, pitchScale: 0.86, widthScale: 1.28, tailCurl: 0.16, lift: 0.012 },
  { radiusStart: 1.22, radiusEnd: 5.18, angleOffset: 0.18, pitchScale: 1.12, widthScale: 0.92, tailCurl: 0.34, lift: -0.01 },
  { radiusStart: 1.1, radiusEnd: 5.74, angleOffset: -0.24, pitchScale: 0.96, widthScale: 1.12, tailCurl: 0.24, lift: 0.022 },
  { radiusStart: 1.32, radiusEnd: 5.06, angleOffset: 0.06, pitchScale: 0.78, widthScale: 0.82, tailCurl: 0.42, lift: -0.018 },
  { radiusStart: 1.0, radiusEnd: 5.42, angleOffset: 0.31, pitchScale: 1.24, widthScale: 1.36, tailCurl: 0.2, lift: 0.006 }
];
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
  high: { stars: 10000, dust: 24000, sky: 9600, sparkles: 460, streaks: 2200 },
  balanced: { stars: 10000, dust: 18000, sky: 5200, sparkles: 220, streaks: 1350 },
  reduced: { stars: 10000, dust: 12000, sky: 3000, sparkles: 130, streaks: 720 }
};
const GALAXY_RANDOMNESS = 0.3;
const GALAXY_RANDOMNESS_POWER_XZ = 2.468;
const GALAXY_RANDOMNESS_POWER_Y = 5.2;
const GALAXY_VERTICAL_RANDOMNESS = 0.026;
const GALAXY_INITIAL_SPIN_TIME = 42;
const GALAXY_SPIN_STRENGTH = 0.05;
const GALAXY_FLOW_ROTATION_SPEED = -0.012;
const GALAXY_INSIDE_COLOR = "#f9fdff";
const GALAXY_OUTSIDE_COLOR = "#83c9ff";
const GALAXY_RIM_GLOW_COLOR = "#e8fbff";
const DEFAULT_POLAR_TESSELLATION = {
  angles: [-180, -150, -116, -84, -52, -24, 8, 38, 68, 100, 132, 164, 196, 228, 260, 294, 330, 360],
  rings: [0.16, 0.72, 1.42, 2.05, 2.85, 3.72, 4.86, 5.58, 6.24, 6.74]
};
const CORE_CUTOUT_RING_INDEX = 1;
const SECTOR_TESSELLATION_CELLS = {
  "tython-deep-core": [[1, 3, 0, 1]],
  coruscant: [[3, 5, 0, 2]],
  corellian: [[5, 7, 1, 2]],
  kuat: [[7, 9, 1, 2]],
  alderaan: [[9, 11, 1, 2]],
  alsakan: [[11, 13, 0, 2]],
  brentaal: [[0, 2, 2, 3]],
  duro: [[2, 4, 2, 3]],
  tapani: [[4, 5, 2, 4], [5, 6, 2, 3]],
  hapes: [[6, 8, 3, 4]],
  manaan: [[8, 10, 3, 4]],
  onderon: [[10, 12, 3, 4], [11, 12, 4, 5]],
  balmorra: [[0, 2, 4, 5]],
  taris: [[2, 3, 4, 6]],
  "bothan-space": [[3, 5, 5, 6]],
  mandalore: [[5, 6, 5, 7]],
  "tion-cluster": [[6, 8, 4, 6]],
  kanz: [[8, 9, 4, 6]],
  voss: [[9, 11, 5, 7]],
  belsavis: [[11, 13, 5, 7]],
  esstran: [[4, 5, 6, 8]],
  dromund: [[5, 6, 6, 8]],
  "hutt-space": [[6, 7, 6, 9]],
  arkanis: [[7, 8, 6, 8]],
  anoat: [[8, 9, 6, 8]],
  "gordian-reach": [[9, 10, 6, 8]],
  "corporate-sector": [[10, 11, 6, 9]],
  "tingel-arm": [[11, 12, 7, 9]],
  "minos-cluster": [[12, 13, 7, 8]],
  kathol: [[13, 14, 7, 9]],
  "rishi-maze": [[14, 15, 7, 9]],
  "ilum-frontier": [[15, 17, 6, 8]]
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

const PLANET_TEXTURE_CACHE = new Map();

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

function galaxyRotationAt(elapsedTime = 0) {
  return new THREE.Euler(
    GALAXY_BASE_ROTATION_X,
    GALAXY_BASE_ROTATION_Y + elapsedTime * GALAXY_FLOW_ROTATION_SPEED,
    GALAXY_BASE_ROTATION_Z
  );
}

function mapLocalToWorld(point, elapsedTime = 0) {
  return point.clone().applyEuler(galaxyRotationAt(elapsedTime));
}

function mapPointToWorld(position, map, y = BODY_Y_OFFSET, elapsedTime = 0) {
  return mapLocalToWorld(mapPointToScene(position, map, y), elapsedTime);
}

function sectorMidAngle(sector) {
  return ((sector.startAngleDeg || 0) + (sector.endAngleDeg || 0)) / 2;
}

function sectorMidRadius(sector) {
  return ((sector.innerRadius || CORE_RADIUS) + (sector.outerRadius || getGuideRadius())) / 2;
}

function sectorSceneCenter(sector, map) {
  const cells = drawableSectorCells(sector, map);
  if (cells.length) {
    const center = new THREE.Vector3();
    let totalWeight = 0;
    cells.forEach(cell => {
      const angleSpan = Math.abs(cell.endAngleDeg - cell.startAngleDeg);
      const weight = Math.max(0.01, angleSpan * (cell.outerRadius * cell.outerRadius - cell.innerRadius * cell.innerRadius));
      center.add(polarToScene((cell.startAngleDeg + cell.endAngleDeg) / 2, (cell.innerRadius + cell.outerRadius) / 2, map).multiplyScalar(weight));
      totalWeight += weight;
    });
    return center.divideScalar(totalWeight || 1);
  }
  return polarToScene(sectorMidAngle(sector), sectorMidRadius(sector), map);
}

function getPolarTessellation(map) {
  return map?.guide?.tessellation || DEFAULT_POLAR_TESSELLATION;
}

function sectorTessellationCells(sector, map) {
  const tessellation = getPolarTessellation(map);
  const cells = sector.cells || SECTOR_TESSELLATION_CELLS[sector.id] || [];

  if (!cells.length) {
    return [{
      startAngleDeg: sector.startAngleDeg || 0,
      endAngleDeg: sector.endAngleDeg || (sector.startAngleDeg || 0) + 22,
      innerRadius: sector.innerRadius || 0.82,
      outerRadius: sector.outerRadius || getGuideRadius(map)
    }];
  }

  return cells.map(cell => {
    const [angleStartIndex, angleEndIndex, ringStartIndex, ringEndIndex] = Array.isArray(cell)
      ? cell
      : [cell.angle?.[0], cell.angle?.[1], cell.ring?.[0], cell.ring?.[1]];

    return {
      angleStartIndex,
      angleEndIndex,
      ringStartIndex,
      ringEndIndex,
      startAngleDeg: tessellation.angles[angleStartIndex],
      endAngleDeg: tessellation.angles[angleEndIndex],
      innerRadius: tessellation.rings[ringStartIndex],
      outerRadius: tessellation.rings[ringEndIndex]
    };
  }).filter(cell => (
    Number.isFinite(cell.startAngleDeg)
    && Number.isFinite(cell.endAngleDeg)
    && Number.isFinite(cell.innerRadius)
    && Number.isFinite(cell.outerRadius)
  ));
}

function drawableSectorCells(sector, map) {
  const tessellation = getPolarTessellation(map);
  const cutoutRadius = tessellation.rings[CORE_CUTOUT_RING_INDEX] || tessellation.rings[0] || 0;

  return sectorTessellationCells(sector, map).map(cell => {
    if (Number.isFinite(cell.ringStartIndex)) {
      if (cell.ringEndIndex <= CORE_CUTOUT_RING_INDEX) return null;
      if (cell.ringStartIndex < CORE_CUTOUT_RING_INDEX) {
        return {
          ...cell,
          ringStartIndex: CORE_CUTOUT_RING_INDEX,
          innerRadius: cutoutRadius
        };
      }
    }

    if (cell.outerRadius <= cutoutRadius) return null;
    if (cell.innerRadius < cutoutRadius) return { ...cell, innerRadius: cutoutRadius };
    return cell;
  }).filter(Boolean);
} 

function visibleSectors(map) {
  return (map?.sectors || []).filter(sector => drawableSectorCells(sector, map).length > 0);
}

function makeLineGeometry(points) {
  return new THREE.BufferGeometry().setFromPoints(points);
}

function LineGeometry({ points }) {
  const geometry = useMemo(() => makeLineGeometry(points), [points]);
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

function spiralArmProfile(arm) {
  return SPIRAL_ARM_PROFILES[arm % SPIRAL_ARM_PROFILES.length] || SPIRAL_ARM_PROFILES[0];
}

function spiralAngle(radius, arm, armCount = SPIRAL_ARM_COUNT) {
  const profile = spiralArmProfile(arm);
  const base = (arm / armCount) * TAU;
  const r = Math.max(radius, CORE_RADIUS);
  // theta = theta0 + ln(r / r0) / tan(pitch) - a true logarithmic spiral.
  // Near the core the angle changes fast (tight winding); further out it changes
  // slowly (loose, open winding) - exactly how real spiral arms are shaped.
  return base + profile.angleOffset + Math.log(r / CORE_RADIUS) / (SPIRAL_B * profile.pitchScale);
}

function makeSpiralGalaxyGeometry(count, seed, mode = "stars") {
  const rnd = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const scales = new Float32Array(count);
  const randomness = new Float32Array(count * 3);
  const colorInside = new THREE.Color(GALAXY_INSIDE_COLOR);
  const colorOutside = new THREE.Color(GALAXY_OUTSIDE_COLOR);
  const colorRim = new THREE.Color(GALAXY_RIM_GLOW_COLOR);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const coreChance = mode === "stars" ? 0.01 : mode === "dust" ? 0.018 : 0.11;
    const isCore = mode === "core" || rnd() < coreChance;
    const isInterArm = !isCore && rnd() < (mode === "dust" ? 0.82 : 0.72);
    const arm = i % SPIRAL_ARM_COUNT;
    const profile = spiralArmProfile(arm);
    const armStart = Math.max(profile.radiusStart, mode === "dust" ? CORE_RADIUS * 1.16 : CORE_RADIUS * 1.24);
    const radius = isCore
      ? Math.pow(rnd(), 1.9) * CORE_RADIUS
      : Math.min(
        GALAXY_RADIUS,
        Math.pow(rnd(), isInterArm ? 0.72 : mode === "dust" ? 0.62 : 0.58) * (GALAXY_RADIUS - armStart) + armStart
      );
    const armProgress = clamp((radius - profile.radiusStart) / Math.max(0.01, profile.radiusEnd - profile.radiusStart), 0, 1);
    const rimTaper = 1 - smoothstep(0.72, 1, armProgress) * profile.tailCurl;
    const armAngle = spiralAngle(radius, arm) - Math.pow(armProgress, 2.2) * profile.tailCurl * 0.62;
    // Arms stay narrow near the core and relax into wider bands further out -
    // real arms have roughly constant angular width in radians, not linear width,
    // so the physical band gets wider (in distance) as radius grows.
    const armWidth = (mode === "dust" ? 0.14 + radius * 0.02 : 0.07 + radius * 0.01) * profile.widthScale * rimTaper;
    const interArmSign = rnd() > 0.5 ? 1 : -1;
    const interArmGap = TAU / SPIRAL_ARM_COUNT;
    const interArmOffset = interArmSign * randRange(
      rnd,
      armWidth * (mode === "dust" ? 1.45 : 1.7),
      interArmGap * (mode === "dust" ? 0.58 : 0.54)
    );
    const jitter = isCore
      ? randRange(rnd, -TAU, TAU)
      : isInterArm
        ? interArmOffset
        : randRange(rnd, -armWidth, armWidth);
    const angle = isCore ? rnd() * TAU : armAngle + jitter;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * GALAXY_VISUAL_FLATTEN;
    const y = randRange(rnd, -0.018, 0.018) * (1 + radius * 0.025);
    const rimFade = Math.min(1, radius / GALAXY_RADIUS);
    const randomSign = () => (rnd() < 0.5 ? -1 : 1);
    const fieldSpread = isInterArm
      ? (mode === "dust" ? 1.34 : 1.12)
      : (mode === "dust" ? 0.58 : 0.34);
    const randomX = Math.pow(rnd(), GALAXY_RANDOMNESS_POWER_XZ) * randomSign() * GALAXY_RANDOMNESS * radius * fieldSpread;
    const randomY = Math.pow(rnd(), GALAXY_RANDOMNESS_POWER_Y) * randomSign() * GALAXY_VERTICAL_RANDOMNESS * radius;
    const randomZ = Math.pow(rnd(), GALAXY_RANDOMNESS_POWER_XZ) * randomSign() * GALAXY_RANDOMNESS * radius * fieldSpread;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    randomness[i * 3] = randomX;
    randomness[i * 3 + 1] = randomY;
    randomness[i * 3 + 2] = randomZ;

    color.copy(colorInside).lerp(colorOutside, rimFade);
    if (isInterArm) color.lerp(new THREE.Color("#d8efff"), mode === "dust" ? 0.36 : 0.44);
    if (rimFade > 0.76) color.lerp(colorRim, smoothstep(0.76, 1, rimFade) * (mode === "dust" ? 0.62 : 0.78));
    if (isCore) color.lerp(new THREE.Color("#ffffff"), 0.58);
    if (!isCore && !isInterArm && rnd() > 0.88) color.lerp(new THREE.Color("#f7fcff"), 0.28);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i] = mode === "dust"
      ? randRange(rnd, 0.052, 0.17) * (1.04 + rimFade * 0.22) * (isInterArm ? 0.94 : 1.08)
      : randRange(rnd, 0.024, 0.088) * (isCore ? 0.94 : isInterArm ? 1 : 1.16) * (1 + smoothstep(0.78, 1, rimFade) * 0.34);
    scales[i] = randRange(rnd, 0.58, 1.36) * (rimFade > 0.78 ? 1.18 : 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute("aRandomness", new THREE.BufferAttribute(randomness, 3));
  return geometry;
}

const NEBULA_PALETTE = ["#f8fdff", "#dff4ff", "#a8dcff", "#76c5ff", "#cbeeff"];

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
          uSpinTime: { value: -GALAXY_INITIAL_SPIN_TIME },
          uSpinStrength: { value: GALAXY_SPIN_STRENGTH },
          uOpacity: { value: opacity },
          uScale: { value: sizeScale }
        }}
        vertexShader={`
          attribute float aSize;
          attribute float aScale;
          attribute vec3 aRandomness;
          uniform float uTime;
          uniform float uSpinTime;
          uniform float uSpinStrength;
          uniform float uScale;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec3 pos = position;
            float distanceToCenter = max(length(pos.xz), 0.08);
            float angle = atan(pos.x, pos.z);
            float angleOffset = (1.0 / distanceToCenter) * uSpinTime * uSpinStrength;
            angle += angleOffset;
            pos.x = cos(angle) * distanceToCenter;
            pos.z = sin(angle) * distanceToCenter;
            pos += aRandomness;
            float breath = sin(uTime * 0.24 + position.x * 1.8 + position.z * 1.3) * 0.006;
            pos.y += breath;
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = aSize * aScale * uScale * (460.0 / max(6.0, -mvPosition.z));
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
            float core = 1.0 - smoothstep(0.0, 0.16, d);
            float glow = 1.0 - smoothstep(0.08, 1.0, d);
            float halo = pow(max(glow, 0.0), 0.72);
            float twinkle = 0.88 + 0.32 * sin(uTime * 1.8 + vColor.r * 17.0);
            gl_FragColor = vec4(vColor * mix(1.32, 1.72, glow), (core * 1.22 + glow * 1.02 + halo * 0.36) * uOpacity * twinkle);
          }
        `}
      />
    </points>
  );
}

function SectorGrid() {
  return null;
}

function GalacticCore({ opacity = 1 }) {
  const glow = useMemo(() => makeGlowTexture("rgba(255,255,255,1)", "rgba(130,210,255,.62)"), []);
  useEffect(() => () => glow.dispose(), [glow]);

  return (
    <group>
      <sprite position={[0, 0.08, 0]} scale={[4.4, 4.4, 1]}>
        <spriteMaterial map={glow} color="#e8f9ff" transparent opacity={0.38 * opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.34, 48, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.94 * opacity} blending={THREE.AdditiveBlending} />
      </mesh>
      <Sparkles count={90} scale={[2.4, 0.55, 2.4]} size={3.8} speed={0.35} color="#d8f5ff" opacity={0.92 * opacity} />
    </group>
  );
}

function makeSectorCellPoints(cell, map) {
  const start = cell.startAngleDeg;
  const end = cell.endAngleDeg;
  const inner = cell.innerRadius;
  const outer = cell.outerRadius;
  const steps = Math.max(18, Math.ceil(Math.abs(end - start) / 1.6));
  const vectors = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = start + (end - start) * t;
    vectors.push(polarToScene(angle, outer, map));
  }

  for (let i = steps; i >= 0; i -= 1) {
    const t = i / steps;
    const angle = start + (end - start) * t;
    vectors.push(polarToScene(angle, inner, map));
  }

  return vectors;
}

function makeSectorCellGeometry(cell, map) {
  const vectors = makeSectorCellPoints(cell, map);
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
  return geometry;
}

function mergeSectorGeometries(geometries) {
  const positions = [];
  const indices = [];
  let vertexOffset = 0;

  geometries.forEach(geometry => {
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();

    for (let i = 0; i < position.count; i += 1) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
    }

    if (index) {
      for (let i = 0; i < index.count; i += 1) {
        indices.push(index.getX(i) + vertexOffset);
      }
    } else {
      for (let i = 0; i < position.count; i += 1) {
        indices.push(i + vertexOffset);
      }
    }

    vertexOffset += position.count;
    geometry.dispose();
  });

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}

function makeSectorGeometry(sector, map) {
  return mergeSectorGeometries(
    drawableSectorCells(sector, map).map(cell => makeSectorCellGeometry(cell, map))
  );
}

function makeSectorArcPoints(radius, startAngleDeg, endAngleDeg, map, y = -0.026) {
  const steps = Math.max(10, Math.ceil(Math.abs(endAngleDeg - startAngleDeg) / 1.6));
  const points = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const point = polarToScene(startAngleDeg + (endAngleDeg - startAngleDeg) * t, radius, map);
    points.push(new THREE.Vector3(point.x, y, point.z));
  }

  return points;
}

function makeSectorRadialPoints(angleDeg, innerRadius, outerRadius, map, y = -0.026) {
  const inner = polarToScene(angleDeg, innerRadius, map);
  const outer = polarToScene(angleDeg, outerRadius, map);
  return [
    new THREE.Vector3(inner.x, y, inner.z),
    new THREE.Vector3(outer.x, y, outer.z)
  ];
}

function makeSectorBoundarySegments(sector, map) {
  const ringEdges = new Map();
  const spokeEdges = new Map();
  const formatKey = value => Number(value).toFixed(4);

  const addInterval = (groups, key, from, to, meta) => {
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    if (Math.abs(end - start) < 0.0001) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ start, end, ...meta });
  };

  const flushIntervals = (groups, makePoints) => {
    const segments = [];

    groups.forEach(intervals => {
      const stops = [...new Set(intervals.flatMap(interval => [interval.start, interval.end]).map(formatKey))]
        .map(Number)
        .sort((left, right) => left - right);

      let openStart = null;
      let openEnd = null;

      for (let index = 0; index < stops.length - 1; index += 1) {
        const start = stops[index];
        const end = stops[index + 1];
        const midpoint = (start + end) * 0.5;
        const coverage = intervals.filter(interval => midpoint > interval.start + 0.0001 && midpoint < interval.end - 0.0001).length;

        if (coverage === 1) {
          if (openStart === null) openStart = start;
          openEnd = end;
        } else if (openStart !== null) {
          segments.push(makePoints(intervals[0], openStart, openEnd));
          openStart = null;
          openEnd = null;
        }
      }

      if (openStart !== null) segments.push(makePoints(intervals[0], openStart, openEnd));
    });

    return segments;
  };

  drawableSectorCells(sector, map).forEach(cell => {
    addInterval(ringEdges, `ring:${formatKey(cell.outerRadius)}`, cell.startAngleDeg, cell.endAngleDeg, { radius: cell.outerRadius });
    addInterval(ringEdges, `ring:${formatKey(cell.innerRadius)}`, cell.startAngleDeg, cell.endAngleDeg, { radius: cell.innerRadius });
    addInterval(spokeEdges, `spoke:${formatKey(cell.startAngleDeg)}`, cell.innerRadius, cell.outerRadius, { angle: cell.startAngleDeg });
    addInterval(spokeEdges, `spoke:${formatKey(cell.endAngleDeg)}`, cell.innerRadius, cell.outerRadius, { angle: cell.endAngleDeg });
  });

  return [
    ...flushIntervals(ringEdges, (edge, start, end) => makeSectorArcPoints(edge.radius, start, end, map)),
    ...flushIntervals(spokeEdges, (edge, start, end) => makeSectorRadialPoints(edge.angle, start, end, map))
  ];
}

function SectorControlZone({ map, sector, active, dimmed, hovered, onSelect, onHover }) {
  const faction = factionById(map, sector.factionId);
  const geometry = useMemo(() => makeSectorGeometry(sector, map), [sector, map]);
  const boundarySegments = useMemo(() => makeSectorBoundarySegments(sector, map), [sector, map]);
  const fillOpacity = active ? 0.52 : dimmed ? 0.08 : hovered ? 0.42 : 0.34;
  const lineOpacity = active ? 0.95 : dimmed ? 0.18 : hovered ? 0.9 : 0.72;
  const scanOpacity = active ? 0.2 : dimmed ? 0.035 : hovered ? 0.16 : 0.12;

  useEffect(() => () => geometry.dispose(), [geometry]);

  if (!boundarySegments.length) return null;

  const handleClick = event => {
    event.stopPropagation();
    onSelect(sector.id);
  };

  const handlePointerOver = event => {
    event.stopPropagation();
    onHover(sector.id);
  };

  const handlePointerOut = event => {
    event.stopPropagation();
    onHover(null);
  };

  return (
    <group>
      <mesh geometry={geometry} onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <meshBasicMaterial
          color={faction.fill || faction.color}
          transparent
          opacity={fillOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={1}
        />
      </mesh>

      <mesh geometry={geometry} raycast={() => null}>
        <shaderMaterial
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          uniforms={{
            uColor: { value: new THREE.Color(faction.glow || faction.color) },
            uOpacity: { value: scanOpacity }
          }}
          vertexShader={`
            void main() {
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            uniform float uOpacity;
            void main() {
              float scan = 0.55 + 0.45 * sin(gl_FragCoord.y * 1.75);
              float band = smoothstep(0.18, 1.0, scan);
              gl_FragColor = vec4(uColor * (0.7 + band * 0.45), uOpacity * (0.38 + band * 0.62));
            }
          `}
        />
      </mesh>

      {boundarySegments.map((points, index) => (
        <line key={`boundary-${index}`} raycast={() => null}>
          <LineGeometry points={points} />
          <lineBasicMaterial
            color={faction.glow || faction.color}
            transparent
            opacity={lineOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
          />
        </line>
      ))}
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

function getGeneratedPlanetTextures(body) {
  if (!PLANET_TEXTURE_CACHE.has(body.id)) {
    PLANET_TEXTURE_CACHE.set(body.id, makePlanetTextures(body));
  }

  return PLANET_TEXTURE_CACHE.get(body.id);
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

function PlanetBody({ map, planet, mode, active, hovered, onSelect, onHover, interactive = true, hidden = false }) {
  const body = useMemo(() => normalizePlanet(map, planet), [map, planet]);
  const groupRef = useRef(null);
  const planetRef = useRef(null);
  const cloudsRef = useRef(null);
  const scanRef = useRef(null);
  const korribanTextures = useKorribanTextureSet();
  const generatedTextures = useMemo(() => body.id === "korriban" ? null : getGeneratedPlanetTextures(body), [body]);
  const hasKorribanTextures = body.id === "korriban";
  const textures = hasKorribanTextures ? korribanTextures : generatedTextures;
  const haloTexture = useMemo(() => makeGlowTexture("rgba(255,255,255,1)", colorWithAlpha(body.colors.glow, 0.58)), [body.colors.glow]);
  const isGalaxy = mode === "galaxy";
  const targetScale = active ? 7.4 : mode === "sector" ? (hovered ? 1.35 : 1.08) : isGalaxy ? 0.34 : 2.15;
  const sectorMarkerVisible = !hidden && mode === "sector";

  useEffect(() => () => {
  haloTexture.dispose();
  }, [haloTexture]);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.visible = !hidden;
      const next = new THREE.Vector3(targetScale, targetScale, targetScale);
      groupRef.current.scale.lerp(next, 0.075);
      const emergence = active && mode !== "sector" ? Math.sin(t * 0.7 + idSeed(body.id)) * 0.035 : 0;
      groupRef.current.position.y = mode === "sector" ? -0.026 : body.scenePosition.y + emergence;
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
  if (!interactive || hidden) return;
  onHover(body.id);
  };

  const handlePointerOut = event => {
  event.stopPropagation();
  if (!interactive || hidden) return;
  onHover(null);
  };

  const handleClick = event => {
  event.stopPropagation();
  if (!interactive || hidden) return;
  onSelect(body.id);
  };

  return (
    <group ref={groupRef} position={body.scenePosition.toArray()}>
      <mesh
  ref={planetRef}
  raycast={interactive && !hidden ? undefined : () => null}
  onPointerOver={handlePointerOver}
  onPointerOut={handlePointerOut}
  onClick={handleClick}
>
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
    </group>
  );
}

function SectorPlanetField({ map, view, hoveredPlanetId, onSelectPlanet, onHoverPlanet }) {
  const visiblePlanets = useMemo(() => {
    if (view.mode === "galaxy") return [];
    if (view.mode === "planet") {
      return (map.planets || []).filter(planet => planet.id === view.planetId);
    }

    return planetsForSector(map, view.sectorId);
  }, [map, view.mode, view.sectorId, view.planetId]);

  return (
    <group>
      <group visible={false}>
        {(map.planets || []).map(planet => (
          <PlanetBody
            key={`preload-${planet.id}`}
            map={map}
            planet={planet}
            mode="galaxy"
            active={false}
            hovered={false}
            interactive={false}
            hidden
            onSelect={() => {}}
            onHover={() => {}}
          />
        ))}
      </group>

      {visiblePlanets.map(planet => (
        <PlanetBody
          key={planet.id}
          map={map}
          planet={planet}
          mode={view.mode}
          active={view.planetId === planet.id}
          hovered={hoveredPlanetId === planet.id}
          interactive={view.mode !== "planet"}
          onSelect={onSelectPlanet}
          onHover={onHoverPlanet}
        />
      ))}
    </group>
  );
}

function GalaxyControlMap({ map, view, hoveredSectorId, onSelectSector, onHoverSector, quality }) {
  const mode = view.mode;
  const opacity = mode === "galaxy" ? 1 : mode === "sector" ? 0.28 : 0;
  const sectorOpacity = mode === "galaxy" ? 1 : mode === "sector" ? 0.58 : 0;
  const counts = PARTICLE_COUNTS[quality] || PARTICLE_COUNTS.balanced;

  return (
    <group visible={opacity > 0.001}>
      <SectorGrid map={map} opacity={opacity} />
      <group position={[0, -0.005, 0]}>
        {visibleSectors(map).map(sector => (
          <SectorControlZone
            key={sector.id}
            map={map}
            sector={sector}
            active={view.sectorId === sector.id}
            hovered={hoveredSectorId === sector.id}
            dimmed={mode !== "galaxy" && view.sectorId !== sector.id}
            onSelect={onSelectSector}
            onHover={onHoverSector}
          />
        ))}
      </group>
      <GalaxyParticles mode="stars" count={counts.stars} seed={4321} opacity={1.18 * opacity} sizeScale={1.06} />
      <GalaxyParticles mode="dust" count={counts.dust} seed={8827} opacity={0.52 * opacity} sizeScale={1.34} />
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

function resolveFocus(view, map, elapsedTime = 0) {
  if (view.mode === "planet") {
    const planet = (map.planets || []).find(item => item.id === view.planetId);
    return planet ? mapPointToWorld(planet.position || planet.mapPosition || [0, 0], map, BODY_Y_OFFSET, elapsedTime) : WIDE_TARGET.clone();
  }
  if (view.mode === "sector") {
    const sector = (map.sectors || []).find(item => item.id === view.sectorId);
    return sector ? mapLocalToWorld(sectorSceneCenter(sector, map), elapsedTime) : WIDE_TARGET.clone();
  }
  return WIDE_TARGET.clone();
}

function horizontalApproachDirection(focus) {
  const direction = new THREE.Vector3(focus.x, 0, focus.z);
  if (direction.lengthSq() < 0.01) direction.set(0, 0, 1);
  return direction.normalize();
}

function resolveCamera(view, map, previousCamera, elapsedTime = 0) {
  const focus = resolveFocus(view, map, elapsedTime);
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
  const { camera, clock } = useThree();
  const activeTransition = useRef(null);
  const lastKey = useRef(null);
  const lastStableView = useRef(view);
  const lastFocusRef = useRef(null);

  useEffect(() => {
    const key = `${view.mode}:${view.sectorId || ""}:${view.planetId || ""}:${transition.token}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    const elapsedTime = clock.elapsedTime;
    const focus = resolveFocus(view, map, elapsedTime);
    const targetCamera = resolveCamera(view, map, camera.position, elapsedTime);
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
  }, [view, transition, map, camera.position, controlsRef, clock]);

  useFrame(({ clock }) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const liveFocus = resolveFocus(view, map, clock.elapsedTime);

    const current = activeTransition.current;
    if (current) {
      const liveCamera = resolveCamera(view, map, camera.position, clock.elapsedTime);
      const raw = (performance.now() - current.startedAt) / current.duration;
      const capped = Math.min(1, raw);
      const isPlanetEntry = current.kind === "planet" && view.mode === "planet";
      const t = isPlanetEntry ? 1 - Math.pow(1 - capped, 3.4) : smoothstep(0, 1, raw);
      const recoil = isPlanetEntry
        ? Math.sin(capped * Math.PI * 3.1) * current.recoil * (1 - t * 0.62)
        : Math.sin(capped * Math.PI * 2.6) * current.recoil * (1 - t);
      camera.position.copy(current.fromCamera).lerp(liveCamera, t);
      const recoilDirection = liveCamera.clone().sub(liveFocus).normalize();
      camera.position.add(recoilDirection.multiplyScalar(recoil));
      if (isPlanetEntry && !current.reducedMotion) {
        const shake = Math.sin(capped * Math.PI) * (1 - t * 0.45) * 0.075;
        camera.position.x += Math.sin(raw * 74) * shake;
        camera.position.y += Math.cos(raw * 61) * shake * 0.55;
      }
      controls.target.copy(current.fromTarget).lerp(liveFocus, t);
      controls.update();

      if (raw >= 1) {
        activeTransition.current = null;
        lastStableView.current = view;
        controls.enabled = true;
        controls.autoRotate = true;
        controls.autoRotateSpeed = view.mode === "galaxy" ? 0.18 : view.mode === "sector" ? 0.28 : 0.2;
        controls.target.copy(liveFocus);
        lastFocusRef.current = liveFocus.clone();
        controls.update();
      }
      return;
    }

    if (lastStableView.current.mode !== view.mode) lastStableView.current = view;
    const previousFocus = lastFocusRef.current || liveFocus.clone();
    const focusDelta = liveFocus.clone().sub(previousFocus);
    if (view.mode !== "galaxy") camera.position.add(focusDelta);
    controls.target.copy(liveFocus);
    lastFocusRef.current = liveFocus.clone();
    controls.autoRotate = true;
    controls.autoRotateSpeed = view.mode === "galaxy" ? 0.18 : view.mode === "sector" ? 0.28 : 0.2;
    controls.update();
  });

  return null;
}

function CameraAnchoredStars({ count, mode }) {
  const ref = useRef(null);

  useFrame(({ camera }) => {
    if (ref.current) ref.current.position.copy(camera.position);
  });

  return (
    <group ref={ref}>
      <Stars
        radius={mode === "planet" ? 160 : 82}
        depth={mode === "planet" ? 90 : 42}
        count={mode === "planet" ? count * 2 : count}
        factor={mode === "planet" ? 7.4 : 5.6}
        saturation={0.62}
        fade={mode !== "planet"}
        speed={mode === "planet" ? 0.12 : 0.26}
      />
    </group>
  );
}

function GalaxyScene({ map, view, hoveredSectorId, hoveredPlanetId, onSelectSector, onHoverSector, onSelectPlanet, onHoverPlanet, onAssetsReady, transition, quality, reducedMotion }) {
  const controlsRef = useRef(null);
  const galaxyRef = useRef(null);
  const selectedPlanet = useMemo(() => (map.planets || []).find(planet => planet.id === view.planetId), [map.planets, view.planetId]);
  const selectedPlanetScenePosition = useMemo(() => selectedPlanet ? mapPointToWorld(selectedPlanet.position || selectedPlanet.mapPosition || [0, 0], map, BODY_Y_OFFSET) : null, [selectedPlanet, map]);
  const hyperspaceActive = transition.kind === "planet" && transition.active && (transition.phase === "hyperspace" || transition.phase === "arrival");
  const counts = PARTICLE_COUNTS[quality] || PARTICLE_COUNTS.balanced;

  useFrame(({ clock }) => {
    if (!galaxyRef.current) return;
    galaxyRef.current.rotation.set(
      GALAXY_BASE_ROTATION_X,
      GALAXY_BASE_ROTATION_Y + clock.elapsedTime * GALAXY_FLOW_ROTATION_SPEED,
      GALAXY_BASE_ROTATION_Z
    );
  });

  return (
    <>
      <color attach="background" args={["#030105"]} />
      <KorribanTexturePreloader onReady={onAssetsReady} />
      <fogExp2 attach="fog" args={["#050107", view.mode === "planet" ? 0.00042 : 0.003]} />
      <ambientLight intensity={view.mode === "planet" ? 0.34 : 0.2} color="#4d1b20" />
      <directionalLight position={[4.8, 8.2, 5.4]} intensity={view.mode === "planet" ? 3.8 : 3.2} color="#ffd8a8" />
      <pointLight position={[0, 1.4, 0]} intensity={view.mode === "planet" ? 0 : 88} distance={19} color="#ffb168" />
      {selectedPlanetScenePosition ? (
        <pointLight position={selectedPlanetScenePosition.clone().add(new THREE.Vector3(3.4, 2.2, 2.6)).toArray()} intensity={68} distance={12} color={view.mode === "planet" ? "#ffe2bd" : normalizePlanet(map, selectedPlanet).colors.glow} />
      ) : null}

      <CameraAnchoredStars count={counts.sky} mode={view.mode} />
      <Sparkles count={view.mode === "planet" ? 0 : counts.sparkles} scale={[24, 5.4, 18]} size={1.55} speed={0.44} color="#ff9a3d" opacity={0.72} />
      <HyperspaceTunnel active={hyperspaceActive} quality={quality} reducedMotion={reducedMotion} />

      <group ref={galaxyRef} rotation={[GALAXY_BASE_ROTATION_X, GALAXY_BASE_ROTATION_Y, GALAXY_BASE_ROTATION_Z]}>
        <GalaxyControlMap
          map={map}
          view={view}
          hoveredSectorId={hoveredSectorId}
          onSelectSector={onSelectSector}
          onHoverSector={onHoverSector}
          quality={quality}
        />
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
          <Bloom intensity={quality === "high" ? 0.58 : 0.38} luminanceThreshold={0.24} luminanceSmoothing={0.28} />
          <Noise opacity={0.032} />
          <Vignette eskil={false} offset={0.2} darkness={0.36} />
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
  if (!sector || !drawableSectorCells(sector, map).length) return null;
  const planets = planetsForSector(map, sector.id);
  const faction = factionById(map, sector.factionId);
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
  const [hoveredSectorId, setHoveredSectorId] = useState(null);
  const [hoveredPlanetId, setHoveredPlanetId] = useState(null);
  const [quality, setQuality] = useState("high");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [transition, setTransition] = useState({ kind: "galaxy", token: 0, active: false, phase: "idle" });
  const transitionTimersRef = useRef([]);
  const sectorSummary = getSectorSummary(normalizedMap, view.sectorId);
  const planetSummary = getPlanetSummary(normalizedMap, view.planetId);
  const hoveredSectorSummary = getSectorSummary(normalizedMap, hoveredSectorId);
  const hoveredPlanetSummary = getPlanetSummary(normalizedMap, hoveredPlanetId);
  const displayedSectorSummary = hoveredSectorSummary || sectorSummary;
  const displayedPlanetSummary = hoveredPlanetSummary || planetSummary;
  const panelFaction = displayedPlanetSummary?.faction || displayedSectorSummary?.faction || null;
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
    setHoveredSectorId(null);
    setHoveredPlanetId(null);
    setView({ mode: "sector", sectorId, planetId: null });
    beginTransition("sector");
  }, [beginTransition]);

  const selectPlanet = useCallback(planetId => {
    const planet = (normalizedMap.planets || []).find(item => item.id === planetId);
    if (!planet) return;
    if (view.mode === "planet" && view.planetId === planetId) return;
    clearTransitionTimers();
    setHoveredSectorId(null);
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
  }, [normalizedMap.planets, view.mode, view.planetId, clearTransitionTimers, queueTransitionTimer, reducedMotion]);

  const zoomOut = useCallback(() => {
    if (view.mode === "planet") {
      setView({ mode: "sector", sectorId: view.sectorId, planetId: null });
      beginTransition("sector");
      return;
    }
    setView({ mode: "galaxy", sectorId: null, planetId: null });
    setHoveredSectorId(null);
    setHoveredPlanetId(null);
    beginTransition("galaxy");
  }, [view.mode, view.sectorId, beginTransition]);

  const panelTitle = displayedPlanetSummary?.planet?.shortName || displayedPlanetSummary?.planet?.name || displayedSectorSummary?.sector?.name || normalizedMap.title;
  const panelKicker = displayedPlanetSummary
    ? `${displayedPlanetSummary.sector?.name || "Sector"} - ${displayedPlanetSummary.planet.grid || "R-5"}`
    : displayedSectorSummary
      ? `${displayedSectorSummary.sector.grid || "Sector"} - ${displayedSectorSummary.sector.regionId || "Outer Rim"}`
      : "Strategic Control Map";
  const panelSummary = displayedPlanetSummary?.planet?.summary
    || displayedSectorSummary?.sector?.objectives?.[0]
    || (displayedSectorSummary ? `${displayedSectorSummary.planets.length || "No"} planets logged in this sector.` : "Hover a sector or planet to inspect it.");
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
            hoveredSectorId={hoveredSectorId}
            hoveredPlanetId={hoveredPlanetId}
            onSelectSector={selectSector}
            onHoverSector={setHoveredSectorId}
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
            {visibleSectors(normalizedMap).map(sector => {
              const summary = getSectorSummary(normalizedMap, sector.id);
              const faction = summary?.faction || factionById(normalizedMap, sector.factionId);
              return (
                <button
                  className={`gm-selector${hoveredSectorId === sector.id ? " is-hovered" : ""}`}
                  type="button"
                  key={sector.id}
                  onClick={() => selectSector(sector.id)}
                  onPointerEnter={() => setHoveredSectorId(sector.id)}
                  onPointerLeave={() => setHoveredSectorId(null)}
                >
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
    filter: blur(.36px);
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
    repeating-linear-gradient(
      90deg,
      rgba(190, 225, 255, 0.00) 0px,
      rgba(190, 225, 255, 0.00) 2px,
      rgba(190, 225, 255, 0.06) 2px,
      rgba(190, 225, 255, 0.06) 4px
    ),
    linear-gradient(
      180deg,
      rgba(120, 180, 255, 0.04),
      rgba(255, 255, 255, 0.00) 22%,
      rgba(255, 255, 255, 0.00) 78%,
      rgba(120, 180, 255, 0.04)
    );
  mix-blend-mode: screen;
  opacity: .42;
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
    max-height: 208px;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 4px;
    scrollbar-color: color-mix(in srgb, var(--panel-color) 58%, transparent) rgba(0, 0, 0, .18);
    scrollbar-width: thin;
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
      grid-template-columns: 1fr;
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
