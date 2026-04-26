import { client, startClient } from "../../bedrock.js";
import { logger } from "../utils/logger.config.js";
import sendResponse from "../utils/response.middleware.js";

export const sendChat = async (message) => {
    try {
        client.queue ("text", {
            needs_translation: false,
            category: 'authored',
            type: 'chat',
            source_name: client.username,
            message: message,
            xuid: '',
            platform_chat_id: '',
            has_filtered_message: false,
            filtered_message: undefined
        })
        logger.info(`Sent text with message: ${message}`);
    } catch (error) {
        logger.info (`Failed to send message: ${message}\n`, error);
    }
}