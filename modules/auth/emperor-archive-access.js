export const EMPEROR_ARCHIVE_ROBLOX_IDS = [
  "37759826",
  "",
  "",
  "16591033",
  "18923063",
  "311083941",
  "92015099",
  "",
  "32217646",
  "",
  "84247455",
  "87835325",
  "146361012",
  "291305672",
  "36390491",
  "44963467",
  "43839070",
  "245850865",
  "38727084",
  "",
  "57450475",
  "447690215",
  "175958198",
  "665792197",
  "316508531",
  "42876764",
  "381283019",
  "89736196",
  "2627035499",
  "2700658652",
  "1060165403",
  "414344751",
  "2672266307",
  "187066128",
  "123937805",
];

const EMPEROR_ARCHIVE_ROBLOX_ID_SET = new Set(
  EMPEROR_ARCHIVE_ROBLOX_IDS.map(value => String(value).trim()).filter(Boolean)
);

export function isEmperorArchiveRobloxId(value) {
  return EMPEROR_ARCHIVE_ROBLOX_ID_SET.has(String(value || "").trim());
}
