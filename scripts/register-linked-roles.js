import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerRoleConnectionMetadata } from "../bot/services/discord-linked-roles.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../bot/.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function main() {
  console.log("Registering Discord Linked Role Metadata Schema...");
  try {
    const result = await registerRoleConnectionMetadata();
    console.log("Successfully registered metadata with Discord API:", result);
  } catch (error) {
    console.error("Failed to register metadata:", error.message || error);
    process.exit(1);
  }
}

main();
