// 1. GLOBAL FIX FOR TIMEOUTS (Put this at the very top)
const { setGlobalDispatcher, Agent } = require("undici");
setGlobalDispatcher(new Agent({ connect: { timeout: 60_000 } }));

process.on("unhandledRejection", (error) => {
  console.error("[ UNHANDLED REJECTION ]", error);
});

// 2. Packages and Requires
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const mongoose = require("mongoose");
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");

const {
  Client,
  Events,
  GatewayIntentBits,
  SlashCommandBuilder,
  PermissionsBitField,
  ActivityType,
} = require("discord.js");

// 3. Script Variables
const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  rest: { timeout: 60000 },
});

const app = express();

// Custom Functions
function getTimestamp() {
  const date = new Date();
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function log(LOG, CODE) {
  const ts = `[ ${getTimestamp()} ]`;
  if (CODE == 1) console.log(`${ts} [ ${chalk.white("LOG")} ] | ${LOG}`);
  if (CODE == 2) console.log(`${ts} [ ${chalk.yellow("WARNING")} ] | ${LOG}`);
  if (CODE == 3) console.log(`${ts} [ ${chalk.red("ERROR")} ] | ${LOG}`);
  if (CODE == 4) console.log(`${ts} [ ${chalk.blue("SERVER")} ] | ${LOG}`);
}

// 4. MongoDB Configuration
const Setting = mongoose.model("Setting", new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, required: true },
}));

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => log("Connected to MongoDB Atlas", 1))
    .catch((err) => log(`MongoDB Connection Error: ${err}`, 3));
}

let targetDate = new Date("2026-06-07T20:00:00-05:00").getTime();

async function loadTargetDateFromDB() {
  if (!MONGO_URI) return;
  try {
    const doc = await Setting.findOne({ key: "targetDate" });
    if (doc) {
      targetDate = doc.value;
      log(`Restored target date from DB`, 1);
    }
  } catch (err) {
    log(`Error loading data from DB: ${err}`, 3);
  }
}
loadTargetDateFromDB();

// 5. Slash Commands
const ping = new SlashCommandBuilder().setName("ping").setDescription("Simple ping!");
const gettime = new SlashCommandBuilder().setName("gettime").setDescription("Get current countdown time");
const setdate = new SlashCommandBuilder()
  .setName("setdate")
  .setDescription("Set the countdown target date")
  .addStringOption(opt => opt.setName("date").setDescription("YYYY-MM-DD HH:MM").setRequired(true));

// 6. Bot Logic
client.on(Events.ClientReady, async () => {
  log(`${client.user.tag} is running!`, 1);
  try {
    await client.application.commands.set([ping, gettime, setdate]);
    log("Commands registered", 1);
  } catch (e) { log(`Command Registry Error: ${e.message}`, 3); }
  client.user.setActivity({ name: `a CountDown`, type: ActivityType.Watching });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply({ content: "Pong!", ephemeral: true });
  }

  if (interaction.commandName === "gettime") {
    const distance = targetDate - Date.now();
    if (distance <= 0) return interaction.reply("The countdown has ended!");
    
    const d = Math.floor(distance / 86400000);
    const h = Math.floor((distance % 86400000) / 3600000);
    const m = Math.floor((distance % 3600000) / 60000);
    const s = Math.floor((distance % 60000) / 1000);
    
    await interaction.reply(`⏳ Time remaining: **${d}d ${h}h ${m}m ${s}s**`);
  }

  if (interaction.commandName === "setdate") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({ content: "Missing Permissions", ephemeral: true });
    }
    
    await interaction.deferReply();
    const dateInput = interaction.options.getString("date");
    const newDate = new Date(dateInput.replace(" ", "T")).getTime();

    if (isNaN(newDate)) return interaction.editReply("Invalid format! Use YYYY-MM-DD HH:MM");

    targetDate = newDate;
    try {
      await Setting.findOneAndUpdate({ key: "targetDate" }, { value: targetDate }, { upsert: true });
      await interaction.editReply(`✅ Saved: **${new Date(targetDate).toLocaleString()}**`);
    } catch (err) {
      await interaction.editReply("Saved to memory only (DB Error).");
    }
  }
});

// START BOT
client.login(TOKEN).catch(err => log(`CRITICAL LOGIN ERROR: ${err}`, 3));

// 7. Web Dashboard
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(session({ secret: "secret", resave: false, saveUninitialized: true }));
app.get("/api/target", (req, res) => res.json({ targetDate }));
app.get("/", (req, res) => res.render("dashboard"));
app.listen(PORT, () => log(`Web Dashboard on port ${PORT}`, 4));