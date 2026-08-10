import { supabaseRest } from "./modules/auth/session-store.js";

async function run() {
  console.log("Fetching schema...");
  try {
    const users = await supabaseRest("users?select=*&limit=1");
    console.log("users table:", Object.keys(users[0] || {}));

    const dUsers = await supabaseRest("discord_users?select=*&limit=1");
    console.log("discord_users table:", Object.keys(dUsers[0] || {}));
  } catch (e) {
    console.error(e);
  }
}

run();
