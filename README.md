# Overlay System - User Guide

## URLs

| Page | URL |
|------|-----|
| Login | https://overlaysystem.road2.workers.dev/login.html |
| Admin Panel | https://overlaysystem.road2.workers.dev/admin.html |
| Console | https://overlaysystem.road2.workers.dev/console/index.html |
| Overlay | https://overlaysystem.road2.workers.dev/overlay/index.html?id=ACCOUNT_ID |

---

## Logging In

1. Go to `https://overlaysystem.road2.workers.dev/`
2. Enter your username and password
3. Admins are sent to the **Admin Panel**, operators are sent to the **Console**

---

## Admin Panel

Only you have access to this. From here you can:

- **Create accounts** - enter a display name, username, and password then click Create Account
- **Reset passwords** - click Reset PW next to any account
- **Delete accounts** - click Delete next to any account (cannot delete admin)
- **Copy overlay URLs** - click the overlay URL next to any account to copy it to your clipboard

Each account gets a unique overlay URL in the format:
```
https://overlaysystem.road2.workers.dev/overlay/index.html?id=ACCOUNT_ID
```
Give this URL to the OBS operator for that event.

---

## Console

This is where you control the overlay. Each section is in the left sidebar.

### Timer
- Set the hours, minutes, and seconds then click **▶ Start**
- **⏸ Stop** pauses the timer at its current value
- **↺ Reset** sets the timer back to zero
- **Set Match Ended** displays "Ended" on the overlay
- **Reset Match State** clears the ended state

### Map
- Select the map from the dropdown and click **Save Map**
- The overlay will automatically load and display the map cinematic video
- Select **None** to hide the video

### Matches
- Set the **Series Type** (BO1, BO3, BO5)
- Set **Games** to the total number of games in the series
- Set **Games Displayed** to how many appear on the overlay
- Fill in team tags, logo URLs, and scores for each game
- Click **Save Matches**

### Graphics
- Check **Enable Graphics Rotation** to turn it on
- Paste image URLs (one per line) - these rotate every 15 seconds
- After a full cycle the map video resumes for 90 seconds before rotating again
- Click **Save Graphics**

### Event
- Type the event name shown in the timer bar (e.g. `Road 2 Invitationals - Group Stage - Day 1`)
- Click **Save Event Name**

### Timeout
- Set remaining timeouts for each team
- Select which side called the timeout
- Check **Show Timeout Banner** to display it on the overlay
- Click **Save Timeout**

### Camera
Camera video/audio is carried over [Cloudflare Calls](https://developers.cloudflare.com/realtime/sfu/) (Cloudflare's own WebRTC infrastructure) instead of a third-party service - nothing leaves your Cloudflare account.

- Set the camera layout (Duo, Solo, None)
- Click **Copy** next to a camera's **Push Link** and send it to that caster. It's a stable URL (`/cam/push.html?slot=left&id=ACCOUNT_ID`) - no need to regenerate it.
- The caster opens the link, grants camera/mic access, and stays live as long as the tab is open. A 🟢/⚪ badge on each camera card shows whether they're currently connected.
- Adjust **Mic Gain** and **Compressor** - these update live on the caster's page via the Web Audio API, no reload needed.
- **Noise Suppression / Echo Cancellation / Auto Gain Control / Audio Bitrate** are applied when the caster's page loads (they need to refresh their push link to pick up changes).
- Volume/Panning/Mute (under "Real-time controls") apply on the overlay side and update instantly.

**Setup (one-time, for the site operator):** create a Calls App in the Cloudflare dashboard under Realtime → SFU, put its App ID in `wrangler.toml` as `CALLS_APP_ID`, and set the App Secret with `wrangler secret put CALLS_APP_SECRET`. See `migrate-calls.sql` if you're adding this to an existing deployment.

Optional but recommended: create a TURN key under Realtime → TURN, set its ID as `TURN_KEY_ID` in `wrangler.toml`, and its API token with `wrangler secret put TURN_KEY_API_TOKEN`. Without this, casters fall back to STUN-only, which can fail behind symmetric NAT or locked-down corporate/venue networks.

### Spotify
- Check **Show Now Playing** to display the current song on the overlay
- Click **Connect Spotify** to authenticate
- Click **Disconnect** to remove the connection

---

## OBS Setup

1. Add a **Browser Source**
2. Set the URL to your overlay URL:
   ```
   https://overlaysystem.road2.workers.dev/overlay/index.html?id=ACCOUNT_ID
   ```
3. Set width to **1920** and height to **1080**
4. Check **Refresh browser when scene becomes active**

---

## Notes

- The overlay polls for updates every **2 seconds** - there may be a short delay between saving in the console and the change appearing on stream
- Each account is fully isolated - changes made in one console do not affect any other overlay
- Spotify tokens are stored locally in your browser - if you clear browser data you will need to reconnect
