"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sparkles } from "@react-three/drei";
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
const SPIRAL_PITCH_DEG = 15.5;
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
const CORE_STAR_INNER_RADIUS = 0.34;
const CORE_STAR_OUTER_RADIUS = 1.38;
const GALAXY_BASE_ROTATION_X = -0.045;
const GALAXY_BASE_ROTATION_Y = -0.32;
const GALAXY_BASE_ROTATION_Z = 0.02;
const GALAXY_BASE_ROTATION = new THREE.Euler(GALAXY_BASE_ROTATION_X, GALAXY_BASE_ROTATION_Y, GALAXY_BASE_ROTATION_Z);
const WIDE_CAMERA = new THREE.Vector3(0, 16.8, 15.4);
const WIDE_TARGET = new THREE.Vector3(0.18, 0, -0.36);
const SECTOR_CAMERA_LIFT = 2.95;
const SECTOR_CAMERA_PULLBACK = 3.65;
const PLANET_APPROACH_DISTANCE = 2.15;
const PLANET_ENTRY_DISTANCE = 96;
const PLANET_LOADING_DISTANCE = 132;
const HYPERSPACE_MIN_MS = 1500;
const SURFACE_REVEAL_TIMEOUT_MS = 5000;
const BODY_Y_OFFSET = 0.05;
const PARTICLE_COUNTS = {
  high: { stars: 26000, dust: 52000, clouds: 180, sky: 16000, sparkles: 460, streaks: 1650 },
  balanced: { stars: 20000, dust: 38000, clouds: 140, sky: 10000, sparkles: 220, streaks: 1000 },
  reduced: { stars: 14000, dust: 24000, clouds: 90, sky: 5600, sparkles: 130, streaks: 540 }
};
const GALAXY_RANDOMNESS = 0.3;
const GALAXY_RANDOMNESS_POWER_XZ = 2.468;
const GALAXY_RANDOMNESS_POWER_Y = 5.2;
const GALAXY_VERTICAL_RANDOMNESS = 0.026;
const GALAXY_INITIAL_SPIN_TIME = 42;
const GALAXY_SPIN_STRENGTH = 0.05;
const GALAXY_FLOW_ROTATION_SPEED = 0.012;
const GALAXY_INSIDE_COLOR = "#f9fdff";
const GALAXY_OUTSIDE_COLOR = "#83c9ff";
const GALAXY_RIM_GLOW_COLOR = "#e8fbff";
const DEFAULT_POLAR_TESSELLATION = {
  angles: [-180, -150, -116, -84, -52, -24, 8, 38, 68, 100, 132, 164, 196, 228, 260, 294, 330, 360],
  rings: [0.28, 0.72, 1.42, 2.05, 2.85, 3.72, 4.86, 5.58, 6.24, 6.74]
};
const CORE_CUTOUT_RING_INDEX = 0;
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
  "/assets/galaxy/korriban/roughness.png",
  "/assets/galaxy/korriban/clouds.png"
];
const KORRIBAN_TEXTURE_PATHS = {
  diffuse: KORRIBAN_TEXTURE_URLS[0],
  bump: KORRIBAN_TEXTURE_URLS[1],
  roughness: KORRIBAN_TEXTURE_URLS[2],
  clouds: KORRIBAN_TEXTURE_URLS[3]
};
const KORRIBAN_MAX_TEXTURE_SIZE = 4096;
const PLANET_TEXTURE_KEYS = [
  ["diffuse", true],
  ["color", true],
  ["bump", false],
  ["roughness", false],
  ["specular", false],
  ["water", true],
  ["lights", true],
  ["clouds", true],
  ["cloudColor", true],
  ["cloudBump", false]
];
const SURFACE_PLANET_TEXTURE_KEYS = new Set(["diffuse", "color"]);
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
const PLANET_ASSET_TEXTURE_CACHE = new Map();
const PLANET_ASSET_TEXTURE_STATUS = new Map();

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

function resizeTextureImage(texture, maxSize) {
  const image = texture.image;
  if (!image || !maxSize) return texture;
  const width = image.naturalWidth || image.videoWidth || image.width || 0;
  const height = image.naturalHeight || image.videoHeight || image.height || 0;
  const largest = Math.max(width, height);
  if (!width || !height || largest <= maxSize) return texture;

  const scale = maxSize / largest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  try {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    texture.image = canvas;
  } catch {
    return texture;
  }
  return texture;
}

function configurePlanetTexture(texture, { color = false, anisotropy = 8, maxSize = null } = {}) {
  resizeTextureImage(texture, maxSize);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function loadOptionalPlanetTexture(loader, url, options) {
  return new Promise(resolve => {
    if (!url) {
      resolve(null);
      return;
    }

    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      texture => resolve(configurePlanetTexture(texture, options)),
      undefined,
      () => resolve(null)
    );
  });
}

function planetTextureEntries(body) {
  const texturePaths = body.id === "korriban" ? KORRIBAN_TEXTURE_PATHS : body.textures || null;
  const textureKeys = body.id === "korriban"
    ? PLANET_TEXTURE_KEYS.filter(([key]) => Object.prototype.hasOwnProperty.call(KORRIBAN_TEXTURE_PATHS, key))
    : PLANET_TEXTURE_KEYS;

  return textureKeys
    .map(([key, color]) => ({ key, color, url: texturePaths?.[key] }))
    .filter(entry => entry.url);
}

function surfaceTextureEntriesForPlanet(planet) {
  return planetTextureEntries(planet).filter(entry => SURFACE_PLANET_TEXTURE_KEYS.has(entry.key));
}

function maxTextureSizeForLayer() {
  return KORRIBAN_MAX_TEXTURE_SIZE;
}

function planetTextureCacheKey(entry) {
  const maxSize = maxTextureSizeForLayer(entry.key);
  return `${entry.url}|${entry.color ? "color" : "data"}|${maxSize}`;
}

function planetTextureIsSettled(entry) {
  const status = PLANET_ASSET_TEXTURE_STATUS.get(planetTextureCacheKey(entry));
  return status === "loaded" || status === "failed";
}

function loadPlanetAssetTexture(entry, anisotropy) {
  const maxSize = maxTextureSizeForLayer(entry.key);
  const cacheKey = planetTextureCacheKey(entry);
  if (!PLANET_ASSET_TEXTURE_CACHE.has(cacheKey)) {
    const loader = new THREE.TextureLoader();
    PLANET_ASSET_TEXTURE_STATUS.set(cacheKey, "pending");
    PLANET_ASSET_TEXTURE_CACHE.set(
      cacheKey,
      loadOptionalPlanetTexture(loader, entry.url, { color: entry.color, anisotropy, maxSize }).then(texture => {
        PLANET_ASSET_TEXTURE_STATUS.set(cacheKey, texture ? "loaded" : "failed");
        return texture;
      })
    );
  }
  return PLANET_ASSET_TEXTURE_CACHE.get(cacheKey);
}

function loadPlanetTextureEntries(entries, anisotropy, onProgress) {
  const total = entries.length;
  if (!total) {
    onProgress?.({ loaded: 0, total: 0 });
    return Promise.resolve({});
  }

  let loaded = 0;
  onProgress?.({ loaded, total });
  return Promise.all(entries.map(entry => (
    loadPlanetAssetTexture(entry, anisotropy).then(texture => {
      loaded += 1;
      onProgress?.({ loaded, total });
      return [entry.key, texture];
    })
  ))).then(results => Object.fromEntries(results.filter(([, texture]) => texture)));
}

function factionById(map, id) {
  const factions = map?.factions?.length ? map.factions : DEFAULT_FACTIONS;
  return factions.find(faction => faction.id === id)
    || factions.find(faction => faction.id === "neutral")
    || DEFAULT_FACTIONS.find(faction => faction.id === "neutral")
    || factions[0]
    || DEFAULT_FACTIONS[0];
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

function sectorControlSummary(map, sector) {
  const control = controlForSector(map, sector.id);
  const factions = map?.factions?.length ? map.factions : DEFAULT_FACTIONS;
  const ranked = factions
    .map(faction => ({ faction, percent: control[faction.id] || 0 }))
    .sort((left, right) => right.percent - left.percent);
  const winner = ranked.find(item => item.percent > 0)?.faction || factionById(map, sector.factionId);
  return { control, ranked, winner };
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

  return cells.flatMap(cell => {
    const [angleStartIndex, angleEndIndex, ringStartIndex, ringEndIndex] = Array.isArray(cell)
      ? cell
      : [cell.angle?.[0], cell.angle?.[1], cell.ring?.[0], cell.ring?.[1]];
    const explicitInnerRadius = Array.isArray(cell) ? null : cell.innerRadius;
    const explicitOuterRadius = Array.isArray(cell) ? null : cell.outerRadius;

    if (
      !Number.isFinite(angleStartIndex)
      || !Number.isFinite(angleEndIndex)
      || !Number.isFinite(ringStartIndex)
      || !Number.isFinite(ringEndIndex)
    ) {
      return [];
    }

    const atomicCells = [];

    for (let angleIndex = angleStartIndex; angleIndex < angleEndIndex; angleIndex += 1) {
      for (let ringIndex = ringStartIndex; ringIndex < ringEndIndex; ringIndex += 1) {
        atomicCells.push({
          angleStartIndex: angleIndex,
          angleEndIndex: angleIndex + 1,
          ringStartIndex: ringIndex,
          ringEndIndex: ringIndex + 1,
          cellKey: `${angleIndex}:${ringIndex}`,
          startAngleDeg: tessellation.angles[angleIndex],
          endAngleDeg: tessellation.angles[angleIndex + 1],
          innerRadius: Number.isFinite(explicitInnerRadius) ? explicitInnerRadius : tessellation.rings[ringIndex],
          outerRadius: Number.isFinite(explicitOuterRadius) ? explicitOuterRadius : tessellation.rings[ringIndex + 1]
        });
      }
    }

    return atomicCells;
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
  return (map?.sectors || []).filter(sector => (
    drawableSectorCells(sector, map).length > 0
    && planetsForSector(map, sector.id).length > 0
  ));
}

function normalizeDeg(angle) {
  return ((angle % 360) + 360) % 360;
}

function angleWithinArc(angle, start, end, padding = 0) {
  const normalizedAngle = normalizeDeg(angle);
  const normalizedStart = normalizeDeg(start + padding);
  const normalizedEnd = normalizeDeg(end - padding);
  if (normalizedStart <= normalizedEnd) return normalizedAngle >= normalizedStart && normalizedAngle <= normalizedEnd;
  return normalizedAngle >= normalizedStart || normalizedAngle <= normalizedEnd;
}

function mapPointFromPolar(angleDeg, radius) {
  const angle = THREE.MathUtils.degToRad(angleDeg);
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function planetSectorPadding(planet) {
  return {
    radius: Math.max(0.42, (planet.radius || 0.018) * 24),
    angle: 13.5
  };
}

function paddedCellBounds(cell, planet) {
  const desiredPadding = planetSectorPadding(planet);
  const radiusSpan = Math.max(0.001, cell.outerRadius - cell.innerRadius);
  const angleSpan = Math.max(0.001, Math.abs(cell.endAngleDeg - cell.startAngleDeg));
  const radiusPadding = Math.min(desiredPadding.radius, radiusSpan * 0.28);
  const anglePadding = Math.min(desiredPadding.angle, Math.max(2.5, angleSpan * 0.24));
  return {
    inner: cell.innerRadius + radiusPadding,
    outer: cell.outerRadius - radiusPadding,
    start: cell.startAngleDeg + anglePadding,
    end: cell.endAngleDeg - anglePadding,
    anglePadding
  };
}

function randomPointInSectorCell(rnd, cell, planet) {
  const { inner, outer, start, end } = paddedCellBounds(cell, planet);
  const radius = outer > inner ? randRange(rnd, inner, outer) : (cell.innerRadius + cell.outerRadius) / 2;
  const angle = end > start ? randRange(rnd, start, end) : (cell.startAngleDeg + cell.endAngleDeg) / 2;
  return mapPointFromPolar(angle, radius);
}

function cellCenterPoint(cell, planet, angleBias = 0.5, radiusBias = 0.5) {
  const { inner, outer, start, end } = paddedCellBounds(cell, planet);
  const radius = outer > inner ? THREE.MathUtils.lerp(inner, outer, clamp(radiusBias, 0, 1)) : (cell.innerRadius + cell.outerRadius) / 2;
  const angle = end > start ? THREE.MathUtils.lerp(start, end, clamp(angleBias, 0, 1)) : (cell.startAngleDeg + cell.endAngleDeg) / 2;
  return mapPointFromPolar(angle, radius);
}

function pointDistance2D(left, right) {
  const dx = left[0] - right[0];
  const dz = left[1] - right[1];
  return Math.sqrt(dx * dx + dz * dz);
}

function minPlanetSpacing(planet, sector) {
  const sectorWidth = Math.max(0.4, (sector.outerRadius || 6) - (sector.innerRadius || 5));
  return Math.max(0.46, Math.min(0.92, sectorWidth * 0.46 + (planet.radius || 0.018) * 12));
}

function largestDrawableCells(sector, map) {
  return drawableSectorCells(sector, map)
    .map(cell => ({
      ...cell,
      area: Math.max(0.001, Math.abs(cell.endAngleDeg - cell.startAngleDeg) * (cell.outerRadius * cell.outerRadius - cell.innerRadius * cell.innerRadius))
    }))
    .sort((left, right) => right.area - left.area);
}

function pickLayoutCell(rnd, cells) {
  const total = cells.reduce((sum, cell) => sum + cell.area, 0);
  let cursor = rnd() * total;
  for (const cell of cells) {
    cursor -= cell.area;
    if (cursor <= 0) return cell;
  }
  return cells[0];
}

function scoreLayoutCandidate(candidate, placed, sectorAnchor, requiredSpacing) {
  const centerDistance = pointDistance2D(candidate, sectorAnchor);
  if (!placed.length) return -centerDistance * 2.6;
  const distances = placed.map(item => pointDistance2D(candidate, item.position));
  const nearest = Math.min(...distances);
  const average = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
  const centroid = placed.reduce((sum, item) => [sum[0] + item.position[0], sum[1] + item.position[1]], [0, 0]);
  centroid[0] /= placed.length;
  centroid[1] /= placed.length;
  const centroidEscape = pointDistance2D(candidate, centroid);
  const spacingPenalty = nearest < requiredSpacing ? (requiredSpacing - nearest) * 50 : 0;
  return nearest * 5.2 + average * 0.85 + centroidEscape * 1.2 - centerDistance * 2.4 - spacingPenalty;
}

function sectorMapCenter(cells) {
  const center = [0, 0];
  let totalWeight = 0;
  cells.forEach(cell => {
    const angleSpan = Math.abs(cell.endAngleDeg - cell.startAngleDeg);
    const weight = Math.max(0.01, angleSpan * (cell.outerRadius * cell.outerRadius - cell.innerRadius * cell.innerRadius));
    const point = mapPointFromPolar((cell.startAngleDeg + cell.endAngleDeg) / 2, (cell.innerRadius + cell.outerRadius) / 2);
    center[0] += point[0] * weight;
    center[1] += point[1] * weight;
    totalWeight += weight;
  });
  return totalWeight ? [center[0] / totalWeight, center[1] / totalWeight] : [0, 0];
}

function buildPlanetLayout(map, planets) {
  const layout = new Map();
  const sectorsById = new Map((map?.sectors || []).map(sector => [sector.id, sector]));
  const planetsBySector = new Map();
  planets.forEach(planet => {
    const list = planetsBySector.get(planet.sectorId) || [];
    list.push(planet);
    planetsBySector.set(planet.sectorId, list);
  });

  planetsBySector.forEach((sectorPlanets, sectorId) => {
    const sector = sectorsById.get(sectorId);
    if (!sector) return;
    const cells = largestDrawableCells(sector, map);
    if (!cells.length) return;
    const placed = [];
    const sectorAnchor = sectorMapCenter(cells);

    sectorPlanets
      .slice()
      .sort((left, right) => String(left.id).localeCompare(String(right.id)))
      .forEach((planet, index) => {
        const rnd = seededRandom(idSeed(`${sector.id}:${planet.id}:${index}`) + 8191);
        let chosen = null;
        let chosenScore = -Infinity;
        const requiredSpacing = minPlanetSpacing(planet, sector);
        const candidateCount = Math.max(220, sectorPlanets.length * 90);
        const candidates = [cellCenterPoint(pickLayoutCell(rnd, cells), planet, 0.5, 0.5)];

        for (let attempt = 0; attempt < candidateCount; attempt += 1) {
          const cell = pickLayoutCell(rnd, cells);
          candidates.push(randomPointInSectorCell(rnd, cell, planet));
        }

        for (const candidate of candidates) {
          const score = scoreLayoutCandidate(candidate, placed, sectorAnchor, requiredSpacing);
          if (score > chosenScore) {
            chosenScore = score;
            chosen = candidate;
          }
        }

        placed.push({ planet, position: chosen });
        layout.set(planet.id, chosen);
      });
  });

  return layout;
}

function safePlanetMapPosition(map, planet) {
  const position = planet.layoutPosition || planet.position || planet.mapPosition || [0, 0];
  const sector = (map?.sectors || []).find(item => item.id === planet.sectorId);
  if (!sector) return position;

  const cells = drawableSectorCells(sector, map);
  if (!cells.length) return position;

  const x = Number(position[0]) || 0;
  const z = Number(position[1] ?? position[2]) || 0;
  const radius = Math.sqrt(x * x + z * z);
  const angle = THREE.MathUtils.radToDeg(Math.atan2(z, x));

  const safelyInside = cells.some(cell => {
    const bounds = paddedCellBounds(cell, planet);
    return radius >= bounds.inner
      && radius <= bounds.outer
      && angleWithinArc(angle, cell.startAngleDeg, cell.endAngleDeg, bounds.anglePadding);
  });
  if (safelyInside) return [x, z];

  const bestCell = cells.slice().sort((left, right) => (
    (right.endAngleDeg - right.startAngleDeg) * (right.outerRadius - right.innerRadius)
    - (left.endAngleDeg - left.startAngleDeg) * (left.outerRadius - left.innerRadius)
  ))[0];
  const safeBounds = paddedCellBounds(bestCell, planet);
  const safeRadius = safeBounds.outer > safeBounds.inner ? (safeBounds.inner + safeBounds.outer) / 2 : (bestCell.innerRadius + bestCell.outerRadius) / 2;
  const safeAngle = (bestCell.startAngleDeg + bestCell.endAngleDeg) / 2;
  return mapPointFromPolar(safeAngle, safeRadius);
}

function planetMapPosition(map, planet) {
  return safePlanetMapPosition(map, planet);
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

function makeRoutePoints(start, end, lift = 0.08) {
  const points = [];
  const mid = start.clone().lerp(end, 0.5);
  const distance = start.distanceTo(end);
  mid.y += lift + distance * 0.035;
  for (let i = 0; i <= 32; i += 1) {
    const t = i / 32;
    const a = start.clone().lerp(mid, t);
    const b = mid.clone().lerp(end, t);
    points.push(a.lerp(b, t));
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
  return base + profile.angleOffset - Math.log(r / CORE_RADIUS) / (SPIRAL_B * profile.pitchScale);
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
    const coreChance = mode === "stars" ? 0.12 : mode === "dust" ? 0.06 : 0.18;
    const isCoreHalo = mode === "core" || rnd() < coreChance;
    const isInterArm = !isCoreHalo && rnd() < (mode === "dust" ? 0.46 : 0.4);
    const arm = i % SPIRAL_ARM_COUNT;
    const profile = spiralArmProfile(arm);
    const armStart = Math.max(profile.radiusStart, mode === "dust" ? CORE_RADIUS * 0.86 : CORE_RADIUS * 0.78);

    const radius = isCoreHalo
      ? CORE_STAR_INNER_RADIUS + Math.pow(rnd(), 1.65) * (CORE_STAR_OUTER_RADIUS - CORE_STAR_INNER_RADIUS)
      : Math.min(
        GALAXY_RADIUS,
        Math.pow(rnd(), isInterArm ? 0.92 : mode === "dust" ? 0.84 : 1.08) * (GALAXY_RADIUS - armStart) + armStart
      );
    const armProgress = clamp((radius - profile.radiusStart) / Math.max(0.01, profile.radiusEnd - profile.radiusStart), 0, 1);
    const rimTaper = 1 - smoothstep(0.72, 1, armProgress) * profile.tailCurl;
    const armAngle = spiralAngle(radius, arm) + Math.pow(armProgress, 2.2) * profile.tailCurl * 0.54;
    // Arms stay narrow near the core and relax into wider bands further out -
    // real arms have roughly constant angular width in radians, not linear width,
    // so the physical band gets wider (in distance) as radius grows.
    const armWidth = (mode === "dust" ? 0.09 + radius * 0.012 : 0.042 + radius * 0.006) * profile.widthScale * rimTaper;
    const interArmSign = rnd() > 0.5 ? 1 : -1;
    const interArmGap = TAU / SPIRAL_ARM_COUNT;
    const interArmOffset = interArmSign * randRange(
      rnd,
      armWidth * (mode === "dust" ? 2.15 : 2.45),
      interArmGap * (mode === "dust" ? 0.5 : 0.46)
    );
    const jitter = isCoreHalo
      ? randRange(rnd, -TAU, TAU)
      : isInterArm
        ? interArmOffset
        : randRange(rnd, -armWidth, armWidth);
    const angle = isCoreHalo ? rnd() * TAU : armAngle + jitter;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * GALAXY_VISUAL_FLATTEN;
    const y = randRange(rnd, -0.018, 0.018) * (1 + radius * 0.025);
    const rimFade = Math.min(1, radius / GALAXY_RADIUS);
    const randomSign = () => (rnd() < 0.5 ? -1 : 1);
    const fieldSpread = isInterArm
      ? (mode === "dust" ? 0.92 : 0.78)
      : (mode === "dust" ? 0.28 : 0.18);
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
    if (isCoreHalo) color.lerp(new THREE.Color("#ffffff"), 0.58);
    if (!isCoreHalo && !isInterArm) color.lerp(new THREE.Color("#ffffff"), mode === "dust" ? 0.16 : 0.24);
    if (!isCoreHalo && !isInterArm && rnd() > 0.88) color.lerp(new THREE.Color("#f7fcff"), 0.34);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i] = mode === "dust"
      ? randRange(rnd, 0.026, 0.095) * (1.04 + rimFade * 0.22) * (isInterArm ? 0.7 : 1.18)
      : randRange(rnd, 0.01, 0.045) * (isCoreHalo ? 0.82 : isInterArm ? 0.7 : 1.24) * (1 + smoothstep(0.78, 1, rimFade) * 0.26);
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
function NebulaClouds({ opacity = 1, count = 140, seed = 6410, renderOrder = -6 }) {
  const textures = useMemo(() => NEBULA_PALETTE.map(hex => makeNebulaCloudTexture(hex)), []);
  useEffect(() => () => textures.forEach(texture => texture.dispose()), [textures]);

  const clumps = useMemo(() => {
    const rnd = seededRandom(seed);
    const rows = [];
    for (let i = 0; i < count; i += 1) {
      const arm = i % SPIRAL_ARM_COUNT;
      const radius = randRange(rnd, CORE_RADIUS * 1.05, GALAXY_RADIUS * 1.02);
      const profile = spiralArmProfile(arm);
      const armProgress = clamp((radius - profile.radiusStart) / Math.max(0.01, profile.radiusEnd - profile.radiusStart), 0, 1);
      const offArm = rnd() < 0.24;
      const angle = offArm
        ? rnd() * TAU
        : spiralAngle(radius, arm) + Math.pow(armProgress, 2.1) * profile.tailCurl * 0.42 + randRange(rnd, -0.36, 0.36);
      const wobbleX = randRange(rnd, -0.75, 0.75);
      const wobbleZ = randRange(rnd, -0.75, 0.75);
      const x = Math.cos(angle) * radius + wobbleX;
      const z = Math.sin(angle) * radius * GALAXY_VISUAL_FLATTEN + wobbleZ;
      const scale = randRange(rnd, 1.15, 3.4) * (0.78 + (radius / GALAXY_RADIUS) * 0.7);
      rows.push({
        position: [x, randRange(rnd, -0.02, 0.05), z],
        scaleX: scale * randRange(rnd, 0.85, 1.5),
        scaleY: scale,
        rotation: randRange(rnd, 0, TAU),
        textureIndex: Math.floor(rnd() * NEBULA_PALETTE.length),
        baseOpacity: randRange(rnd, 0.08, 0.2)
      });
    }
    return rows;
  }, [count, seed]);

  return (
    <group renderOrder={renderOrder}>
      {clumps.map((clump, index) => (
        <sprite key={index} position={clump.position} scale={[clump.scaleX, clump.scaleY, 1]} renderOrder={renderOrder}>
          <spriteMaterial
            map={textures[clump.textureIndex]}
            rotation={clump.rotation}
            transparent
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
            opacity={clump.baseOpacity * opacity}
          />
        </sprite>
      ))}
    </group>
  );
}

function GalaxyParticles({ mode, count, seed, opacity, sizeScale = 1, renderOrder = -5 }) {
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
    <points geometry={geometry} renderOrder={renderOrder}>
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
            gl_PointSize = aSize * aScale * uScale * (325.0 / max(6.0, -mvPosition.z));
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
      <sprite position={[0, 0.08, 0]} scale={[3.2, 3.2, 1]} renderOrder={6}>
        <spriteMaterial map={glow} color="#e8f9ff" transparent opacity={0.38 * opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh position={[0, 0.05, 0]} renderOrder={7}>
        <sphereGeometry args={[0.23, 48, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.94 * opacity} blending={THREE.AdditiveBlending} />
      </mesh>
      <Sparkles count={120} scale={[3.2, 0.55, 3.2]} size={3.8} speed={0.35} color="#d8f5ff" opacity={0.88 * opacity} />
    </group>
  );
}


function makeSectorCellPoints(sector, cell, map) {
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

function makeSectorCellGeometry(sector, cell, map) {
  const vectors = makeSectorCellPoints(sector, cell, map);
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
    drawableSectorCells(sector, map).map(cell => makeSectorCellGeometry(sector, cell, map))
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
  const tessellation = getPolarTessellation(map);
  const angleCellCount = Math.max(0, (tessellation.angles?.length || 0) - 1);
  const cells = drawableSectorCells(sector, map);
  const occupiedCells = new Set(cells.map(cell => cell.cellKey).filter(Boolean));
  const segments = [];
  const angleNeighborIndex = angleIndex => {
    if (!angleCellCount) return angleIndex;
    return ((angleIndex % angleCellCount) + angleCellCount) % angleCellCount;
  };
  const hasOccupiedNeighbor = (angleIndex, ringIndex) => occupiedCells.has(`${angleNeighborIndex(angleIndex)}:${ringIndex}`);

  cells.forEach(cell => {
    if (!cell.cellKey) {
  segments.push(
    makeSectorArcPoints(cell.outerRadius, cell.startAngleDeg, cell.endAngleDeg, map),
    makeSectorArcPoints(cell.innerRadius, cell.startAngleDeg, cell.endAngleDeg, map),
    makeSectorRadialPoints(cell.startAngleDeg, cell.innerRadius, cell.outerRadius, map),
    makeSectorRadialPoints(cell.endAngleDeg, cell.innerRadius, cell.outerRadius, map)
  );
  return;
}

    const angleIndex = cell.angleStartIndex;
    const ringIndex = cell.ringStartIndex;

    if (!hasOccupiedNeighbor(angleIndex, ringIndex + 1)) {
      segments.push(makeSectorArcPoints(cell.outerRadius, cell.startAngleDeg, cell.endAngleDeg, map, -0.026, sector, cell, true));
    }

    if (!hasOccupiedNeighbor(angleIndex, ringIndex - 1)) {
      segments.push(makeSectorArcPoints(cell.innerRadius, cell.startAngleDeg, cell.endAngleDeg, map));
    }

    if (!hasOccupiedNeighbor(angleIndex - 1, ringIndex)) {
      segments.push(makeSectorRadialPoints(cell.startAngleDeg, cell.innerRadius, cell.outerRadius, map));
    }

    if (!hasOccupiedNeighbor(angleIndex + 1, ringIndex)) {
      segments.push(makeSectorRadialPoints(cell.endAngleDeg, cell.innerRadius, cell.outerRadius, map));
    }
  });

  return segments;
}

function SectorControlZone({ map, sector, active, dimmed, hovered, onSelect, onHover }) {
  const { winner: faction } = sectorControlSummary(map, sector);
  const geometry = useMemo(() => makeSectorGeometry(sector, map), [sector, map]);
  const boundarySegments = useMemo(() => makeSectorBoundarySegments(sector, map), [sector, map]);
  const fillOpacity = active ? 0.48 : dimmed ? 0.1 : hovered ? 0.42 : 0.36;
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
      <mesh geometry={geometry} renderOrder={10} onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        <meshBasicMaterial
          color={faction.fill || faction.color}
          transparent
          opacity={fillOpacity}
          depthWrite={false}
          depthTest
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={1}
        />
      </mesh>

      <mesh geometry={geometry} renderOrder={11} raycast={() => null}>
        <shaderMaterial
          transparent
          depthWrite={false}
          depthTest
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
        <line key={`boundary-${index}`} renderOrder={12} raycast={() => null}>
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
    scenePosition: mapPointToScene(planetMapPosition(map, planet), map, BODY_Y_OFFSET),
    visualRadius: Math.max(0.07, (planet.radius || 0.065) * getMapScale(map) * 2.35)
  };
}

function usePlanetTextureSet(body, enabled = true) {
  const maxAnisotropy = useThree(state => Math.min(12, state.gl.capabilities.getMaxAnisotropy?.() || 8));
  const [textures, setTextures] = useState({});
  const entries = useMemo(() => planetTextureEntries(body), [body]);

  useEffect(() => {
    if (!enabled) {
      setTextures({});
      return undefined;
    }

    let cancelled = false;
    setTextures({});
    const loadAndApply = entry => (
      loadPlanetAssetTexture(entry, maxAnisotropy).then(texture => {
        if (!cancelled && texture) {
          setTextures(current => ({ ...current, [entry.key]: texture }));
        }
        return texture;
      })
    );
    const surfaceEntries = entries.filter(entry => SURFACE_PLANET_TEXTURE_KEYS.has(entry.key));
    const optionalEntries = entries.filter(entry => !SURFACE_PLANET_TEXTURE_KEYS.has(entry.key));
    Promise.all(surfaceEntries.map(loadAndApply)).finally(() => {
      if (!cancelled) optionalEntries.forEach(loadAndApply);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, entries, maxAnisotropy]);

  return textures;
}

function PlanetTexturePreloader({ map, view, onProgress, onReady }) {
  const maxAnisotropy = useThree(state => Math.min(12, state.gl.capabilities.getMaxAnisotropy?.() || 8));
  const entries = useMemo(() => {
    if (view.mode === "galaxy") return [];
    if (view.mode === "sector") return [];
    const preloadPlanets = (map?.planets || []).filter(planet => planet.id === view.planetId);
    const seen = new Set();
    return preloadPlanets.flatMap(planet => surfaceTextureEntriesForPlanet(planet)).filter(entry => {
      const key = `${entry.key}:${entry.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [map, view.mode, view.planetId, view.sectorId]);

  useEffect(() => {
    if (view.mode !== "planet") return undefined;

    let cancelled = false;
    let fallbackTimer = null;
    let settledPoll = null;
    let readySent = false;
    const sendReady = () => {
      if (cancelled || readySent) return;
      readySent = true;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      if (settledPoll) window.clearInterval(settledPoll);
      onReady?.();
    };

    if (!entries.length || entries.every(planetTextureIsSettled)) {
      onProgress?.({ loaded: entries.length, total: entries.length });
      sendReady();
      return () => {};
    }

    fallbackTimer = window.setTimeout(sendReady, SURFACE_REVEAL_TIMEOUT_MS);
    settledPoll = window.setInterval(() => {
      if (entries.every(planetTextureIsSettled)) {
        onProgress?.({ loaded: entries.length, total: entries.length });
        sendReady();
      }
    }, 80);

    loadPlanetTextureEntries(entries, maxAnisotropy, progress => {
      if (!cancelled) onProgress?.(progress);
    }).then(() => {
      sendReady();
    });

    return () => {
      cancelled = true;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      if (settledPoll) window.clearInterval(settledPoll);
    };
  }, [entries, maxAnisotropy, onProgress, onReady]);

  return null;
}

function BackgroundPlanetTextureLoader({ map, onProgress, onReady }) {
  const maxAnisotropy = useThree(state => Math.min(12, state.gl.capabilities.getMaxAnisotropy?.() || 8));
  const entries = useMemo(() => {
    const seen = new Set();
    return (map?.planets || [])
      .flatMap(planet => planetTextureEntries(planet))
      .filter(entry => {
        const key = `${entry.key}:${entry.url}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => {
        const leftPriority = SURFACE_PLANET_TEXTURE_KEYS.has(left.key) ? 0 : 1;
        const rightPriority = SURFACE_PLANET_TEXTURE_KEYS.has(right.key) ? 0 : 1;
        return leftPriority - rightPriority;
      });
  }, [map]);

  useEffect(() => {
    let cancelled = false;
    let cursor = 0;
    let loaded = entries.filter(planetTextureIsSettled).length;
    const total = entries.length;
    onProgress?.({ loaded, total });

    if (!total || loaded >= total) {
      onReady?.();
      return () => {
        cancelled = true;
      };
    }

    const markLoaded = () => {
      loaded += 1;
      onProgress?.({ loaded, total });
      if (loaded >= total) onReady?.();
    };

    const workers = Array.from({ length: 2 }, async () => {
      while (!cancelled && cursor < entries.length) {
        const entry = entries[cursor];
        cursor += 1;
        if (planetTextureIsSettled(entry)) {
          continue;
        }
        await loadPlanetAssetTexture(entry, maxAnisotropy);
        if (!cancelled) markLoaded();
      }
    });

    Promise.all(workers).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entries, maxAnisotropy, onProgress, onReady]);

  return null;
}

function PlanetNightLights({ map, radius, active }) {
  const lightDirection = useMemo(() => new THREE.Vector3(5.6, 3.2, 4.4).normalize(), []);

  return (
    <mesh renderOrder={30.65}>
      <sphereGeometry args={[radius * 1.0012, 96, 48]} />
      <shaderMaterial
        uniforms={{
          uMap: { value: map },
          uLightDirection: { value: lightDirection },
          uIntensity: { value: active ? 1.18 : 0.78 }
        }}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          void main() {
            vUv = uv;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform sampler2D uMap;
          uniform vec3 uLightDirection;
          uniform float uIntensity;
          varying vec2 vUv;
          varying vec3 vWorldNormal;
          void main() {
            vec4 texel = texture2D(uMap, vUv);
            float day = dot(normalize(vWorldNormal), normalize(uLightDirection));
            float night = 1.0 - smoothstep(-0.22, 0.28, day);
            float glow = max(max(texel.r, texel.g), texel.b);
            gl_FragColor = vec4(texel.rgb * uIntensity, texel.a * glow * night);
          }
        `}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

function PlanetBody({ map, planet, mode, active, hovered, onSelect, onHover, interactive = true, hidden = false }) {
  const body = useMemo(() => normalizePlanet(map, planet), [map, planet]);
  const groupRef = useRef(null);
  const planetRef = useRef(null);
  const waterRef = useRef(null);
  const lightsRef = useRef(null);
  const cloudsRef = useRef(null);
  const scanRef = useRef(null);
  const assetTextures = usePlanetTextureSet(body, mode === "sector" || (mode === "planet" && active));
  const generatedTextures = useMemo(() => getGeneratedPlanetTextures(body), [body]);
  const textures = useMemo(() => ({
    map: assetTextures.diffuse || assetTextures.color || generatedTextures.map,
    bumpMap: assetTextures.bump || generatedTextures.bumpMap,
    roughnessMap: assetTextures.roughness || assetTextures.specular || null,
    waterMap: assetTextures.water || null,
    lightsMap: assetTextures.lights || null,
    cloudMap: assetTextures.cloudColor || assetTextures.clouds || generatedTextures.cloudMap,
    cloudAlphaMap: assetTextures.clouds || assetTextures.cloudColor || generatedTextures.cloudMap,
    cloudBumpMap: assetTextures.cloudBump || null,
    hasAssetSurface: !!(assetTextures.diffuse || assetTextures.color),
    hasAssetClouds: !!(assetTextures.cloudColor || assetTextures.clouds)
  }), [assetTextures, generatedTextures]);
  const haloTexture = useMemo(() => makeGlowTexture("rgba(255,255,255,1)", colorWithAlpha(body.colors.glow, 0.58)), [body.colors.glow]);
  const isGalaxy = mode === "galaxy";
  const targetScale = active ? 7.4 : mode === "sector" ? (hovered ? 1.35 : 1.08) : isGalaxy ? 0.34 : 2.15;
  const sectorMarkerVisible = !hidden && mode === "sector";
  const sectorHitRadius = Math.max(body.visualRadius * 2.65, 0.19);

  useEffect(() => () => {
    haloTexture.dispose();
  }, [haloTexture]);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.visible = !hidden;
      const next = new THREE.Vector3(targetScale, targetScale, targetScale);
      groupRef.current.scale.lerp(next, 0.075);
      const emergence = active && mode !== "sector" && mode !== "planet" ? Math.sin(t * 0.7 + idSeed(body.id)) * 0.035 : 0;
      groupRef.current.position.y = mode === "sector" ? -0.026 : body.scenePosition.y + emergence;
    }
    if (planetRef.current) {
      planetRef.current.rotation.y += (active ? 0.05 : 0.035) * delta;
      planetRef.current.rotation.x = THREE.MathUtils.lerp(planetRef.current.rotation.x, 0.018, 0.025);
      if (waterRef.current) waterRef.current.rotation.copy(planetRef.current.rotation);
      if (lightsRef.current) lightsRef.current.rotation.copy(planetRef.current.rotation);
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
    <group ref={groupRef} position={body.scenePosition.toArray()} renderOrder={30}>
      {mode === "sector" ? (
        <mesh
          renderOrder={36}
          raycast={interactive && !hidden ? undefined : () => null}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          <sphereGeometry args={[sectorHitRadius, 32, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
        </mesh>
      ) : null}
      <mesh
        ref={planetRef}
        renderOrder={30}
        raycast={interactive && !hidden && mode !== "sector" ? undefined : () => null}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[body.visualRadius, 96, 48]} />
        <meshStandardMaterial
          map={textures.map}
          bumpMap={textures.bumpMap}
          bumpScale={textures.hasAssetSurface ? 0.12 : 0.055}
          roughnessMap={textures.roughnessMap}
          roughness={textures.roughnessMap ? 0.72 : 0.78}
          metalness={0.02}
          emissive={body.colors.surfaceDark}
          emissiveIntensity={active ? 0.12 : 0.035}
        />
      </mesh>
      {textures.waterMap ? (
        <mesh ref={waterRef} renderOrder={30.5}>
          <sphereGeometry args={[body.visualRadius * 1.0008, 96, 48]} />
          <meshStandardMaterial
            map={textures.waterMap}
            alphaMap={textures.waterMap}
            color="#8fdcff"
            transparent
            opacity={0.34}
            alphaTest={0.025}
            roughness={0.18}
            metalness={0.04}
            depthWrite={false}
          />
        </mesh>
      ) : null}
      {textures.lightsMap ? (
        <group ref={lightsRef}>
          <PlanetNightLights map={textures.lightsMap} radius={body.visualRadius} active={active} />
        </group>
      ) : null}
      <mesh ref={cloudsRef} renderOrder={31}>
        <sphereGeometry args={[body.visualRadius * (textures.hasAssetClouds ? 1.0015 : 1.004), 96, 48]} />
        <meshStandardMaterial
          map={textures.cloudMap}
          alphaMap={textures.cloudAlphaMap}
          bumpMap={textures.cloudBumpMap}
          bumpScale={textures.cloudBumpMap ? 0.018 : 0}
          color={textures.hasAssetClouds ? "#fff7ef" : "#ffffff"}
          transparent
          opacity={textures.hasAssetClouds ? 0.42 : 0.2}
          alphaTest={textures.hasAssetClouds ? 0.035 : 0}
          roughness={1}
          metalness={0}
          depthWrite={false}
          blending={textures.hasAssetClouds ? THREE.NormalBlending : THREE.AdditiveBlending}
        />
      </mesh>
      {sectorMarkerVisible ? (
        <>
          <mesh scale={1.18} renderOrder={32}>
            <sphereGeometry args={[body.visualRadius * 1.16, 96, 36]} />
            <meshBasicMaterial color={body.colors.glow} transparent opacity={hovered ? 0.16 : 0.08} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide} />
          </mesh>
          <sprite scale={[body.visualRadius * 6.8, body.visualRadius * 6.8, 1]} renderOrder={33}>
            <spriteMaterial map={haloTexture} color={body.colors.glow} transparent opacity={hovered ? 0.24 : 0.12} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
          <line ref={scanRef} rotation={[Math.PI / 2, 0, 0]} renderOrder={34}>
            <LineGeometry points={makeEllipsePoints(body.visualRadius * 2.55, body.visualRadius * 2.55, 150)} />
            <lineBasicMaterial color={body.colors.glow} transparent opacity={0.24} blending={THREE.AdditiveBlending} depthWrite={false} />
          </line>
        </>
      ) : null}
    </group>
  );
}

function SectorHyperspaceRoutes({ map, planets, visible }) {
  const routes = useMemo(() => {
    if (!visible || planets.length < 2) return [];
    return planets.flatMap((planet, index) => (
      planets.slice(index + 1).map(other => {
        const from = mapPointToScene(planetMapPosition(map, planet), map, BODY_Y_OFFSET + 0.012);
        const to = mapPointToScene(planetMapPosition(map, other), map, BODY_Y_OFFSET + 0.012);
        return {
          id: `${planet.id}-${other.id}`,
          points: makeRoutePoints(from, to, 0.045)
        };
      })
    ));
  }, [map, planets, visible]);

  if (!routes.length) return null;

  return (
    <group>
      {routes.map(route => (
        <line key={route.id} renderOrder={28} raycast={() => null}>
          <LineGeometry points={route.points} />
          <lineBasicMaterial color="#9fe8ff" transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} />
        </line>
      ))}
    </group>
  );
}

function SectorPlanetField({ map, view, hoveredPlanetId, onSelectPlanet, onHoverPlanet, hideActivePlanet = false }) {
  const visiblePlanets = useMemo(() => {
    if (view.mode === "galaxy") return map.planets || [];
    if (view.mode === "planet") {
      return (map.planets || []).filter(planet => planet.id === view.planetId);
    }

    return planetsForSector(map, view.sectorId);
  }, [map, view.mode, view.sectorId, view.planetId]);

  return (
    <group>
      <SectorHyperspaceRoutes map={map} planets={visiblePlanets} visible={view.mode === "sector"} />
      {visiblePlanets.map(planet => (
        <PlanetBody
          key={planet.id}
          map={map}
          planet={planet}
          mode={view.mode}
          active={view.planetId === planet.id}
          hovered={hoveredPlanetId === planet.id}
          interactive={view.mode === "sector"}
          hidden={hideActivePlanet && view.planetId === planet.id}
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
      <GalaxyParticles mode="stars" count={counts.stars} seed={4321} opacity={1.08 * opacity} sizeScale={0.78} renderOrder={-9} />
      <GalaxyParticles mode="dust" count={counts.dust} seed={8827} opacity={0.64 * opacity} sizeScale={0.96} renderOrder={-8} />
      <NebulaClouds count={counts.clouds} seed={6410} opacity={0.72 * opacity} renderOrder={-7} />
      <GalacticCore opacity={0.62 * sectorOpacity} />
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
    const tunnelBand = Math.pow(rnd(), 0.55);
    const radius = THREE.MathUtils.lerp(1.2, 16.5, tunnelBand);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * randRange(rnd, 0.7, 1.02);
    const z = randRange(rnd, -102, -4);
    const length = randRange(rnd, 6.2, 18.5);
    const speed = randRange(rnd, 48, 92);
    const idx = i * 6;
    streaks.push({ x, y, z, length, speed, radius });

    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
    positions[idx + 3] = x;
    positions[idx + 4] = y;
    positions[idx + 5] = z - length;

    colors[idx] = 0.72;
    colors[idx + 1] = 0.9;
    colors[idx + 2] = 1;
    colors[idx + 3] = 0.48;
    colors[idx + 4] = 0.72;
    colors[idx + 5] = 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  return { geometry, streaks };
}

function HyperspaceTunnel({ active, phase = "idle", quality, reducedMotion }) {
  const count = (PARTICLE_COUNTS[quality] || PARTICLE_COUNTS.balanced).streaks;
  const { geometry, streaks } = useMemo(() => makeHyperspaceGeometry(count, 7717), [count]);
  const ref = useRef(null);
  const materialRef = useRef(null);
  const opacityRef = useRef(0);
  const exitFadeRef = useRef(0);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ camera, clock }, delta) => {
    if (!ref.current || !materialRef.current) return;
    const exitTarget = active && phase === "reveal" ? 1 : 0;
    exitFadeRef.current = THREE.MathUtils.lerp(exitFadeRef.current, exitTarget, exitTarget ? 0.22 : 0.14);
    const tunnelIntensity = 1 - exitFadeRef.current;
    const targetOpacity = active ? (reducedMotion ? 0.48 : 0.88) * tunnelIntensity : 0;
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
        streak.z = randRange(seededRandom(i + 919), -112, -72);
      }

      const stretch = streak.length * (0.32 + tunnelIntensity * (0.68 + opacityRef.current * (reducedMotion ? 0.9 : 2.7)));
      const tunnelDepth = THREE.MathUtils.clamp((streak.z + 112) / 114, 0, 1);
      const tunnelScale = 0.38 + tunnelDepth * 1.18;
      const pulse = 1 + Math.sin(clock.elapsedTime * 1.8 + i) * 0.024;
      const tailSpread = (0.025 + opacityRef.current * 0.018) * (0.42 + tunnelIntensity * 0.58);
      const idx = i * 6;
      array[idx] = streak.x * tunnelScale * pulse;
      array[idx + 1] = streak.y * tunnelScale * pulse;
      array[idx + 2] = streak.z;
      array[idx + 3] = streak.x * (tunnelScale + tailSpread) * pulse;
      array[idx + 4] = streak.y * (tunnelScale + tailSpread) * pulse;
      array[idx + 5] = streak.z - stretch;
    }
    position.needsUpdate = true;
    materialRef.current.opacity = opacityRef.current;
    materialRef.current.linewidth = active ? 1 + tunnelIntensity * 0.35 : 1;
  });

  return (
    <lineSegments ref={ref} geometry={geometry} visible={false}>
      <lineBasicMaterial ref={materialRef} vertexColors transparent opacity={0} linewidth={1.35} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </lineSegments>
  );
}

function resolveFocus(view, map, elapsedTime = 0) {
  if (view.mode === "planet") {
    const planet = (map.planets || []).find(item => item.id === view.planetId);
    return planet ? mapPointToWorld(planetMapPosition(map, planet), map, BODY_Y_OFFSET, elapsedTime) : WIDE_TARGET.clone();
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

function CameraRig({ map, view, transition, controlsRef, galaxySpinTimeRef }) {
  const { camera, clock } = useThree();
  const activeTransition = useRef(null);
  const lastKey = useRef(null);
  const lastStableView = useRef(view);
  const lastFocusRef = useRef(null);

  useEffect(() => {
    const key = `${view.mode}:${view.sectorId || ""}:${view.planetId || ""}:${transition.token}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    const galaxySpinTime = galaxySpinTimeRef.current;
    const focus = resolveFocus(view, map, galaxySpinTime);
    const targetCamera = resolveCamera(view, map, camera.position, galaxySpinTime);
    const controls = controlsRef.current;
    const kind = transition.kind || view.mode;
    const isPlanetEntry = kind === "planet" && view.mode === "planet";

    if (transition.snap) {
      camera.position.copy(targetCamera);
      if (controls) {
        controls.target.copy(focus);
        controls.enabled = true;
        controls.autoRotate = false;
        controls.autoRotateSpeed = 0;
        controls.update();
      }
      activeTransition.current = null;
      lastStableView.current = view;
      lastFocusRef.current = focus.clone();
      return;
    }

    const entryDirection = isPlanetEntry ? horizontalApproachDirection(focus) : camera.position.clone().sub(focus);
    if (entryDirection.lengthSq() < 0.01) entryDirection.set(1.8, 0.6, 1.8);
    entryDirection.normalize();

    if (isPlanetEntry && transition.phase === "loading") {
      const loadingDistance = transition.reducedMotion ? 30 : PLANET_LOADING_DISTANCE;
      camera.position.copy(focus).add(entryDirection.multiplyScalar(loadingDistance));
      if (controls) {
        controls.target.copy(focus);
        controls.enabled = false;
        controls.autoRotate = false;
        controls.autoRotateSpeed = 0;
        controls.update();
      }
      activeTransition.current = null;
      lastStableView.current = view;
      lastFocusRef.current = focus.clone();
      return;
    }

    const entryDistance = transition.reducedMotion ? 18 : PLANET_ENTRY_DISTANCE;
    const fromCamera = isPlanetEntry
      ? transition.phase === "reveal"
        ? camera.position.clone()
        : focus.clone().add(entryDirection.multiplyScalar(entryDistance))
      : camera.position.clone();

    activeTransition.current = {
      kind,
      startedAt: performance.now(),
      duration: isPlanetEntry ? transition.flightDuration || 1850 : transition.duration || 980,
      fromCamera,
      toCamera: targetCamera,
      fromTarget: isPlanetEntry ? focus.clone() : controls?.target?.clone?.() || WIDE_TARGET.clone(),
      toTarget: focus,
      recoil: isPlanetEntry ? transition.reducedMotion ? 0.12 : 0.95 : 0.08,
      reducedMotion: !!transition.reducedMotion
    };
    if (controls) {
      controls.enabled = false;
      controls.autoRotate = false;
    }
  }, [view, transition, map, camera.position, controlsRef, clock, galaxySpinTimeRef]);

  useFrame(({ clock }) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const galaxySpinTime = galaxySpinTimeRef.current;
    const liveFocus = resolveFocus(view, map, galaxySpinTime);

    const current = activeTransition.current;
    if (current) {
      const liveCamera = resolveCamera(view, map, camera.position, galaxySpinTime);
      const raw = (performance.now() - current.startedAt) / current.duration;
      const capped = Math.min(1, raw);
      const isPlanetEntry = current.kind === "planet" && view.mode === "planet";
      const t = isPlanetEntry ? 1 - Math.pow(1 - capped, 3.4) : smoothstep(0, 1, raw);
      const recoil = isPlanetEntry
        ? 0
        : Math.sin(capped * Math.PI * 2.6) * current.recoil * (1 - t);
      camera.position.copy(current.fromCamera).lerp(liveCamera, t);
      const recoilDirection = liveCamera.clone().sub(liveFocus).normalize();
      camera.position.add(recoilDirection.multiplyScalar(recoil));
      if (isPlanetEntry && !current.reducedMotion) {
        const exitRumble = smoothstep(0.78, 1, capped) * (1 - smoothstep(0.95, 1, capped));
        const travelRumble = Math.sin(capped * Math.PI) * 0.024;
        const rumble = exitRumble * 0.18 + travelRumble;
        camera.position.x += (Math.sin(raw * 211) + Math.sin(raw * 389) * 0.52) * rumble;
        camera.position.y += (Math.cos(raw * 263) + Math.sin(raw * 421) * 0.42) * rumble * 0.58;
        camera.position.z += Math.sin(raw * 337) * rumble * 0.44;
      }
      controls.target.copy(current.fromTarget).lerp(liveFocus, t);
      controls.update();

      if (raw >= 1) {
        activeTransition.current = null;
        lastStableView.current = view;
        controls.enabled = true;
        controls.autoRotate = false;
        controls.autoRotateSpeed = 0;
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
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;
    controls.update();
  });

  return null;
}

function makeBackdropStarGeometry(count, seed, radius) {
  const rnd = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const z = randRange(rnd, -1, 1);
    const angle = rnd() * TAU;
    const shellRadius = radius * randRange(rnd, 0.72, 1);
    const plane = Math.sqrt(Math.max(0, 1 - z * z));
    positions[i * 3] = Math.cos(angle) * plane * shellRadius;
    positions[i * 3 + 1] = z * shellRadius;
    positions[i * 3 + 2] = Math.sin(angle) * plane * shellRadius;

    color.set(rnd() > 0.78 ? "#ffe6bf" : rnd() > 0.52 ? "#d9f2ff" : "#ffffff");
    color.multiplyScalar(randRange(rnd, 0.46, 1));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function CameraAnchoredStars({ count, mode, hyperspaceActive = false }) {
  const ref = useRef(null);
  const materialRef = useRef(null);
  const radius = mode === "planet" ? 92 : 70;
  const geometry = useMemo(() => makeBackdropStarGeometry(mode === "planet" ? count * 3 : count * 2, mode === "planet" ? 9917 : 7163, radius), [count, mode, radius]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ camera }) => {
    if (ref.current) ref.current.position.copy(camera.position);
    if (materialRef.current) {
      const baseOpacity = mode === "planet" ? 0.92 : 0.72;
      const targetOpacity = hyperspaceActive ? 0.06 : baseOpacity;
      materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, targetOpacity, hyperspaceActive ? 0.22 : 0.08);
    }
  });

  return (
    <group ref={ref}>
      <points geometry={geometry} frustumCulled={false} renderOrder={-100}>
        <pointsMaterial
          ref={materialRef}
          vertexColors
          transparent
          opacity={mode === "planet" ? 0.92 : 0.72}
          size={mode === "planet" ? 1.35 : 1.05}
          sizeAttenuation={false}
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

function GalaxyScene({ map, view, hoveredSectorId, hoveredPlanetId, onSelectSector, onHoverSector, onSelectPlanet, onHoverPlanet, onAssetsProgress, onAssetsReady, transition, quality, reducedMotion }) {
  const controlsRef = useRef(null);
  const galaxyRef = useRef(null);
  const galaxySpinTimeRef = useRef(0);
  const selectedPlanet = useMemo(() => (map.planets || []).find(planet => planet.id === view.planetId), [map.planets, view.planetId]);
  const selectedPlanetScenePosition = useMemo(() => selectedPlanet ? mapPointToWorld(planetMapPosition(map, selectedPlanet), map, BODY_Y_OFFSET) : null, [selectedPlanet, map]);
  const hyperspaceActive = transition.kind === "planet" && transition.active && transition.hyperspace && ["loading", "reveal"].includes(transition.phase);
  const hideActivePlanet = transition.kind === "planet" && transition.active && transition.phase === "loading";
  const counts = PARTICLE_COUNTS[quality] || PARTICLE_COUNTS.balanced;

  useFrame((_, delta) => {
    if (!galaxyRef.current) return;
    if (view.mode === "galaxy") galaxySpinTimeRef.current += delta;
    galaxyRef.current.rotation.set(
      GALAXY_BASE_ROTATION_X,
      GALAXY_BASE_ROTATION_Y + galaxySpinTimeRef.current * GALAXY_FLOW_ROTATION_SPEED,
      GALAXY_BASE_ROTATION_Z
    );
  });

  return (
    <>
      <color attach="background" args={["#030105"]} />
      <BackgroundPlanetTextureLoader map={map} onProgress={onAssetsProgress} onReady={onAssetsReady} />
      <PlanetTexturePreloader map={map} view={view} onProgress={onAssetsProgress} onReady={onAssetsReady} />
      <fogExp2 attach="fog" args={["#050107", view.mode === "planet" ? 0.00042 : 0.003]} />
      <ambientLight intensity={view.mode === "planet" ? 0.14 : 0.2} color="#4d1b20" />
      <directionalLight position={[5.6, 3.2, 4.4]} intensity={view.mode === "planet" ? 4.4 : 3.2} color="#ffd8a8" />
      <pointLight position={[0, 1.4, 0]} intensity={view.mode === "planet" ? 0 : 88} distance={19} color="#ffb168" />
      {selectedPlanetScenePosition && view.mode !== "planet" ? (
        <pointLight position={selectedPlanetScenePosition.clone().add(new THREE.Vector3(3.4, 2.2, 2.6)).toArray()} intensity={68} distance={12} color={view.mode === "planet" ? "#ffe2bd" : normalizePlanet(map, selectedPlanet).colors.glow} />
      ) : null}

      <CameraAnchoredStars count={counts.sky} mode={view.mode} hyperspaceActive={hyperspaceActive} />
      <Sparkles count={view.mode === "planet" ? 0 : counts.sparkles} scale={[24, 5.4, 18]} size={1.55} speed={0.44} color="#ff9a3d" opacity={0.72} />
      <HyperspaceTunnel active={hyperspaceActive} phase={transition.phase} quality={quality} reducedMotion={reducedMotion} />

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
          hideActivePlanet={hideActivePlanet}
        />
      </group>

      <CameraRig map={map} view={view} transition={transition} controlsRef={controlsRef} galaxySpinTimeRef={galaxySpinTimeRef} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.07}
        enablePan={false}
        minDistance={view.mode === "planet" ? 1.2 : view.mode === "sector" ? 2.2 : 4.2}
        maxDistance={view.mode === "planet" ? 10.5 : view.mode === "sector" ? 9.2 : 34}
        autoRotate={false}
        autoRotateSpeed={0}
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
      factionId: body.factionId || "neutral",
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
    factionId: "neutral",
    innerRadius: 4.86,
    outerRadius: 6.24,
    startAngleDeg: -60,
    endAngleDeg: -30
  }];

  const baseMap = {
    ...map,
    factions,
    sectors: fallbackSector,
    planets,
    guide: map?.guide || { radius: 6.74, spokeStepDeg: 15, spokeOffsetDeg: 0 },
    title: map?.title || "Galaxy"
  };
  const planetLayout = buildPlanetLayout(baseMap, planets);

  return {
    ...baseMap,
    planets: planets.map(planet => ({
      ...planet,
      layoutPosition: planetLayout.get(planet.id) || planet.position || planet.mapPosition || [0, 0]
    }))
  };
}

function getSectorSummary(map, sectorId) {
  const sector = (map.sectors || []).find(item => item.id === sectorId);
  if (!sector || !drawableSectorCells(sector, map).length) return null;
  const planets = planetsForSector(map, sector.id);
  const controlSummary = sectorControlSummary(map, sector);
  return { sector, faction: controlSummary.winner, planets, control: controlSummary.control, rankedControl: controlSummary.ranked };
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
  const [planetTextureProgress, setPlanetTextureProgress] = useState({ loaded: 0, total: 1 });
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
  const displayedSectorSummary = view.mode === "galaxy"
    ? hoveredSectorSummary || sectorSummary
    : sectorSummary;
  const displayedPlanetSummary = view.mode === "galaxy"
    ? hoveredPlanetSummary || planetSummary
    : planetSummary;
  const panelFaction = displayedPlanetSummary?.faction || displayedSectorSummary?.faction || null;
  const ready = canvasReady && assetsReady;
  const textureProgress = planetTextureProgress.total > 0
    ? (planetTextureProgress.loaded / planetTextureProgress.total) * 100
    : 100;
  const assetProgress = textureProgress;
  const galaxyLoaderProgress = ready ? 100 : Math.min(99, Math.round((canvasReady ? 12 : 3) + assetProgress * 0.86));
  const galaxyLoaderDetail = useMemo(() => ({
    active: !ready,
    progress: galaxyLoaderProgress,
    ready,
    loaded: planetTextureProgress.loaded,
    total: planetTextureProgress.total
  }), [galaxyLoaderProgress, planetTextureProgress.loaded, planetTextureProgress.total, ready]);

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

  const markGalaxyAssetsProgress = useCallback(progress => {
    setPlanetTextureProgress({
      loaded: progress?.loaded || 0,
      total: progress?.total || 0
    });
  }, []);

  useEffect(() => {
    if (view.mode === "planet") setPlanetTextureProgress({ loaded: 0, total: 1 });
  }, [view.mode, view.sectorId, view.planetId]);

  useEffect(() => {
    window.__holonetGalaxyLoaderDetail = galaxyLoaderDetail;
    window.dispatchEvent(new CustomEvent("holonet:galaxy-loader-progress", { detail: galaxyLoaderDetail }));
    if (ready) window.dispatchEvent(new CustomEvent("holonet:galaxy-loader-ready", { detail: galaxyLoaderDetail }));
  }, [galaxyLoaderDetail, ready]);

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
    if (view.mode === "planet" || transition.active) return;
    setHoveredSectorId(null);
    setHoveredPlanetId(null);
    setView({ mode: "sector", sectorId, planetId: null });
    beginTransition("sector");
  }, [view.mode, transition.active, beginTransition]);

  const selectPlanet = useCallback(planetId => {
    if (transition.active) return;

    const planet = (normalizedMap.planets || []).find(item => item.id === planetId);
    if (!planet) return;
    if (view.mode === "planet" && view.planetId === planetId) return;

    clearTransitionTimers();
    setHoveredSectorId(null);
    setHoveredPlanetId(null);

    const wipeDuration = reducedMotion ? 450 : 900;
    const flightDuration = reducedMotion ? 900 : 1850;

    setAssetsReady(false);
    setPlanetTextureProgress({ loaded: 0, total: 1 });
    setTransition(current => ({
      kind: "planet",
      token: current.token,
      active: true,
      phase: "wipe",
      wipeDuration,
      reducedMotion
    }));

    queueTransitionTimer(() => {
      setView({ mode: "planet", sectorId: planet.sectorId, planetId });

      setTransition(current => ({
        kind: "planet",
        token: current.token,
        active: true,
        phase: "loading",
        flightDuration,
        minHyperspaceUntil: performance.now() + (reducedMotion ? 620 : HYPERSPACE_MIN_MS),
        revealQueued: false,
        hyperspace: true,
        reducedMotion
      }));
    }, wipeDuration);
  }, [
    transition.active,
    normalizedMap.planets,
    view.mode,
    view.planetId,
    clearTransitionTimers,
    queueTransitionTimer,
    reducedMotion
  ]);

  useEffect(() => {
    if (
      view.mode !== "planet"
      || !view.planetId
      || !assetsReady
      || transition.kind !== "planet"
      || !transition.active
      || transition.phase !== "loading"
      || transition.revealQueued
    ) {
      return;
    }

    const minDelay = Math.max(0, (transition.minHyperspaceUntil || 0) - performance.now());
    setTransition(current => current.kind === "planet" && current.phase === "loading"
      ? { ...current, revealQueued: true }
      : current
    );
    const startReveal = () => {
      const flightDuration = transition.flightDuration || (reducedMotion ? 900 : 1850);
      setTransition(current => ({
        ...current,
        token: current.token + 1,
        phase: "reveal",
        revealQueued: false,
        duration: flightDuration,
        flightDuration,
        snapTarget: true,
        snap: false
      }));

      queueTransitionTimer(() => {
        setTransition(current => current.kind === "planet"
          ? { ...current, active: false, phase: "idle", snap: false, snapTarget: false, hyperspace: false, minHyperspaceUntil: 0, revealQueued: false }
          : current
        );
      }, flightDuration);
    };

    if (minDelay > 0) {
      queueTransitionTimer(startReveal, minDelay);
      return;
    }
    startReveal();
  }, [assetsReady, queueTransitionTimer, reducedMotion, transition, view.mode]);

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
    : transition.kind === "planet" && transition.active && transition.phase === "reveal"
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
          onPointerMissed={() => {
            if (view.mode === "sector") zoomOut();
          }}
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
            onAssetsProgress={markGalaxyAssetsProgress}
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

        {displayedSectorSummary?.rankedControl?.length ? (
          <div className="gm-control" aria-label="Sector control">
            <div className="gm-control-track">
              {displayedSectorSummary.rankedControl.filter(item => item.percent > 0).map(item => (
                <span
                  key={item.faction.id}
                  className="gm-control-segment"
                  style={{
                    "--segment-color": item.faction.fill || item.faction.color,
                    "--segment-width": `${item.percent}%`
                  }}
                />
              ))}
            </div>
            <div className="gm-control-legend">
              {displayedSectorSummary.rankedControl.filter(item => item.percent > 0).map(item => (
                <span key={item.faction.id}>
                  <i style={{ "--segment-color": item.faction.glow || item.faction.color }} />
                  {item.faction.shortName || item.faction.name} {item.percent}%
                </span>
              ))}
            </div>
          </div>
        ) : null}

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

  body:has(.gm-root) .site-header,
  body:has(.gm-root) .site-nav {
    z-index: 3000 !important;
  }

  body:has(.gm-root) #app > .status-bar,
  body:has(.gm-root) #app > footer {
    display: none;
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
      180deg,
      rgba(255, 255, 255, 0.035) 0px,
      rgba(255, 255, 255, 0.035) 1px,
      transparent 1px,
      transparent 4px
    );
  mix-blend-mode: screen;
  opacity: .28;
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
    --gm-topbar-inset: clamp(12px, 1.2vw, 18px);
    --gm-topbar-card-size: 54px;
    align-items: stretch;
    display: flex;
    gap: 12px;
    height: var(--gm-topbar-card-size);
    justify-content: flex-start;
    left: var(--gm-topbar-inset);
    max-width: min(560px, calc(100vw - var(--gm-topbar-inset) - var(--gm-topbar-inset)));
    padding: 0;
    position: absolute;
    right: auto;
    text-align: left;
    top: calc(var(--nav-height, 62px) + 14px + var(--gm-topbar-inset));
    width: auto;
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
    flex: 0 0 var(--gm-topbar-card-size);
    height: 100%;
    justify-content: center;
    padding: 0;
    transition: border-color .18s ease, box-shadow .18s ease, color .18s ease, transform .18s ease;
    width: var(--gm-topbar-card-size);
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
  .gm-panel {
    background:
      linear-gradient(135deg, var(--theme-wash, rgba(192, 0, 26, .035)), transparent 62%),
      var(--gm-panel);
    border: 1px solid var(--theme-accent-dim, #7a1a28);
    box-shadow: 0 0 30px var(--theme-accent-glow, rgba(255, 59, 79, .18)), inset 0 0 34px rgba(255, 255, 255, .02);
    clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
  }

  .gm-lockup {
    align-content: center;
    display: grid;
    gap: 3px;
    height: 100%;
    min-height: 0;
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

  .gm-control {
    display: grid;
    gap: 8px;
    margin-top: 13px;
  }

  .gm-control-track {
    background: rgba(0, 0, 0, .28);
    border: 1px solid color-mix(in srgb, var(--panel-color) 38%, transparent);
    display: flex;
    height: 11px;
    overflow: hidden;
  }

  .gm-control-segment {
    background: var(--segment-color);
    box-shadow: 0 0 14px color-mix(in srgb, var(--segment-color) 72%, transparent);
    flex: 0 0 var(--segment-width);
    min-width: 2px;
  }

  .gm-control-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
  }

  .gm-control-legend span {
    align-items: center;
    color: var(--text-dim, #f2d8d8);
    display: inline-flex;
    font-size: .62rem;
    gap: 6px;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .gm-control-legend i {
    background: var(--segment-color);
    box-shadow: 0 0 10px var(--segment-color);
    display: inline-block;
    height: 7px;
    width: 7px;
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
      --gm-topbar-inset: clamp(10px, 3vw, 14px);
      --gm-topbar-card-size: 50px;
      left: var(--gm-topbar-inset);
      max-width: none;
      right: var(--gm-topbar-inset);
      top: calc(var(--nav-height, 56px) + 12px + var(--gm-topbar-inset));
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

    .gm-panel.is-galaxy .gm-selectors {
      max-height: 42px;
      scroll-snap-type: y mandatory;
    }

    .gm-panel.is-galaxy .gm-selector {
      min-height: 42px;
      scroll-snap-align: start;
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
