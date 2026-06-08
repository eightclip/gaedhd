/**
 * GaeDHD Presence Bridge
 *
 * Subscribes to the ESPresense MQTT topics for her beacon, figures out which
 * room she's nearest to, and POSTs that room to the GaeDHD app (/api/enter)
 * whenever it changes. /api/enter sets her presence AND fires a calm,
 * cooldowned nudge if anything is tied to that room (a spot task, a room-tagged
 * task, or a due room ritual).
 *
 * This is deliberately dumb: nearest-room in, one HTTP POST out. All the "what
 * to nudge / quiet hours / cooldown" logic lives server-side in /api/enter.
 *
 * Runs on the QNAP via Docker (see deploy.sh), same pattern as the Telegram bot.
 *
 * Docs: https://github.com/mqttjs/MQTT.js
 */

import mqtt from "mqtt";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Load .env if present (simple manual parse — no dotenv dependency)
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, ".env");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (k && !(k in process.env)) process.env[k] = v;
  }
} catch {
  // no .env — rely on environment
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MQTT_HOST = process.env.MQTT_HOST || "192.168.87.100";
const MQTT_PORT = parseInt(process.env.MQTT_PORT || "1883", 10);
const MQTT_USER = process.env.MQTT_USER || "gaedhd";
const MQTT_PASS = process.env.MQTT_PASS || "";
const DEVICE_ID = process.env.DEVICE_ID || "gaes_beacon"; // the aliased beacon
const TOPIC = `espresense/devices/${DEVICE_ID}/+`;

const GAEDHD_BASE_URL = (process.env.GAEDHD_BASE_URL || "https://gaedhd.jmj.fyi").replace(/\/$/, "");
const GAEDHD_NOW_TOKEN = process.env.GAEDHD_NOW_TOKEN;

// Tuning (all overridable via env)
const FRESH_MS = parseInt(process.env.FRESH_MS || "30000", 10);       // a room reading older than this is ignored
const DWELL_MS = parseInt(process.env.DWELL_MS || "8000", 10);        // candidate room must hold this long before we commit
const TICK_MS = parseInt(process.env.TICK_MS || "3000", 10);          // how often we recompute nearest
const MAX_DISTANCE_M = parseFloat(process.env.MAX_DISTANCE_M || "8"); // ignore readings farther than this

// Keep-alive: re-affirm the current room periodically so the app's presence
// doesn't age out. /api/where treats a room with no update for 3h as "unknown"
// and her "while you're here" tasks vanish — even though she's right there in one
// spot. We silently refresh (via /api/here, no nudge) during her active hours; the
// daily morning reset then clears it so a room never lingers overnight.
const KEEPALIVE_MS = parseInt(process.env.KEEPALIVE_MS || "600000", 10); // 10 min
const ACTIVE_START = parseInt(process.env.ACTIVE_START || "7", 10);
const ACTIVE_END = parseInt(process.env.ACTIVE_END || "22", 10);

if (!GAEDHD_NOW_TOKEN) {
  console.error("[fatal] GAEDHD_NOW_TOKEN is not set. Exiting.");
  process.exit(1);
}
if (!MQTT_PASS) console.warn("[warn] MQTT_PASS is not set — the broker requires auth, this will fail.");

console.log(`[init] presence bridge → ${GAEDHD_BASE_URL}`);
console.log(`[init] watching ${TOPIC} on ${MQTT_HOST}:${MQTT_PORT} (user ${MQTT_USER})`);
console.log(`[init] fresh=${FRESH_MS}ms dwell=${DWELL_MS}ms tick=${TICK_MS}ms maxDist=${MAX_DISTANCE_M}m`);
console.log(`[init] keep-alive every ${KEEPALIVE_MS}ms during ${ACTIVE_START}:00-${ACTIVE_END}:00`);

// ---------------------------------------------------------------------------
// State: most recent distance reading per room
// ---------------------------------------------------------------------------
const readings = new Map(); // room -> { distance, ts }

let currentRoom = null;  // the room we last reported to the app
let candidate = null;    // a room we're considering switching to
let candidateSince = 0;

// ---------------------------------------------------------------------------
// MQTT
// ---------------------------------------------------------------------------
const client = mqtt.connect(`mqtt://${MQTT_HOST}:${MQTT_PORT}`, {
  username: MQTT_USER,
  password: MQTT_PASS,
  reconnectPeriod: 5000,
  connectTimeout: 10_000,
});

client.on("connect", () => {
  console.log("[mqtt] connected");
  client.subscribe(TOPIC, (err) => {
    if (err) console.error("[mqtt] subscribe error:", err.message);
    else console.log(`[mqtt] subscribed ${TOPIC}`);
  });
});
client.on("reconnect", () => console.log("[mqtt] reconnecting…"));
client.on("error", (err) => console.error("[mqtt] error:", err.message));
client.on("close", () => console.log("[mqtt] connection closed"));

client.on("message", (topic, payload) => {
  // topic: espresense/devices/<id>/<room>
  const room = topic.split("/").pop();
  if (!room) return;
  let dist;
  try {
    dist = JSON.parse(payload.toString()).distance;
  } catch {
    return;
  }
  if (typeof dist !== "number" || !Number.isFinite(dist)) return;
  readings.set(room, { distance: dist, ts: Date.now() });
});

// ---------------------------------------------------------------------------
// Nearest-room + debounce loop
// ---------------------------------------------------------------------------
function nearestRoom() {
  const now = Date.now();
  let best = null;
  let bestDist = Infinity;
  for (const [room, r] of readings) {
    if (now - r.ts > FRESH_MS) continue;        // stale — she's no longer near this node
    if (r.distance > MAX_DISTANCE_M) continue;  // too far to count as "in the room"
    if (r.distance < bestDist) {
      bestDist = r.distance;
      best = room;
    }
  }
  return best;
}

async function enter(room) {
  // Token rides in an Authorization header, not the URL, so it never lands in
  // the app's access logs. Room stays in the query string (it's not a secret).
  const url = `${GAEDHD_BASE_URL}/api/enter?room=${encodeURIComponent(room)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${GAEDHD_NOW_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({}));
    const tag = data.nudged ? "(nudged)" : data.reason ? `(${data.reason})` : "";
    console.log(`[enter] ${room} → ${res.status} ${tag}`.trim());
  } catch (err) {
    console.error(`[enter] ${room} failed:`, err.message);
  }
}

// Silently re-affirm the current room (no nudge) so presence stays fresh.
async function refresh(room) {
  const url = `${GAEDHD_BASE_URL}/api/here?room=${encodeURIComponent(room)}`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${GAEDHD_NOW_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error(`[keepalive] ${room} failed:`, err.message);
  }
}

function inActiveHours() {
  const h = new Date().getHours(); // QNAP runs in her local timezone
  return h >= ACTIVE_START && h < ACTIVE_END;
}

setInterval(() => {
  if (currentRoom && inActiveHours()) refresh(currentRoom);
}, KEEPALIVE_MS);

setInterval(() => {
  const near = nearestRoom();
  if (!near) return; // beacon not heard near any node right now — keep last room, do nothing

  if (near === currentRoom) {
    candidate = null; // back to where we already are; cancel any pending switch
    return;
  }

  // Debounce: a new room must persist for DWELL_MS before we commit, so passing
  // through a room doesn't fire a nudge.
  const now = Date.now();
  if (candidate !== near) {
    candidate = near;
    candidateSince = now;
    return;
  }
  if (now - candidateSince < DWELL_MS) return;

  currentRoom = near;
  candidate = null;
  enter(near);
}, TICK_MS);

// Heartbeat so the logs show it's alive and what it's seeing.
setInterval(() => {
  const now = Date.now();
  const live = [...readings.entries()]
    .filter(([, r]) => now - r.ts <= FRESH_MS)
    .map(([room, r]) => `${room}:${r.distance.toFixed(1)}m`)
    .join(" ");
  console.log(`[hb] current=${currentRoom ?? "?"} live=[${live || "none"}]`);
}, 60_000);

process.on("SIGTERM", () => { client.end(); process.exit(0); });
process.on("SIGINT", () => { client.end(); process.exit(0); });
