import { Router } from "express";
import sendResponse from "../utils/response.middleware.js";
import { logger } from "../utils/logger.config.js";

const router = Router();

/**
 * Creates Java bot routes.
 * Accepts a getter function that returns the current { bot, botState } so
 * the routes always reflect the latest reconnected bot instance.
 *
 * @param {() => { bot: import("mineflayer").Bot | null, botState: object }} getBotContext
 */
export function createJavaRoutes(getBotContext) {
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

    return router;
}
