const EMPEROR_ARCHIVE_ROBLOX_IDS = [
  "2627035499",
];

const EMPEROR_ARCHIVE_ROBLOX_ID_SET = new Set(
  EMPEROR_ARCHIVE_ROBLOX_IDS.map(value => String(value).trim()).filter(Boolean)
);

export function isEmperorArchiveRobloxId(value) {
  return EMPEROR_ARCHIVE_ROBLOX_ID_SET.has(String(value || "").trim());
}
