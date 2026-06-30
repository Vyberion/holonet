export const GALAXY_CONTROL_MAP = {
  title: "Galaxy",
  sources: [
    {
      label: "StarWars.com Galaxy Map",
      url: "https://www.starwars.com/star-wars-galaxy-map",
      note: "Primary visual placement reference for broad galactic geography."
    },
    {
      label: "Wookieepedia Esstran sector and Sith Worlds references",
      url: "https://starwars.fandom.com/",
      note: "Fallback reference for Esstran/Sith Worlds sector membership."
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
    { id: "deep-core", name: "Deep Core", radius: [0, 0.82] },
    { id: "core", name: "Core Worlds", radius: [0.82, 1.42] },
    { id: "colonies", name: "Colonies", radius: [1.42, 2.05] },
    { id: "inner-rim", name: "Inner Rim", radius: [2.05, 2.85] },
    { id: "expansion", name: "Expansion Region", radius: [2.85, 3.72] },
    { id: "mid-rim", name: "Mid Rim", radius: [3.72, 4.86] },
    { id: "outer-rim", name: "Outer Rim", radius: [4.86, 6.24] },
    { id: "wild-space", name: "Wild Space", radius: [6.24, 6.74] }
  ],
  guide: {
    radius: 6.74,
    unknownRegion: {
      startAngleDeg: 132,
      endAngleDeg: 224,
      label: "Unknown Regions"
    },
    knownSpaceSpokes: [-120, -94, -68, -42, -16, 12, 38, 64, 90, 116, 246, 272, 298, 324],
    sparseSpokes: [146, 180, 214]
  },
  sectors: [
    {
      id: "esstran",
      name: "Esstran Sector",
      regionId: "outer-rim",
      grid: "R-5",
      factionId: "sith-empire",
      placementConfidence: "Canonical broad placement: Sith Worlds / Esstran sector / Outer Rim",
      innerRadius: 4.92,
      outerRadius: 6.34,
      startAngleDeg: -58,
      endAngleDeg: -30,
      objectives: ["Secure Korriban temple approaches", "Deny Republic reconnaissance through Sith Worlds"],
      activeWars: [],
      surveyStars: [
        { id: "esstran-a", position: [3.82, -4.44], size: 0.045 },
        { id: "esstran-b", position: [4.52, -4.05], size: 0.035 },
        { id: "esstran-c", position: [4.9, -5.5], size: 0.032 },
        { id: "esstran-d", position: [5.62, -4.08], size: 0.04 },
        { id: "esstran-e", position: [5.85, -5.32], size: 0.034 }
      ]
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
      position: [4.92, -4.7],
      radius: 0.2,
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
