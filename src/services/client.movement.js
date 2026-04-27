// src/services/client.movement.js
import { isBotStillInServer } from "./client.status.js";
import { logger } from "../utils/logger.config.js";

export const state = {
  spawned: false,
  runtimeEntityId: null,

  position: { x: 0, y: 0, z: 0 },
  prevPosition: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },

  yaw: 0,
  pitch: 0,
  headYaw: 0,

  tick: 0,

  held: {
    w: false,
    a: false,
    s: false,
    d: false,
    jump: false,
    sneak: false,
    sprint: false
  },

  prevHeld: {
    jump: false,
    sneak: false,
    sprint: false
  }
};

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function getMoveVectorFromKeys() {
  let x = 0;
  let z = 0;

  if (state.held.a) x -= 1;
  if (state.held.d) x += 1;
  if (state.held.w) z += 1;
  if (state.held.s) z -= 1;

  const len = Math.hypot(x, z);
  if (len > 0) {
    x /= len;
    z /= len;
  }

  return { x, z };
}

function getRawMoveVectorFromKeys() {
  let x = 0;
  let z = 0;

  if (state.held.a) x -= 1;
  if (state.held.d) x += 1;
  if (state.held.w) z += 1;
  if (state.held.s) z -= 1;

  return { x, z };
}

function getCameraOrientation(pitch, yaw) {
  const pitchRad = degToRad(pitch);
  const yawRad = degToRad(yaw);

  const cp = Math.cos(pitchRad);
  return {
    x: -Math.sin(yawRad) * cp,
    y: -Math.sin(pitchRad),
    z: Math.cos(yawRad) * cp
  };
}

function buildInputFlags() {
  const move = getMoveVectorFromKeys();
  const flags = {
    ascend: false,
    descend: false,
    north_jump: false,
    jump_down: state.held.jump,
    sprint_down: state.held.sprint,
    change_height: false,
    jumping: state.held.jump,
    auto_jumping_in_water: false,
    sneaking: state.held.sneak,
    sneak_down: state.held.sneak,
    up: state.held.w,
    down: state.held.s,
    left: state.held.a,
    right: state.held.d,
    up_left: state.held.w && state.held.a,
    up_right: state.held.w && state.held.d,
    want_up: false,
    want_down: false,
    want_down_slow: false,
    want_up_slow: false,
    sprinting: state.held.sprint,
    ascend_block: false,
    descend_block: false,
    sneak_toggle_down: false,
    persist_sneak: state.held.sneak,
    start_sprinting: state.held.sprint && !state.prevHeld.sprint,
    stop_sprinting: !state.held.sprint && state.prevHeld.sprint,
    start_sneaking: state.held.sneak && !state.prevHeld.sneak,
    stop_sneaking: !state.held.sneak && state.prevHeld.sneak,
    start_swimming: false,
    stop_swimming: false,
    start_jumping: state.held.jump && !state.prevHeld.jump,
    start_gliding: false,
    stop_gliding: false,
    item_interact: false,
    block_action: false,
    item_stack_request: false,
    handled_teleport: false,
    emoting: false,
    missed_swing: false,
    start_crawling: false,
    stop_crawling: false,
    start_flying: false,
    stop_flying: false,
    received_server_data: false,
    client_predicted_vehicle: false,
    paddling_left: false,
    paddling_right: false,
    block_breaking_delay_enabled: false,
    horizontal_collision: false,
    vertical_collision: false,
    down_left: state.held.s && state.held.a,
    down_right: state.held.s && state.held.d,
    start_using_item: false,
    camera_relative_movement_enabled: false,
    rot_controlled_by_move_direction: false,
    start_spin_attack: false,
    stop_spin_attack: false,
    hotbar_only_touch: false,
    jump_released_raw: !state.held.jump && state.prevHeld.jump,
    jump_pressed_raw: state.held.jump && !state.prevHeld.jump,
    jump_current_raw: state.held.jump,
    sneak_released_raw: !state.held.sneak && state.prevHeld.sneak,
    sneak_pressed_raw: state.held.sneak && !state.prevHeld.sneak,
    sneak_current_raw: state.held.sneak
  };

  if (move.x === 0 && move.z === 0) {
    flags.up_left = false;
    flags.up_right = false;
    flags.down_left = false;
    flags.down_right = false;
  }

  return flags;
}

function simulateLocalMotion() {
  const move = getMoveVectorFromKeys();
  const yawRad = degToRad(state.yaw);

  const speed = state.held.sprint ? 0.14 : state.held.sneak ? 0.04 : 0.08;

  const forwardX = -Math.sin(yawRad);
  const forwardZ = Math.cos(yawRad);
  const rightX = Math.cos(yawRad);
  const rightZ = Math.sin(yawRad);

  const worldX = (forwardX * move.z + rightX * move.x) * speed;
  const worldZ = (forwardZ * move.z + rightZ * move.x) * speed;

  state.prevPosition = { ...state.position };
  state.position.x += worldX;
  state.position.z += worldZ;

  state.velocity.x = state.position.x - state.prevPosition.x;
  state.velocity.y = state.position.y - state.prevPosition.y;
  state.velocity.z = state.position.z - state.prevPosition.z;
}

export function sendPlayerAuthInput(client) {
  if (!state.spawned || !client.serializer) return;

  simulateLocalMotion();

  const moveVector = getMoveVectorFromKeys();
  const rawMoveVector = getRawMoveVectorFromKeys();
  const cameraOrientation = getCameraOrientation(state.pitch, state.yaw);
  const inputFlags = buildInputFlags();

  state.tick += 1;

  client.queue("player_auth_input", {
    pitch: state.pitch,
    yaw: state.yaw,
    position: {
      x: state.position.x,
      y: state.position.y,
      z: state.position.z
    },
    move_vector: {
      x: moveVector.x,
      z: moveVector.z
    },
    head_yaw: state.headYaw,
    input_data: inputFlags,
    input_mode: "mouse",
    play_mode: "normal",
    interaction_model: "crosshair",
    interact_rotation: {
      x: state.pitch,
      z: state.yaw
    },
    tick: BigInt(state.tick),
    delta: {
      x: state.velocity.x,
      y: state.velocity.y,
      z: state.velocity.z
    },
    analogue_move_vector: {
      x: moveVector.x,
      z: moveVector.z
    },
    camera_orientation: {
      x: cameraOrientation.x,
      y: cameraOrientation.y,
      z: cameraOrientation.z
    },
    raw_move_vector: {
      x: rawMoveVector.x,
      z: rawMoveVector.z
    }
  });

  state.prevHeld.jump = state.held.jump;
  state.prevHeld.sneak = state.held.sneak;
  state.prevHeld.sprint = state.held.sprint;
}

export function setupMovement(client) {
  let interval;

  client.on("spawn", () => {
    state.spawned = true;
    logger.info("Movement state: spawned");

    if (interval) clearInterval(interval);
    interval = setInterval(async () => {
      try {
        if (await isBotStillInServer()) {
          sendPlayerAuthInput(client);
        }
      } catch (err) {
        logger.error("Movement loop error:", err.message);
      }
    }, 50);
  });

  client.on("start_game", (packet) => {
    state.runtimeEntityId = packet.runtime_entity_id;
    state.position = {
      x: packet.player_position.x,
      y: packet.player_position.y,
      z: packet.player_position.z
    };
    state.prevPosition = { ...state.position };
    state.pitch = packet.rotation.x;
    state.yaw = packet.rotation.z;
    state.headYaw = packet.rotation.z;
    state.tick = Number(packet.current_tick || 0);

    logger.info("Movement state: start_game initialised from server state");
  });

  client.on("tick_sync", (packet) => {
    if (typeof packet.response_time !== "undefined") {
      state.tick = Number(packet.response_time);
    }
  });

  client.on("respawn", (packet) => {
    state.position = {
      x: packet.position.x,
      y: packet.position.y,
      z: packet.position.z
    };
    state.prevPosition = { ...state.position };
  });

  client.on("correct_player_move_prediction", (packet) => {
    state.position = {
      x: packet.position.x,
      y: packet.position.y,
      z: packet.position.z
    };
    state.prevPosition = { ...state.position };
    state.pitch = packet.rotation.x;
    state.yaw = packet.rotation.z;
    state.headYaw = packet.rotation.z;
    state.tick = Number(packet.tick);
  });

  client.once("close", () => {
    if (interval) clearInterval(interval);
    state.spawned = false;
  });
}

export function startJumpLoop(client) {
  const jumpInterval = setInterval(async () => {
    try {
      if (await isBotStillInServer()) {
        logger.info('Bot is jumping!');
        state.held.jump = true;
        setTimeout(() => {
          state.held.jump = false;
        }, 500); // hold jump for 500ms to register properly
      }
    } catch (err) {
      logger.error("Jump loop error:", err.message);
    }
  }, 5000);

  client.once("close", () => {
    clearInterval(jumpInterval);
  });
}