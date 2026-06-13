import { Client, GatewayIntentBits, Partials } from "discord.js";
import { requireEnv } from "./config/index.js";
import { routeInteraction } from "./commands/index.js";
import { ephemeral, errorEmbed } from "./services/discord-ui.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember]
});

client.once("clientReady", () => {
  console.log(`Holonet bot online as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  try {
    const handled = await routeInteraction(interaction);
    if (!handled && interaction.isRepliable()) {
      const subcommand = interaction.isChatInputCommand?.() ? interaction.options?.getSubcommand(false) : "";
      const detail = interaction.commandName
        ? `Unknown bot interaction: /${interaction.commandName}${subcommand ? ` ${subcommand}` : ""}. Restart the bot and redeploy commands if this command was just changed.`
        : `Unknown bot interaction: ${interaction.customId || interaction.type}.`;
      await interaction.reply(ephemeral({ embeds: [errorEmbed(detail)] }));
    }
  } catch (error) {
    console.error(error);
    if (interaction.isRepliable()) {
      const payload = ephemeral({ embeds: [errorEmbed(error.message || "Unexpected bot error.")] });
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
      else await interaction.reply(payload).catch(() => {});
    }
  }
});

const tokenEnvName = ["DISCORD", "TOKEN"].join("_");
await client.login(requireEnv(tokenEnvName));
