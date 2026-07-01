import { GALAXY_CONTROL_MAP as BASE_GALAXY_CONTROL_MAP } from "./galaxy-control-map.js";

const REGION_CELL_COUNTS = {
  "deep-core": 4,
  core: 6,
  colonies: 8,
  "inner-rim": 10,
  expansion: 12,
  "mid-rim": 16,
  "outer-rim": 24,
  "wild-space": 32
};

const TESSELLATION_SEED = 9341;

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

function hashString(value = "galaxy") {
  return Array.from(value).reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
}

function roundAngle(angle) {
  return Math.round(angle * 1000) / 1000;
}

function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

function circularDistance(a, b) {
  const delta = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(delta, 360 - delta);
}

function sectorAnchor(sector) {
  return ((sector.startAngleDeg || 0) + (sector.endAngleDeg || 0)) / 2;
}

function sectorRadialOverlap(sector, innerRadius, outerRadius) {
  const inner = sector.innerRadius ?? 0;
  const outer = sector.outerRadius ?? 0;
  return Math.max(0, Math.min(outer, outerRadius) - Math.max(inner, innerRadius));
}

function makeIrregularAngles(regionId, count) {
  const rnd = seededRandom(TESSELLATION_SEED + hashString(regionId));
  const weights = Array.from({ length: count }, (_, index) => {
    const broadSweep = Math.sin(index * 1.73 + hashString(regionId) * 0.0009) * 0.14;
    return Math.max(0.55, 1 + broadSweep + (rnd() - 0.5) * 0.5);
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const angles = [-180];
  let cursor = -180;

  weights.forEach((weight, index) => {
    if (index === weights.length - 1) {
      cursor = 180;
    } else {
      cursor += (weight / totalWeight) * 360;
    }
    angles.push(roundAngle(cursor));
  });

  angles[angles.length - 1] = 180;
  return angles;
}

function assignSectorForCell(candidates, angleMid, innerRadius, outerRadius) {
  return candidates.reduce((best, sector) => {
    const angleScore = circularDistance(sectorAnchor(sector), angleMid);
    const radialBonus = sectorRadialOverlap(sector, innerRadius, outerRadius) * 18;
    const score = angleScore - radialBonus;
    if (!best || score < best.score) return { sector, score };
    return best;
  }, null)?.sector || candidates[0];
}

function buildProceduralTessellation(map) {
  const ringRadii = map.regions.reduce((radii, region, index) => {
    if (index === 0) radii.push(Math.max(0.12, region.radius[0] || 0));
    radii.push(region.radius[1]);
    return radii;
  }, []);
  const allAngles = new Set([-180, 180]);
  const ringAngles = new Map();

  map.regions.forEach(region => {
    const angles = makeIrregularAngles(region.id, REGION_CELL_COUNTS[region.id] || 12);
    ringAngles.set(region.id, angles);
    angles.forEach(angle => allAngles.add(angle));
  });

  const tessellationAngles = Array.from(allAngles).sort((a, b) => a - b);
  const angleIndex = new Map(tessellationAngles.map((angle, index) => [angle, index]));
  const cellsBySector = new Map(map.sectors.map(sector => [sector.id, []]));

  map.regions.forEach((region, ringIndex) => {
    const innerRadius = ringRadii[ringIndex];
    const outerRadius = ringRadii[ringIndex + 1];
    const angles = ringAngles.get(region.id) || [-180, 180];
    const ownRegion = map.sectors.filter(sector => sector.regionId === region.id);
    const radialMatches = map.sectors.filter(sector => sectorRadialOverlap(sector, innerRadius, outerRadius) > 0.1);
    const rimMatches = region.id === "wild-space"
      ? map.sectors.filter(sector => ["outer-rim", "wild-space"].includes(sector.regionId))
      : [];
    const candidates = [...new Map([...ownRegion, ...radialMatches, ...rimMatches].map(sector => [sector.id, sector])).values()];
    const usableCandidates = candidates.length ? candidates : map.sectors;

    for (let index = 0; index < angles.length - 1; index += 1) {
      const startAngle = angles[index];
      const endAngle = angles[index + 1];
      const angleMid = (startAngle + endAngle) / 2;
      const sector = assignSectorForCell(usableCandidates, angleMid, innerRadius, outerRadius);
      cellsBySector.get(sector.id)?.push([
        angleIndex.get(startAngle),
        angleIndex.get(endAngle),
        ringIndex,
        ringIndex + 1
      ]);
    }
  });

  map.sectors.forEach(sector => {
    if (cellsBySector.get(sector.id)?.length) return;
    const regionIndex = Math.max(0, map.regions.findIndex(region => region.id === sector.regionId));
    const region = map.regions[regionIndex] || map.regions[0];
    const angles = ringAngles.get(region.id) || [-180, 180];
    const anchor = sectorAnchor(sector);
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let index = 0; index < angles.length - 1; index += 1) {
      const distance = circularDistance(anchor, (angles[index] + angles[index + 1]) / 2);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    cellsBySector.set(sector.id, [[
      angleIndex.get(angles[bestIndex]),
      angleIndex.get(angles[bestIndex + 1]),
      regionIndex,
      regionIndex + 1
    ]]);
  });

  return {
    angles: tessellationAngles,
    rings: ringRadii,
    cellsBySector
  };
}

export function withProceduralSectorCells(map) {
  const { angles, rings, cellsBySector } = buildProceduralTessellation(map);
  return {
    ...map,
    guide: {
      ...map.guide,
      tessellation: {
        angles,
        rings,
        strategy: "seeded full-coverage polar tessellation"
      }
    },
    sectors: map.sectors.map(sector => ({
      ...sector,
      cells: cellsBySector.get(sector.id) || []
    }))
  };
}

export const GALAXY_CONTROL_MAP = withProceduralSectorCells(BASE_GALAXY_CONTROL_MAP);
