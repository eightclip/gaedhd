-- GaeDHD extra tables. Run this in the GaeDHD Supabase project's SQL editor
-- (project vqnkfbceuodzrynfccnf — NOT the TrakMac project).
--
-- Same security model as gaedhd_state: RLS on, no policies, so only the
-- service-role key (used server-side in the API routes) can read/write.

-- Where she is right now. Written by /api/here (Home Assistant, NFC, Shortcuts,
-- or the in-app room switcher); read by the app for "while you're here".
create table if not exists gaedhd_presence (
  user_email text primary key,
  room       text,
  source     text,
  updated_at timestamptz default now()
);
alter table gaedhd_presence enable row level security;

-- Area-transition dedup for /api/enter (the in-house room nudge). last_ping_room
-- is the area she was last actually nudged for (the "anchor"); a room only
-- re-pings once she's been nudged in a DIFFERENT area since. last_ping_at lets
-- the anchor expire after a few hours so returning the next day pings again.
alter table gaedhd_presence add column if not exists last_ping_room text;
alter table gaedhd_presence add column if not exists last_ping_at   timestamptz;

-- Append-only capture inbox. Every async door (Telegram bot, email, John adding
-- to her list) inserts a row; the app drains it. Append-only avoids clobbering
-- the single state blob when several writers act at once.
create table if not exists gaedhd_inbox (
  id         uuid primary key default gen_random_uuid(),
  user_email text not null,
  source     text,            -- 'telegram' | 'email' | 'john' | 'api'
  raw_text   text,
  image_url  text,
  processed  boolean default false,
  created_at timestamptz default now()
);
create index if not exists gaedhd_inbox_user_idx
  on gaedhd_inbox (user_email, processed, created_at);
alter table gaedhd_inbox enable row level security;

-- Per-room arrival cooldown. /api/arrive records when a geofence arrival last
-- nudged each room so it doesn't re-buzz on geofence flapping (45 min cooldown).
create table if not exists gaedhd_arrival_log (
  user_email  text not null,
  room        text not null,
  notified_at timestamptz default now(),
  primary key (user_email, room)
);
alter table gaedhd_arrival_log enable row level security;

-- Web push subscriptions. One row per device/browser she enables in Settings.
create table if not exists gaedhd_push_subs (
  endpoint     text primary key,
  user_email   text not null,
  subscription jsonb not null,
  created_at   timestamptz default now()
);
create index if not exists gaedhd_push_subs_user_idx on gaedhd_push_subs (user_email);
alter table gaedhd_push_subs enable row level security;

-- Location-tagged one-line tasks ("water the plants in the yard"). Written by
-- the Telegram bot (token) or the app (session) via /api/spot; read + completed
-- in the app's "while you're here" panel; nudged by /api/enter when the presence
-- bridge reports she's in that room. Its own table (not the state blob) so async
-- writers never clobber her synced state.
create table if not exists gaedhd_spot_tasks (
  id         uuid primary key default gen_random_uuid(),
  user_email text not null,
  title      text not null,
  room       text not null,   -- a room slug: office/kitchen/bedroom/living_room/yard/…
  emoji      text,
  done       boolean default false,
  created_at timestamptz default now(),
  done_at    timestamptz
);
create index if not exists gaedhd_spot_tasks_user_idx
  on gaedhd_spot_tasks (user_email, done, room, created_at);
alter table gaedhd_spot_tasks enable row level security;
