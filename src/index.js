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
//   GET    /api/calls/ice-servers                       (TURN creds, or STUN fallback)
//   POST   /api/calls/session                          (Cloudflare Calls proxy)
//   POST   /api/calls/session/:sessionId/tracks         (Cloudflare Calls proxy)
//   PUT    /api/calls/session/:sessionId/renegotiate    (Cloudflare Calls proxy)
//   PUT    /api/calls/session/:sessionId/tracks/close   (Cloudflare Calls proxy)
//   PUT    /api/camera/:accountId/:slot     (push.html registers/heartbeats)
//   GET    /api/camera/:accountId/:slot     (pull.html polls for current track)
//   DELETE /api/camera/:accountId/:slot     (push.html unload - best effort)
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

// ── Cloudflare Calls (Realtime SFU) proxy ──────────────────────────────────
// The push/pull pages talk to these instead of the Calls API directly, so
// CALLS_APP_SECRET never touches the browser. Track/session IDs themselves
// aren't secret (per Cloudflare's own docs), just the App Secret is.
const CALLS_API_BASE = "https://rtc.live.cloudflare.com/v1";

async function callsFetch(env, path, { method = "GET", body } = {}) {
    if (!env.CALLS_APP_ID || !env.CALLS_APP_SECRET) {
        return { ok: false, status: 500, data: { error: "Calls app not configured on the server (CALLS_APP_ID / CALLS_APP_SECRET)" } };
    }
    const res = await fetch(`${CALLS_API_BASE}/apps/${env.CALLS_APP_ID}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${env.CALLS_APP_SECRET}`,
            "Content-Type": "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch { /* empty body */ }
    return { ok: res.ok, status: res.status, data };
}

// Cloudflare TURN service uses a *separate* key pair from the Calls App
// (TURN_KEY_ID / TURN_KEY_API_TOKEN), not the app secret above.
async function fetchIceServers(env) {
    const fallback = { iceServers: [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] }] };
    if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return fallback;
    try {
        const res = await fetch(
            `${CALLS_API_BASE}/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ttl: 3600 }),
            }
        );
        if (!res.ok) return fallback;
        return await res.json();
    } catch {
        return fallback;
    }
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
        event_preset: "waveoce",
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
        event_preset: row.event_preset || "waveoce",
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
            if (pathname === "/") {
                return Response.redirect(new URL("/login.html", request.url).toString(), 302);
            }
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
                     event_name, event_preset, map, map_video, series_type, games_displayed,
                     graphics_enabled, graphics_images, matches, spotify_enabled, updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                `).bind(
                    d.account_id, d.timer_duration, d.timer_start_at, d.timer_running,
                    d.timer_ended, d.event_name, d.event_preset, d.map, d.map_video, d.series_type,
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
                 event_name, event_preset, map, map_video, series_type, games_displayed,
                 graphics_enabled, graphics_images, matches, spotify_enabled, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(account_id) DO UPDATE SET
                    timer_duration    = excluded.timer_duration,
                    timer_start_at    = excluded.timer_start_at,
                    timer_running     = excluded.timer_running,
                    timer_ended       = excluded.timer_ended,
                    event_name        = excluded.event_name,
                    event_preset      = excluded.event_preset,
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
                body.event_preset ?? "waveoce",
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
                 event_name, event_preset, map, map_video, series_type, games_displayed,
                 graphics_enabled, graphics_images, matches, spotify_enabled, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `).bind(
                id, d.timer_duration, d.timer_start_at, d.timer_running, d.timer_ended,
                d.event_name, d.event_preset, d.map, d.map_video, d.series_type, d.games_displayed,
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

        // PUT /api/overlay/:accountId/spotify-token
        const spotifyTokenMatch = pathname.match(/^\/api\/overlay\/([^/]+)\/spotify-token$/);
        if (spotifyTokenMatch && method === "PUT") {
            const accountId = spotifyTokenMatch[1];
            const session = await requireAuth(env, request);
            if (!session) return err("Unauthorised", 401);
            if (session.accountId !== accountId && !session.isAdmin) return err("Forbidden", 403);
            const { token } = await request.json();
            await env.DB.prepare(
                "UPDATE overlay_data SET spotify_token = ?, updated_at = ? WHERE account_id = ?"
            ).bind(token || "", Math.floor(Date.now() / 1000), accountId).run();
            return json({ ok: true });
        }

        // ── GET /api/calls/ice-servers ────────────────────────────────────────
        // Short-lived TURN credentials (1hr TTL) if TURN is configured, else
        // STUN-only fallback. push.html/pull.html fetch this once per session.
        if (pathname === "/api/calls/ice-servers" && method === "GET") {
            return json(await fetchIceServers(env));
        }

        // ── POST /api/calls/session ───────────────────────────────────────────
        // Creates a bare Cloudflare Calls session (no SDP exchange yet).
        if (pathname === "/api/calls/session" && method === "POST") {
            const { ok, status, data } = await callsFetch(env, "/sessions/new", { method: "POST", body: {} });
            return json(data, ok ? 200 : status);
        }

        // ── POST /api/calls/session/:sessionId/tracks ─────────────────────────
        // Push: body = { sessionDescription, tracks: [{location:'local', mid, trackName}] }
        // Pull: body = { tracks: [{location:'remote', sessionId, trackName}] }
        const callsTracksMatch = pathname.match(/^\/api\/calls\/session\/([^/]+)\/tracks$/);
        if (callsTracksMatch && method === "POST") {
            const body = await request.json();
            const { ok, status, data } = await callsFetch(
                env, `/sessions/${callsTracksMatch[1]}/tracks/new`, { method: "POST", body }
            );
            return json(data, ok ? 200 : status);
        }

        // ── PUT /api/calls/session/:sessionId/renegotiate ─────────────────────
        const callsRenegMatch = pathname.match(/^\/api\/calls\/session\/([^/]+)\/renegotiate$/);
        if (callsRenegMatch && method === "PUT") {
            const body = await request.json();
            const { ok, status, data } = await callsFetch(
                env, `/sessions/${callsRenegMatch[1]}/renegotiate`, { method: "PUT", body }
            );
            return json(data, ok ? 200 : status);
        }

        // ── PUT /api/calls/session/:sessionId/tracks/close ────────────────────
        const callsCloseMatch = pathname.match(/^\/api\/calls\/session\/([^/]+)\/tracks\/close$/);
        if (callsCloseMatch && method === "PUT") {
            const body = await request.json().catch(() => ({}));
            const { ok, status, data } = await callsFetch(
                env, `/sessions/${callsCloseMatch[1]}/tracks/close`, { method: "PUT", body }
            );
            return json(data, ok ? 200 : status);
        }

        // ── PUT /api/camera/:accountId/:slot ──────────────────────────────────
        // Caster's push.html registers/heartbeats its current Calls session here.
        // No login required - same trust model as the public overlay poll endpoint;
        // the accountId itself is the capability (mirrors the old VDO push-link design).
        const cameraPutMatch = pathname.match(/^\/api\/camera\/([^/]+)\/(left|right|solo)$/);
        if (cameraPutMatch && method === "PUT") {
            const [, accountId, slot] = cameraPutMatch;
            const { sessionId, videoTrack, audioTrack } = await request.json();
            if (!sessionId) return err("Missing sessionId");
            const now = Math.floor(Date.now() / 1000);
            await env.DB.prepare(`
                INSERT INTO camera_sessions (account_id, slot, session_id, video_track, audio_track, updated_at)
                VALUES (?,?,?,?,?,?)
                ON CONFLICT(account_id, slot) DO UPDATE SET
                    session_id  = excluded.session_id,
                    video_track = excluded.video_track,
                    audio_track = excluded.audio_track,
                    updated_at  = excluded.updated_at
            `).bind(accountId, slot, sessionId, videoTrack || "", audioTrack || "", now).run();
            return json({ ok: true, updated_at: now });
        }

        // ── GET /api/camera/:accountId/:slot ──────────────────────────────────
        // pull.html polls this to find out what to pull (and whether the caster
        // is still alive - anything older than ~15s is treated as offline).
        const cameraGetMatch = pathname.match(/^\/api\/camera\/([^/]+)\/(left|right|solo)$/);
        if (cameraGetMatch && method === "GET") {
            const [, accountId, slot] = cameraGetMatch;
            const row = await env.DB.prepare(
                "SELECT session_id, video_track, audio_track, updated_at FROM camera_sessions WHERE account_id = ? AND slot = ?"
            ).bind(accountId, slot).first();
            if (!row) return json(null);
            const age = Math.floor(Date.now() / 1000) - row.updated_at;
            return json({ ...row, age_seconds: age, live: age < 15 });
        }

        // ── DELETE /api/camera/:accountId/:slot ───────────────────────────────
        // Caster's push.html calls this (best-effort, on unload) to go offline immediately.
        const cameraDeleteMatch = pathname.match(/^\/api\/camera\/([^/]+)\/(left|right|solo)$/);
        if (cameraDeleteMatch && method === "DELETE") {
            const [, accountId, slot] = cameraDeleteMatch;
            await env.DB.prepare("DELETE FROM camera_sessions WHERE account_id = ? AND slot = ?").bind(accountId, slot).run();
            return json({ ok: true });
        }

        return err("Not found", 404);
    },
};
