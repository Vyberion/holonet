// Paste first-term Emperor Roblox user IDs here as strings.
// Usernames are deliberately not resolved at runtime; this is a fixed ID allowlist.
export const EMPEROR_ARCHIVE_ROBLOX_IDS = [
];

const EMPEROR_ARCHIVE_ROBLOX_ID_SET = new Set(
  EMPEROR_ARCHIVE_ROBLOX_IDS.map(value => String(value).trim()).filter(Boolean)
);

export function isEmperorArchiveRobloxId(value) {
  return EMPEROR_ARCHIVE_ROBLOX_ID_SET.has(String(value || "").trim());
}
