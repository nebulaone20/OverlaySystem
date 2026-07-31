INSERT OR REPLACE INTO accounts (id, username, password_hash, display_name)
VALUES ('admin', 'admin', 'M4/x8VE1LNdeiqq0Vqx/pXzoJSRMhdCvP7X16FOpxsU=', 'Admin');

INSERT OR IGNORE INTO overlay_data (account_id, timer_duration, timer_start_at, timer_running, timer_ended, event_name, map, map_video, series_type, games_displayed, graphics_enabled, graphics_images, matches, spotify_enabled, updated_at)
VALUES ('admin', 600, 0, 0, 0, '', 'none', '', 'BO1', 1, 0, '[]', '{}', 1, 1781420256);