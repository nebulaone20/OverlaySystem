-- Run this against an EXISTING database to add Cloudflare Calls support
-- without re-running schema.sql (which would error on the event_preset
-- ALTER TABLE line if that column already exists).
--
--   wrangler d1 execute overlay-db --file=migrate-calls.sql
--   wrangler d1 execute overlay-db --remote --file=migrate-calls.sql

CREATE TABLE IF NOT EXISTS camera_sessions (
    account_id  TEXT NOT NULL,
    slot        TEXT NOT NULL,
    session_id  TEXT NOT NULL,
    video_track TEXT NOT NULL DEFAULT '',
    audio_track TEXT NOT NULL DEFAULT '',
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (account_id, slot)
);
