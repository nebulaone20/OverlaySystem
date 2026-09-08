-- Adds the Graphics OP state column to an EXISTING database.
--
--   wrangler d1 execute overlay-db --command="ALTER TABLE overlay_data ADD COLUMN gfx TEXT NOT NULL DEFAULT '{}'"
--   wrangler d1 execute overlay-db --remote --command="ALTER TABLE overlay_data ADD COLUMN gfx TEXT NOT NULL DEFAULT '{}'"
--
-- Or run this file directly:
--   wrangler d1 execute overlay-db --remote --file=migrate-gfx.sql
--
-- NOTE: SQLite has no "ADD COLUMN IF NOT EXISTS". If the column already
-- exists this errors with "duplicate column name: gfx" - that is safe to ignore.

ALTER TABLE overlay_data ADD COLUMN gfx TEXT NOT NULL DEFAULT '{}';
