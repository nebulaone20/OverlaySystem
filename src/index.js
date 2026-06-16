// ─── Overlay System Worker ───────────────────────────────────────────────────
// Routes:
//   POST   /api/login
//   POST   /api/logout
//   GET    /api/me
//   GET    /api/overlay/:accountId          (overlay polls this)
//   PUT    /api/overlay/:accountId          (console saves to this)
//   GET    /api/overlay/:accountId/timer    (granular timer endpoint)
//   PUT    /api/overlay/:accountId/timer
//   GET    /api/admin/accounts              (admin only)
//   POST   /api/admin/accounts              (admin only - create account)
//   DELETE /api/admin/accounts/:id          (admin only)
//   PUT    /api/admin/accounts/:id/password (admin only)
// ─────────────────────────────────────────────────────────────────────────────

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
    });
}

function err(msg, status = 400) {
    return json({ error: msg }, status);
}

// ── Simple password hashing using Web Crypto (SHA-256 + salt) ─────────────
async function hashPassword(password, salt) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw", enc.encode(password), { name: "PBKDF2" }, false,
        ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
        key, 256
    );
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

async function verifyPassword(password, salt, storedHash) {
    const hash = await hashPassword(password, salt);
    return hash === storedHash;
}

function generateId(length = 32) {
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Session helpers ───────────────────────────────────────────────────────────
async function createSession(env, accountId, username, isAdmin) {
    const token = generateId(32);
    const session = JSON.stringify({ accountId, username, isAdmin, created: Date.now() });
    // Sessions expire after 7 days
    await env.SESSIONS.put(`session:${token}`, session, { expirationTtl: 604800 });
    return token;
}

async function getSession(env, req) {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) return null;
    const raw = await env.SESSIONS.get(`session:${token}`);
    if (!raw) return null;
    return { ...JSON.parse(raw), token };
}

async function requireAuth(env, req) {
    const session = await getSession(env, req);
    if (!session) return null;
    return session;
}

// ── Default overlay state ─────────────────────────────────────────────────────
function defaultOverlay(accountId) {
    return {
        account_id: accountId,
        timer_duration: 600,
        timer_start_at: 0,
        timer_running: 0,
        timer_ended: 0,
        event_name: "",
        map: "none",
        map_video: "",
        series_type: "BO1",
        games_displayed: 1,
        graphics_enabled: 0,
        graphics_images: "[]",
        matches: "{}",
        spotify_enabled: 1,
        updated_at: Math.floor(Date.now() / 1000),
    };
}

function parseOverlay(row) {
    if (!row) return null;
    return {
        ...row,
        timer_running: !!row.timer_running,
        timer_ended: !!row.timer_ended,
        graphics_enabled: !!row.graphics_enabled,
        spotify_enabled: !!row.spotify_enabled,
        graphics_images: JSON.parse(row.graphics_images || "[]"),
        matches: JSON.parse(row.matches || "{}"),
    };
}

// ── Router ────────────────────────────────────────────────────────────────────
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const { pathname } = url;
        const method = request.method;

        // CORS preflight
        if (method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS });
        }

        if (pathname === "/favicon.ico") {
            return new Response(null, { status: 204 });
        }

        // ── Static assets (Workers Sites / __STATIC_CONTENT) ────────────────
        if (!pathname.startsWith("/api/")) {
            return env.ASSETS.fetch(request);
        }

        // ── POST /api/login ──────────────────────────────────────────────────
        if (pathname === "/api/login" && method === "POST") {
            const { username, password } = await request.json();
            if (!username || !password) return err("Missing credentials");

            const row = await env.DB.prepare(
                "SELECT id, username, password_hash, display_name FROM accounts WHERE username = ?"
            ).bind(username).first();

            if (!row) return err("Invalid credentials", 401);

            // Salt is the account id
            const valid = await verifyPassword(password, row.id, row.password_hash);
            if (!valid) return err("Invalid credentials", 401);

            const isAdmin = row.id === "admin" || username === "admin";
            const token = await createSession(env, row.id, row.username, isAdmin);

            return json({ token, accountId: row.id, username: row.username, displayName: row.display_name, isAdmin });
        }

        // ── POST /api/logout ─────────────────────────────────────────────────
        if (pathname === "/api/logout" && method === "POST") {
            const session = await getSession(env, request);
            if (session) await env.SESSIONS.delete(`session:${session.token}`);
            return json({ ok: true });
        }

        // ── GET /api/me ──────────────────────────────────────────────────────
        if (pathname === "/api/me" && method === "GET") {
            const session = await requireAuth(env, request);
            if (!session) return err("Unauthorised", 401);
            return json({ accountId: session.accountId, username: session.username, isAdmin: session.isAdmin });
        }

        // ── GET /api/overlay/:accountId ──────────────────────────────────────
        const overlayMatch = pathname.match(/^\/api\/overlay\/([^/]+)$/);
        if (overlayMatch && method === "GET") {
            const accountId = overlayMatch[1];
            let row = await env.DB.prepare(
                "SELECT * FROM overlay_data WHERE account_id = ?"
            ).bind(accountId).first();

            if (!row) {
                // Auto-create default overlay row for this account
                const d = defaultOverlay(accountId);
                await env.DB.prepare(`
                    INSERT OR IGNORE INTO overlay_data
                    (account_id, timer_duration, timer_start_at, timer_running, timer_ended,
                     event_name, map, map_video, series_type, games_displayed,
                     graphics_enabled, graphics_images, matches, spotify_enabled, updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                `).bind(
                    d.account_id, d.timer_duration, d.timer_start_at, d.timer_running,
                    d.timer_ended, d.event_name, d.map, d.map_video, d.series_type,
                    d.games_displayed, d.graphics_enabled, d.graphics_images,
                    d.matches, d.spotify_enabled, d.updated_at
                ).run();
                row = d;
            }

            return json(parseOverlay(row));
        }

        // ── PUT /api/overlay/:accountId ──────────────────────────────────────
        const overlayPutMatch = pathname.match(/^\/api\/overlay\/([^/]+)$/);
        if (overlayPutMatch && method === "PUT") {
            const accountId = overlayPutMatch[1];
            const session = await requireAuth(env, request);
            if (!session) return err("Unauthorised", 401);
            // Only the account owner or admin can update
            if (session.accountId !== accountId && !session.isAdmin) {
                return err("Forbidden", 403);
            }

            const body = await request.json();
            const now = Math.floor(Date.now() / 1000);

            await env.DB.prepare(`
                INSERT INTO overlay_data
                (account_id, timer_duration, timer_start_at, timer_running, timer_ended,
                 event_name, map, map_video, series_type, games_displayed,
                 graphics_enabled, graphics_images, matches, spotify_enabled, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(account_id) DO UPDATE SET
                    timer_duration    = excluded.timer_duration,
                    timer_start_at    = excluded.timer_start_at,
                    timer_running     = excluded.timer_running,
                    timer_ended       = excluded.timer_ended,
                    event_name        = excluded.event_name,
                    map               = excluded.map,
                    map_video         = excluded.map_video,
                    series_type       = excluded.series_type,
                    games_displayed   = excluded.games_displayed,
                    graphics_enabled  = excluded.graphics_enabled,
                    graphics_images   = excluded.graphics_images,
                    matches           = excluded.matches,
                    spotify_enabled   = excluded.spotify_enabled,
                    updated_at        = excluded.updated_at
            `).bind(
                accountId,
                body.timer_duration ?? 600,
                body.timer_start_at ?? 0,
                body.timer_running ? 1 : 0,
                body.timer_ended ? 1 : 0,
                body.event_name ?? "",
                body.map ?? "none",
                body.map_video ?? "",
                body.series_type ?? "BO1",
                body.games_displayed ?? 1,
                body.graphics_enabled ? 1 : 0,
                JSON.stringify(body.graphics_images ?? []),
                JSON.stringify(body.matches ?? {}),
                body.spotify_enabled ? 1 : 0,
                now
            ).run();

            return json({ ok: true, updated_at: now });
        }

        // ── Granular timer PUT ───────────────────────────────────────────────
        const timerMatch = pathname.match(/^\/api\/overlay\/([^/]+)\/timer$/);
        if (timerMatch && method === "PUT") {
            const accountId = timerMatch[1];
            const session = await requireAuth(env, request);
            if (!session) return err("Unauthorised", 401);
            if (session.accountId !== accountId && !session.isAdmin) return err("Forbidden", 403);

            const body = await request.json();
            const now = Math.floor(Date.now() / 1000);

            await env.DB.prepare(`
                UPDATE overlay_data SET
                    timer_duration  = COALESCE(?, timer_duration),
                    timer_start_at  = COALESCE(?, timer_start_at),
                    timer_running   = COALESCE(?, timer_running),
                    timer_ended     = COALESCE(?, timer_ended),
                    updated_at      = ?
                WHERE account_id = ?
            `).bind(
                body.duration ?? null,
                body.start_at ?? null,
                body.running != null ? (body.running ? 1 : 0) : null,
                body.ended != null ? (body.ended ? 1 : 0) : null,
                now,
                accountId
            ).run();

            return json({ ok: true });
        }

        // ── GET /api/admin/accounts ──────────────────────────────────────────
        if (pathname === "/api/admin/accounts" && method === "GET") {
            const session = await requireAuth(env, request);
            if (!session?.isAdmin) return err("Forbidden", 403);

            const { results } = await env.DB.prepare(
                "SELECT id, username, display_name, created_at FROM accounts ORDER BY created_at DESC"
            ).all();

            return json(results);
        }

        // ── POST /api/admin/accounts ─────────────────────────────────────────
        if (pathname === "/api/admin/accounts" && method === "POST") {
            const session = await requireAuth(env, request);
            if (!session?.isAdmin) return err("Forbidden", 403);

            const { username, password, displayName } = await request.json();
            if (!username || !password || !displayName) return err("Missing fields");

            const id = generateId(8);
            const hash = await hashPassword(password, id);

            await env.DB.prepare(
                "INSERT INTO accounts (id, username, password_hash, display_name) VALUES (?,?,?,?)"
            ).bind(id, username, hash, displayName).run();

            // Create blank overlay row
            const d = defaultOverlay(id);
            await env.DB.prepare(`
                INSERT OR IGNORE INTO overlay_data
                (account_id, timer_duration, timer_start_at, timer_running, timer_ended,
                 event_name, map, map_video, series_type, games_displayed,
                 graphics_enabled, graphics_images, matches, spotify_enabled, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `).bind(
                id, d.timer_duration, d.timer_start_at, d.timer_running, d.timer_ended,
                d.event_name, d.map, d.map_video, d.series_type, d.games_displayed,
                d.graphics_enabled, d.graphics_images, d.matches, d.spotify_enabled, d.updated_at
            ).run();

            return json({ id, username, displayName });
        }

        // ── DELETE /api/admin/accounts/:id ───────────────────────────────────
        const deleteMatch = pathname.match(/^\/api\/admin\/accounts\/([^/]+)$/);
        if (deleteMatch && method === "DELETE") {
            const session = await requireAuth(env, request);
            if (!session?.isAdmin) return err("Forbidden", 403);
            const id = deleteMatch[1];
            if (id === "admin") return err("Cannot delete admin account");
            await env.DB.prepare("DELETE FROM accounts WHERE id = ?").bind(id).run();
            return json({ ok: true });
        }

        // ── PUT /api/admin/accounts/:id/password ─────────────────────────────
        const pwMatch = pathname.match(/^\/api\/admin\/accounts\/([^/]+)\/password$/);
        if (pwMatch && method === "PUT") {
            const session = await requireAuth(env, request);
            if (!session?.isAdmin) return err("Forbidden", 403);
            const id = pwMatch[1];
            const { password } = await request.json();
            if (!password) return err("Missing password");
            const hash = await hashPassword(password, id);
            await env.DB.prepare("UPDATE accounts SET password_hash = ? WHERE id = ?").bind(hash, id).run();
            return json({ ok: true });
        }

        return err("Not found", 404);
    },
};
