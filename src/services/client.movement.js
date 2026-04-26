// src/utils/movement.js
import { isBotStillInServer } from "./client.status.js";
import { logger } from "../utils/logger.config.js";
import { runtimeEntityId } from "../../bedrock.js";

// The Jump bit in the player_auth_input bitmask
const JUMP_BIT = 1n << 3n;

async function swingArm(client) {
  try {
    // A simple animation packet. Action ID 1 is usually swing arm.
    client.queue("animate", {
      action_id: 1,
      runtime_entity_id: runtimeEntityId
    });
  } catch (e) {
    console.error("Failed to animate:", e.message);
  }
}

export const antiAFKAnim = (client) => {
    setInterval(async () => {
        if (await isBotStillInServer()) {
            swingArm(client);
        }
    }, 5000);
};