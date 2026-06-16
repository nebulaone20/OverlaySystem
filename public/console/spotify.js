const CLIENT_ID = "36304abf3c674b89ba2489ab3e554e0b";
const REDIRECT_URI = "https://nebulaone20.github.io/Nebulas-Valorant-Overlay/console/";
const SCOPES = "user-read-playback-state user-read-currently-playing";

const loginBtn = document.getElementById("spotify-connect");
const statusEl = document.getElementById("spotify-status");

/* =========================
   PKCE HELPERS
========================= */
function randomString(length) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return await crypto.subtle.digest("SHA-256", data);
}

function base64encode(input) {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

/* =========================
   LOGIN BUTTON (PKCE)
========================= */
if (loginBtn) {
    loginBtn.onclick = async () => {
        const verifier = randomString(64);
        const challenge = base64encode(await sha256(verifier));

        localStorage.setItem("pkce_verifier", verifier);

        const params = new URLSearchParams({
            response_type: "code",
            client_id: CLIENT_ID,
            scope: SCOPES,
            redirect_uri: REDIRECT_URI,
            code_challenge_method: "S256",
            code_challenge: challenge,
        });

        window.location.href =
            "https://accounts.spotify.com/authorize?" + params.toString();
    };
}

/* =========================
   HANDLE REDIRECT (IMPORTANT)
========================= */
async function handleRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
        console.error("Spotify error:", error);
        if (statusEl) statusEl.textContent = "Spotify Error";
        return;
    }

    if (!code) return;

    const verifier = localStorage.getItem("pkce_verifier");
    if (!verifier) {
        alert("Missing verifier - reconnect Spotify");
        return;
    }

    const body = new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
    });

    try {
        const res = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body,
        });

        const data = await res.json();

        if (data.access_token) {
            localStorage.setItem("spotify_access_token", data.access_token);

            // ✅ GET USER DISPLAY NAME (THIS FIXES YOUR BUTTON)
            try {
                const meRes = await fetch("https://api.spotify.com/v1/me", {
                    headers: {
                        Authorization: "Bearer " + data.access_token
                    }
                });

                const me = await meRes.json();

                if (me.display_name) {
                    localStorage.setItem("spotify_user_display", me.display_name);
                }
            } catch (e) {
                console.error("Failed to fetch user", e);
            }

            if (statusEl) statusEl.textContent = "Spotify Connected ✅";

            // clean URL
            window.history.replaceState({}, document.title, REDIRECT_URI);

            // ✅ OPTIONAL (but recommended)
            location.reload();
        } else {
            console.error(data);
            alert("Token exchange failed");
        }
    } catch (err) {
        console.error(err);
        alert("Spotify error");
    }
}

/* =========================
   INIT
========================= */
handleRedirect();

const savedToken = localStorage.getItem("spotify_access_token");
if (savedToken && statusEl) {
    statusEl.textContent = "Spotify Connected";
}

/* =========================
   DISCONNECT
========================= */
const disconnectBtn = document.getElementById("spotify-disconnect");

if (disconnectBtn) {
    disconnectBtn.onclick = () => {
        localStorage.removeItem("spotify_access_token");
        localStorage.removeItem("spotify_refresh_token");
        localStorage.removeItem("spotify_user_display");
        localStorage.removeItem("pkce_verifier");

        if (statusEl) statusEl.textContent = "Not connected";

        // reset UI
        const userBox = document.getElementById("spotify-user");
        if (userBox) userBox.classList.add("hidden");

        const connectBtn = document.getElementById("spotify-connect");
        if (connectBtn) connectBtn.style.display = "";

        disconnectBtn.style.display = "none";

        console.log("Spotify disconnected");
    };
}

/* =========================
   RESTORE UI ON LOAD
========================= */
const token = localStorage.getItem("spotify_access_token");
const displayName = localStorage.getItem("spotify_user_display");
const connectBtn2 = document.getElementById("spotify-connect");
const disconnectBtn2 = document.getElementById("spotify-disconnect");
const userBox = document.getElementById("spotify-user");
const userNameEl = document.getElementById("spotify-user-name");

if (token) {
    if (statusEl) statusEl.textContent = "Spotify Connected ✅";
    if (connectBtn2) connectBtn2.style.display = "none";
    if (disconnectBtn2) disconnectBtn2.style.display = "";
    if (displayName && userBox && userNameEl) {
        userNameEl.textContent = displayName;
        userBox.classList.remove("hidden");
    }
}
