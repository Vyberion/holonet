export const GALAXY_CONTROL_MAP = {
  title: "Galaxy",
  sources: [
    {
      label: "StarWars.com Galaxy Map",
      url: "https://www.starwars.com/star-wars-galaxy-map",
      note: "Primary visual placement reference for galactic regions and planets where available."
    },
    {
      label: "Wookieepedia Esstran sector and Unknown Regions entries",
      url: "https://starwars.fandom.com/",
      note: "Fallback reference for sector membership and broad region geography."
    }
  ],
  factions: [
    {
      id: "sith-empire",
      name: "Sith Empire",
      shortName: "Empire",
      color: "#ff3448",
      glow: "#ff1028"
    },
    {
      id: "jedi-republic",
      name: "Jedi / Republic",
      shortName: "Republic",
      color: "#2ed8ff",
      glow: "#4fffff"
    },
    {
      id: "neutral",
      name: "Neutral / Unknown",
      shortName: "Unknown",
      color: "#727272",
      glow: "#b8b8b8"
    }
  ],
  regions: [
    { id: "deep-core", name: "Deep Core", radius: [0, 1.0] },
    { id: "core", name: "Core Worlds", radius: [1.0, 1.8] },
    { id: "colonies", name: "Colonies", radius: [1.8, 2.6] },
    { id: "inner-rim", name: "Inner Rim", radius: [2.6, 3.45] },
    { id: "expansion", name: "Expansion Region", radius: [3.45, 4.35] },
    { id: "mid-rim", name: "Mid Rim", radius: [4.35, 5.45] },
    { id: "outer-rim", name: "Outer Rim", radius: [5.45, 6.65] },
    { id: "wild-space", name: "Wild Space", radius: [6.65, 7.2] },
    { id: "unknown-regions", name: "Unknown Regions", radius: [4.2, 7.2] }
  ],
  sectors: [
    {
      id: "core-worlds",
      name: "Core Worlds",
      regionId: "core",
      grid: "Core",
      factionId: "jedi-republic",
      placementConfidence: "Broad canonical region",
      points: [[-1.05, 0.82], [0.18, 1.05], [1.12, 0.52], [1.22, -0.56], [0.36, -1.2], [-0.92, -1.02], [-1.34, -0.08]],
      objectives: ["Maintain capital-route stability", "Monitor Sith incursions toward the Hydian corridor"]
    },
    {
      id: "inner-rim-east",
      name: "Inner Rim Corridor",
      regionId: "inner-rim",
      grid: "L/M",
      factionId: "jedi-republic",
      placementConfidence: "Broad canonical region",
      points: [[1.42, 1.28], [3.02, 1.45], [3.42, 0.62], [3.05, -0.58], [1.48, -0.92], [1.12, 0.04]],
      objectives: ["Hold major trade lanes", "Screen the Core from eastern Outer Rim pressure"]
    },
    {
      id: "mid-rim-south",
      name: "Southern Mid Rim",
      regionId: "mid-rim",
      grid: "N/O",
      factionId: "neutral",
      placementConfidence: "Broad canonical region",
      points: [[-0.22, -3.52], [1.72, -3.1], [2.92, -4.22], [2.42, -5.42], [0.28, -5.62], [-1.18, -4.42]],
      objectives: ["Unclaimed routes under observation"]
    },
    {
      id: "outer-rim-east",
      name: "Eastern Outer Rim",
      regionId: "outer-rim",
      grid: "P/Q",
      factionId: "jedi-republic",
      placementConfidence: "Broad canonical region",
      points: [[3.42, 1.1], [5.34, 1.62], [6.32, 0.72], [6.04, -1.12], [4.5, -1.82], [3.18, -0.72]],
      objectives: ["Hold mapped hyperspace approaches", "Protect worlds bordering Wild Space"]
    },
    {
      id: "esstran",
      name: "Esstran Sector",
      regionId: "outer-rim",
      grid: "R-5",
      factionId: "sith-empire",
      placementConfidence: "Canonical broad placement: Sith Worlds / Outer Rim",
      points: [[4.22, -3.15], [6.28, -3.48], [6.92, -4.78], [5.92, -6.06], [4.3, -5.76], [3.72, -4.4]],
      objectives: ["Secure Korriban temple approaches", "Deny Republic reconnaissance through Sith Worlds"],
      activeWars: []
    },
    {
      id: "western-reaches",
      name: "Western Reaches",
      regionId: "outer-rim",
      grid: "E/F",
      factionId: "neutral",
      placementConfidence: "Broad mapped-space west of the Core",
      points: [[-5.84, 1.52], [-3.72, 1.2], [-3.18, -0.42], [-4.02, -2.12], [-6.18, -2.72], [-6.88, -0.46]],
      objectives: ["Low-confidence route monitoring"]
    },
    {
      id: "unknown-west",
      name: "Unknown Regions",
      regionId: "unknown-regions",
      grid: "Western Unknowns",
      factionId: "neutral",
      placementConfidence: "Canonical broad placement: western less-charted galaxy",
      points: [[-7.05, 3.1], [-5.35, 4.8], [-3.44, 3.52], [-3.92, 1.54], [-5.98, 1.82], [-7.42, 0.2], [-7.22, -1.78], [-5.96, -2.94], [-6.9, -4.82], [-7.85, -3.05], [-8.15, 0.1]],
      objectives: ["Insufficient charting", "Long-range probe telemetry only"]
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
      position: [5.38, -4.86],
      placementConfidence: "Canonical broad placement: Sith Worlds, Esstran sector, Outer Rim",
      contested: false,
      objectives: ["Maintain temple control", "Defend academy and tomb access"],
      locations: ["Sith Temple", "Sith Academy approaches", "Valley tomb routes"],
      robloxPlaceId: 1177256329,
      robloxLaunchUrl: "roblox://experiences/start?placeId=1177256329",
      summary: "Ancient Sith homeworld and current Imperial stronghold in the Sith Worlds."
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
