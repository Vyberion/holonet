export const GALAXY_CONTROL_MAP = {
  title: "Galaxy",
  sources: [],
  regions: [
    { id: "deep-core", name: "Deep Core", radius: [0, 0.72] },
    { id: "core", name: "Core Worlds", radius: [0.72, 1.42] },
    { id: "colonies", name: "Colonies", radius: [1.42, 2.05] },
    { id: "inner-rim", name: "Inner Rim", radius: [2.05, 2.85] },
    { id: "expansion", name: "Expansion Region", radius: [2.85, 3.72] },
    { id: "mid-rim", name: "Mid Rim", radius: [3.72, 4.86] },
    { id: "outer-rim", name: "Outer Rim", radius: [4.86, 6.24] },
    { id: "wild-space", name: "Wild Space", radius: [6.24, 7.0] }
  ],
  // Cleaned map data: sector shapes now come from polar cells only.
  // No legacy smooth edge radii or sinusoidal rim warping.
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
  guide: {
    radius: 7.0,
    tessellation: {
      angles: [-180, -165, -150, -133, -116, -100, -84, -68, -52, -38, -24, -8, 8, 23, 38, 53, 68, 84, 100, 116, 132, 148, 164, 180, 196, 212, 228, 244, 260, 277, 294, 312, 330, 345, 360],
      // The last two rings are deliberately short so protrusions are small
      // cell-shaped caps, not full-height outer-rim blocks.
      rings: [0.28, 0.72, 1.42, 2.05, 2.85, 3.72, 4.86, 5.58, 6.24, 6.52, 6.74, 6.88, 7.0]
    }
  },
  sectors: [
    {
      id: "tython-deep-core",
      name: "Tython Deep Core",
      regionId: "deep-core",
      grid: "K-10",
      factionId: "neutral",
      cells: [[2, 6, 0, 1]]
    },
    {
      id: "coruscant",
      name: "Coruscant Sector",
      regionId: "core",
      grid: "L-9",
      factionId: "neutral",
      cells: [[6, 10, 0, 2]]
    },
    {
      id: "corellian",
      name: "Corellian Sector",
      regionId: "core",
      grid: "M-10",
      factionId: "neutral",
      cells: [[10, 14, 1, 2]]
    },
    {
      id: "kuat",
      name: "Kuat Sector",
      regionId: "core",
      grid: "M-9",
      factionId: "neutral",
      cells: [[14, 18, 1, 2]]
    },
    {
      id: "alderaan",
      name: "Alderaan Sector",
      regionId: "core",
      grid: "M-10",
      factionId: "neutral",
      cells: [[18, 22, 1, 2]]
    },
    {
      id: "alsakan",
      name: "Alsakan Sector",
      regionId: "core",
      grid: "L-10",
      factionId: "neutral",
      cells: [[22, 26, 0, 2]]
    },
    {
      id: "brentaal",
      name: "Brentaal Sector",
      regionId: "colonies",
      grid: "L-9",
      factionId: "neutral",
      cells: [[0, 4, 2, 3]]
    },
    {
      id: "duro",
      name: "Duro Sector",
      regionId: "colonies",
      grid: "M-10",
      factionId: "neutral",
      cells: [[4, 8, 2, 3]]
    },
    {
      id: "tapani",
      name: "Tapani Sector",
      regionId: "colonies",
      grid: "M-11",
      factionId: "neutral",
      cells: [[8, 10, 2, 4], [10, 12, 2, 3]]
    },
    {
      id: "hapes",
      name: "Hapes Cluster",
      regionId: "inner-rim",
      grid: "O-8",
      factionId: "neutral",
      cells: [[12, 16, 3, 4]]
    },
    {
      id: "manaan",
      name: "Manaan Sector",
      regionId: "inner-rim",
      grid: "O-11",
      factionId: "neutral",
      cells: [[16, 20, 3, 4]]
    },
    {
      id: "onderon",
      name: "Onderon Sector",
      regionId: "inner-rim",
      grid: "O-9",
      factionId: "neutral",
      cells: [[20, 24, 3, 4], [22, 24, 4, 5]]
    },
    {
      id: "balmorra",
      name: "Balmorra Sector",
      regionId: "expansion",
      grid: "M-10",
      factionId: "neutral",
      cells: [[0, 4, 4, 5]]
    },
    {
      id: "taris",
      name: "Taris Sector",
      regionId: "outer-rim",
      grid: "M-10",
      factionId: "neutral",
      cells: [[4, 6, 4, 6]]
    },
    {
      id: "bothan-space",
      name: "Bothan Space",
      regionId: "mid-rim",
      grid: "R-14",
      factionId: "neutral",
      cells: [[6, 10, 5, 6]]
    },
    {
      id: "mandalore",
      name: "Mandalore Sector",
      regionId: "outer-rim",
      grid: "O-7",
      factionId: "neutral",
      cells: [[10, 12, 5, 7]]
    },
    {
      id: "tion-cluster",
      name: "Tion Cluster",
      regionId: "outer-rim",
      grid: "S-5",
      factionId: "neutral",
      cells: [[12, 16, 4, 6]]
    },
    {
      id: "kanz",
      name: "Kanz Sector",
      regionId: "mid-rim",
      grid: "O-12",
      factionId: "neutral",
      cells: [[16, 18, 4, 6]]
    },
    {
      id: "voss",
      name: "Voss Sector",
      regionId: "outer-rim",
      grid: "S-7",
      factionId: "neutral",
      cells: [[18, 22, 5, 7]]
    },
    {
      id: "belsavis",
      name: "Belsavis Sector",
      regionId: "outer-rim",
      grid: "Q-16",
      factionId: "neutral",
      cells: [[22, 26, 5, 7]]
    },
    {
      id: "esstran",
      name: "Esstran Sector",
      regionId: "outer-rim",
      grid: "R-5",
      factionId: "sith-empire",
      cells: [[8, 10, 6, 10], [9, 10, 10, 11]],
      objectives: ["Sith Worlds strategic zone"]
    },
    {
      id: "dromund",
      name: "Dromund Sector",
      regionId: "outer-rim",
      grid: "S-5",
      factionId: "neutral",
      cells: [[10, 12, 6, 10], [10, 11, 10, 11]]
    },
    {
      id: "hutt-space",
      name: "Hutt Space",
      regionId: "outer-rim",
      grid: "S-12",
      factionId: "neutral",
      cells: [[12, 14, 6, 10], [13, 14, 10, 11]]
    },
    {
      id: "arkanis",
      name: "Arkanis Sector",
      regionId: "outer-rim",
      grid: "R-16",
      factionId: "neutral",
      cells: [[14, 16, 6, 9], [15, 16, 9, 10]]
    },
    {
      id: "anoat",
      name: "Anoat Sector",
      regionId: "outer-rim",
      grid: "K-18",
      factionId: "neutral",
      cells: [[16, 18, 6, 10]]
    },
    {
      id: "gordian-reach",
      name: "Gordian Reach",
      regionId: "outer-rim",
      grid: "P-6",
      factionId: "neutral",
      cells: [[18, 20, 6, 10], [18, 19, 10, 11]]
    },
    {
      id: "corporate-sector",
      name: "Corporate Sector",
      regionId: "outer-rim",
      grid: "S-4",
      factionId: "neutral",
      cells: [[20, 22, 6, 10], [20, 21, 10, 11]]
    },
    {
      id: "tingel-arm",
      name: "Tingel Arm",
      regionId: "outer-rim",
      grid: "T-3",
      factionId: "neutral",
      cells: [[22, 24, 7, 10], [23, 24, 10, 11]]
    },
    {
      id: "minos-cluster",
      name: "Minos Cluster",
      regionId: "outer-rim",
      grid: "K-19",
      factionId: "neutral",
      cells: [[24, 26, 7, 9], [25, 26, 9, 10]]
    },
    {
      id: "kathol",
      name: "Kathol Sector",
      regionId: "outer-rim",
      grid: "J-20",
      factionId: "neutral",
      cells: [[26, 28, 7, 10], [27, 28, 10, 11]]
    },
    {
      id: "rishi-maze",
      name: "Rishi Maze Approaches",
      regionId: "wild-space",
      grid: "S-15",
      factionId: "neutral",
      cells: [[28, 30, 7, 10], [28, 29, 10, 11]]
    },
    {
      id: "ilum-frontier",
      name: "Ilum Frontier",
      regionId: "outer-rim",
      grid: "G-7",
      factionId: "neutral",
      cells: [[30, 34, 6, 9], [31, 32, 9, 10], [32, 33, 10, 11]]
    }
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
      objectives: ["Watch Torreto do his Hell Jacks"],
      locations: ["Sith Temple", "Dark Tombs"],
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
