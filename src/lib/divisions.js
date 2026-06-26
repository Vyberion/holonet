import { getDivision } from "../../modules/data/divisions/index.js";

const ROUTE_ALIASES = {
  reavers: "reavers",
  "dark-honor-guards": "dhg",
  darkhonorguards: "dhg",
  dhg: "dhg",
  inquisitors: "inquisitors",
  "dread-masters": "dreadmasters",
  dreadmasters: "dreadmasters",
  highranks: "highranks",
  "high-ranks": "highranks",
  "dark-council": "darkCouncil",
  darkcouncil: "darkCouncil"
};

export function getDivisionByRouteSlug(slug) {
  const key = ROUTE_ALIASES[String(slug || "").toLowerCase()];
  if (!key) return null;
  return getDivision(key);
}

export { getDivision };
