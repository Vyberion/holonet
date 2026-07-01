import { GALAXY_CONTROL_MAP as BASE_GALAXY_CONTROL_MAP } from "./galaxy-control-map.js";

const BASE_ANGLE_STEP_DEG = 5;
const ANGLE_LATTICE_STEPS = Math.round(360 / BASE_ANGLE_STEP_DEG);
const MIN_CORE_RADIUS = 0.28;

const REGION_CELL_COUNTS = {
  "deep-core": 36,
  core: 36,
  colonies: 36,
  "inner-rim": 36,
  expansion: 36,
  "mid-rim": 36,
  "outer-rim": 72,
  "wild-space": 72
};

const MAX_SECTOR_ANGLE_SPAN_BY_REGION = {
  "deep-core": 18,
  core: 20,
  colonies: 24,
  "inner-rim": 28,
  expansion: 32,
  "mid-rim": 34,
  "outer-rim": 36,
  "wild-space": 36
};

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

function sectorAngleSpan(sector) {
  const start = sector.startAngleDeg || 0;
  const end = sector.endAngleDeg ?? start + 24;
  let span = end - start;
  while (span <= 0) span += 360;
  return Math.min(span, 360);
}

function sectorMidRadius(sector) {
  return ((sector.innerRadius || MIN_CORE_RADIUS) + (sector.outerRadius || 0)) / 2;
}

function sectorRadialOverlap(sector, innerRadius, outerRadius) {
  const inner = sector.innerRadius ?? 0;
  const outer = sector.outerRadius ?? 0;
  return Math.max(0, Math.min(outer, outerRadius) - Math.max(inner, innerRadius));
}

function uniqueSectors(sectors) {
  return [...new Map(sectors.map(sector => [sector.id, sector])).values()];
}

function latticeAngle(index) {
  return roundAngle(-180 + index * BASE_ANGLE_STEP_DEG);
}

function makeRingAngleIndexes(regionId) {
  const count = REGION_CELL_COUNTS[regionId] || 36;
  const stride = Math.max(1, Math.round(ANGLE_LATTICE_STEPS / count));
  const indexes = [];

  for (let index = 0; index < ANGLE_LATTICE_STEPS; index += stride) {
    indexes.push(index);
  }

  if (indexes[indexes.length - 1] !== ANGLE_LATTICE_STEPS) indexes.push(ANGLE_LATTICE_STEPS);
  return indexes;
}

function assignSectorForCell(candidates, cell, region) {
  const angleMid = (cell.startAngleDeg + cell.endAngleDeg) / 2;
  const radiusMid = (cell.innerRadius + cell.outerRadius) / 2;

  return candidates.reduce((best, sector) => {
    const angleScore = circularDistance(sectorAnchor(sector), angleMid);
    const radiusScore = Math.abs(sectorMidRadius(sector) - radiusMid) * 10;
    const radialBonus = sectorRadialOverlap(sector, cell.innerRadius, cell.outerRadius) * 18;
    const regionPenalty = sector.regionId === region.id ? 0 : 18;
    const score = angleScore + radiusScore + regionPenalty - radialBonus;
    if (!best || score < best.score) return { sector, score };
    return best;
  }, null)?.sector || candidates[0];
}

function makeRingRadii(map) {
  return map.regions.reduce((radii, region, index) => {
    if (index === 0) radii.push(Math.max(MIN_CORE_RADIUS, region.radius[0] || 0));
    radii.push(region.radius[1]);
    return radii;
  }, []);
}

function buildStructuralCells(map, rings, angles) {
  const cells = [];

  map.regions.forEach((region, ringIndex) => {
    const innerRadius = rings[ringIndex];
    const outerRadius = rings[ringIndex + 1];
    const ringAngles = makeRingAngleIndexes(region.id);

    for (let index = 0; index < ringAngles.length - 1; index += 1) {
      const angleStartIndex = ringAngles[index];
      const angleEndIndex = ringAngles[index + 1];
      cells.push({
        id: `${region.id}:${ringIndex}:${angleStartIndex}-${angleEndIndex}`,
        regionId: region.id,
        ringIndex,
        angleStartIndex,
        angleEndIndex,
        ringStartIndex: ringIndex,
        ringEndIndex: ringIndex + 1,
        innerRadius,
        outerRadius,
        startAngleDeg: angles[angleStartIndex],
        endAngleDeg: angles[angleEndIndex]
      });
    }
  });

  return cells;
}

function candidatesForCell(map, region, cell) {
  const sameRegion = map.sectors.filter(sector => sector.regionId === region.id);
  const radialMatches = map.sectors.filter(sector => sectorRadialOverlap(sector, cell.innerRadius, cell.outerRadius) > 0.08);
  const rimMatches = region.id === "wild-space"
    ? map.sectors.filter(sector => ["outer-rim", "wild-space"].includes(sector.regionId))
    : [];
  const candidates = uniqueSectors([...sameRegion, ...radialMatches, ...rimMatches]);
  return candidates.length ? candidates : map.sectors;
}

function cellFitsSector(cell, sector) {
  const cellAngleMid = (cell.startAngleDeg + cell.endAngleDeg) / 2;
  const cellAngleSpan = Math.abs(cell.endAngleDeg - cell.startAngleDeg);
  const maxAngleSpan = MAX_SECTOR_ANGLE_SPAN_BY_REGION[sector.regionId] || 36;
  const sectorHalfSpan = Math.min(sectorAngleSpan(sector), maxAngleSpan) / 2;
  const angularAllowance = sectorHalfSpan + cellAngleSpan * 0.5 + 0.25;
  const angleFits = circularDistance(sectorAnchor(sector), cellAngleMid) <= angularAllowance;
  const radialOverlap = sectorRadialOverlap(sector, cell.innerRadius, cell.outerRadius);
  const cellThickness = Math.max(0.01, cell.outerRadius - cell.innerRadius);
  const radiusMid = (cell.innerRadius + cell.outerRadius) / 2;
  const radialPadding = Math.max(0.1, cellThickness * 0.18);
  const radialFits = radialOverlap >= Math.min(0.12, cellThickness * 0.32)
    || (radiusMid >= (sector.innerRadius || MIN_CORE_RADIUS) - radialPadding
      && radiusMid <= (sector.outerRadius || cell.outerRadius) + radialPadding);

  return angleFits && radialFits;
}

function scoreCellForSector(cell, sector) {
  const angleMid = (cell.startAngleDeg + cell.endAngleDeg) / 2;
  const radiusMid = (cell.innerRadius + cell.outerRadius) / 2;
  const regionPenalty = cell.regionId === sector.regionId ? 0 : 22;
  return circularDistance(sectorAnchor(sector), angleMid)
    + Math.abs(sectorMidRadius(sector) - radiusMid) * 10
    + regionPenalty
    - sectorRadialOverlap(sector, cell.innerRadius, cell.outerRadius) * 14;
}

function reassignClosestCell(sector, structuralCells, cellsBySector) {
  const fittingCells = structuralCells.filter(cell => cellFitsSector(cell, sector));
  const candidateCells = fittingCells.length ? fittingCells : structuralCells;
  const best = candidateCells.reduce((winner, cell) => {
    const ownerPenalty = cell.ownerSectorId ? 18 : 0;
    const score = scoreCellForSector(cell, sector) + ownerPenalty;
    if (!winner || score < winner.score) return { cell, score };
    return winner;
  }, null)?.cell;

  if (!best) return;

  const previousCells = cellsBySector.get(best.ownerSectorId) || [];
  const previousIndex = previousCells.indexOf(best);
  if (previousIndex >= 0) previousCells.splice(previousIndex, 1);

  best.ownerSectorId = sector.id;
  cellsBySector.get(sector.id)?.push(best);
}

function serializeSectorCells(cells) {
  return cells
    .sort((a, b) => a.ringStartIndex - b.ringStartIndex || a.angleStartIndex - b.angleStartIndex)
    .map(cell => [
      cell.angleStartIndex,
      cell.angleEndIndex,
      cell.ringStartIndex,
      cell.ringEndIndex
    ]);
}

function buildProceduralTessellation(map) {
  const rings = makeRingRadii(map);
  const angles = Array.from({ length: ANGLE_LATTICE_STEPS + 1 }, (_, index) => latticeAngle(index));
  const structuralCells = buildStructuralCells(map, rings, angles);
  const cellsBySector = new Map(map.sectors.map(sector => [sector.id, []]));

  structuralCells.forEach(cell => {
    const region = map.regions[cell.ringIndex] || map.regions[0];
    const candidates = candidatesForCell(map, region, cell).filter(sector => cellFitsSector(cell, sector));
    if (!candidates.length) return;

    const sector = assignSectorForCell(candidates, cell, region);
    cell.ownerSectorId = sector.id;
    cellsBySector.get(sector.id)?.push(cell);
  });

  map.sectors.forEach(sector => {
    if (cellsBySector.get(sector.id)?.length) return;
    reassignClosestCell(sector, structuralCells, cellsBySector);
  });

  return {
    angles,
    rings,
    structuralCells,
    cellsBySector: new Map([...cellsBySector.entries()].map(([sectorId, cells]) => [sectorId, serializeSectorCells(cells)]))
  };
}

export function withProceduralSectorCells(map) {
  const { angles, rings, structuralCells, cellsBySector } = buildProceduralTessellation(map);
  return {
    ...map,
    guide: {
      ...map.guide,
      tessellation: {
        angles,
        rings,
        cells: structuralCells.map(cell => ({
          id: cell.id,
          sectorId: cell.ownerSectorId,
          regionId: cell.regionId,
          innerRadius: cell.innerRadius,
          outerRadius: cell.outerRadius,
          startAngleDeg: cell.startAngleDeg,
          endAngleDeg: cell.endAngleDeg,
          angle: [cell.angleStartIndex, cell.angleEndIndex],
          ring: [cell.ringStartIndex, cell.ringEndIndex]
        })),
        strategy: "footprint-limited polar lattice with hidden structural cells"
      }
    },
    sectors: map.sectors.map(sector => ({
      ...sector,
      cells: cellsBySector.get(sector.id) || []
    }))
  };
}

export const GALAXY_CONTROL_MAP = withProceduralSectorCells(BASE_GALAXY_CONTROL_MAP);
