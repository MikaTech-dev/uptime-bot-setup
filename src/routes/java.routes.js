import { Router } from "express";
import sendResponse from "../utils/response.middleware.js";
import { client, clientStatus, } from "../../bedrock.js";
import { logger } from "../utils/logger.config.js";

const host = process.env.MC_HOST;
const router = Router();

router.get("/", (req, res) => {
    sendResponse(res, 200, true, "24/7 minecraft bot is up and running");
});

router.get("/bot", (req, res) => {
    try {
        if (clientStatus.isError) {
            return sendResponse(res, 500, false, `Bot failed to connect to host ${host}`, null, clientStatus.errorReason)
        };

        if (clientStatus.isKicked) {
            return sendResponse(res, 404, false, `Bot was kicked`, null, `Kicked from server ${host} for reason: ${clientStatus.kickReason}`)
        };

        if (!bot || !bot.entity) {
            return sendResponse(res, 200, true, `Bot is offline or spawning in ${host}`);
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

router.get("/messages", (req, res) => {
    try {

    } catch (error) {

    }
})

export default router;