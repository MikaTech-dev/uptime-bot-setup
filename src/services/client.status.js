import { client } from "../../bedrock.js";

export async function isBotStillInServer() {
    // 1. If client doesn't exist at all
    if (!client) return false;

    // 2. Check the low-level socket (this is the most "on-command" way)
    // This checks if the UDP/RakNet session is still physically open
    const isSocketActive = client.raknet?.connected || client.connection?.connected;
    if (!isSocketActive) return false;

    // 3. Check heartbeat timing
    const now = Date.now();
    const last = client.lastHeartbeat || 0;
    const diff = now - last;

    // If it hasn't spawned yet, lastHeartbeat is 0. 
    // If it has spawned, check if we've heard from it in the last 45 seconds.
    if (last === 0) {
        // Bot might be in the middle of joining
        return true; 
    }

    return diff < 45000;
}
