import { registerRoleConnectionMetadata } from "../bot/services/discord-linked-roles.js";

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
