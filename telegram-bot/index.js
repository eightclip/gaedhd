/**
 * GaeDHD Telegram Bot
 *
 * Capture + query + nudge channel for the GaeDHD ADHD second-brain app.
 * Runs on QNAP via long-polling (no public webhook needed).
 *
 * Docs:
 *   https://grammy.dev
 *   https://core.telegram.org/bots/api
 *   https://docs.anthropic.com/en/api/messages
 */

import { Bot } from "grammy";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Load .env if present (simple manual parse — no dotenv dependency needed)
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, ".env");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {
  // .env not present — rely on environment variables set externally
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GAEDHD_BASE_URL = (process.env.GAEDHD_BASE_URL || "https://gaedhd.jmj.fyi").replace(/\/$/, "");
const GAEDHD_NOW_TOKEN = process.env.GAEDHD_NOW_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const NUDGES_ENABLED = process.env.NUDGES_ENABLED === "true";
const NUDGE_CHAT_ID = process.env.NUDGE_CHAT_ID;
const QUIET_START = parseInt(process.env.QUIET_START ?? "21", 10);
const QUIET_END = parseInt(process.env.QUIET_END ?? "8", 10);

// Morning planning prompt: a daily "what are you trying to do today?" message.
// Fires once per day at MORNING_HOUR. Her reply is captured like any text (into her inbox).
const MORNING_PROMPT_ENABLED = process.env.MORNING_PROMPT_ENABLED === "true";
const MORNING_HOUR = parseInt(process.env.MORNING_HOUR ?? "9", 10);
const MORNING_CHAT_ID = process.env.MORNING_CHAT_ID || process.env.NUDGE_CHAT_ID;

// Parse the allowlist once at startup
const ALLOWED_CHAT_IDS = new Set(
  (process.env.ALLOWED_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

// Validate required config
if (!TELEGRAM_BOT_TOKEN) {
  console.error("[fatal] TELEGRAM_BOT_TOKEN is not set. Exiting.");
  process.exit(1);
}
if (!GAEDHD_NOW_TOKEN) {
  console.error("[fatal] GAEDHD_NOW_TOKEN is not set. Exiting.");
  process.exit(1);
}
if (ALLOWED_CHAT_IDS.size === 0) {
  console.warn("[warn] ALLOWED_CHAT_IDS is empty — no one can use the bot.");
}

console.log(`[init] GaeDHD bot starting. Allowed chat IDs: ${[...ALLOWED_CHAT_IDS].join(", ") || "(none)"}`);
console.log(`[init] Nudges: ${NUDGES_ENABLED ? "enabled" : "disabled"}`);

// ---------------------------------------------------------------------------
// grammY bot instance
// ---------------------------------------------------------------------------
const bot = new Bot(TELEGRAM_BOT_TOKEN);

// ---------------------------------------------------------------------------
// Allowlist middleware — silently drop anything from unknown chats
// ---------------------------------------------------------------------------
bot.use(async (ctx, next) => {
  const chatId = String(ctx.chat?.id ?? "");
  if (!ALLOWED_CHAT_IDS.has(chatId)) {
    console.log(`[auth] Ignoring message from unknown chat ${chatId}`);
    return;
  }
  await next();
});

// ---------------------------------------------------------------------------
// /start and /help
// ---------------------------------------------------------------------------
const HELP_TEXT = `
GaeDHD bot — your ADHD second brain, now in Telegram.

*What I do*
• Send me any text → it goes into your inbox for review.
• Send me a photo of a handwritten list → I'll read it and add each item.
• /next — what to focus on right now.
• /today — your full snapshot: task, rituals, streak, and next meeting.

Everything lands in your GaeDHD app at https://gaedhd.jmj.fyi for you to accept, skip, or reschedule. I never delete anything — I only add.
`.trim();

// Evergreen first hello (any day that isn't her birthday window).
const WELCOME_TEXT = `
Hey! 💛 I'm your second brain in your pocket. Throw anything at me and I'll hold onto it for you.

*Try it*
• Send me any thought or to-do → it lands in your list.
• Snap a photo of a handwritten list → I'll read it and add each item.
• /next — the one thing to focus on right now.
• /today — your snapshot: task, rituals, streak, next meeting.

It all shows up in your app at https://gaedhd.jmj.fyi. I only ever add, never delete.
`.trim();

// The first thing she EVER sees from the bot is this, because she opens it on
// her birthday. From John.
const BIRTHDAY_WELCOME = `
Happy Birthday, gorgeous. 🎂

Today the *strongest, hottest, most capable woman I know* gets her own celebration, and her own second brain to match.

You are a knockout. Soft and girly and absolutely lethal all at once. Those muscles? Earned. That mind? Sharper than you give it credit for. There is nothing on your list you can't crush, and I built this so you never have to hold all of it in your head alone again.

So here's the deal, birthday girl. Throw anything at me and I'll carry it:
• Any thought or to-do → straight into your list.
• Snap a photo of a handwritten list → I'll read it and add every item.
• /next for your one thing right now.
• /today for your snapshot: task, rituals, streak, next meeting.

It all lives at https://gaedhd.jmj.fyi. I only ever add, never delete.

Now go be the badass you are. I've got the rest. 😘
`.trim();

// Her birthday week, so the special version lands even if she opens the bot a
// day early or late around the gift reveal.
function isBirthdayWindow(d = new Date()) {
  return d.getMonth() === 5 && d.getDate() >= 5 && d.getDate() <= 8; // June 5–8
}

bot.command("start", (ctx) =>
  ctx.reply(isBirthdayWindow() ? BIRTHDAY_WELCOME : WELCOME_TEXT, { parse_mode: "Markdown" })
);
bot.command("help", (ctx) => ctx.reply(HELP_TEXT, { parse_mode: "Markdown" }));

// ---------------------------------------------------------------------------
// /next — what to focus on right now
// ---------------------------------------------------------------------------
bot.command("next", async (ctx) => {
  try {
    const data = await fetchNow();
    const lines = [];

    if (data.task) {
      const { emoji, title, durationMin, goal } = data.task;
      lines.push(`*${emoji ?? ""} ${title}*`);
      if (durationMin) lines.push(`${durationMin} min`);
      if (goal) lines.push(`Goal: ${goal}`);
    } else {
      lines.push("You're all clear — no active task right now.");
    }

    if (data.ritualsDue?.length) {
      lines.push("");
      lines.push("*Rituals due:*");
      for (const r of data.ritualsDue) {
        lines.push(`${r.emoji ?? "•"} ${r.title}`);
      }
    }

    if (data.pendingCount > 0) {
      lines.push("");
      lines.push(`${data.pendingCount} item${data.pendingCount === 1 ? "" : "s"} waiting in your inbox.`);
    }

    await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
  } catch (err) {
    console.error("[/next] Error:", err.message);
    await ctx.reply("Couldn't reach GaeDHD right now. Try again in a moment.");
  }
});

// ---------------------------------------------------------------------------
// /today — full daily snapshot
// ---------------------------------------------------------------------------
bot.command("today", async (ctx) => {
  try {
    const data = await fetchNow();
    const lines = [];

    // Current task
    if (data.task) {
      const { emoji, title, durationMin } = data.task;
      lines.push(`*Now:* ${emoji ?? ""} ${title}${durationMin ? ` (${durationMin} min)` : ""}`);
    } else {
      lines.push("*Now:* All clear");
    }

    // Rituals
    const ritualCount = data.ritualsDue?.length ?? 0;
    lines.push(`*Rituals due:* ${ritualCount}`);

    // Streak & progress
    lines.push(`*Streak:* ${data.streak ?? 0} day${data.streak === 1 ? "" : "s"}`);
    lines.push(`*Done today:* ${data.completedToday ?? 0} task${data.completedToday === 1 ? "" : "s"}, ${data.minutesToday ?? 0} min focused`);

    // Next meeting
    const upcoming = nextEvent(data.events ?? []);
    if (upcoming) {
      lines.push(`*Next meeting:* ${upcoming.title} at ${upcoming.startTime}`);
    }

    if (data.pendingCount > 0) {
      lines.push(`*Inbox:* ${data.pendingCount} item${data.pendingCount === 1 ? "" : "s"} pending`);
    }

    await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
  } catch (err) {
    console.error("[/today] Error:", err.message);
    await ctx.reply("Couldn't reach GaeDHD right now. Try again in a moment.");
  }
});

// ---------------------------------------------------------------------------
// Plain text messages → capture to inbox
// ---------------------------------------------------------------------------
bot.on("message:text", async (ctx) => {
  // Skip if it looks like a command (already handled above)
  if (ctx.message.text.startsWith("/")) return;

  const raw_text = ctx.message.text.trim();
  if (!raw_text) return;

  try {
    await postInbox(raw_text);
    await ctx.reply("Added to your list ✓");
  } catch (err) {
    console.error("[capture:text] Error:", err.message);
    await ctx.reply("Couldn't add that right now. Try again in a moment.");
  }
});

// ---------------------------------------------------------------------------
// Photo messages → Anthropic vision → extract todos → capture to inbox
// ---------------------------------------------------------------------------
bot.on("message:photo", async (ctx) => {
  if (!ANTHROPIC_API_KEY) {
    await ctx.reply("Photo reading isn't configured (missing ANTHROPIC_API_KEY).");
    return;
  }

  // Telegram sends multiple sizes; take the largest (last) one
  const photos = ctx.message.photo;
  const largest = photos[photos.length - 1];

  let imageBase64;
  try {
    imageBase64 = await downloadTelegramPhoto(largest.file_id);
  } catch (err) {
    console.error("[capture:photo] Download error:", err.message);
    await ctx.reply("Couldn't download the photo. Try again.");
    return;
  }

  let items;
  try {
    items = await extractTodosFromImage(imageBase64);
  } catch (err) {
    console.error("[capture:photo] Vision error:", err.message);
    await ctx.reply("Couldn't read the photo. Try again, or type the items out.");
    return;
  }

  if (!items || items.length === 0) {
    await ctx.reply("I couldn't find any to-do items in that photo. Try typing them out.");
    return;
  }

  let added = 0;
  const errors = [];
  for (const item of items) {
    try {
      await postInbox(item.text);
      added++;
    } catch (err) {
      console.error(`[capture:photo] Inbox error for "${item.text}":`, err.message);
      errors.push(item.text);
    }
  }

  if (errors.length === 0) {
    await ctx.reply(`Read your list — added ${added} item${added === 1 ? "" : "s"} ✓`);
  } else {
    await ctx.reply(
      `Added ${added} item${added === 1 ? "" : "s"} ✓. ${errors.length} couldn't be saved — try those manually.`
    );
  }
});

// ---------------------------------------------------------------------------
// Nudge loop (optional)
// ---------------------------------------------------------------------------
// Track last nudge per ritual id to avoid repeating within an hour
const lastNudgeSent = new Map(); // ritualId -> Date

if (NUDGES_ENABLED) {
  if (!NUDGE_CHAT_ID) {
    console.warn("[nudge] NUDGES_ENABLED=true but NUDGE_CHAT_ID is not set. Nudges will not fire.");
  } else {
    const NUDGE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
    const NUDGE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between same ritual

    console.log(`[nudge] Nudge loop active. Interval: 30 min. Quiet: ${QUIET_START}:00 to ${QUIET_END}:00.`);

    setInterval(async () => {
      if (!isActiveHour()) {
        return; // quiet hours
      }

      let data;
      try {
        data = await fetchNow();
      } catch (err) {
        console.error("[nudge] fetchNow error:", err.message);
        return;
      }

      const rituals = data.ritualsDue ?? [];
      if (rituals.length === 0) return;

      // Pick the first ritual not recently nudged
      const now = Date.now();
      const ritual = rituals.find((r) => {
        const last = lastNudgeSent.get(r.id);
        return !last || now - last.getTime() > NUDGE_COOLDOWN_MS;
      });

      if (!ritual) return; // all recently nudged

      const message = ritual.nudge
        ? `${ritual.emoji ?? ""} ${ritual.nudge}`
        : `${ritual.emoji ?? ""} Time for: ${ritual.title}`;

      try {
        await bot.api.sendMessage(NUDGE_CHAT_ID, message);
        lastNudgeSent.set(ritual.id, new Date());
        console.log(`[nudge] Sent nudge for ritual "${ritual.title}" to chat ${NUDGE_CHAT_ID}`);
      } catch (err) {
        console.error("[nudge] sendMessage error:", err.message);
      }
    }, NUDGE_INTERVAL_MS);
  }
}

// ---------------------------------------------------------------------------
// Morning planning prompt — once a day, around school-dropoff o'clock
// ---------------------------------------------------------------------------
const MORNING_TEXT = [
  "Good morning. What are you trying to take care of today?",
  "",
  "Just type it back to me — the big things and the little things. I'll drop them",
  "in your list and the app will build your day around your meetings and the school runs.",
].join("\n");

if (MORNING_PROMPT_ENABLED) {
  if (!MORNING_CHAT_ID) {
    console.warn("[morning] MORNING_PROMPT_ENABLED=true but no MORNING_CHAT_ID/NUDGE_CHAT_ID set.");
  } else {
    let lastMorningDay = null; // YYYY-M-D we last prompted
    console.log(`[morning] Morning prompt active at ${MORNING_HOUR}:00.`);
    setInterval(async () => {
      const d = new Date();
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (d.getHours() !== MORNING_HOUR || lastMorningDay === dayKey) return;
      lastMorningDay = dayKey;
      try {
        await bot.api.sendMessage(MORNING_CHAT_ID, MORNING_TEXT);
        console.log(`[morning] Sent planning prompt to chat ${MORNING_CHAT_ID}`);
      } catch (err) {
        console.error("[morning] sendMessage error:", err.message);
      }
    }, 10 * 60 * 1000); // check every 10 minutes
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the current hour is inside the active (non-quiet) window. */
function isActiveHour() {
  const hour = new Date().getHours();
  if (QUIET_START > QUIET_END) {
    // Wraps midnight: quiet from e.g. 21 to 08
    return hour >= QUIET_END && hour < QUIET_START;
  } else {
    // Doesn't wrap midnight
    return hour >= QUIET_END && hour < QUIET_START;
  }
}

/** Calls GET /api/now and returns parsed JSON. Throws on non-2xx. */
async function fetchNow() {
  const url = `${GAEDHD_BASE_URL}/api/now?token=${encodeURIComponent(GAEDHD_NOW_TOKEN)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`GET /api/now ${res.status}: ${body}`);
  }
  return res.json();
}

/** POSTs a raw text string to /api/inbox. Throws on non-2xx. */
async function postInbox(raw_text) {
  const url = `${GAEDHD_BASE_URL}/api/inbox?token=${encodeURIComponent(GAEDHD_NOW_TOKEN)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_text, source: "telegram" }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`POST /api/inbox ${res.status}: ${body}`);
  }
}

/**
 * Downloads a Telegram photo by file_id and returns it as a base64 string.
 * Uses the Telegram Bot API getFile + direct CDN URL pattern.
 */
async function downloadTelegramPhoto(fileId) {
  // Step 1: resolve file path
  const infoRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
    { signal: AbortSignal.timeout(15_000) }
  );
  if (!infoRes.ok) throw new Error(`getFile HTTP ${infoRes.status}`);
  const info = await infoRes.json();
  if (!info.ok) throw new Error(`getFile error: ${info.description}`);

  const filePath = info.result.file_path;

  // Step 2: download raw bytes
  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`,
    { signal: AbortSignal.timeout(30_000) }
  );
  if (!fileRes.ok) throw new Error(`file download HTTP ${fileRes.status}`);
  const buffer = await fileRes.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

/**
 * Sends an image (base64 JPEG) to Anthropic claude-sonnet-4-20250514 vision
 * and extracts an array of { text, kind } to-do items.
 */
async function extractTodosFromImage(imageBase64) {
  const payload = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `Look at this image. It likely contains a handwritten or typed to-do list.

Extract every distinct to-do item and return ONLY valid JSON in exactly this format, with no other text:
{"items":[{"text":"<item text>","kind":"task"},...]}

Rules:
- Each item should be a single, actionable thing.
- If the item is a project or multi-step effort rather than a single action, set kind to "project".
- Otherwise set kind to "task".
- Do not add, interpret, or expand items — transcribe what's written.
- If there are no to-do items visible, return {"items":[]}.`,
          },
        ],
      },
    ],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`Anthropic API ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text ?? "";

  // Extract JSON even if the model wraps it in markdown fences
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Anthropic response");

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.items ?? [];
}

/**
 * Given an array of calendar events, returns the next one that hasn't ended yet.
 * Events are expected to have string startTime/endTime fields. Returns null if none.
 */
function nextEvent(events) {
  if (!events.length) return null;
  // We can't parse arbitrary time strings without a timezone reference,
  // so just return the first event in the array (the API is expected to sort them).
  return events[0] ?? null;
}

// ---------------------------------------------------------------------------
// Error boundary — log but don't crash on update errors
// ---------------------------------------------------------------------------
bot.catch((err) => {
  console.error("[bot:error]", err.message);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
console.log("[init] Starting long-polling...");
bot.start({
  onStart: () => console.log("[init] Bot is running."),
});
