import { logger } from "../utils/logger.config.js";
import { askGemini } from "./ask.gemini.js";
import { sendChat } from "./chat.bedrock.js";

export const handleText = async (data) => {
    if (data.category !== 'message_only') {
        logger.info(data);
    }
    if (data.message && data.type == 'chat') {
        // force bot to reconnect when it's time to sleep
        if (data.message == "!bot sleep") {
            logger.warn(`Sleep cmd recieved, rejoining...`)
            client.close();
            setTimeout(() => startClient(), 9000);
        }
    }
    if (data.message === 'chat.type.sleeping') {
        logger.warn(`Player(s) sleeping, rejoining...`)
        client.close();
        setTimeout(() => startClient(), 9000);
    };

    const aiRegex = /^!ai/i;
    if ( aiRegex.test(data.message) ) {
        try {
            let userMessage = data.message
            logger.warn("Regex match successful, sending message/query to Gemini...")
                
            const geminiResponse = await askGemini(userMessage)

            logger.info("Gemini's response:", geminiResponse)
            await sendChat(geminiResponse)

        } catch (error) {
            logger.error("An error ocurred processing and sending AI targeted message", error)
        }
    }
}