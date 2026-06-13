import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "../config/index.js";

export const supabase = createClient(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);

export async function upsert(table, payload, options = {}) {
  const { data, error } = await supabase.from(table).upsert(payload, options).select();
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function insert(table, payload) {
  const { data, error } = await supabase.from(table).insert(payload).select();
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function audit(action, payload = {}) {
  return null;
}
