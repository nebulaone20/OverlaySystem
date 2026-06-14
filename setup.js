#!/usr/bin/env node
// Run this ONCE after deploying to create your admin account:
//   node setup.js
//
// Requires: npm install node-fetch (or Node 18+ built-in fetch)

const WORKER_URL = process.env.WORKER_URL || "https://overlay-system.YOUR-SUBDOMAIN.workers.dev";
const ADMIN_USERNAME = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASS || "changeme123";
const ADMIN_DISPLAY  = process.env.ADMIN_DISPLAY || "Admin";

// Uses Web Crypto (Node 18+) to hash the same way the Worker does
async function hashPassword(password, salt) {
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
        "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
    );
    const bits = await globalThis.crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
        key, 256
    );
    return Buffer.from(bits).toString("base64");
}

async function main() {
    const id = "admin";
    const hash = await hashPassword(ADMIN_PASSWORD, id);

    // Directly insert via D1 REST API or wrangler
    // The easiest approach: generate the SQL and run it with wrangler
    const sql = `
INSERT OR REPLACE INTO accounts (id, username, password_hash, display_name)
VALUES ('${id}', '${ADMIN_USERNAME}', '${hash}', '${ADMIN_DISPLAY}');

INSERT OR IGNORE INTO overlay_data (account_id, timer_duration, timer_start_at, timer_running, timer_ended, event_name, map, map_video, series_type, games_displayed, graphics_enabled, graphics_images, matches, spotify_enabled, updated_at)
VALUES ('${id}', 600, 0, 0, 0, '', 'none', '', 'BO1', 1, 0, '[]', '{}', 1, ${Math.floor(Date.now()/1000)});
`.trim();

    console.log("=== Run this SQL via wrangler: ===\n");
    console.log(`wrangler d1 execute overlay-db --remote --command="${sql.replace(/\n/g," ")}"`);
    console.log("\n=== Or save to a file and run: ===");
    console.log("wrangler d1 execute overlay-db --remote --file=admin-seed.sql\n");

    const fs = await import("fs");
    fs.writeFileSync("admin-seed.sql", sql);
    console.log("admin-seed.sql written. Run:");
    console.log("  wrangler d1 execute overlay-db --remote --file=admin-seed.sql");
    console.log(`\nAdmin login: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
    console.log("Change your password after first login via the admin panel.");
}

main().catch(console.error);
