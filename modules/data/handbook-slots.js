const HANDBOOK_SLOT_DEFINITIONS = {
  reavers: [
    { key: "handbook", label: "Handbook", slug: "reaver-handbook", order: 1 },
    { key: "formations", label: "Formations", slug: "reaver-formations", order: 2 },
    { key: "assassinations", label: "Assassinations", slug: "reaver-assassinations", order: 3 }
  ],
  dhg: [
    { key: "handbook", label: "Handbook", slug: "dhg-handbook", order: 1 },
    { key: "formations", label: "Formations", slug: "dhg-formations", order: 2 },
    { key: "jailing", label: "Jailing", slug: "dhg-jailing", order: 3 }
  ],
  inquisitors: [
    { key: "handbook", label: "Handbook", slug: "inquisitors-handbook", order: 1 },
    { key: "formations", label: "Formations", slug: "inquisitors-formations", order: 2 },
  ],
  dreadmasters: [
    { key: "handbook", label: "Handbook", slug: "dreadmasters-handbook", order: 1 },
    { key: "formations", label: "Formations", slug: "dreadmasters-formations", order: 2 },
  ]
};

export function getHandbookSlots(division) {
  return HANDBOOK_SLOT_DEFINITIONS[division] || [];
}

export function getHandbookSlot(division, slotKey) {
  return getHandbookSlots(division).find(slot => slot.key === slotKey) || null;
}
