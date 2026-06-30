import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { embed } from "./discord-ui.js";
import { supabase } from "./supabase.js";

const CHECK_INTERVAL_MS = 60 * 1000;
const HOUR_SECONDS = 60 * 60;
const REMINDER_PREFERENCES_TABLE = "shift_reminder_preferences";

const remindedHoursByShiftId = new Map();

let reminderInterval = null;
let reminderScanRunning = false;

function scopeLabel(scope) {
  return {
    reavers: "Reavers",
    dhg: "DHG",
    inquisitors: "Inquisitors",
    dreadmasters: "Dread Masters",
    highranks: "High Ranks",
    darkCouncil: "Dark Council",
    all: "All"
  }[scope] || scope;
}

function formatHours(hours) {
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function activeShiftSeconds(shift, now = Date.now()) {
  const startedAt = new Date(shift.started_at).getTime();
  if (!Number.isFinite(startedAt)) return 0;
  const liveSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return Math.max(0, liveSeconds + Number(shift.adjustment_seconds || 0));
}

function reminderControls(discordUserId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`shiftreminder:disable:${discordUserId}`)
      .setLabel("Disable Reminders")
      .setStyle(ButtonStyle.Danger)
  );
}

async function loadActiveShifts() {
  const { data, error } = await supabase
    .from("clock_shifts")
    .select("id,scope,discord_user_id,started_at,adjustment_seconds")
    .eq("status", "active")
    .not("discord_user_id", "is", null);

  if (error) throw error;
  return data || [];
}

async function loadDisabledReminderUserIds(discordUserIds) {
  const ids = [...new Set(discordUserIds.map(String).filter(Boolean))];
  if (!ids.length) return new Set();

  const { data, error } = await supabase
    .from(REMINDER_PREFERENCES_TABLE)
    .select("discord_user_id")
    .in("discord_user_id", ids)
    .eq("enabled", false);

  if (error) throw error;
  return new Set((data || []).map(row => String(row.discord_user_id)));
}

export async function setShiftRemindersEnabled(discordUserId, enabled) {
  const userId = String(discordUserId || "").trim();
  if (!userId) throw new Error("DISCORD_USER_REQUIRED");

  const { data, error } = await supabase
    .from(REMINDER_PREFERENCES_TABLE)
    .upsert({
      discord_user_id: userId,
      enabled: Boolean(enabled),
      updated_at: new Date().toISOString()
    }, { onConflict: "discord_user_id" })
    .select("enabled")
    .single();

  if (error) throw error;
  return data;
}

async function sendShiftReminder(client, shift, hours) {
  const discordUserId = String(shift.discord_user_id || "");
  if (!discordUserId) return false;

  const user = await client.users.fetch(discordUserId);
  if (!user || typeof user.send !== "function") throw new Error("SHIFT_REMINDER_USER_UNAVAILABLE");

  await user.send({
    embeds: [embed("Shift Check-In", [
      `Your shift is **${formatHours(hours)}** long.`,
      "Make sure to take a break.",
      "Are you still ingame, or did you forget to clock out?",
      "",
      `Scope: ${scopeLabel(shift.scope)}`
    ].join("\n"))],
    components: [reminderControls(discordUserId)]
  });

  return true;
}

export async function checkShiftReminders(client, options = {}) {
  if (reminderScanRunning) return { checked: 0, sent: 0, skipped: 0, failed: 0 };
  reminderScanRunning = true;

  try {
    const now = Date.now();
    const activeShifts = await loadActiveShifts();
    const activeIds = new Set(activeShifts.map(shift => String(shift.id)));
    const disabledReminderUserIds = await loadDisabledReminderUserIds(activeShifts.map(shift => shift.discord_user_id));
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const shift of activeShifts) {
      const shiftId = String(shift.id || "");
      const discordUserId = String(shift.discord_user_id || "");
      if (!shiftId || !discordUserId) {
        skipped += 1;
        continue;
      }

      if (disabledReminderUserIds.has(discordUserId)) {
        skipped += 1;
        continue;
      }

      const hours = Math.floor(activeShiftSeconds(shift, now) / HOUR_SECONDS);
      const lastRemindedHour = remindedHoursByShiftId.get(shiftId) || 0;

      if (options.baseline) {
        remindedHoursByShiftId.set(shiftId, hours);
        skipped += 1;
        continue;
      }

      if (hours < 1 || hours <= lastRemindedHour) {
        if (!remindedHoursByShiftId.has(shiftId)) remindedHoursByShiftId.set(shiftId, hours);
        skipped += 1;
        continue;
      }

      try {
        await sendShiftReminder(client, shift, hours);
        remindedHoursByShiftId.set(shiftId, hours);
        sent += 1;
      } catch (error) {
        failed += 1;
        console.warn("Shift reminder failed", { shiftId, scope: shift.scope, reason: error?.message || String(error) });
      }
    }

    for (const shiftId of remindedHoursByShiftId.keys()) {
      if (!activeIds.has(shiftId)) remindedHoursByShiftId.delete(shiftId);
    }

    return { checked: activeShifts.length, sent, skipped, failed };
  } finally {
    reminderScanRunning = false;
  }
}

export function startShiftReminderLoop(client) {
  if (reminderInterval) return;

  checkShiftReminders(client, { baseline: true })
    .then(result => console.log(`Shift reminders baseline checked ${result.checked} active shift(s).`))
    .catch(error => console.error("Shift reminder baseline failed", error));

  reminderInterval = setInterval(() => {
    checkShiftReminders(client).catch(error => console.error("Shift reminder scan failed", error));
  }, CHECK_INTERVAL_MS);

  reminderInterval.unref?.();
}
