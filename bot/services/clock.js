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

export async function clockIn(discordUser, options = {}) {
  const discordUserId = discordUser.id;
  const discordUsername = discordUser.username;
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
    discord_username: discordUsername,
    roblox_user_id: verified.link.roblox_user_id,
    roblox_username: verified.profile?.name,
    started_at: startedAt.toISOString(),
    late: isLate,
    late_minutes: isLate ? lateMinutes : null,
    status: "active"
  });

  await audit("clock.in", { actorDiscordId: discordUserId, actorDiscordUsername: discordUsername, robloxUserId: verified.link.roblox_user_id, robloxUsername: verified.profile?.name, scope });
  return shift;
}

export async function clockOut(discordUser, options = {}) {
  const discordUserId = discordUser.id;
  const discordUsername = discordUser.username;
  const shift = await activeShift(discordUserId);
  if (!shift) throw new Error("NOT_CLOCKED_IN");

  const endedAt = new Date();
  const startedAt = new Date(shift.started_at);
  const isLate = Boolean(options.late);
  const lateMinutes = isLate ? Math.max(0, Number(options.lateMinutes) || 0) : 0;
  const elapsedSeconds = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
  const durationSeconds = Math.max(0, elapsedSeconds - lateMinutes * 60);
  const { data, error } = await supabase
    .from("clock_shifts")
    .update({
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      clockout_late: isLate,
      clockout_late_minutes: isLate ? lateMinutes : null,
      status: "completed"
    })
    .eq("id", shift.id)
    .select()
    .single();
  if (error) throw error;

  await audit("clock.out", { actorDiscordId: discordUserId, actorDiscordUsername: discordUsername, robloxUserId: shift.roblox_user_id, robloxUsername: shift.roblox_username, scope: shift.scope });
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

export async function adjustShiftTime(discordUser, minutes) {
  const discordUserId = discordUser.id;
  const discordUsername = discordUser.username;
  const verified = await getVerifiedProfile(discordUserId);
  if (!verified) throw new Error("DISCORD_NOT_LINKED");

  let scope = inferScope(verified.profile);
  if (!scope) {
    const shift = await latestShift(discordUserId);
    if (shift) scope = shift.scope;
  }
  if (!scope) throw new Error("NO_CLOCK_SCOPE");

  const now = new Date().toISOString();
  const data = await insert("clock_shifts", {
    scope,
    discord_user_id: discordUserId,
    discord_username: discordUsername,
    roblox_user_id: verified.link.roblox_user_id,
    roblox_username: verified.profile?.name,
    started_at: now,
    ended_at: now,
    duration_seconds: 0,
    adjustment_seconds: Math.trunc(minutes * 60),
    status: "completed"
  });

  return data;
}

export async function shiftTotals(discordUserId, scopes = null) {
  let query = supabase
    .from("clock_shifts")
    .select("duration_seconds,adjustment_seconds,status,started_at")
    .eq("discord_user_id", discordUserId);

  if (Array.isArray(scopes) && scopes.length) query = query.in("scope", scopes);
  else if (typeof scopes === "string" && scopes) query = query.eq("scope", scopes);

  const { data, error } = await query;
  if (error) throw error;

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
    hasActiveShift: (data || []).some(shift => shift.status === "active")
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
