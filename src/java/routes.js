import { Router } from "express";
import sendResponse from "../utils/response.middleware.js";
import { logger } from "../utils/logger.config.js";

const router = Router();

/**
 * Creates Java bot routes.
 * Accepts a getter function that returns the current { bot, botState } and
 * actions to control bot lifecycle.
 *
 * @param {() => { bot: import("mineflayer").Bot | null, botState: object }} getBotContext
 * @param {{ disconnectBot?: (allowReconnect?: boolean) => boolean, connectBot?: () => void }} [actions]
 */
export function createJavaRoutes(getBotContext, actions = {}) {
    router.get("/", (_req, res) => {
        sendResponse(res, 200, true, "Java MC bot is up and running");
    });

    router.get("/bot", (req, res) => {
        try {
            const { bot, botState } = getBotContext();

            if (botState.isFailedToConnect) {
                return sendResponse(
                    res, 503, false,
                    `Bot failed to connect to host ${botState.host}`,
                    null,
                    botState.errorReason
                );
            }

            if (botState.isKicked) {
                return sendResponse(
                    res, 503, false,
                    `Bot was kicked from ${botState.host}`,
                    null,
                    `Kicked for: ${botState.kickReason}`
                );
            }

            if (!bot || !bot.entity) {
                return sendResponse(
                    res, 200, true,
                    `Bot is offline or spawning into ${botState.host}`
                );
            }

            // Detailed status requested
            if (req.query.status === "true") {
                const status = {
                    username: bot.username,
                    position: bot.entity?.position,
                    health: bot.health,
                    food: bot.food,
                    gameMode: bot.game?.gameMode,
                    difficulty: bot.game?.difficulty,
                    serverBrand: bot.game?.serverBrand,
                    isRaining: bot.isRaining,
                    uptime: process.uptime(),
                };
                return sendResponse(res, 200, true, "Bot status", status);
            }

            return sendResponse(res, 200, true, `Bot is active in ${botState.host}`);

        } catch (error) {
            logger.error("Error returning bot status\n", error);
            return sendResponse(res, 500, false, "Error returning bot status", null, error);
        }
    });

    router.get("/health", (_req, res) => {
        const { bot, botState } = getBotContext();
        const healthy = bot && bot.entity && !botState.isKicked && !botState.isFailedToConnect;
        return sendResponse(
            res,
            healthy ? 200 : 503,
            healthy,
            healthy ? "Healthy" : "Unhealthy"
        );
    });

    router.all(["/disconnect", "/bot/disconnect"], (req, res) => {
        try {
            const { bot } = getBotContext();
            const reconnect = req.query.reconnect === "true";

            if (!actions.disconnectBot) {
                return sendResponse(res, 500, false, "Disconnect action is not configured");
            }

            if (!bot) {
                return sendResponse(res, 200, true, "Bot is already disconnected");
            }

            actions.disconnectBot(reconnect);
            return sendResponse(
                res,
                200,
                true,
                `Bot disconnected successfully.${reconnect ? " Auto-reconnect is enabled." : " Auto-reconnect is paused."}`
            );
        } catch (error) {
            logger.error("Error disconnecting bot\n", error);
            return sendResponse(res, 500, false, "Error disconnecting bot", null, error);
        }
    });

    router.all(["/connect", "/bot/connect"], (_req, res) => {
        try {
            const { bot } = getBotContext();
            if (bot && bot.entity) {
                return sendResponse(res, 200, true, "Bot is already connected");
            }

            if (!actions.connectBot) {
                return sendResponse(res, 500, false, "Connect action is not configured");
            }

            actions.connectBot();
            return sendResponse(res, 200, true, "Bot connection sequence initiated");
        } catch (error) {
            logger.error("Error connecting bot\n", error);
            return sendResponse(res, 500, false, "Error connecting bot", null, error);
        }
    });

    return router;
}
