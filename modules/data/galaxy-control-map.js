export const GALAXY_CONTROL_MAP = {
  title: "Galaxy",
  sources: [],
  factions: [
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
  ],
  regions: [
    { id: "deep-core", name: "Deep Core", radius: [0, 0.72] },
    { id: "core", name: "Core Worlds", radius: [0.72, 1.42] },
    { id: "colonies", name: "Colonies", radius: [1.42, 2.05] },
    { id: "inner-rim", name: "Inner Rim", radius: [2.05, 2.85] },
    { id: "expansion", name: "Expansion Region", radius: [2.85, 3.72] },
    { id: "mid-rim", name: "Mid Rim", radius: [3.72, 4.86] },
    { id: "outer-rim", name: "Outer Rim", radius: [4.86, 6.24] },
    { id: "wild-space", name: "Wild Space", radius: [6.24, 6.9] }
  ],
  guide: {
    radius: 6.9,
    spokeStepDeg: 15,
    spokeOffsetDeg: 0,
    tessellation: { angles: [-180, -165, -150, -133, -116, -100, -84, -68, -52, -38, -24, -8, 8, 23, 38, 53, 68, 84, 100, 116, 132, 148, 164, 180, 196, 212, 228, 244, 260, 277, 294, 312, 330, 345, 360], rings: [0.28, 0.72, 1.42, 2.05, 2.85, 3.72, 4.86, 5.58, 6.24, 6.74, 6.9] }
  },
  sectors: [
    { id: "tython-deep-core", name: "Tython Deep Core", regionId: "deep-core", grid: "K-10", factionId: "neutral", placementConfidence: "Approximate Legends/Old Republic placement", innerRadius: 0.16, outerRadius: 0.86, startAngleDeg: -150, endAngleDeg: -96 , cells: [[2, 6, 0, 1]]},
    { id: "coruscant", name: "Coruscant Sector", regionId: "core", grid: "L-9", factionId: "neutral", placementConfidence: "Core Worlds / Republic capital broad placement", innerRadius: 0.42, outerRadius: 1.28, startAngleDeg: -96, endAngleDeg: -36 , cells: [[6, 10, 0, 2]]},
    { id: "corellian", name: "Corellian Sector", regionId: "core", grid: "M-10", factionId: "neutral", placementConfidence: "Core Worlds broad placement", innerRadius: 0.78, outerRadius: 1.58, startAngleDeg: -36, endAngleDeg: 20 , cells: [[10, 14, 1, 2]]},
    { id: "kuat", name: "Kuat Sector", regionId: "core", grid: "M-9", factionId: "neutral", placementConfidence: "Core Worlds broad placement", innerRadius: 0.72, outerRadius: 1.52, startAngleDeg: 20, endAngleDeg: 82 , cells: [[14, 18, 1, 2]]},
    { id: "alderaan", name: "Alderaan Sector", regionId: "core", grid: "M-10", factionId: "neutral", placementConfidence: "Core Worlds broad placement", innerRadius: 0.7, outerRadius: 1.46, startAngleDeg: 82, endAngleDeg: 148 , cells: [[18, 22, 1, 2]]},
    { id: "alsakan", name: "Alsakan Sector", regionId: "core", grid: "L-10", factionId: "neutral", placementConfidence: "Core Worlds broad placement", innerRadius: 0.58, outerRadius: 1.38, startAngleDeg: 148, endAngleDeg: 210 , cells: [[22, 26, 0, 2]]},
    { id: "brentaal", name: "Brentaal Sector", regionId: "colonies", grid: "L-9", factionId: "neutral", placementConfidence: "Colonies / major route broad placement", innerRadius: 1.34, outerRadius: 2.24, startAngleDeg: -160, endAngleDeg: -106 , cells: [[0, 4, 2, 3]]},
    { id: "duro", name: "Duro Sector", regionId: "colonies", grid: "M-10", factionId: "neutral", placementConfidence: "Colonies broad placement", innerRadius: 1.36, outerRadius: 2.18, startAngleDeg: -106, endAngleDeg: -56 , cells: [[4, 8, 2, 3]]},
    { id: "tapani", name: "Tapani Sector", regionId: "colonies", grid: "M-11", factionId: "neutral", placementConfidence: "Colonies/Inner Rim broad placement", innerRadius: 1.5, outerRadius: 2.4, startAngleDeg: -56, endAngleDeg: 4 , cells: [[8, 10, 2, 4], [10, 12, 2, 3]]},
    { id: "hapes", name: "Hapes Cluster", regionId: "inner-rim", grid: "O-8", factionId: "neutral", placementConfidence: "Legends cluster placement approximated", innerRadius: 1.84, outerRadius: 2.86, startAngleDeg: 4, endAngleDeg: 52 , cells: [[12, 16, 3, 4]]},
    { id: "manaan", name: "Manaan Sector", regionId: "inner-rim", grid: "O-11", factionId: "neutral", placementConfidence: "Old Republic / Inner Rim broad placement", innerRadius: 1.96, outerRadius: 2.82, startAngleDeg: 52, endAngleDeg: 112 , cells: [[16, 20, 3, 4]]},
    { id: "onderon", name: "Onderon Sector", regionId: "inner-rim", grid: "O-9", factionId: "neutral", placementConfidence: "Old Republic / Inner Rim broad placement", innerRadius: 2.04, outerRadius: 3.02, startAngleDeg: 112, endAngleDeg: 176 , cells: [[20, 24, 3, 4], [22, 24, 4, 5]]},
    { id: "balmorra", name: "Balmorra Sector", regionId: "expansion", grid: "M-10", factionId: "neutral", placementConfidence: "Old Republic campaign-world broad placement", innerRadius: 2.66, outerRadius: 3.86, startAngleDeg: -172, endAngleDeg: -128 , cells: [[0, 4, 4, 5]]},
    { id: "taris", name: "Taris Sector", regionId: "outer-rim", grid: "M-10", factionId: "neutral", placementConfidence: "Old Republic campaign-world broad placement", innerRadius: 2.84, outerRadius: 4.22, startAngleDeg: -128, endAngleDeg: -88 , cells: [[4, 6, 4, 6]]},
    { id: "bothan-space", name: "Bothan Space", regionId: "mid-rim", grid: "R-14", factionId: "neutral", placementConfidence: "Mid Rim Legends broad placement", innerRadius: 3.08, outerRadius: 4.62, startAngleDeg: -88, endAngleDeg: -42 , cells: [[6, 10, 5, 6]]},
    { id: "mandalore", name: "Mandalore Sector", regionId: "outer-rim", grid: "O-7", factionId: "neutral", placementConfidence: "Mandalorian space broad placement", innerRadius: 3.36, outerRadius: 5.04, startAngleDeg: -42, endAngleDeg: 6 , cells: [[10, 12, 5, 7]]},
    { id: "tion-cluster", name: "Tion Cluster", regionId: "outer-rim", grid: "S-5", factionId: "neutral", placementConfidence: "Legends Tion region broad placement", innerRadius: 3.14, outerRadius: 4.58, startAngleDeg: 6, endAngleDeg: 50 , cells: [[12, 16, 4, 6]]},
    { id: "kanz", name: "Kanz Sector", regionId: "mid-rim", grid: "O-12", factionId: "neutral", placementConfidence: "Legends sector broad placement", innerRadius: 3.2, outerRadius: 4.78, startAngleDeg: 50, endAngleDeg: 92 , cells: [[16, 18, 4, 6]]},
    { id: "voss", name: "Voss Sector", regionId: "outer-rim", grid: "S-7", factionId: "neutral", placementConfidence: "Old Republic campaign-world broad placement", innerRadius: 3.62, outerRadius: 5.18, startAngleDeg: 92, endAngleDeg: 136 , cells: [[18, 22, 5, 7]]},
    { id: "belsavis", name: "Belsavis Sector", regionId: "outer-rim", grid: "Q-16", factionId: "neutral", placementConfidence: "Old Republic campaign-world broad placement", innerRadius: 3.94, outerRadius: 5.36, startAngleDeg: 136, endAngleDeg: 178 , cells: [[22, 26, 5, 7]]},
    { id: "esstran", name: "Esstran Sector", regionId: "outer-rim", grid: "R-5", factionId: "sith-empire", placementConfidence: "Legends placement: Esstran sector in the Outer Rim, containing Sith Worlds and major Old Republic Sith worlds.", innerRadius: 4.72, outerRadius: 6.24, startAngleDeg: -64, endAngleDeg: -32, localView: { innerRadius: 0.72, outerRadius: 6.24, startAngleDeg: -30, endAngleDeg: 30 }, objectives: [], activeWars: ["Ak'tuun vs Kalazar"], surveyStars: [{ id: "esstran-a", position: [3.46, -4.22], size: 0.045 }, { id: "esstran-b", position: [4.15, -3.62], size: 0.035 }, { id: "esstran-c", position: [4.26, -4.16], size: 0.032 }, { id: "esstran-d", position: [5.24, -3.26], size: 0.04 }, { id: "esstran-e", position: [4.62, -3.72], size: 0.034 }] , cells: [[8, 10, 6, 8]]},
    { id: "dromund", name: "Dromund Sector", regionId: "outer-rim", grid: "S-5", factionId: "neutral", placementConfidence: "Sith Empire / Dromund Kaas broad placement", innerRadius: 4.96, outerRadius: 6.4, startAngleDeg: -32, endAngleDeg: -4 , cells: [[10, 12, 6, 8]]},
    { id: "hutt-space", name: "Hutt Space", regionId: "outer-rim", grid: "S-12", factionId: "neutral", placementConfidence: "Legends Hutt Space broad placement", innerRadius: 4.68, outerRadius: 6.5, startAngleDeg: -4, endAngleDeg: 28 , cells: [[12, 14, 6, 9], [13, 14, 9, 10]]},
    { id: "arkanis", name: "Arkanis Sector", regionId: "outer-rim", grid: "R-16", factionId: "neutral", placementConfidence: "Outer Rim Legends broad placement", innerRadius: 4.88, outerRadius: 6.34, startAngleDeg: 28, endAngleDeg: 56 , cells: [[14, 16, 6, 8]]},
    { id: "anoat", name: "Anoat Sector", regionId: "outer-rim", grid: "K-18", factionId: "neutral", placementConfidence: "Outer Rim Legends broad placement", innerRadius: 4.72, outerRadius: 6.28, startAngleDeg: 56, endAngleDeg: 84 , cells: [[16, 18, 6, 8]]},
    { id: "gordian-reach", name: "Gordian Reach", regionId: "outer-rim", grid: "P-6", factionId: "neutral", placementConfidence: "Outer Rim Legends sector placement", innerRadius: 4.8, outerRadius: 6.36, startAngleDeg: 84, endAngleDeg: 112 , cells: [[18, 20, 6, 8]]},
    { id: "corporate-sector", name: "Corporate Sector", regionId: "outer-rim", grid: "S-4", factionId: "neutral", placementConfidence: "Outer Rim Legends broad placement", innerRadius: 4.9, outerRadius: 6.62, startAngleDeg: 112, endAngleDeg: 142 , cells: [[20, 22, 6, 9], [20, 21, 9, 10]]},
    { id: "tingel-arm", name: "Tingel Arm", regionId: "outer-rim", grid: "T-3", factionId: "neutral", placementConfidence: "Outer Rim / galactic arm broad placement", innerRadius: 5.04, outerRadius: 6.72, startAngleDeg: 142, endAngleDeg: 170 , cells: [[22, 24, 7, 9], [23, 24, 9, 10]]},
    { id: "minos-cluster", name: "Minos Cluster", regionId: "outer-rim", grid: "K-19", factionId: "neutral", placementConfidence: "Outer Rim Legends broad placement", innerRadius: 5.02, outerRadius: 6.44, startAngleDeg: 170, endAngleDeg: 202 , cells: [[24, 26, 7, 8]]},
    { id: "kathol", name: "Kathol Sector", regionId: "outer-rim", grid: "J-20", factionId: "neutral", placementConfidence: "Outer Rim Legends broad placement", innerRadius: 5.18, outerRadius: 6.7, startAngleDeg: 202, endAngleDeg: 232 , cells: [[26, 28, 7, 9], [26, 27, 9, 10]]},
    { id: "rishi-maze", name: "Rishi Maze Approaches", regionId: "wild-space", grid: "S-15", factionId: "neutral", placementConfidence: "Wild Space / satellite-galaxy approach approximated", innerRadius: 5.28, outerRadius: 6.74, startAngleDeg: 232, endAngleDeg: 262 , cells: [[28, 30, 7, 9], [29, 30, 9, 10]]},
    { id: "ilum-frontier", name: "Ilum Frontier", regionId: "outer-rim", grid: "G-7", factionId: "neutral", placementConfidence: "Old Republic Ilum frontier broad placement", innerRadius: 5.06, outerRadius: 6.42, startAngleDeg: 262, endAngleDeg: 296 , cells: [[30, 34, 6, 8]]}
  ],
  planets: [
    {
      id: "korriban",
      name: "Korriban / Moraband",
      shortName: "Korriban",
      sectorId: "esstran",
      regionId: "outer-rim",
      factionId: "sith-empire",
      grid: "R-5",
      position: [3.92, -3.92],
      radius: 0.018,
      placementConfidence: "Canonical broad placement: Sith Worlds, Esstran sector, Outer Rim",
      contested: false,
      objectives: ["Watch Torreto do his Hell Jacks"],
      locations: ["Sith Temple", "Dark Tombs"],
      robloxPlaceId: 1177256329,
      robloxLaunchUrl: "roblox://experiences/start?placeId=1177256329",
      summary: "Homeworld of the Sith and location of the Sith Academy."
    }
  ]
};

export function factionById(map, id) {
  return (map.factions || []).find(faction => faction.id === id) || map.factions?.[0] || null;
}

export function planetsForSector(map, sectorId) {
  return (map.planets || []).filter(planet => planet.sectorId === sectorId);
}

export function controlForSector(map, sectorId) {
  const planets = planetsForSector(map, sectorId);
  const totals = Object.fromEntries((map.factions || []).map(faction => [faction.id, 0]));
  if (!planets.length) return totals;

  planets.forEach(planet => {
    totals[planet.factionId] = (totals[planet.factionId] || 0) + 1;
  });

  Object.keys(totals).forEach(key => {
    totals[key] = Math.round((totals[key] / planets.length) * 100);
  });

  return totals;
}


