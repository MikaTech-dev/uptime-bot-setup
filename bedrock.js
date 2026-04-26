import bedrock from "bedrock-protocol"
import { logger } from "./src/utils/logger.config.js"
import morgan from "morgan"
import express from "express"
import cors from "cors"
import "dotenv/config"
import sendResponse from "./src/utils/response.middleware.js"
import router from "./src/routes/bedrock.routes.js"
import { isBotStillInServer } from "./src/services/client.status.js"
import { antiAFKAnim } from "./src/services/client.movement.js"
import { handleText } from "./src/services/handle.texts.js"
import { sendChat } from "./src/services/chat.bedrock.js"

// Env variables
process.env.DEBUG = 'minecraft-protocol'

const mcHost = process.env.MC_HOST;
const username = process.env.MC_USERNAME;
const mcPort = parseInt(process.env.MC_PORT);
const mcVer = process.env.MC_VERSION;
const viewerPort = process.env.VIEWER_PORT;
const appPort = process.env.APP_PORT;
const isOfflineAccount = Boolean(process.env.IS_OFFLINE);

const botOptions = {
    host: mcHost,
    username: username,
    ... (mcPort && { port: mcPort }), // shorthand conditional appending with spread opp: ... ()
    ... (mcVer && { version: mcVer }),
    ... (isOfflineAccount && { offline: isOfflineAccount }),
    raknetBackend: 'raknet-native',
    connectTimeout: 30000
};

logger.info(botOptions);

const clientStatus = {
    isOnline: false,
    isSpawned: false,
    isKicked: false,
    isDisconnected: false,
    isError: false,
    kickReason: null,
    disconnectReason: null,
    errorReason: null
}

export let client
export let runtimeEntityId

function startClient() {
    client = bedrock.createClient(botOptions);

    client.lastHeartbeat = 0

    client.on('heartbeat', () => {
        logger.info("Received heartbeat packet")
        client.lastHeartbeat = Date.now();
    });

    client.on("join", (packet) => {
        logger.info('Bot authenticated & Joined successfully, spawning...')
    });

    client.on('start_game', (packet) => {
        // Bedrock stores the spawn point in the spawn_position object
        client.pos = {
            x: packet.spawn_position.x,
            y: packet.spawn_position.y,
            z: packet.spawn_position.z
        };
        runtimeEntityId = packet.runtime_entity_id; // entity id seems to be giving issues, it is only needed to cause swing for anti afk
        logger.info(`Initial position set from start_game: ${client.pos.x}, ${client.pos.y}, ${client.pos.z}`);
    });

    client.on('spawn', (packet) => {
        logger.info('Spawned successfully, attempting to announce');
        sendChat(`Bot: ${client.username}, just joined`)
        
        logger.info(`My EID: ${client.entityId} (Type: ${typeof client.entityId})`);
        
        client.on('move_player', (packet) => {
            // Use BigInt() to ensure both sides of the comparison match types
            if (BigInt(packet.runtime_id) === BigInt(client.entityId)) {
                client.pos = packet.position;
            }
        });

        client.on('text', (packet) => {
            handleText(packet, client)
        });

    });


    // client kicked logger
    client.on('kick', (packet) => {
        logger.error('Client was kicked from the server:\n', packet);
        clientStatus.isKicked = true;
        startClient();
    })

    // client disconnect logger
    client.on('disconnect', (packet) => {
        logger.error('Client disconnected:\n', packet);
        clientStatus.isDisconnected = true;
    })

    // Client error logger
    client.on('error', (err) => {
        logger.error('An error ocurred: \n', err);
        clientStatus.isError = true;
        // Attempt reconnect
        startClient();
    })

    return client
}

logger.warn("Starting Client")
let clientInstance = startClient()
// startAntiAFK(clientInstance)

export { startClient };


/* bedrock.ping({
    host: mcHost,
    port: mcPort
}).then(res => {
    logger.info("\n", res)
}).catch((err) => {
    logger.error(err)
}) */

const stream = {
    write: (message) => logger.info(message.trim())
}

const app = express()

app.use(cors({
    // Dynamically allow the origin of the request
    origin: function (origin, callback) {
        // If there's no origin (like a mobile app or curl), allow it
        // Otherwise, allow all incoming origins
        if (!origin) return callback(null, true);
        callback(null, true); 
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "authv1"],
    credentials: true
}));

app.use (express.json())
app.use(morgan("tiny", { stream }))

app.use("/", router)
app.use((req, res) => {
    return sendResponse(res, 404, false, "Route not found", null, `${req.method} ${req.path} does not exist`);
})

app.listen(appPort, (req, res) => {
    logger.info(`App Started successfully http://localhost:${appPort}`)
})

antiAFKAnim(client);