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
