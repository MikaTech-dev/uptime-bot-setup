import { Router } from "express";
import sendResponse from "../utils/response.middleware.js";
import { bot, botState, } from "../../bot.js";
import { logger } from "../utils/logger.config.js";

const host = process.env.HOST;
const router = Router();

router.get("/", (req, res) => {
    sendResponse(res, 200, true, "24/7 minecraft bot is up and running");
});

router.get("/bot", (req, res) => {
    try {
        if (botState.isFailedToConnect) {
            return sendResponse(res, 500, false, `Bot failed to connect to host ${host}`, null, botState.errorReason)
        };

        if (botState.isKicked) {
            return sendResponse(res, 404, false, `Bot was kicked`, null, `Kicked from server ${host} for reason: ${botState.kickReason}`)
        };

        if (!bot || !bot.entity) {
            return sendResponse (res, 200, true, `Bot is offline or spawning in ${host}`);
        };

        if (req.query.status === "true") {
            const botStatus = {
                name: bot.username,
                position: bot.entity?.position,
                health: bot.health,
                food: bot.food,
            };
            return sendResponse(res, 200, false, "Bot status returned successfully", botStats);
        };
        
        return sendResponse(res, 200, true, `Bot is active in server: ${host}`);

    } catch (error) {
        logger.info("An error occurred returning the bot's status \n", error);
        return sendResponse(res, 500, false, "An error occurred returning the bot's status", null, error);
    };
});

export default router;