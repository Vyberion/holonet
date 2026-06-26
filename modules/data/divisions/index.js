const DIVISIONS = {
  reavers: {
    id: "reavers",
    name: "The Reavers",
    shortName: "Reavers",
    subtitle: "The Emperor's assassins",
    node: "RVR-01",
    theme: "theme-reavers",
    href: "/reavers/home",
    status: "restricted",
    description: "Elite assassins entrusted with eliminating hostile threats and protecting the Temple from external threats.",
    access: {
      home: "reavers_home",
      handbooks: "reavers_handbooks",
      transmissions: "reavers_transmissions",
      reports: "reavers_reports",
      trackers: "reavers_trackers"
    },
    modules: ["transmissions", "documents", "reports", "trackers", "actions"],
    transmissions: [],
    documents: [],
    reports: [],
    trackers: [],
    actions: [
      { label: "Open Handbooks", href: "/reavers/handbooks", minimumTier: "member" },
      { label: "Open Transmissions", href: "/reavers/transmissions", minimumTier: "member" },
      { label: "Open Reports", href: "/reavers/reports", minimumTier: "member" },
      { label: "Open Tracking", href: "/reavers/trackers", minimumTier: "member" }
    ]
  },

  dhg: {
    id: "dhg",
    name: "Dark Honor Guard",
    shortName: "DHG",
    subtitle: "Temple law and order",
    node: "DHG-02",
    theme: "theme-dhg",
    href: "/dark-honor-guards/home",
    status: "restricted",
    description: "Elite guards tasked with maintaining law and order within the Temple.",
    access: {
      home: "dhg_home",
      handbooks: "dhg_handbooks",
      transmissions: "dhg_transmissions",
      reports: "dhg_reports",
      trackers: "dhg_trackers"
    },
    modules: ["transmissions", "documents", "reports", "trackers", "actions"],
    transmissions: [],
    documents: [],
    reports: [],
    trackers: [],
    actions: [
      { label: "Open Handbooks", href: "/dark-honor-guards/handbooks", minimumTier: "member" },
      { label: "Open Transmissions", href: "/dark-honor-guards/transmissions", minimumTier: "member" },
      { label: "Open Reports", href: "/dark-honor-guards/reports", minimumTier: "member" },
      { label: "Open Tracking", href: "/dark-honor-guards/trackers", minimumTier: "member" }
    ]
  },

  inquisitors: {
    id: "inquisitors",
    name: "Inquisitors",
    shortName: "Inquisitors",
    subtitle: "Internal investigation and enforcement",
    node: "IQ-03",
    theme: "theme-inquisitors",
    href: "/inquisitors/home",
    status: "restricted",
    description: "Division closed.",
    access: {
      home: "inquisitors_home",
      handbooks: "inquisitors_handbooks",
      transmissions: "inquisitors_transmissions",
      reports: "inquisitors_reports",
      trackers: "inquisitors_trackers"
    },
    modules: ["transmissions", "documents", "reports", "trackers", "actions"],
    transmissions: [],
    documents: [],
    reports: [],
    trackers: [],
    actions: [
      { label: "Open Handbooks", href: "/inquisitors/handbooks", minimumTier: "member" },
      { label: "Open Transmissions", href: "/inquisitors/transmissions", minimumTier: "member" },
      { label: "Open Reports", href: "/inquisitors/reports", minimumTier: "member" },
      { label: "Open Tracking", href: "/inquisitors/trackers", minimumTier: "member" }
    ]
  },

  dreadmasters: {
    id: "dreadmasters",
    name: "Dread Masters",
    shortName: "Dread Masters",
    subtitle: "Ancient knowledge instructors",
    node: "DM-04",
    theme: "theme-dreadmasters",
    href: "/dread-masters/home",
    status: "restricted",
    description: "Powerful and influential beings who are tasked with teaching Ancient Knowledge.",
    access: {
      home: "dreadmasters_home",
      handbooks: "dreadmasters_handbooks",
      transmissions: "dreadmasters_transmissions",
      reports: "dreadmasters_reports",
      trackers: "dreadmasters_trackers"
    },
    modules: ["documents", "transmissions", "reports", "trackers", "actions"],
    transmissions: [],
    documents: [],
    reports: [],
    trackers: [],
    actions: [
      { label: "Open Handbooks", href: "/dread-masters/handbooks", minimumTier: "member" },
      { label: "Open Transmissions", href: "/dread-masters/transmissions", minimumTier: "member" },
      { label: "Open Reports", href: "/dread-masters/reports", minimumTier: "member" },
      { label: "Open Tracking", href: "/dread-masters/trackers", minimumTier: "member" }
    ]
  },

  highranks: {
    id: "highranks",
    name: "High Ranks",
    shortName: "High Ranks",
    subtitle: "Sith instructors and event hosts",
    node: "HR-05",
    theme: "theme-highranks",
    href: "/highranks/home",
    status: "restricted",
    description: "Experienced Sith who are entrusted with hosting events and training the lower ranks.",
    access: {
      home: "highranks_home",
      handbooks: "highranks_handbooks",
      transmissions: "highranks_transmissions",
      reports: "highranks_reports",
      trackers: "highranks_trackers"
    },
    modules: ["reports", "trackers", "transmissions", "documents", "actions"],
    transmissions: [],
    documents: [],
    reports: [],
    trackers: [],
    actions: [
      { label: "Open Handbooks", href: "/highranks/handbooks", minimumTier: "lower" },
      { label: "Open Transmissions", href: "/highranks/transmissions", minimumTier: "lower" },
      { label: "Open Reports", href: "/highranks/reports", minimumTier: "lower" },
      { label: "Open Tracking", href: "/highranks/trackers", minimumTier: "lower" }
    ]
  },

  darkCouncil: {
    id: "darkCouncil",
    name: "Dark Council",
    shortName: "Dark Council",
    subtitle: "Internal oversight authority",
    node: "DC-06",
    theme: "theme-dark-council",
    href: "/dark-council/home",
    status: "restricted",
    description: "Senior Sith entrusted with overseeing the Order and making decisions on legislation, policy and internal oversight.",
    access: {
      home: "dark_council_home",
      handbooks: "darkcouncil_handbooks",
      transmissions: "darkcouncil_transmissions",
      reports: "darkcouncil_reports",
      trackers: "darkcouncil_trackers"
    },
    modules: ["documents", "transmissions", "reports", "trackers", "actions"],
    transmissions: [],
    documents: [],
    reports: [],
    trackers: [],
    actions: [
      { label: "Open Council Floor", href: "/dark-council/council-floor", minimumTier: "council" },
      { label: "Open Handbooks", href: "/dark-council/handbooks", minimumTier: "powerbase" },
      { label: "Open Transmissions", href: "/dark-council/transmissions", minimumTier: "powerbase" },
      { label: "Open Reports", href: "/dark-council/reports", minimumTier: "powerbase" },
      { label: "Open Tracking", href: "/dark-council/trackers", minimumTier: "powerbase" }
    ]
  }
};

export function getDivision(id) {
  return DIVISIONS[id] || null;
}

export function listDivisions() {
  return Object.values(DIVISIONS);
}
