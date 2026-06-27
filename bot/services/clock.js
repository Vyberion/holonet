import { audit, insert, supabase } from "./supabase.js";
import { getVerifiedProfile, inferScope } from "./roles.js";

export async function activeShift(discordUserId) {
  const { data, error } = await supabase
    .from("clock_shifts")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function clockIn(discordUserId, options = {}) {
  if (await activeShift(discordUserId)) throw new Error("ALREADY_CLOCKED_IN");

  const verified = await getVerifiedProfile(discordUserId);
  if (!verified) throw new Error("DISCORD_NOT_LINKED");

  const scope = options.scope || inferScope(verified.profile);
  if (!scope) throw new Error("NO_CLOCK_SCOPE");
  const isLate = Boolean(options.late);
  const lateMinutes = isLate ? Math.max(0, Number(options.lateMinutes) || 0) : 0;
  const startedAt = new Date(Date.now() - lateMinutes * 60 * 1000);

  const shift = await insert("clock_shifts", {
    scope,
    discord_user_id: discordUserId,
    roblox_user_id: verified.link.roblox_user_id,
    started_at: startedAt.toISOString(),
    late: isLate,
    late_minutes: isLate ? lateMinutes : null,
    status: "active"
  });

  await audit("clock.in", { actorDiscordId: discordUserId, robloxUserId: verified.link.roblox_user_id, scope });
  return shift;
}

export async function clockOut(discordUserId, options = {}) {
  const shift = await activeShift(discordUserId);
  if (!shift) throw new Error("NOT_CLOCKED_IN");

  const endedAt = new Date();
  const startedAt = new Date(shift.started_at);
  const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
  const { data, error } = await supabase
    .from("clock_shifts")
    .update({
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      clockout_late: Boolean(options.late),
      clockout_late_minutes: options.lateMinutes ?? null,
      status: "completed"
    })
    .eq("id", shift.id)
    .select()
    .single();
  if (error) throw error;

  await audit("clock.out", { actorDiscordId: discordUserId, robloxUserId: shift.roblox_user_id, scope: shift.scope });
  return data;
}

export async function latestShift(discordUserId) {
  const active = await activeShift(discordUserId);
  if (active) return active;

  const { data, error } = await supabase
    .from("clock_shifts")
    .select("*")
    .eq("discord_user_id", discordUserId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function adjustShiftTime(discordUserId, minutes) {
  const shift = await latestShift(discordUserId);
  const verified = await getVerifiedProfile(discordUserId);
  if (!verified) throw new Error("DISCORD_NOT_LINKED");

  if (!shift) {
    if (minutes <= 0) throw new Error("NO_SHIFT_FOUND");

    const scope = inferScope(verified.profile);
    if (!scope) throw new Error("NO_CLOCK_SCOPE");

    const now = new Date().toISOString();
    return insert("clock_shifts", {
      scope,
      discord_user_id: discordUserId,
      roblox_user_id: verified.link.roblox_user_id,
      started_at: now,
      ended_at: now,
      duration_seconds: Math.trunc(minutes * 60),
      adjustment_seconds: 0,
      status: "completed"
    });
  }

  const adjustmentSeconds = Number(shift.adjustment_seconds || 0) + Math.trunc(minutes * 60);
  const { data, error } = await supabase
    .from("clock_shifts")
    .update({ adjustment_seconds: adjustmentSeconds })
    .eq("id", shift.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function shiftTotals(discordUserId) {
  const { data, error } = await supabase
    .from("clock_shifts")
    .select("duration_seconds,adjustment_seconds,status,started_at")
    .eq("discord_user_id", discordUserId);
  if (error) throw error;

  const active = await activeShift(discordUserId);
  const now = Date.now();

  return (data || []).reduce((totals, shift) => {
    const liveSeconds = shift.status === "active"
      ? Math.max(0, Math.floor((now - new Date(shift.started_at).getTime()) / 1000))
      : Number(shift.duration_seconds || 0);

    totals.rawSeconds += liveSeconds;
    totals.adjustmentSeconds += Number(shift.adjustment_seconds || 0);
    return totals;
  }, {
    rawSeconds: 0,
    adjustmentSeconds: 0,
    get totalSeconds() {
      return Math.max(0, this.rawSeconds + this.adjustmentSeconds);
    },
    hasActiveShift: Boolean(active)
  });
}

export function formatDuration(seconds = 0) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export async function saveClockPanel({ scope, channelId, messageId, createdBy }) {
  const { error } = await supabase.from("clock_panels").upsert({
    scope,
    channel_id: channelId,
    message_id: messageId,
    created_by_discord_id: createdBy,
    updated_at: new Date().toISOString()
  }, { onConflict: "scope,channel_id,message_id" });
  if (error) throw error;
}
