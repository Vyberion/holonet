export const GALAXY_MAP = {
  title: "Hidden Archives Galaxy Map",
  focus: {
    id: "sith-worlds",
    name: "Sith Worlds",
    region: "Esstran sector",
    grid: "R-5",
    mapPosition: [6.55, 0.16, -2.65],
    position: [6.55, 0.16, -2.65],
    localPosition: [6.55, 0.16, -2.65],
    radius: 1.12,
    sectorRadius: 1.76,
    summary: "A remote archive projection tied to ancient Sith worlds and forgotten imperial records."
  },
  bodies: [
    {
      id: "korriban",
      name: "Korriban / Moraband",
      shortName: "Korriban",
      kind: "Ancient Sith homeworld",
      region: "Sith Worlds, Esstran sector",
      grid: "R-5",
      mapPosition: [9.09, 0.18, -3.57],
      position: [9.09, 0.18, -3.57],
      localPosition: [9.09, 0.18, -3.57],
      localAngleDeg: -20,
      localDistance: 2.7,
      radius: 0.46,
      selectable: true,
      colors: {
        surface: "#8f2f22",
        surfaceDark: "#2a0806",
        glow: "#ff4e36",
        accent: "#ffb05f"
      },
      summary: "The ancient Sith homeworld, marked in later records as Moraband, housing the primary Sith Temple."
    },
    {
      id: "khar-delba",
      name: "Khar Delba",
      shortName: "Khar Delba",
      kind: "Sith Worlds anchor",
      region: "Sith Worlds, Esstran sector",
      grid: "R-5",
      mapPosition: [6.79, 0.08, 0.04],
      position: [6.79, 0.08, 0.04],
      localPosition: [6.79, 0.08, 0.04],
      localAngleDeg: 85,
      localDistance: 2.7,
      radius: 0.34,
      selectable: false,
      colors: {
        surface: "#52333c",
        surfaceDark: "#0e070b",
        glow: "#a46a8a",
        accent: "#5eb6c4"
      },
      summary: "The parent world used here as a dim anchor for Khar Shian's local placement."
    },
    {
      id: "khar-shian",
      name: "Khar Shian",
      shortName: "Khar Shian",
      kind: "Moon of Khar Delba",
      region: "Sith Worlds, Esstran sector",
      grid: "R-5",
      parentId: "khar-delba",
      mapPosition: [5.77, 0.15, -0.43],
      position: [5.77, 0.22, -0.43],
      localPosition: [5.77, 0.22, -0.43],
      radius: 0.2,
      selectable: true,
      colors: {
        surface: "#b7c7cc",
        surfaceDark: "#1a2328",
        glow: "#76e0ef",
        accent: "#f2c66d"
      },
      summary: "A moon of Khar Delba, Naga Sadow's place of exile and the location of an ancient Sith Sanctum."
    }
  ]
};

export function selectableGalaxyBodies(map = GALAXY_MAP) {
  return (map.bodies || []).filter(body => body.selectable);
}
