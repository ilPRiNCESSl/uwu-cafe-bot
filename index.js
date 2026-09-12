import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import axios from "axios";

const token = process.env.BOT_TOKEN;
const appId = process.env.APPLICATION_ID;
const guildId = process.env.GUILD_ID;
const webhook = process.env.WEBHOOK;

const CHANNELS = {
  reviews: process.env.CH_REVIEWS,
  customers: process.env.CH_CUSTOMERS,
  location: process.env.CH_LOCATION,
  welcome: process.env.CH_WELCOME,
  status: process.env.CH_STATUS
};

async function sendWebhook(channelId, embed) {
  await axios.post(webhook, {
    content: `<#${channelId}>`,
    embeds: [embed]
  });
}

const commands = [
  new SlashCommandBuilder().setName("open").setDescription("Set UwU Café to OPEN"),
  new SlashCommandBuilder().setName("close").setDescription("Set UwU Café to CLOSED"),
  new SlashCommandBuilder()
    .setName("location")
    .setDescription("Post café location")
    .addStringOption(opt =>
      opt.setName("imageurl").setDescription("Optional image URL").setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Post welcome message")
    .addStringOption(opt =>
      opt.setName("imageurl").setDescription("Optional image URL").setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("review")
    .setDescription("Post a customer review")
    .addUserOption(opt =>
      opt.setName("employee").setDescription("Employee").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("rating").setDescription("Rating (e.g. ⭐⭐⭐⭐⭐)").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("comment").setDescription("Comment").setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName("client").setDescription("Client").setRequired(true)
    )
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
  console.log("Slash commands registered");
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "UwU Café", type: 0 }],
    status: "online"
  });
  registerCommands().catch(console.error);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "open") {
      await sendWebhook(CHANNELS.status, {
        title: "🟢 UwU Café — OPEN",
        description: "The UwU Café is now open. 🌸☕",
        color: 0x77DD77
      });
      await interaction.reply({ content: "Café set to **OPEN**.", ephemeral: true });
    }

    if (interaction.commandName === "close") {
      await sendWebhook(CHANNELS.status, {
        title: "🔴 UwU Café — CLOSED",
        description: "The UwU Café is now closed. 💗",
        color: 0xFF6961
      });
      await interaction.reply({ content: "Café set to **CLOSED**.", ephemeral: true });
    }

    if (interaction.commandName === "location") {
      const imageUrl = interaction.options.getString("imageurl");
      const embed = {
        title: "📍 UwU Café — Location",
        description: "Little Seoul, Los Santos. 🌸☕",
        color: 0xFFB6C1
      };
      if (imageUrl) embed.image = { url: imageUrl };
      await sendWebhook(CHANNELS.location, embed);
      await interaction.reply({ content: "Location posted.", ephemeral: true });
    }

    if (interaction.commandName === "welcome") {
      const imageUrl = interaction.options.getString("imageurl");
      const embed = {
        title: "🌸 Welcome to UwU Café 🌸",
        description: "Cozy vibes, sweet treats, soft atmosphere. 💗",
        color: 0xFFB6C1
      };
      if (imageUrl) embed.image = { url: imageUrl };
      await sendWebhook(CHANNELS.welcome, embed);
      await interaction.reply({ content: "Welcome message posted.", ephemeral: true });
    }

    if (interaction.commandName === "review") {
      const employee = interaction.options.getUser("employee");
      const rating = interaction.options.getString("rating");
      const comment = interaction.options.getString("comment");
      const clientUser = interaction.options.getUser("client");
      await sendWebhook(CHANNELS.reviews, {
        title: "⭐ New Customer Review",
        description:
          `👤 **Employee:** ${employee}\n\n` +
          `🌟 **Rating:** ${rating}\n\n` +
          `📝 **Comment:** ${comment}\n\n` +
          `✍️ **Client:** ${clientUser}`,
        color: 0xFFB6C1
      });
      await interaction.reply({ content: "Review posted.", ephemeral: true });
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      await interaction.reply({ content: "Something went wrong.", ephemeral: true });
    }
  }
});

client.login(token);
