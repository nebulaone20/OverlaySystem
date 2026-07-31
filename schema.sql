-- Run with: wrangler d1 execute overlay-db --file=schema.sql

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS overlay_data (
    account_id TEXT PRIMARY KEY,
    timer_duration INTEGER NOT NULL DEFAULT 600,
    timer_start_at INTEGER NOT NULL DEFAULT 0,
    timer_running INTEGER NOT NULL DEFAULT 0,
    timer_ended INTEGER NOT NULL DEFAULT 0,
    event_name TEXT NOT NULL DEFAULT '',
    event_preset TEXT NOT NULL DEFAULT 'road2',
    map TEXT NOT NULL DEFAULT 'none',
    map_video TEXT NOT NULL DEFAULT '',
    series_type TEXT NOT NULL DEFAULT 'BO1',
    games_displayed INTEGER NOT NULL DEFAULT 1,
    graphics_enabled INTEGER NOT NULL DEFAULT 0,
    graphics_images TEXT NOT NULL DEFAULT '[]',
    matches TEXT NOT NULL DEFAULT '{}',
    spotify_enabled INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS camera_sessions (
    account_id  TEXT NOT NULL,
    slot        TEXT NOT NULL,
    session_id  TEXT NOT NULL,
    video_track TEXT NOT NULL DEFAULT '',
    audio_track TEXT NOT NULL DEFAULT '',
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (account_id, slot)
);

-- Run setup.js after this to create your admin account:
-- node setup.js
