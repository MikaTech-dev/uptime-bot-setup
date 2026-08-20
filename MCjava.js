import mineflayer from "mineflayer";
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import { logger } from "./src/utils/logger.config.js";
import { startAntiAfk } from "./src/java/antiAfk.js";
import { createJavaRoutes } from "./src/java/routes.js";

// ── Config ──────────────────────────────────────────────────────────

const MC_HOST = process.env.MC_HOST;
const MC_USERNAME = process.env.MC_USERNAME || process.env.USERNAME;
const MC_PORT = process.env.MC_PORT;
const MC_VERSION = process.env.MC_VERSION;
const IS_OFFLINE = process.env.IS_OFFLINE?.trim().toLowerCase() === "true";
const APP_PORT = parseInt(process.env.APP_PORT) || 3000;
const RECONNECT_DELAY_MS = parseInt(process.env.RECONNECT_DELAY) || 10_000;

// ── Bot state (shared with routes) ──────────────────────────────────

let bot = null;
let afkController = null;

const botState = {
    host: MC_HOST,
    isKicked: false,
    isFailedToConnect: false,
    kickReason: null,
    errorReason: null,
};

function resetBotState() {
    botState.isKicked = false;
    botState.isFailedToConnect = false;
    botState.kickReason = null;
    botState.errorReason = null;
}

// ── Bot creation & lifecycle ────────────────────────────────────────

function buildBotOptions() {
    const opts = {
        host: MC_HOST,
        username: MC_USERNAME,
        hideErrors: false,
    };

    if (MC_PORT) opts.port = parseInt(MC_PORT);
    if (MC_VERSION) opts.version = MC_VERSION;

    // Offline-mode servers don't need Microsoft auth
    if (IS_OFFLINE) {
        opts.auth = "offline";
    }

    return opts;
}

function createBot() {
    resetBotState();

    const opts = buildBotOptions();
    logger.info(`Connecting to ${MC_HOST}${MC_PORT ? ":" + MC_PORT : ""} as "${opts.username}"${MC_VERSION ? " (v" + MC_VERSION + ")" : ""}${IS_OFFLINE ? " [offline mode]" : ""}`);

    bot = mineflayer.createBot(opts);

    // ── Spawn & In-Game Events ──────────────────────────────────

    bot.once("spawn", () => {
        logger.info(`Bot spawned into ${MC_HOST} successfully as "${bot.username}"`);

        // Start randomized anti-AFK movement
        afkController = startAntiAfk(bot, {
            minDelay: 2_000,
            maxDelay: 12_000,
        });
    });

    bot.on("chat", (username, message) => {
        if (username === bot.username) return;
        logger.info(`[CHAT] <${username}> ${message}`);
    });

    bot.on("whisper", (username, message) => {
        logger.info(`[WHISPER] <${username}> ${message}`);
    });

    bot.on("death", () => {
        logger.warn(`Bot died in ${MC_HOST}`);
    });

    bot.on("respawn", () => {
        logger.info(`Bot respawned in ${MC_HOST}`);
    });

    bot.on("playerJoined", (player) => {
        if (player.username !== bot.username) {
            logger.info(`[JOIN] ${player.username} joined the server`);
        }
    });

    bot.on("playerLeft", (player) => {
        if (player.username !== bot.username) {
            logger.info(`[LEAVE] ${player.username} left the server`);
        }
    });

    // ── Kicked ───────────────────────────────────────────────────

    bot.on("kicked", (reason) => {
        botState.kickReason = reason;
        botState.isKicked = true;
        logger.error(`Bot kicked from ${MC_HOST}:\n${typeof reason === "object" ? JSON.stringify(reason) : reason}`);
    });

    // ── Error ────────────────────────────────────────────────────

    bot.on("error", (err) => {
        botState.errorReason = err;
        botState.isFailedToConnect = true;
        logger.error(`Bot error on ${MC_HOST}:`, err);
    });

    // ── Disconnect / end → auto reconnect ────────────────────────

    bot.on("end", (reason) => {
        logger.warn(`Bot disconnected from ${MC_HOST}: ${reason}`);
        botState.isFailedToConnect = true;

        // Stop the anti-AFK loop for the old bot
        if (afkController) {
            afkController.stop();
            afkController = null;
        }

        // Schedule reconnect
        logger.info(`Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
        setTimeout(() => {
            createBot();
        }, RECONNECT_DELAY_MS);
    });
}

// ── Express server ──────────────────────────────────────────────────

const app = express();

const stream = { write: (msg) => logger.info(msg.trim()) };
app.use(express.json());
app.use(morgan("tiny", { stream }));

// Routes — getter ensures they always see the latest bot instance
const javaRoutes = createJavaRoutes(() => ({ bot, botState }));
app.use("/", javaRoutes);

app.listen(APP_PORT, () => {
    logger.info(`Java bot server listening on http://localhost:${APP_PORT}`);
});

// ── Go ──────────────────────────────────────────────────────────────

createBot();

export { bot, botState };