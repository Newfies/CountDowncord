// Packages and Requires
const dotenv = require("dotenv").config();
const fs = require("fs");
const ini = require("ini");
const { exec } = require("child_process");
const pm2 = require("pm2");
const chalk = require("chalk");
const https = require("https");
const {
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionsBitField,
  ActivityType,
} = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();

// Script Variables
const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 4000;

// Dynamic Countdown Variable (Default value)
let targetDate = new Date("2026-06-07T20:00:00-05:00").getTime();

// Custom Functions
function getTimestamp() {
  const date = new Date();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function log(LOG, CODE) {
  const ts = `[ ${getTimestamp()} ]`;
  if (CODE == 1) console.log(`${ts} [ ${chalk.white("LOG")} ] | ${LOG}`);
  if (CODE == 2) console.log(`${ts} [ ${chalk.yellow("WARNING")} ] | ${LOG}`);
  if (CODE == 3) console.log(`${ts} [ ${chalk.red("ERROR")} ] | ${LOG}`);
  if (CODE == 4) console.log(`${ts} [ ${chalk.blue("SERVER")} ] | ${LOG}`);
}

// Slash Commands Definitions
const ping = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Simple ping command!");

const gettime = new SlashCommandBuilder()
  .setName("gettime")
  .setDescription("Get the remaining time for the countdown");

const setdate = new SlashCommandBuilder()
  .setName("setdate")
  .setDescription("Set the countdown target date")
  .addStringOption((option) =>
    option
      .setName("date")
      .setDescription("Format: YYYY-MM-DD HH:MM (e.g. 2026-12-25 18:00)")
      .setRequired(true)
  );

// Client Events
client.on("ready", async () => {
  log(`${client.user.tag} is now running!`, 1);

  await client.application.commands.set([ping, gettime, setdate]);
  log(`Slash commands registered`, 1);

  client.user.setActivity({
    name: `Managing a CountDown`,
    type: ActivityType.Watching,
  });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  // PING COMMAND
  if (interaction.commandName === "ping") {
    await interaction.reply({ content: "Pong!", ephemeral: true });
  }

  // GETTIME COMMAND
  if (interaction.commandName === "gettime") {
    const now = new Date().getTime();
    const distance = targetDate - now;

    if (distance <= 0) {
      return interaction.reply("The countdown has already ended!");
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((distance / (1000 * 60)) % 60);

    await interaction.reply({
      content: `⏳ Time remaining: **${days}d ${hours}h ${minutes}m**`,
    });
  }

  // SETDATE COMMAND
  if (interaction.commandName === "setdate") {
    // Only allow users with Manage Guild permission to change the date
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ManageGuild
      )
    ) {
      return interaction.reply({
        content: "You don't have permission to change the date.",
        ephemeral: true,
      });
    }

    const dateInput = interaction.options.getString("date");
    const newDate = new Date(dateInput).getTime();

    if (isNaN(newDate)) {
      return interaction.reply({
        content: "Invalid date format! Please use `YYYY-MM-DD HH:MM`",
        ephemeral: true,
      });
    }

    targetDate = newDate;
    log(`Countdown updated to: ${dateInput}`, 4);
    await interaction.reply(`✅ Countdown date updated to: **${dateInput}**`);
  }
});

client.login(TOKEN);

// App configuration
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SECRET || "fallback-secret",
    resave: false,
    saveUninitialized: true,
  })
);

// API endpoint for the web dashboard to get the current target
app.get("/api/target", (req, res) => {
  res.json({ targetDate });
});

app.get("/", (req, res) => res.render("dashboard"));

app.use((req, res) => {
  res.status(404).redirect("/");
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);