import { audit, insert, supabase } from "./supabase.js";
import { getVerifiedProfile, inferScope } from "./roles.js";

export async function activeShift(discordUserId) {
  const idStr = typeof discordUserId === "object" ? String(discordUserId?.id || "") : String(discordUserId || "");
  const verified = await getVerifiedProfile(idStr).catch(() => null);
  const discordId = verified?.link?.discord_user_id ? String(verified.link.discord_user_id) : idStr;
  const robloxId = verified?.link?.roblox_user_id ? String(verified.link.roblox_user_id) : null;

  let query = supabase
    .from("clock_shifts")
    .select("*")
    .eq("status", "active");

  if (robloxId && discordId) {
    query = query.or(`discord_user_id.eq.${discordId},roblox_user_id.eq.${robloxId}`);
  } else {
    query = query.or(`discord_user_id.eq.${discordId},roblox_user_id.eq.${discordId}`);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function clockIn(discordUser, options = {}) {
  const discordUserId = typeof discordUser === "object" ? discordUser?.id : String(discordUser || "");
  const discordUsername = typeof discordUser === "object" ? (discordUser?.username || discordUser?.tag || "") : "";
  if (await activeShift(discordUserId)) throw new Error("ALREADY_CLOCKED_IN");

  const verified = await getVerifiedProfile(discordUserId);
  if (!verified) throw new Error("DISCORD_NOT_LINKED");

  const inferred = inferScope(verified.profile);
  const scope = (inferred === "darkCouncil") ? "darkCouncil" : (options.scope || inferred);
  if (!scope) throw new Error("NO_CLOCK_SCOPE");
  const isLate = Boolean(options.late);
  const lateMinutes = isLate ? Math.max(0, Number(options.lateMinutes) || 0) : 0;
  const startedAt = new Date(Date.now() - lateMinutes * 60 * 1000);

  const shift = await insert("clock_shifts", {
    scope,
    discord_user_id: discordUserId,
    discord_username: discordUsername || verified?.link?.discord_username || "",
    roblox_user_id: String(verified.link.roblox_user_id),
    roblox_username: String(verified.profile?.name || ""),
    started_at: startedAt.toISOString(),
    late: isLate,
    late_minutes: isLate ? lateMinutes : null,
    status: "active"
  });

  await audit("clock.in", { actorDiscordId: discordUserId, actorDiscordUsername: discordUsername, robloxUserId: verified.link.roblox_user_id, robloxUsername: verified.profile?.name, scope });
  return shift;
}

export async function clockOut(discordUser, options = {}) {
  const discordUserId = typeof discordUser === "object" ? discordUser?.id : String(discordUser || "");
  const discordUsername = typeof discordUser === "object" ? (discordUser?.username || discordUser?.tag || "") : "";
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

  const idStr = typeof discordUserId === "object" ? String(discordUserId?.id || "") : String(discordUserId || "");
  const verified = await getVerifiedProfile(idStr).catch(() => null);
  const discordId = verified?.link?.discord_user_id ? String(verified.link.discord_user_id) : idStr;
  const robloxId = verified?.link?.roblox_user_id ? String(verified.link.roblox_user_id) : null;

  let query = supabase
    .from("clock_shifts")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1);

  if (robloxId && discordId) {
    query = query.or(`discord_user_id.eq.${discordId},roblox_user_id.eq.${robloxId}`);
  } else {
    query = query.or(`discord_user_id.eq.${discordId},roblox_user_id.eq.${discordId}`);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function adjustShiftTime(discordUser, minutes, overrideScope = null) {
  const discordUserId = typeof discordUser === "object" ? String(discordUser?.id || "") : String(discordUser || "");
  const discordUsername = typeof discordUser === "object" ? String(discordUser?.username || discordUser?.tag || "") : "";

  const verified = await getVerifiedProfile(discordUserId).catch(() => null);
  const discordId = verified?.link?.discord_user_id ? String(verified.link.discord_user_id) : discordUserId;
  const robloxId = verified?.link?.roblox_user_id ? String(verified.link.roblox_user_id) : null;

  const inferred = verified ? inferScope(verified.profile) : null;
  let scope = (inferred === "darkCouncil") ? "darkCouncil" : (overrideScope || inferred);
  if (!scope && verified) {
    const shift = await latestShift(discordUserId);
    if (shift) scope = shift.scope;
  }
  if (!scope) scope = "reavers";

  const targetSeconds = Math.trunc(minutes * 60);

  if (targetSeconds >= 0) {
    const now = new Date().toISOString();
    return await insert("clock_shifts", {
      scope,
      discord_user_id: discordId || null,
      discord_username: discordUsername || verified?.link?.discord_username || "",
      roblox_user_id: robloxId || null,
      roblox_username: verified?.profile?.name || null,
      started_at: now,
      ended_at: now,
      duration_seconds: targetSeconds,
      adjustment_seconds: 0,
      status: "completed"
    });
  } else {
    let secondsToRemove = Math.abs(targetSeconds);

    let query = supabase
      .from("clock_shifts")
      .select("id, duration_seconds")
      .eq("status", "completed")
      .order("started_at", { ascending: false });

    if (robloxId && discordId) {
      query = query.or(`discord_user_id.eq.${discordId},roblox_user_id.eq.${robloxId}`);
    } else {
      query = query.or(`discord_user_id.eq.${discordId},roblox_user_id.eq.${discordId}`);
    }

    if (overrideScope) query = query.eq("scope", overrideScope);

    const { data: shifts, error } = await query;
    if (error) throw error;

    for (const shift of (shifts || [])) {
      if (secondsToRemove <= 0) break;
      const currentDuration = Number(shift.duration_seconds || 0);
      if (currentDuration <= 0) continue;

      if (currentDuration >= secondsToRemove) {
        const newDuration = currentDuration - secondsToRemove;
        secondsToRemove = 0;
        await supabase
          .from("clock_shifts")
          .update({ duration_seconds: newDuration })
          .eq("id", shift.id);
      } else {
        secondsToRemove -= currentDuration;
        await supabase
          .from("clock_shifts")
          .update({ duration_seconds: 0 })
          .eq("id", shift.id);
      }
    }

    return { scope, discord_user_id: discordId };
  }
}

export async function setShiftTime(discordUser, minutes, overrideScope = null) {
  const discordUserId = typeof discordUser === "object" ? String(discordUser?.id || "") : String(discordUser || "");
  const discordUsername = typeof discordUser === "object" ? String(discordUser?.username || discordUser?.tag || "") : "";

  const verified = await getVerifiedProfile(discordUserId).catch(() => null);
  const discordId = verified?.link?.discord_user_id ? String(verified.link.discord_user_id) : discordUserId;
  const robloxId = verified?.link?.roblox_user_id ? String(verified.link.roblox_user_id) : null;

  const inferred = verified ? inferScope(verified.profile) : null;
  let scope = (inferred === "darkCouncil") ? "darkCouncil" : (overrideScope || inferred);
  if (!scope && verified) {
    const shift = await latestShift(discordUserId);
    if (shift) scope = shift.scope;
  }
  if (!scope) scope = "reavers";

  const targetSeconds = Math.max(0, Math.trunc(minutes * 60));

  let deleteQuery = supabase
    .from("clock_shifts")
    .delete()
    .eq("status", "completed");

  if (robloxId && discordId) {
    deleteQuery = deleteQuery.or(`discord_user_id.eq.${discordId},roblox_user_id.eq.${robloxId}`);
  } else {
    deleteQuery = deleteQuery.or(`discord_user_id.eq.${discordId},roblox_user_id.eq.${discordId}`);
  }

  if (overrideScope) deleteQuery = deleteQuery.eq("scope", overrideScope);
  const { error: delErr } = await deleteQuery;
  if (delErr) throw delErr;

  if (targetSeconds > 0) {
    const now = new Date().toISOString();
    return await insert("clock_shifts", {
      scope,
      discord_user_id: discordId || null,
      discord_username: discordUsername || verified?.link?.discord_username || "",
      roblox_user_id: robloxId || null,
      roblox_username: verified?.profile?.name || null,
      started_at: now,
      ended_at: now,
      duration_seconds: targetSeconds,
      adjustment_seconds: 0,
      status: "completed"
    });
  }

  return { scope, discord_user_id: discordId };
}

export async function shiftTotals(discordUserId, visibleScopes = []) {
  const idStr = typeof discordUserId === "object" ? String(discordUserId?.id || "") : String(discordUserId || "");
  const verified = await getVerifiedProfile(idStr).catch(() => null);
  const discordId = verified?.link?.discord_user_id ? String(verified.link.discord_user_id) : idStr;
  const robloxId = verified?.link?.roblox_user_id ? String(verified.link.roblox_user_id) : null;

  let query = supabase
    .from("clock_shifts")
    .select("duration_seconds,adjustment_seconds,status,started_at,scope");

  if (robloxId && discordId) {
    query = query.or(`discord_user_id.eq.${discordId},roblox_user_id.eq.${robloxId}`);
  } else {
    query = query.or(`discord_user_id.eq.${discordId},roblox_user_id.eq.${discordId}`);
  }

  if (visibleScopes.length > 0 && !visibleScopes.includes("all")) {
    query = query.in("scope", visibleScopes);
  }

  const { data, error } = await query;
  if (error) throw error;

  const now = Date.now();
  let totalSeconds = 0;
  let hasActiveShift = false;

  for (const row of (data || [])) {
    if (row.status === "active") {
      hasActiveShift = true;
      const started = new Date(row.started_at).getTime();
      totalSeconds += Math.max(0, Math.floor((now - started) / 1000));
    } else {
      totalSeconds += Number(row.duration_seconds || 0);
    }
    totalSeconds += Number(row.adjustment_seconds || 0);
  }

  return { totalSeconds: Math.max(0, totalSeconds), hasActiveShift };
}

export function formatDuration(seconds = 0) {
  const total = Math.max(0, Math.trunc(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export async function saveClockPanel(scope, channelId, messageId, createdBy) {
  const { error } = await supabase.from("clock_panels").upsert({
    scope,
    channel_id: channelId,
    message_id: messageId,
    created_by_discord_id: createdBy,
    updated_at: new Date().toISOString()
  }, { onConflict: "scope,channel_id,message_id" });
  if (error) throw error;
}

export async function healMisattributedShifts() {
  let fixed = 0;
  try {
    const pageSize = 1000;
    const allShifts = [];

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("clock_shifts")
        .select("id,discord_user_id,roblox_user_id,scope")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      allShifts.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    if (!allShifts.length) return fixed;

    const { data: links } = await supabase
      .from("verification_links")
      .select("discord_user_id,roblox_user_id");

    const discordToRoblox = new Map();
    const robloxToDiscord = new Map();
    (links || []).forEach(l => {
      if (l.discord_user_id && l.roblox_user_id) {
        discordToRoblox.set(String(l.discord_user_id), String(l.roblox_user_id));
        robloxToDiscord.set(String(l.roblox_user_id), String(l.discord_user_id));
      }
    });

    const profileCache = new Map();

    for (const shift of allShifts) {
      const discordId = shift.discord_user_id ? String(shift.discord_user_id) : (robloxToDiscord.get(String(shift.roblox_user_id)) || "");
      const robloxId = shift.roblox_user_id ? String(shift.roblox_user_id) : (discordToRoblox.get(String(shift.discord_user_id)) || "");

      const cacheKey = robloxId || discordId;
      if (!cacheKey) continue;

      let verified;
      if (profileCache.has(cacheKey)) {
        verified = profileCache.get(cacheKey);
      } else {
        if (discordId) {
          verified = await getVerifiedProfile(discordId).catch(() => null);
        }
        if (!verified?.profile && robloxId) {
          const { loadProfileForRoblox } = await import("./roblox.js");
          const profile = await loadProfileForRoblox(robloxId).catch(() => null);
          if (profile) verified = { link: { roblox_user_id: robloxId }, profile };
        }
        profileCache.set(cacheKey, verified);
      }

      if (!verified?.profile) continue;
      const correct = inferScope(verified.profile);
      if (correct && correct !== shift.scope) {
        await supabase.from("clock_shifts").update({ scope: correct }).eq("id", shift.id);
        console.log(`[Heal] Shift ${shift.id}: ${shift.scope} → ${correct} for user ${cacheKey}`);
        fixed++;
      }
    }
  } catch (err) {
    console.error("healMisattributedShifts error:", err);
  }
  return fixed;
}
