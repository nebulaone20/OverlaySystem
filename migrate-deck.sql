-- Stream Deck support: one key per account.
--
-- The deck's built in Website action can only do a plain GET. It cannot send
-- an Authorization header, so the thing that proves a button press is yours
-- has to travel in the URL. That is a weaker place to keep a secret than a
-- header, which is exactly why this is its own key and not the console login:
-- it can only fire the five actions, it can never read your state or touch
-- your account, and you can regenerate it from the console the moment you
-- suspect it has been seen.
--
-- Empty means no key has been made yet, and every deck URL answers 404 until
-- you press Generate in the console.
--
-- Apply with:
--   npx wrangler d1 execute overlay-db --remote --file=migrate-deck.sql
--
-- Running it twice gives "duplicate column name: deck_key", which is harmless
-- and means it already applied.

ALTER TABLE overlay_data ADD COLUMN deck_key TEXT NOT NULL DEFAULT '';
