import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPaths = [
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../.env.local"),
  path.resolve(__dirname, "../bot/.env"),
  "c:/Users/owenr/.gemini/config/.env"
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: true });
  }
}

import { supabase } from "../bot/services/supabase.js";
import { syncPowerbaseRosterMessage, fetchPowerbases } from "../bot/services/powerbase-api.js";
import { Client, GatewayIntentBits } from "discord.js";

async function run() {
  console.log("=== STARTING IMPERIAL POWERBASE & DISCORD MESSAGE ROTATION ===");

  // 1. Fetch all existing powerbases ordered by created_at ascending
  const { data: allPbs, error: fetchErr } = await supabase
    .from("powerbases")
    .select("*, powerbase_members(*)")
    .neq("status", "DISSOLVED")
    .order("created_at", { ascending: true });

  if (fetchErr) {
    console.error("Error fetching powerbases:", fetchErr);
    process.exit(1);
  }

  console.log(`Found ${allPbs.length} non-dissolved powerbases in database.`);
  allPbs.forEach((p, idx) => {
    console.log(`[${idx + 1}] ID: ${p.id} | Name: "${p.name}" | MsgID: ${p.roster_message_id} | Created: ${p.created_at}`);
  });

  // Identify standard powerbases (excluding any existing Imperial PB)
  const nonImperial = allPbs.filter(p => !p.is_imperial && !p.name?.toLowerCase().includes("imperial powerbase"));
  let imperialPb = allPbs.find(p => p.is_imperial || p.name?.toLowerCase().includes("imperial powerbase"));

  if (nonImperial.length < 2) {
    console.warn("Notice: Expected 2 active non-imperial powerbases, found:", nonImperial.length);
  }

  const oldestPB = nonImperial[0];
  const secondPB = nonImperial[1];

  const msg1Id = oldestPB?.roster_message_id;
  const msg2Id = secondPB?.roster_message_id;

  console.log("\nRotation mapping:");
  console.log(`- Slot 1 (Oldest Discord Msg: ${msg1Id}) -> IMPERIAL POWERBASE`);
  console.log(`- Slot 2 (2nd Discord Msg: ${msg2Id}) -> "${oldestPB?.name}" (formerly oldest)`);
  console.log(`- Slot 3 (New Discord Msg) -> "${secondPB?.name}" (formerly second)`);

  // 2. Ensure Imperial Powerbase exists in DB
  if (!imperialPb) {
    console.log("\nCreating Imperial Powerbase record in Supabase...");
    const { data: created, error: createErr } = await supabase
      .from("powerbases")
      .insert([{
        name: "Imperial Powerbase",
        description: "The supreme seat of authority within the Sith Empire, governed directly by the Lord Emperor and the Dark Council figureheads.",
        leader_id: "0", // Will be auto-populated on sync
        tier: 10,
        prestige: 0,
        status: "ACTIVE",
        is_imperial: true,
        roster_message_id: msg1Id
      }])
      .select();

    if (createErr) {
      console.error("Failed to create Imperial Powerbase in DB:", createErr);
      process.exit(1);
    }
    imperialPb = created[0];
    console.log("Imperial Powerbase created with ID:", imperialPb.id);
  } else {
    console.log("\nUpdating Imperial Powerbase record in Supabase...");
    const { error: updateImpErr } = await supabase
      .from("powerbases")
      .update({
        is_imperial: true,
        tier: 10,
        status: "ACTIVE",
        roster_message_id: msg1Id
      })
      .eq("id", imperialPb.id);

    if (updateImpErr) {
      console.error("Failed to update Imperial Powerbase:", updateImpErr);
      process.exit(1);
    }
  }

  // 3. Update Oldest PB to use Msg 2
  if (oldestPB) {
    console.log(`Updating "${oldestPB.name}" to roster_message_id: ${msg2Id}...`);
    await supabase
      .from("powerbases")
      .update({ roster_message_id: msg2Id })
      .eq("id", oldestPB.id);
  }

  // 4. Update 2nd PB to have null roster_message_id so it gets sent fresh as Msg 3
  if (secondPB) {
    console.log(`Clearing roster_message_id for "${secondPB.name}" so a new message is sent...`);
    await supabase
      .from("powerbases")
      .update({ roster_message_id: null })
      .eq("id", secondPB.id);
  }

  // 5. Connect Discord client to sync messages in exact order
  console.log("\nConnecting to Discord client to render and post messages in order...");
  const discordToken = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  if (!discordToken) {
    console.warn("DISCORD_TOKEN not found in process.env; message IDs in DB have been updated, but live Discord rendering requires running in an environment with DISCORD_TOKEN.");
    console.log("Once the bot starts or restarts, syncStoredPowerbaseRosters() will execute the sync automatically!");
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

  client.once("ready", async () => {
    console.log(`Discord client logged in as ${client.user.tag}`);
    try {
      console.log("1. Syncing Imperial Powerbase (Editing Msg 1)...");
      await syncPowerbaseRosterMessage(client, imperialPb.id);

      if (oldestPB) {
        console.log(`2. Syncing "${oldestPB.name}" (Editing Msg 2)...`);
        await syncPowerbaseRosterMessage(client, oldestPB.id);
      }

      if (secondPB) {
        console.log(`3. Syncing "${secondPB.name}" (Sending New Msg 3)...`);
        await syncPowerbaseRosterMessage(client, secondPB.id);
      }

      console.log("\n=== ROTATION & SYNC COMPLETED SUCCESSFULLY ===");
    } catch (err) {
      console.error("Error during Discord sync:", err);
    } finally {
      client.destroy();
      process.exit(0);
    }
  });

  await client.login(discordToken);
}

run().catch(err => {
  console.error("Fatal rotation error:", err);
  process.exit(1);
});
