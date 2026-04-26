import { createClient } from "bedrock-protocol";
import "dotenv/config";

/* =========================
   🌍 CORE BOT STATE
========================= */

let client;

let runtimeEntityId;
let position = { x: 0, y: 0, z: 0 };

let players = {};

const memory = {
  visited: new Set(),
  deathCount: 0,
  netherReady: false,
};

let inventory = {
  wood: 10,
  stone: 10,
  iron: 0,
};

const structures = {
  house: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 1, z: 0 },
  ],
};

let buildIndex = 0;

/* =========================
   🚀 START BOT
========================= */

function startBot() {
  client = createClient({
    host: process.env.MC_HOST,
    port: Number(process.env.MC_PORT) || 19132,
    username: 'ApolloBot',
    offline: true,
    raknetBackend: 'raknet-native',
    connectTimeout: 30000
  });

  setupEvents();
}

/* =========================
   ⚙️ EVENTS
========================= */

function setupEvents() {
  client.on("start_game", (packet) => {
    runtimeEntityId = packet.runtime_entity_id;
    position = packet.player_position;

    startBrain();
    startAntiAFK();
  });

  client.on("move_player", (packet) => {
    if (packet.runtime_entity_id === runtimeEntityId) {
      position = packet.position;
    }

    Object.values(players).forEach((p) => {
      if (p.runtimeEntityId === packet.runtime_entity_id) {
        p.position = packet.position;
      }
    });
  });

  client.on("add_player", (packet) => {
    players[packet.uuid] = {
      username: packet.username,
      runtimeEntityId: packet.runtime_id,
      position: packet.position,
    };
  });

  client.on("disconnect", reconnect);
  client.on("error", reconnect);
}

/* =========================
   🧠 PERCEPTION
========================= */

function perceive() {
  const nearbyPlayers = Object.values(players).filter(
    (p) => distanceTo(p.position) < 10
  );

  return {
    nearbyPlayers,
    lowResources: inventory.wood < 5 || inventory.stone < 5,
    safe: nearbyPlayers.length === 0,
  };
}

/* =========================
   🧠 DECISION ENGINE
========================= */

function decide(p) {
  const score = {
    APPROACH: p.nearbyPlayers.length > 0 ? 90 : 0,
    SURVIVE: p.lowResources ? 100 : 20,
    SWING: memory.visited.size > 5 ? 70 : 10,
    EXPLORE: p.safe ? 60 : 10,
  };

  return Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
}

/* =========================
   ⚙️ ACTION MAP
========================= */

const actions = {
  APPROACH: approach,
  SURVIVE: survive,
  SWING: swingArm,
  EXPLORE: explore,
};

/* =========================
   🧠 BRAIN LOOP
========================= */

function startBrain() {
  setInterval(() => {
    const perception = perceive();
    const decision = decide(perception);

    console.log("🧠 State:", decision);

    actions[decision](perception);

    evolve();
  }, 500);
}

/* =========================
   🚶‍♂️ APPROACH
========================= */

function approach(p) {
  const enemy = p.nearbyPlayers[0];
  if (!enemy) return;

  const dx = enemy.position.x - position.x;
  const dz = enemy.position.z - position.z;

  if (distanceTo(enemy.position) > 2) {
    moveToward(dx, dz);
  } else {
    swingArm(); // Swing arm when close
  }
}

/* =========================
   💪 SWING / INTERACT
========================= */

function swingArm() {
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

/* =========================
   🌍 EXPLORE
========================= */

function explore() {
  const angle = Math.random() * Math.PI * 2;

  const x = position.x + Math.cos(angle) * 10;
  const z = position.z + Math.sin(angle) * 10;

  memory.visited.add(`${Math.floor(x)},${Math.floor(z)}`);

  moveToward(x - position.x, z - position.z);
}

/* =========================
   🧠 SURVIVE
========================= */

function survive() {
  inventory.wood += 2;
  inventory.stone += 1;
}

/* =========================
   📈 EVOLUTION SYSTEM
========================= */

function evolve() {
  if (memory.visited.size > 10) {
    inventory.wood += 1;
  }

  if (inventory.iron > 5) {
    memory.netherReady = true;
  }
}

/* =========================
   🧭 MOVEMENT
========================= */

function moveToward(dx, dz) {
  const yaw = Math.atan2(-dx, dz) * (180 / Math.PI);

  try {
    client.queue("player_auth_input", {
      pitch: 0,
      yaw,
      position,
      move_vector: { x: 0, z: 1 },
      analog_move_vector: { x: 0, z: 1 },
      head_yaw: yaw,
      input_data: 2n,
      input_mode: 1,
      play_mode: 0,
      tick: 0n,
      delta: { x: 0, y: 0, z: 0 }
    });
  } catch (e) {
    console.error("Failed moveToward:", e.message);
  }
}

function stopMoving() {
  try {
    client.queue("player_auth_input", {
      pitch: 0,
      yaw: 0,
      position,
      move_vector: { x: 0, z: 0 },
      analog_move_vector: { x: 0, z: 0 },
      head_yaw: 0,
      input_data: 0n,
      input_mode: 1,
      play_mode: 0,
      tick: 0n,
      delta: { x: 0, y: 0, z: 0 }
    });
  } catch (e) {
    console.error("Failed stopMoving:", e.message);
  }
}

/* =========================
   📍 MOVE TO TARGET
========================= */

function moveTo(target) {
  return new Promise((resolve) => {
    const i = setInterval(() => {
      const dx = target.x - position.x;
      const dz = target.z - position.z;

      if (Math.abs(dx) < 1 && Math.abs(dz) < 1) {
        clearInterval(i);
        stopMoving();
        resolve();
      } else {
        moveToward(dx, dz);
      }
    }, 200);
  });
}

/* =========================
   💾 UTIL
========================= */

function distanceTo(pos) {
  const dx = pos.x - position.x;
  const dz = pos.z - position.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/* =========================
   💤 ANTI AFK
========================= */

function startAntiAFK() {
  setInterval(() => {
    try {
      client.queue("player_auth_input", {
        pitch: 0,
        yaw: 0,
        position,
        move_vector: { x: 0, z: 0 },
        analog_move_vector: { x: 0, z: 0 },
        head_yaw: 0,
        input_data: 32n,
        input_mode: 1,
        play_mode: 0,
        tick: 0n,
        delta: { x: 0, y: 0, z: 0 }
      });
    } catch (e) {
      console.error("Failed antiAFK:", e.message);
    }
  }, 30000);
}

/* =========================
   🔁 RECONNECT
========================= */

function reconnect() {
  console.log("🔁 Reconnecting...");
  setTimeout(startBot, 5000);
}

/* =========================
   🚀 START
========================= */

startBot();