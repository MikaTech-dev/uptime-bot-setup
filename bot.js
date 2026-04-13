import mineflayer from "mineflayer";
import "dotenv/config"
import express from "express"
import { logger } from "./src/utils/logger.config.js";
import sendResponse from "./src/utils/response.middleware.js"
import router from "./src/bot_health/botInfoRoute.js"
import morgan from "morgan";
import { mineflayer as botViewer } from 'prismarine-viewer';

const app = express()
const host = process.env.HOST;
const username = process.env.USERNAME;
const mcPort = process.env.MC_PORT;
const mcVer = process.env.MC_VERSION;
const viewerPort = process.env.VIEWER_PORT;
const appPort = process.env.APP_PORT;

const botOptions = {
    host: host,
    username: username
}

if (mcPort) {
    botOptions.port = mcPort
}

if (mcVer) {
    botOptions.version = mcVer
}

const botState = {
    isKicked: false,
    isFailedToConnect: false,
    kickReason: null,
    errorReason: null,
}


const bot = new mineflayer.createBot(
    botOptions
);

bot.once("spawn", ()=> {
    logger.info(`Bot spawned into world ${host} successfully`)
    try{
        botViewer(bot, {
            port: viewerPort,
            firstPerson: false
        });
        logger.info(`Viewer active at http://localhost:${viewerPort}`);

    } catch (err){
        logger.error(`An error occurred viewing the bot at localhost:${viewerPort}\n Error desc: ${err}`);
    };
});

bot.on("kicked", (reason) => {
    // Clean response (Responses too varied to clean)
   /* try {
    reason = JSON.stringify(reason)
     const cleanReason = reason
        .replace(/§./g, '')
        .replace(/\\n/g, ' ')
        .trim();
    const reasonObject = JSON.parse(cleanReason);
    botState.kickReason = reasonObject.text
    if (botState.kickReason == "[object Object]")    throw new Error ("Error");
   } catch (error) {
        botState.kickReason = reason
        logger.warn("Failed to clean warning")
   } */
    botState.kickReason = reason
    botState.isKicked = true
    logger.error (`Bot kicked, ${host} said: \n${botState.kickReason}`);
});


bot.on("error", (err) => {
    botState.errorReason = err
    botState.isFailedToConnect = true
    logger.error (`Bot failed to connect to host "${host}"\n`, err);
});



// Server/express setup
app.listen(appPort || 3000, ()=> {
    logger.info(`Uptime Bot App started successfully, localhost:${appPort || 3000}`);
})


const stream = {
    write: (message) => logger.info(message.trim())
}

app.use(express.json())
app.use (morgan("tiny", { stream }))

app.use("/", router)


export {bot, botState}