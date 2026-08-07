import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";

const paths = [
  "c:/Users/Owen/.gemini/config/.env",
  "c:/Users/Owen/Documents/Visual Studio Code/Holonet/.env",
  "c:/Users/Owen/Documents/Visual Studio Code/Holonet/.env.local",
  "c:/Users/Owen/Documents/Visual Studio Code/Holonet/bot/.env"
];

paths.forEach(p => {
  if (fs.existsSync(p)) {
    console.log("Loading env from:", p);
    dotenv.config({ path: p, override: true });
  }
});

import { fetchPowerbases } from "../bot/services/powerbase-api.js";

async function run() {
  const pbs = await fetchPowerbases();
  console.log("=== ALL POWERBASES IN DB ===");
  pbs.forEach(pb => {
    console.log(JSON.stringify({
      id: pb.id,
      name: pb.name,
      status: pb.status,
      created_at: pb.created_at,
      roster_message_id: pb.roster_message_id,
      leader_id: pb.leader_id
    }, null, 2));
  });
}

run().catch(console.error);
