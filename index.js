import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const REQUIRED_ENV = ["BOT_TOKEN", "GUILD_ID"];
const missingEnv = REQUIRED_ENV.filter(name => !process.env[name]);
if (missingEnv.length > 0) {
  console.error(
    `Missing required environment variables: ${missingEnv.join(", ")}`
  );
  process.exit(1);
}

const token = process.env.BOT_TOKEN;
const guildId = process.env.GUILD_ID;

const CHANNELS = {
  status: "1548296719664545892",      // OPEN/CLOSE
  location: "1549513556133945424",    // Location
  reviews: "1548295628335878224",     // Reviews
  announcements: "1548166125924384782" // Announcements
};

const CONFIG_PATH = "./cafe-config.json";

const defaultConfig = {
  images: {
    open: "https://via.placeholder.com/400x300?text=OPEN",
    close: "https://via.placeholder.com/400x300?text=CLOSED",
    location: "https://via.placeholder.com/400x300?text=LOCATION",
    review: "https://via.placeholder.com/400x300?text=REVIEW",
    announce: "https://via.placeholder.com/400x300?text=ANNOUNCEMENT"
  },
  text: {
    open: {
      title: "🟢 UwU Café — OPEN",
      description:
        "Employee {employee} is now available at the counter!\n\nWe're ready to serve you delicious drinks and desserts! ☕🍰",
      footer: "UwU Café • Come in and relax"
    },
    close: {
      title: "🔴 UwU Café — CLOSED",
      description:
        "Employee {employee} is no longer available at the counter.\n\nThank you for visiting — see you soon! 🌙🌸",
      footer: "UwU Café • See you next time"
    },
    location: {
      title: "📍 UwU Café — Location",
      description: "725 Little Seoul Avenue\nLos Santos\n☕✨",
      footer: "UwU Café • Find us and stay awhile"
    },
    review: {
      title: "⭐ New Customer Review",
      description:
        "👤 **Employee:** {employee}\n\n" +
        "🌟 **Rating:** {rating}\n\n" +
        "📝 **Comment:** {comment}\n\n" +
        "✍️ **Client:** {client}",
      footer: "UwU Café • Thank you for your feedback"
    },
    announce: {
      title: "{title}",
      description: "{message}",
      footer: "UwU Café • Announcement"
    }
  }
};

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return defaultConfig;
  }
  try {
    const saved = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    return {
      ...defaultConfig,
      ...saved,
      images: { ...defaultConfig.images, ...(saved.images || {}) },
      text: { ...defaultConfig.text, ...(saved.text || {}) }
    };
  } catch (error) {
    console.warn(
      "Could not read cafe-config.json; using default café content.",
      error.message
    );
    return defaultConfig;
  }
}

let cafeConfig = loadConfig();

function saveConfig() {
  writeFileSync(CONFIG_PATH, `${JSON.stringify(cafeConfig, null, 2)}\n`);
}

function fillTemplate(template, values) {
  return template.replace(
    /\{(\w+)\}/g,
    (_, key) => values[key] ?? `{${key}}`
  );
}

function configuredEmbed(section, values = {}, color) {
  const copy = cafeConfig.text[section];
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(fillTemplate(copy.title, values))
    .setDescription(fillTemplate(copy.description, values))
    .setImage(cafeConfig.images[section])
    .setFooter({ text: fillTemplate(copy.footer, values) });
}

async function sendToChannel(channelId, embed) {
  const channel = await client.channels.fetch(channelId);
  if (
    !channel ||
    !channel.isTextBased() ||
    typeof channel.send !== "function"
  ) {
    throw new Error(
      `Channel ${channelId} is not a text channel the bot can use.`
    );
  }
  await channel.send({ embeds: [embed] });
}

const commands = [
  new SlashCommandBuilder()
    .setName("open")
    .setDescription("Announce that UwU Café is open")
    .addUserOption(option =>
      option
        .setName("employee")
        .setDescription("Employee at the counter")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Announce that UwU Café is closed")
    .addUserOption(option =>
      option
        .setName("employee")
        .setDescription("Employee leaving the counter")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("location")
    .setDescription("Post the UwU Café location")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("review")
    .setDescription("Send a customer review to the reviews channel")
    .addUserOption(option =>
      option
        .setName("employee")
        .setDescription("Employee")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("rating")
        .setDescription("Rating from 1 to 5")
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("comment")
        .setDescription("Comment")
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName("client")
        .setDescription("Client")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Post a fancy announcement")
    .addStringOption(opt =>
      opt
        .setName("title")
        .setDescription("Announcement title")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName("message")
        .setDescription("Announcement message")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("setimage")
    .setDescription("Change an image used by the café bot")
    .addStringOption(option =>
      option
        .setName("type")
        .setDescription("Which image to change")
        .setRequired(true)
        .addChoices(
          { name: "OPEN status", value: "open" },
          { name: "CLOSED status", value: "close" },
          { name: "Location", value: "location" },
          { name: "Review", value: "review" },
          { name: "Announcement", value: "announce" }
        )
    )
    .addStringOption(option =>
      option
        .setName("url")
        .setDescription("Direct public image URL")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("images")
    .setDescription("Show the currently configured café images")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);
  const applicationId = client.user.id;
  await rest.put(
    Routes.applicationGuildCommands(applicationId, guildId),
    { body: commands }
  );
  console.log("Slash commands registered");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

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
      const employee = interaction.options.getUser("employee");
      await sendToChannel(
        CHANNELS.status,
        configuredEmbed("open", { employee }, 0x77DD77)
      );
      await interaction.reply({
        content: "Café set to **OPEN**.",
        flags: 64
      });
    }

    if (interaction.commandName === "close") {
      const employee = interaction.options.getUser("employee");
      await sendToChannel(
        CHANNELS.status,
        configuredEmbed("close", { employee }, 0xFF6961)
      );
      await interaction.reply({
        content: "Café set to **CLOSED**.",
        flags: 64
      });
    }

    if (interaction.commandName === "location") {
      await sendToChannel(
        CHANNELS.location,
        configuredEmbed("location", {}, 0xFFB6C1)
      );
      await interaction.reply({
        content: "Location posted.",
        flags: 64
      });
    }

    if (interaction.commandName === "review") {
      const employee = interaction.options.getUser("employee");
      const ratingValue = interaction.options.getInteger("rating");
      const comment = interaction.options.getString("comment");
      const clientUser = interaction.options.getUser("client");

      await sendToChannel(
        CHANNELS.reviews,
        configuredEmbed(
          "review",
          {
            employee,
            rating: "⭐".repeat(ratingValue),
            comment,
            client: clientUser
          },
          0xFFB6C1
        )
      );
      await interaction.reply({
        content: "Review posted.",
        flags: 64
      });
    }

    if (interaction.commandName === "announce") {
      const title = interaction.options.getString("title");
      const message = interaction.options.getString("message");

      await sendToChannel(
        CHANNELS.announcements,
        configuredEmbed("announce", { title, message }, 0xFFB6C1)
      );
      await interaction.reply({
        content: "Announcement posted.",
        flags: 64
      });
    }

    if (interaction.commandName === "setimage") {
      const type = interaction.options.getString("type");
      const url = interaction.options.getString("url");

      try {
        new URL(url);
      } catch {
        await interaction.reply({
          content: "Please provide a valid public image URL.",
          flags: 64
        });
        return;
      }

      cafeConfig.images = { ...cafeConfig.images, [type]: url };
      saveConfig();

      await interaction.reply({
        content: `The **${type.toUpperCase()}** image has been updated.`,
        flags: 64
      });
    }

    if (interaction.commandName === "images") {
      const formatImage = imageUrl => imageUrl || "Not configured";
      await interaction.reply({
        content:
          `**Current UwU Café images**\n` +
          `OPEN: ${formatImage(cafeConfig.images.open)}\n` +
          `CLOSED: ${formatImage(cafeConfig.images.close)}\n` +
          `LOCATION: ${formatImage(cafeConfig.images.location)}\n` +
          `REVIEW: ${formatImage(cafeConfig.images.review)}\n` +
          `ANNOUNCE: ${formatImage(cafeConfig.images.announce)}`,
        flags: 64
      });
    }
  } catch (error) {
    console.error(error);
    if (!interaction.replied) {
      await interaction.reply({
        content: "Something went wrong.",
        flags: 64
      });
    }
  }
});

client.login(token);
