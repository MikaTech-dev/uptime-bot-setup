import { logger } from "../utils/logger.config.js";

/**
 * Randomized anti-AFK movement engine for mineflayer bots.
 * Performs a variety of actions at random intervals to prevent
 * the server's AFK detection from kicking the bot.
 */

const ACTIONS = [
    "walk",
    "jump",
    "look",
    "sneak",
    "sprint",
    "swing",
    "walkAndJump",
    "strafeWalk",
    "spin",
];

/** Random int in [min, max] inclusive */
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/** Random float in [min, max) */
const randFloat = (min, max) => Math.random() * (max - min) + min;

/** Pick a random element from an array */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Wait for ms milliseconds */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Reset all control states on the bot */
function resetControls(bot) {
    bot.setControlState("forward", false);
    bot.setControlState("back", false);
    bot.setControlState("left", false);
    bot.setControlState("right", false);
    bot.setControlState("jump", false);
    bot.setControlState("sneak", false);
    bot.setControlState("sprint", false);
}

// ── Individual action handlers ──────────────────────────────────────

async function doWalk(bot) {
    const direction = pick(["forward", "back", "left", "right"]);
    const duration = randInt(800, 3000);
    bot.setControlState(direction, true);
    await wait(duration);
    bot.setControlState(direction, false);
}

async function doJump(bot) {
    const jumps = randInt(1, 3);
    for (let i = 0; i < jumps; i++) {
        bot.setControlState("jump", true);
        await wait(200);
        bot.setControlState("jump", false);
        await wait(randInt(300, 800));
    }
}

async function doLook(bot) {
    const yaw = randFloat(-Math.PI, Math.PI);
    const pitch = randFloat(-0.8, 0.8);
    bot.look(yaw, pitch, false);
    await wait(randInt(400, 1200));
}

async function doSneak(bot) {
    bot.setControlState("sneak", true);
    await wait(randInt(500, 2000));
    bot.setControlState("sneak", false);
}

async function doSprint(bot) {
    bot.setControlState("sprint", true);
    bot.setControlState("forward", true);
    await wait(randInt(600, 2500));
    bot.setControlState("sprint", false);
    bot.setControlState("forward", false);
}

async function doSwing(bot) {
    const swings = randInt(1, 4);
    for (let i = 0; i < swings; i++) {
        bot.swingArm();
        await wait(randInt(200, 600));
    }
}

async function doWalkAndJump(bot) {
    const direction = pick(["forward", "back"]);
    bot.setControlState(direction, true);
    const jumps = randInt(1, 3);
    for (let i = 0; i < jumps; i++) {
        await wait(randInt(400, 900));
        bot.setControlState("jump", true);
        await wait(200);
        bot.setControlState("jump", false);
    }
    await wait(randInt(200, 600));
    bot.setControlState(direction, false);
}

async function doStrafeWalk(bot) {
    const strafe = pick(["left", "right"]);
    bot.setControlState("forward", true);
    bot.setControlState(strafe, true);
    await wait(randInt(600, 2000));
    bot.setControlState("forward", false);
    bot.setControlState(strafe, false);
}

async function doSpin(bot) {
    const steps = randInt(4, 10);
    for (let i = 0; i < steps; i++) {
        const yaw = (i / steps) * 2 * Math.PI;
        bot.look(yaw, 0, false);
        await wait(150);
    }
}

// ── Action dispatcher ───────────────────────────────────────────────

const actionMap = {
    walk: doWalk,
    jump: doJump,
    look: doLook,
    sneak: doSneak,
    sprint: doSprint,
    swing: doSwing,
    walkAndJump: doWalkAndJump,
    strafeWalk: doStrafeWalk,
    spin: doSpin,
};

// ── Main anti-AFK loop ──────────────────────────────────────────────

/**
 * Starts the anti-AFK loop on a mineflayer bot.
 * Returns a stop() function to cleanly shut it down.
 *
 * @param {import("mineflayer").Bot} bot
 * @param {object} [options]
 * @param {number} [options.minDelay=2000]  Min ms between actions
 * @param {number} [options.maxDelay=15000] Max ms between actions
 * @returns {{ stop: () => void }}
 */
export function startAntiAfk(bot, options = {}) {
    const { minDelay = 2000, maxDelay = 15000 } = options;
    let running = true;

    async function loop() {
        logger.info("Anti-AFK loop started");

        while (running) {
            try {
                const action = pick(ACTIONS);
                const handler = actionMap[action];

                if (handler) {
                    logger.debug(`Anti-AFK action executing: ${action}`);
                    await handler(bot);
                }

                resetControls(bot);

                // Random pause between actions
                const delay = randInt(minDelay, maxDelay);
                await wait(delay);
            } catch (err) {
                // Bot may have been destroyed mid-action (disconnect/kick)
                if (!running) break;
                logger.warn(`Anti-AFK action error: ${err.message}`);
                await wait(3000);
            }
        }

        logger.info("Anti-AFK loop stopped");
    }

    loop();

    return {
        stop() {
            running = false;
            try {
                resetControls(bot);
            } catch {
                // Bot may already be gone
            }
        },
    };
}
