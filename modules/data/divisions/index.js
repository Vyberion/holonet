const DIVISION_ROUTE_META = {
  reavers: {
    publicSlug: "reavers",
    subdomain: "reavers",
    aliases: ["reavers"]
  },
  dhg: {
    publicSlug: "guards",
    subdomain: "guards",
    aliases: ["guards", "dark-honor-guards", "darkhonorguards", "dhg"]
  },
  inquisitors: {
    publicSlug: "inquisitors",
    subdomain: "inquisitors",
    aliases: ["inquisitors"]
  },
  dreadmasters: {
    publicSlug: "dreads",
    subdomain: "dreads",
    aliases: ["dreads", "dread-masters", "dreadmasters"]
  },
  highranks: {
    publicSlug: "instructors",
    subdomain: "instructors",
    aliases: ["instructors", "highranks", "high-ranks"]
  },
  darkCouncil: {
    publicSlug: "council",
    subdomain: "council",
    aliases: ["council", "dark-council", "darkcouncil"]
  }
};

const PUBLIC_INFO_DIVISION_IDS = new Set(["reavers", "dhg", "inquisitors", "dreadmasters"]);

const ROUTE_ALIAS_TO_ID = Object.fromEntries(
  Object.entries(DIVISION_ROUTE_META).flatMap(([id, meta]) => (
    [meta.publicSlug, meta.subdomain, ...(meta.aliases || [])]
      .filter(Boolean)
      .map(alias => [String(alias).toLowerCase(), id])
  ))
);

const SUBDOMAIN_TO_ID = Object.fromEntries(
  Object.entries(DIVISION_ROUTE_META).map(([id, meta]) => [meta.subdomain, id])
);

function isLocalHostname(hostname = "") {
  const normalized = String(hostname || "").toLowerCase();
  return normalized === "localhost" || normalized.endsWith(".localhost") || normalized === "127.0.0.1" || normalized === "::1" || /^\d+\.\d+\.\d+\.\d+$/.test(normalized);
}

function canonicalSiteHostname(hostname = "") {
  const normalized = String(hostname || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "thesithorder.org" || normalized === "www.thesithorder.org") return "www.thesithorder.org";
  return normalized;
}

function configuredRootOrigin() {
  const env = typeof process !== "undefined" ? process.env || {} : {};
  const value =
    env.NEXT_PUBLIC_SITE_URL ||
    env.NEXT_PUBLIC_ROOT_URL ||
    env.HOLONET_BASE_URL ||
    "https://www.thesithorder.org";

  return normalizeOrigin(value);
}

function normalizeOrigin(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  const url = new URL(normalized.startsWith("http") ? normalized : `https://${normalized}`);
  if (!isLocalHostname(url.hostname)) {
    url.hostname = canonicalSiteHostname(url.hostname);
    url.port = "";
  }

  return url.origin.replace(/\/+$/, "");
}

function rootHostname(hostname = "") {
  const labels = String(hostname || "").toLowerCase().split(".").filter(Boolean);
  if (labels.length > 2 && SUBDOMAIN_TO_ID[labels[0]]) return labels.slice(1).join(".");
  if (labels.length > 2 && labels[0] === "www") return labels.slice(1).join(".");
  return labels.join(".");
}

export function holonetRootOrigin() {
  if (typeof window !== "undefined" && window.location?.hostname) {
    const url = new URL(window.location.origin);
    if (!isLocalHostname(url.hostname)) {
      url.hostname = canonicalSiteHostname(url.hostname);
      url.port = "";
    }
    return url.origin.replace(/\/+$/, "");
  }

  return normalizeOrigin(configuredRootOrigin());
}

export function divisionIdFromRouteSlug(slug) {
  return ROUTE_ALIAS_TO_ID[String(slug || "").toLowerCase()] || "";
}

export function divisionIdFromSubdomain(subdomain) {
  return SUBDOMAIN_TO_ID[String(subdomain || "").toLowerCase()] || "";
}

export function divisionSubdomainForId(id) {
  return DIVISION_ROUTE_META[id]?.subdomain || "";
}

export function divisionPublicSlug(id) {
  return DIVISION_ROUTE_META[id]?.publicSlug || "";
}

export function isPublicInfoDivision(id) {
  return PUBLIC_INFO_DIVISION_IDS.has(id);
}

export function divisionPublicInfoPath(id) {
  const slug = divisionPublicSlug(id);
  return slug ? `/${slug}` : "";
}

export function divisionLockedPath(section = "home") {
  const normalized = String(section || "home").toLowerCase().replace(/^\/+|\/+$/g, "");
  const route = normalized === "trackers" ? "activity" : normalized;
  return !route || route === "home" ? "/" : `/${route}`;
}

export function divisionSubdomainOrigin(id, rootOrigin = "") {
  const subdomain = divisionSubdomainForId(id);
  const origin = normalizeOrigin(rootOrigin) || holonetRootOrigin();
  if (!subdomain) return origin;

  const url = new URL(origin);
  url.hostname = `${subdomain}.${rootHostname(url.hostname)}`;
  if (!isLocalHostname(url.hostname)) {
    url.port = "";
  }
  return url.origin.replace(/\/+$/, "");
}

export function divisionLockedHref(id, section = "home", rootOrigin = "") {
  return `${divisionSubdomainOrigin(id, rootOrigin)}${divisionLockedPath(section)}`;
}

const DIVISIONS = {
  reavers: {
    id: "reavers",
    name: "The Reavers",
    shortName: "Reavers",
    subtitle: "The Emperor's assassins",
    node: "RVR-01",
    theme: "theme-reavers",
    href: divisionLockedHref("reavers"),
    status: "restricted",
    description: "Elite assassins entrusted with eliminating hostile threats and protecting the Temple from external threats.",
    access: {
      home: "reavers_home",
      handbooks: "reavers_handbooks",
      transmissions: "reavers_transmissions",
      reports: "reavers_reports",
      activity: "reavers_activity"
    },
    modules: ["transmissions", "documents", "reports", "activity", "actions"],
    transmissions: [],
    documents: [],
    reports: [],
    activity: [],
    actions: [
      { label: "Open Handbooks", href: divisionLockedHref("reavers", "handbooks"), minimumTier: "member" },
      { label: "Open Transmissions", href: divisionLockedHref("reavers", "transmissions"), minimumTier: "member" },
      { label: "Open Reports", href: divisionLockedHref("reavers", "reports"), minimumTier: "member" },
      { label: "Open Activity", href: divisionLockedHref("reavers", "activity"), minimumTier: "member" }
    ]
  },

  dhg: {
    id: "dhg",
    name: "Dark Honor Guard",
    shortName: "DHG",
    subtitle: "Temple law and order",
    node: "DHG-02",
    theme: "theme-dhg",
    href: divisionLockedHref("dhg"),
    status: "restricted",
    description: "Elite guards tasked with maintaining law and order within the Temple.",
    access: {
      home: "dhg_home",
      handbooks: "dhg_handbooks",
      transmissions: "dhg_transmissions",
      reports: "dhg_reports",
      activity: "dhg_activity"
    },
    modules: ["transmissions", "documents", "reports", "activity", "actions"],
    transmissions: [],
    documents: [],
    reports: [],
    activity: [],
    actions: [
      { label: "Open Handbooks", href: divisionLockedHref("dhg", "handbooks"), minimumTier: "member" },
      { label: "Open Transmissions", href: divisionLockedHref("dhg", "transmissions"), minimumTier: "member" },
      { label: "Open Reports", href: divisionLockedHref("dhg", "reports"), minimumTier: "member" },
      { label: "Open Activity", href: divisionLockedHref("dhg", "activity"), minimumTier: "member" }
    ]
  },

  inquisitors: {
    id: "inquisitors",
    name: "Inquisitors",
    shortName: "Inquisitors",
    subtitle: "Internal investigation and enforcement",
    node: "IQ-03",
    theme: "theme-inquisitors",
    href: divisionLockedHref("inquisitors"),
    status: "restricted",
    description: "Intelligence operations and background oversight of the group.",
    access: {
      home: "inquisitors_home",
      handbooks: "inquisitors_handbooks",
      transmissions: "inquisitors_transmissions",
      reports: "inquisitors_reports",
      activity: "inquisitors_activity"
    },
    modules: ["transmissions", "documents", "reports", "activity", "actions"],
    transmissions: [],
    documents: [],
    reports: [],
    activity: [],
    actions: [
      { label: "Open Handbooks", href: divisionLockedHref("inquisitors", "handbooks"), minimumTier: "member" },
      { label: "Open Transmissions", href: divisionLockedHref("inquisitors", "transmissions"), minimumTier: "member" },
      { label: "Open Reports", href: divisionLockedHref("inquisitors", "reports"), minimumTier: "member" },
      { label: "Open Activity", href: divisionLockedHref("inquisitors", "activity"), minimumTier: "member" }
    ]
  },

  dreadmasters: {
    id: "dreadmasters",
    name: "Dread Masters",
    shortName: "Dread Masters",
    subtitle: "Ancient knowledge instructors",
    node: "DM-04",
    theme: "theme-dreadmasters",
    href: divisionLockedHref("dreadmasters"),
    status: "restricted",
    description: "Powerful and influential beings who are tasked with teaching Ancient Knowledge.",
    access: {
      home: "dreadmasters_home",
      handbooks: "dreadmasters_handbooks",
      transmissions: "dreadmasters_transmissions",
      reports: "dreadmasters_reports",
      activity: "dreadmasters_activity"
    },
    modules: ["documents", "transmissions", "reports", "activity", "actions"],
    transmissions: [],
    documents: [],
    reports: [],
    activity: [],
    actions: [
      { label: "Open Handbooks", href: divisionLockedHref("dreadmasters", "handbooks"), minimumTier: "member" },
      { label: "Open Transmissions", href: divisionLockedHref("dreadmasters", "transmissions"), minimumTier: "member" },
      { label: "Open Reports", href: divisionLockedHref("dreadmasters", "reports"), minimumTier: "member" },
      { label: "Open Activity", href: divisionLockedHref("dreadmasters", "activity"), minimumTier: "member" }
    ]
  },

  highranks: {
    id: "highranks",
    name: "High Ranks",
    shortName: "High Ranks",
    subtitle: "Sith instructors and event hosts",
    node: "HR-05",
    theme: "theme-highranks",
    href: divisionLockedHref("highranks"),
    status: "restricted",
    description: "Experienced Sith who are entrusted with hosting events and training the lower ranks.",
    access: {
      home: "highranks_home",
      handbooks: "highranks_handbooks",
      transmissions: "highranks_transmissions",
      reports: "highranks_reports",
      activity: "highranks_activity"
    },
    modules: ["reports", "activity", "transmissions", "documents", "actions"],
    transmissions: [],
    documents: [],
    reports: [],
    activity: [],
    actions: [
      { label: "Open Handbooks", href: divisionLockedHref("highranks", "handbooks"), minimumTier: "lower" },
      { label: "Open Transmissions", href: divisionLockedHref("highranks", "transmissions"), minimumTier: "lower" }
    ]
  },

  darkCouncil: {
    id: "darkCouncil",
    name: "Dark Council",
    shortName: "Dark Council",
    subtitle: "Internal oversight authority",
    node: "DC-06",
    theme: "theme-dark-council",
    href: divisionLockedHref("darkCouncil"),
    status: "restricted",
    description: "Senior Sith entrusted with overseeing the Order and making decisions on legislation, policy and internal oversight.",
    access: {
      home: "dark_council_home",
      handbooks: "darkcouncil_handbooks",
      transmissions: "darkcouncil_transmissions",
      reports: "darkcouncil_reports",
      activity: "darkcouncil_activity"
    },
    modules: ["documents", "transmissions", "reports", "activity", "actions"],
    transmissions: [],
    documents: [],
    reports: [],
    activity: [],
    actions: [
      { label: "Open Council Floor", href: divisionLockedHref("darkCouncil", "council-floor"), minimumTier: "council" },
      { label: "Open Transmissions", href: divisionLockedHref("darkCouncil", "transmissions"), minimumTier: "powerbase" },
      { label: "Open Reports", href: divisionLockedHref("darkCouncil", "reports"), minimumTier: "powerbase" },
      { label: "Open Activity", href: divisionLockedHref("darkCouncil", "activity"), minimumTier: "powerbase" }
    ]
  }
};

export function getDivision(id) {
  return DIVISIONS[id] || null;
}

export function listDivisions() {
  return Object.values(DIVISIONS);
}
