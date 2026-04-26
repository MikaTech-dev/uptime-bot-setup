import { Router } from "express";
import sendResponse from "../utils/response.middleware.js";
import { logger } from "../utils/logger.config.js";
import { client, startClient, } from "../../bedrock.js";
import bedrock from "bedrock-protocol";
import verifySchema from "../utils/validation.schema.js";
import { sendChat } from "../services/chat.bedrock.js";
import { isBotStillInServer } from "../services/client.status.js";

const mcHost = process.env.MC_HOST;
const router = Router();

router.get("/bot", async (req, res) => {
    try {
        logger.info(`Checking if Client is in server: ${mcHost}`)
        const isInServer = await isBotStillInServer()
        if ( isInServer === true) { 
            logger.info(`Client:${client.username}, is in server.`)
            return sendResponse(res, 200, true, "24/7 minecraft bot is up and running", { botInServer: isInServer} )
        } else if ( isInServer === false ) {
            logger.warn("Client is not in server.")
            return sendResponse(res, 499, true, "Bot is offline", { botInServer: isInServer} )
        }
    } catch (error) {
        logger.error("Error occurred while checking client: \n", error);
        return sendResponse(res, 503, true, "Unable to determine", { botInServer: isInServer}, error )
    }
});

router.get("/bot/reconnect", async (req, res) => {
    try {
        if (client.status == 4 || await isBotStillInServer() === true) {
            logger.info("Tried reconnect, bot is already in server")
            return sendResponse(res, 200, true, "Bot is already connected and spawned in server")
        };
        logger.warn("Closing client")
        client.close()
        logger.info("Reconnecting bot to server... ");
        setTimeout(() => startClient(), 2000)
        return sendResponse(res, 200, true, "Reconnecting bot to server... ");
    } catch (error) {
        logger.error("Error connecting bot to server: ", error);
        return sendResponse(res, 500, true, "Internal server error connecting bot to server", null, error);
    };
});

router.get("/bot/disconnect", async (req, res) => {
    try {
        const isInServer = await isBotStillInServer()
        if (isInServer === true) {
            logger.warn("Disconnecting/closing client connection...")
            client.close()
            logger.info("Client disconnected successfully")
            return sendResponse(res, 200, true, "Client connection disconnected successfully", null)
        }
        return sendResponse(res, 200, true, "Bot isn't connected yet", null)
    } catch (error) {
        logger.error ("Error disconnecting bot: \n", error)
        return sendResponse(res, 200, true, "Unable to disconnect bot", null, error)
    }
})

router.get("/bot/server", async (req, res) => {
    try {
        const serverInfo = await bedrock.ping({
            host: process.env.MC_HOST,
            port: parseInt(process.env.MC_PORT)
        });

        const serverStatus = {
            motd: serverInfo.motd,
            version: serverInfo.version,
            protocol: serverInfo.protocol,
            playersOnline: serverInfo.playersOnline,
            playersMax: serverInfo.playersMax,
            serverId: serverInfo.serverId,
            levelName: serverInfo.levelName,
            gamemodeId: serverInfo.gamemodeId
        };

        return sendResponse(res, 200, true, "Server info retrieved successfully", serverStatus);
    } catch (error) {
        logger.error("Failed to ping server:", error);
        return sendResponse(res, 500, false, "Failed to retrieve server info", null, error.message);
    }
})

router.post ("/bot/chat", async (req, res) => {
    try {
        logger.info('Validating request body...')
        logger.warn(req.body)
        const validationResult = await verifySchema(req.body)
        let { message } = validationResult
        logger.info('Sending message...')
        await sendChat(message)
        logger.info('Sent message successfully')
        return sendResponse(res, 200, true, 'Sent chat message to server successfully', message);
    } catch (error) {
        logger.error("Failed to send message: \n", error)
        return sendResponse (res, 500, false, 'Failed to send chat message to server', null, error);
    };
})

export default router;