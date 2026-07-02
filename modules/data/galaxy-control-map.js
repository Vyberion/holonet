const galaxyPlanetTextures = folder => ({
  diffuse: `/assets/galaxy/${folder}/diffuse.png`,
  color: `/assets/galaxy/${folder}/color.png`,
  bump: `/assets/galaxy/${folder}/bump.png`,
  elevation: `/assets/galaxy/${folder}/elevation.png`,
  roughness: `/assets/galaxy/${folder}/roughness.png`,
  water: `/assets/galaxy/${folder}/water.png`,
  lights: `/assets/galaxy/${folder}/lights.png`,
  clouds: `/assets/galaxy/${folder}/clouds.png`,
  cloudColor: `/assets/galaxy/${folder}/cloud-color.png`,
  cloudBump: `/assets/galaxy/${folder}/cloud-bump.png`
});

export const GALAXY_CONTROL_MAP = {
  title: "Galaxy",
  sources: [
    {
      label: "StarWars.com Galaxy Map",
      url: "https://www.starwars.com/star-wars-galaxy-map",
      note: "Primary visual placement reference for broad galactic geography."
    },
    {
      label: "The Essential Atlas Extra: Outer Rim Sectors",
      url: "https://www.starwars.com/news/essential-atlas-outer-rim-sectors",
      note: "Official sector-map reference for the uneven Outer Rim sector feel."
    },
    {
      label: "SWTOR Galactic History",
      url: "https://www.swtor.com/holonet/galactic-history",
      note: "Old Republic era framing for the divided Republic/Sith galaxy."
    },
    {
      label: "Wookieepedia Esstran sector and Sith Worlds references",
      url: "https://starwars.fandom.com/",
      note: "Legends sector, region, and Sith Worlds membership reference."
    },
    {
      label: "Star Wars: The Old Republic planet references",
      url: "https://www.swtor.com/holonet/planets/dromund-kaas",
      note: "Era-specific placement reference for Sith Empire worlds."
    }
  ],
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
    { id: "wild-space", name: "Wild Space", radius: [6.24, 6.74] }
  ],
  guide: {
    radius: 6.74,
    spokeStepDeg: 15,
    spokeOffsetDeg: 0
  },
  sectors: [
    { id: "tython-deep-core", name: "Tython Deep Core", regionId: "deep-core", grid: "K-10", factionId: "neutral", placementConfidence: "Approximate Legends/Old Republic placement", innerRadius: 0.16, outerRadius: 0.86, outerStartRadius: 0.72, outerEndRadius: 0.96, startAngleDeg: -150, endAngleDeg: -96 },
    { id: "coruscant", name: "Coruscant Sector", regionId: "core", grid: "L-9", factionId: "neutral", placementConfidence: "Core Worlds / Republic capital broad placement", innerRadius: 0.42, outerRadius: 1.28, outerStartRadius: 1.16, outerEndRadius: 1.36, startAngleDeg: -96, endAngleDeg: -36 },
    { id: "corellian", name: "Corellian Sector", regionId: "core", grid: "M-10", factionId: "neutral", placementConfidence: "Core Worlds broad placement", innerRadius: 0.78, outerRadius: 1.58, innerEndRadius: 0.66, outerStartRadius: 1.48, outerEndRadius: 1.72, startAngleDeg: -36, endAngleDeg: 20 },
    { id: "kuat", name: "Kuat Sector", regionId: "core", grid: "M-9", factionId: "neutral", placementConfidence: "Core Worlds broad placement", innerRadius: 0.72, outerRadius: 1.52, innerStartRadius: 0.62, outerEndRadius: 1.68, startAngleDeg: 20, endAngleDeg: 82 },
    { id: "alderaan", name: "Alderaan Sector", regionId: "core", grid: "M-10", factionId: "neutral", placementConfidence: "Core Worlds broad placement", innerRadius: 0.7, outerRadius: 1.46, outerStartRadius: 1.62, outerEndRadius: 1.34, startAngleDeg: 82, endAngleDeg: 148 },
    { id: "alsakan", name: "Alsakan Sector", regionId: "core", grid: "L-10", factionId: "neutral", placementConfidence: "Core Worlds broad placement", innerRadius: 0.58, outerRadius: 1.38, innerStartRadius: 0.48, outerEndRadius: 1.52, startAngleDeg: 148, endAngleDeg: 210 },
    { id: "brentaal", name: "Brentaal Sector", regionId: "colonies", grid: "L-9", factionId: "neutral", placementConfidence: "Colonies / major route broad placement", innerRadius: 1.34, outerRadius: 2.24, outerStartRadius: 2.05, outerEndRadius: 2.42, startAngleDeg: -160, endAngleDeg: -106 },
    { id: "duro", name: "Duro Sector", regionId: "colonies", grid: "M-10", factionId: "neutral", placementConfidence: "Colonies broad placement", innerRadius: 1.36, outerRadius: 2.18, innerEndRadius: 1.22, outerStartRadius: 2.34, startAngleDeg: -106, endAngleDeg: -56 },
    { id: "tapani", name: "Tapani Sector", regionId: "colonies", grid: "M-11", factionId: "neutral", placementConfidence: "Colonies/Inner Rim broad placement", innerRadius: 1.5, outerRadius: 2.4, outerStartRadius: 2.18, outerEndRadius: 2.58, startAngleDeg: -56, endAngleDeg: 4 },
    { id: "hapes", name: "Hapes Cluster", regionId: "inner-rim", grid: "O-8", factionId: "neutral", placementConfidence: "Legends cluster placement approximated", innerRadius: 1.84, outerRadius: 2.86, outerStartRadius: 2.72, outerEndRadius: 3.02, startAngleDeg: 4, endAngleDeg: 52 },
    { id: "manaan", name: "Manaan Sector", regionId: "inner-rim", grid: "O-11", factionId: "neutral", placementConfidence: "Old Republic / Inner Rim broad placement", innerRadius: 1.96, outerRadius: 2.82, innerStartRadius: 1.8, outerEndRadius: 2.96, startAngleDeg: 52, endAngleDeg: 112 },
    { id: "onderon", name: "Onderon Sector", regionId: "inner-rim", grid: "O-9", factionId: "neutral", placementConfidence: "Old Republic / Inner Rim broad placement", innerRadius: 2.04, outerRadius: 3.02, outerStartRadius: 2.78, outerEndRadius: 3.18, startAngleDeg: 112, endAngleDeg: 176 },
    { id: "balmorra", name: "Balmorra Sector", regionId: "expansion", grid: "M-10", factionId: "neutral", placementConfidence: "Old Republic campaign-world broad placement", innerRadius: 2.66, outerRadius: 3.86, outerStartRadius: 3.62, outerEndRadius: 4.02, startAngleDeg: -172, endAngleDeg: -128 },
    { id: "taris", name: "Taris Sector", regionId: "outer-rim", grid: "M-10", factionId: "neutral", placementConfidence: "Old Republic campaign-world broad placement", innerRadius: 2.84, outerRadius: 4.22, outerStartRadius: 4.34, outerEndRadius: 4.06, startAngleDeg: -128, endAngleDeg: -88 },
    { id: "bothan-space", name: "Bothan Space", regionId: "mid-rim", grid: "R-14", factionId: "neutral", placementConfidence: "Mid Rim Legends broad placement", innerRadius: 3.08, outerRadius: 4.62, outerStartRadius: 4.36, outerEndRadius: 4.84, startAngleDeg: -88, endAngleDeg: -42 },
    { id: "mandalore", name: "Mandalore Sector", regionId: "outer-rim", grid: "O-7", factionId: "neutral", placementConfidence: "Mandalorian space broad placement", innerRadius: 3.36, outerRadius: 5.04, outerStartRadius: 4.86, outerEndRadius: 5.22, startAngleDeg: -42, endAngleDeg: 6 },
    { id: "tion-cluster", name: "Tion Cluster", regionId: "outer-rim", grid: "S-5", factionId: "neutral", placementConfidence: "Legends Tion region broad placement", innerRadius: 3.14, outerRadius: 4.58, outerStartRadius: 4.36, outerEndRadius: 4.76, startAngleDeg: 6, endAngleDeg: 50 },
    { id: "kanz", name: "Kanz Sector", regionId: "mid-rim", grid: "O-12", factionId: "neutral", placementConfidence: "Legends sector broad placement", innerRadius: 3.2, outerRadius: 4.78, outerStartRadius: 4.94, outerEndRadius: 4.54, startAngleDeg: 50, endAngleDeg: 92 },
    { id: "voss", name: "Voss Sector", regionId: "outer-rim", grid: "S-7", factionId: "neutral", placementConfidence: "Old Republic campaign-world broad placement", innerRadius: 3.62, outerRadius: 5.18, outerStartRadius: 4.98, outerEndRadius: 5.4, startAngleDeg: 92, endAngleDeg: 136 },
    { id: "belsavis", name: "Belsavis Sector", regionId: "outer-rim", grid: "Q-16", factionId: "neutral", placementConfidence: "Old Republic campaign-world broad placement", innerRadius: 3.94, outerRadius: 5.36, outerStartRadius: 5.5, outerEndRadius: 5.1, startAngleDeg: 136, endAngleDeg: 178 },
    { id: "esstran", name: "Esstran Sector", regionId: "outer-rim", grid: "R-5", factionId: "sith-empire", placementConfidence: "Legends placement: Esstran sector in the Outer Rim, containing Sith Worlds and major Old Republic Sith worlds.", innerRadius: 4.72, outerRadius: 6.24, innerStartRadius: 4.58, innerEndRadius: 4.9, outerStartRadius: 6.34, outerEndRadius: 6.08, startAngleDeg: -64, endAngleDeg: -32, localView: { innerRadius: 0.72, outerRadius: 6.24, startAngleDeg: -30, endAngleDeg: 30 }, objectives: [], activeWars: ["Ak'tuun vs Kalazar"], surveyStars: [{ id: "esstran-a", position: [3.46, -4.22], size: 0.045 }, { id: "esstran-b", position: [4.15, -3.62], size: 0.035 }, { id: "esstran-c", position: [4.26, -4.16], size: 0.032 }, { id: "esstran-d", position: [5.24, -3.26], size: 0.04 }, { id: "esstran-e", position: [4.62, -3.72], size: 0.034 }] },
    { id: "dromund", name: "Dromund Sector", regionId: "outer-rim", grid: "S-5", factionId: "neutral", placementConfidence: "Sith Empire / Dromund Kaas broad placement", innerRadius: 4.96, outerRadius: 6.4, outerStartRadius: 6.22, outerEndRadius: 6.58, startAngleDeg: -32, endAngleDeg: -4 },
    { id: "hutt-space", name: "Hutt Space", regionId: "outer-rim", grid: "S-12", factionId: "neutral", placementConfidence: "Legends Hutt Space broad placement", innerRadius: 4.68, outerRadius: 6.5, outerStartRadius: 6.66, outerEndRadius: 6.28, startAngleDeg: -4, endAngleDeg: 28 },
    { id: "arkanis", name: "Arkanis Sector", regionId: "outer-rim", grid: "R-16", factionId: "neutral", placementConfidence: "Outer Rim Legends broad placement", innerRadius: 4.88, outerRadius: 6.34, innerEndRadius: 4.68, outerEndRadius: 6.56, startAngleDeg: 28, endAngleDeg: 56 },
    { id: "anoat", name: "Anoat Sector", regionId: "outer-rim", grid: "K-18", factionId: "neutral", placementConfidence: "Outer Rim Legends broad placement", innerRadius: 4.72, outerRadius: 6.28, outerStartRadius: 6.12, outerEndRadius: 6.5, startAngleDeg: 56, endAngleDeg: 84 },
    { id: "gordian-reach", name: "Gordian Reach", regionId: "outer-rim", grid: "P-6", factionId: "neutral", placementConfidence: "Outer Rim Legends sector placement", innerRadius: 4.8, outerRadius: 6.36, innerStartRadius: 4.62, outerEndRadius: 6.58, startAngleDeg: 84, endAngleDeg: 112 },
    { id: "corporate-sector", name: "Corporate Sector", regionId: "outer-rim", grid: "S-4", factionId: "neutral", placementConfidence: "Outer Rim Legends broad placement", innerRadius: 4.9, outerRadius: 6.62, outerStartRadius: 6.44, outerEndRadius: 6.74, startAngleDeg: 112, endAngleDeg: 142 },
    { id: "tingel-arm", name: "Tingel Arm", regionId: "outer-rim", grid: "T-3", factionId: "neutral", placementConfidence: "Outer Rim / galactic arm broad placement", innerRadius: 5.04, outerRadius: 6.72, innerEndRadius: 4.86, outerStartRadius: 6.52, startAngleDeg: 142, endAngleDeg: 170 },
    { id: "minos-cluster", name: "Minos Cluster", regionId: "outer-rim", grid: "K-19", factionId: "neutral", placementConfidence: "Outer Rim Legends broad placement", innerRadius: 5.02, outerRadius: 6.44, outerStartRadius: 6.6, outerEndRadius: 6.2, startAngleDeg: 170, endAngleDeg: 202 },
    { id: "kathol", name: "Kathol Sector", regionId: "outer-rim", grid: "J-20", factionId: "neutral", placementConfidence: "Outer Rim Legends broad placement", innerRadius: 5.18, outerRadius: 6.7, innerStartRadius: 5.0, outerEndRadius: 6.52, startAngleDeg: 202, endAngleDeg: 232 },
    { id: "rishi-maze", name: "Rishi Maze Approaches", regionId: "wild-space", grid: "S-15", factionId: "neutral", placementConfidence: "Wild Space / satellite-galaxy approach approximated", innerRadius: 5.28, outerRadius: 6.74, outerStartRadius: 6.48, outerEndRadius: 6.88, startAngleDeg: 232, endAngleDeg: 262 },
    { id: "ilum-frontier", name: "Ilum Frontier", regionId: "outer-rim", grid: "G-7", factionId: "neutral", placementConfidence: "Old Republic Ilum frontier broad placement", innerRadius: 5.06, outerRadius: 6.42, innerEndRadius: 4.84, outerStartRadius: 6.58, startAngleDeg: 262, endAngleDeg: 296 },
    { id: "raioballo", name: "Raioballo Sector", regionId: "outer-rim", grid: "L-4", factionId: "jedi-republic", placementConfidence: "Legends placement: Dantooine system in the Raioballo sector of the Outer Rim.", innerRadius: 5.0, outerRadius: 6.48, outerStartRadius: 6.32, outerEndRadius: 6.62, startAngleDeg: 296, endAngleDeg: 330 }
  ],
  planets: [
    {
      id: "coruscant",
      name: "Coruscant",
      shortName: "Coruscant",
      sectorId: "coruscant",
      regionId: "core",
      factionId: "jedi-republic",
      grid: "L-9",
      position: [0.62, -0.58],
      radius: 0.018,
      placementConfidence: "Canonical broad placement: Coruscant sector / Corusca sector, Core Worlds",
      contested: false,
      objectives: [],
      locations: ["Galactic Senate", "Jedi Temple"],
      summary: "Galactic capital world and seat of Republic power.",
      textures: galaxyPlanetTextures("coruscant")
    },
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
      summary: "Homeworld of the Sith and location of the Sith Academy.",
      textures: galaxyPlanetTextures("korriban")
    },
    {
      id: "dromund-kaas",
      name: "Dromund Kaas",
      shortName: "Dromund Kaas",
      sectorId: "esstran",
      regionId: "outer-rim",
      factionId: "sith-empire",
      grid: "R-5",
      position: [4.22, -3.7],
      radius: 0.018,
      placementConfidence: "Legends placement: Dromund Kaas system in the Sith Worlds of the Esstran sector.",
      contested: false,
      objectives: [],
      locations: ["Kaas City", "Dark Temple"],
      summary: "Sith Empire capital hidden within the storm-wrapped Sith Worlds.",
      textures: galaxyPlanetTextures("dromund-kaas")
    },
    {
      id: "ziost",
      name: "Ziost",
      shortName: "Ziost",
      sectorId: "esstran",
      regionId: "outer-rim",
      factionId: "sith-empire",
      grid: "R-4",
      position: [3.72, -4.24],
      radius: 0.017,
      placementConfidence: "Canonical broad placement: ancient Sith world in the Outer Rim, grid R-4; Sith Worlds / Esstran in Legends.",
      contested: false,
      objectives: [],
      locations: ["Sith Citadel", "Ancient Vaults"],
      summary: "Ancient Sith world and former center of Sith imperial power.",
      textures: galaxyPlanetTextures("ziost")
    },
    {
      id: "mandalore",
      name: "Mandalore",
      shortName: "Mandalore",
      sectorId: "mandalore",
      regionId: "outer-rim",
      factionId: "neutral",
      grid: "O-7",
      position: [3.66, -2.18],
      radius: 0.018,
      placementConfidence: "Canonical broad placement: Mandalore system in the Mandalore sector, Outer Rim.",
      contested: false,
      objectives: [],
      locations: ["Sundari", "Dome Cities"],
      summary: "Homeworld of the Mandalorians in the Outer Rim's Mandalore sector.",
      textures: galaxyPlanetTextures("mandalore")
    },
    {
      id: "nar-shaddaa",
      name: "Nar Shaddaa",
      shortName: "Nar Shaddaa",
      sectorId: "hutt-space",
      regionId: "outer-rim",
      factionId: "neutral",
      grid: "S-12",
      position: [5.1, -0.16],
      radius: 0.016,
      placementConfidence: "Canonical broad placement: moon of Nal Hutta in Hutt Space, Outer Rim.",
      contested: false,
      objectives: [],
      locations: ["Hutta Town", "Vertical City"],
      summary: "The Smuggler's Moon, an ecumenopolis and major Hutt Space port.",
      textures: galaxyPlanetTextures("nar-shaddaa")
    },
    {
      id: "dantooine",
      name: "Dantooine",
      shortName: "Dantooine",
      sectorId: "raioballo",
      regionId: "outer-rim",
      factionId: "jedi-republic",
      grid: "L-4",
      position: [3.88, 4.32],
      radius: 0.017,
      placementConfidence: "Legends placement: Dantooine system in the Raioballo sector of the Outer Rim.",
      contested: false,
      objectives: [],
      locations: ["Jedi Enclave", "Khoonda Plains"],
      summary: "Remote grassland world known for its Jedi Enclave and Rebel-era secrecy.",
      textures: galaxyPlanetTextures("dantooine")
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
