# Overlay System - User Guide

## URLs

| Page | URL |
|------|-----|
| Login | https://overlaysystem.road2.workers.dev/login.html |
| Admin Panel | https://overlaysystem.road2.workers.dev/admin.html |
| Console | https://overlaysystem.road2.workers.dev/console/index.html |
| Overlay | https://overlaysystem.road2.workers.dev/overlay/index.html?id=ACCOUNT_ID |
| Cams | https://overlaysystem.road2.workers.dev/castcams/castcams-index?id=ACCOUNT_ID |
| Graphics OP | https://overlaysystem.road2.workers.dev/overlay/gfx.html?id=ACCOUNT_ID |

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

### Graphics OP
Live graphics that fire over the **game feed**, not the intermission screen. They render on their own transparent browser source - see OBS Setup below.

**Caster / Observer Shoutout**
- Fill in up to two observer names (left side) and two caster names (right side)
- The Left/Right Label fields set the heading above each - defaults are OBSERVERS and CASTERS
- Set the hold duration, then click **Show Shoutout** - both sides slide in off the walls together, hold, then slide back out on their own
- Leave one side's names blank to keep that side off screen entirely
- **Hide Now** pulls it early

**Caster Name Tags**
- One name tag under each caster cam: type a name into **Left Caster**, **Right Caster**, or both
- Click **Show Tags** - they slide up into place under the cams and stay there
- **Hide Tags** takes them away; there is no timer on these, they are a straight toggle
- Leave a side blank to keep that tag off screen
- Editing a name and pressing **Show Tags** again updates them in place, no need to hide first
- Long names shrink to fit the blue panel rather than running past it
- Unlike the two graphics below, these **do** come back by themselves if the browser source reloads mid-show, so refreshing OBS will not silently drop them off stream

**Toast Message**
- Type any text, set the duration, click **Show Toast**
- The event mark slides up to the middle of screen, the bar stretches out from it to fit the text, then reverses to hide
- The mark follows your event preset (Road 2 / Wave / Blob), same as the sponsor box
- Very long messages clamp at 1500px rather than running off the edge

Pressing Show again replays the animation even if the text has not changed.

### Event
- Type the event name shown in the timer bar (e.g. `Road 2 Invitationals - Group Stage - Day 1`)
- Click **Save Event Name**

### Timeout
- Set remaining timeouts for each team
- Set **Attacking Side**. This is the one thing to keep current: set it at the
  start of each half and the Stream Deck's Attacker and Defender buttons stay
  right all the way through it
- **Called By** is the side that called this one
- Check **Show Timeout Banner** to display it, and untick it to take it down
- Click **Save Timeout**

The banner renders on the **Graphics OP** overlay, not the intermission one, so
it sits over gameplay where a timeout actually happens. It is red when the team
that called it is attacking and green when they are defending, and it shows that
team's logo and tricode. The small boxes down each side are the timeouts still in
hand: filled is one left.

A timeout raised here stays up until you untick the box. One fired from the
Stream Deck takes itself down after 58 seconds.

### Stream Deck

Five buttons, no plugin. In the Stream Deck app, drag a **System > Website**
action onto a key, paste the URL from the console's **Stream Deck** panel, and
tick **Access in background**. Without that box the deck opens a browser tab
every time you press it.

| Button | What it does |
|---|---|
| Shoutout | Fires the shoutout as it is set up in Graphics OP |
| Caster tags | Toggle. Press for up, press again for down |
| Toast | Fires the toast message as it is set up in Graphics OP |
| Attacker timeout | Red banner for the attacking team, takes one off their count, 58 seconds |
| Defender timeout | Green banner for the defending team, same |

There is a sixth URL, **Clear timeout**, which takes the banner down early. It is
there for a misfire; only give it a key if you have one going spare.

Each button in that panel also has its key image under it, set in Jefferies so
the deck matches the broadcast. The preview shown is the file that downloads, so
there is nothing to match up by hand. Clear the key's **Title** in the Stream
Deck app after setting one: the words are part of the image, and the app draws
its own title over the top by default.

The colours carry the meaning. Blue for the three Graphics OP buttons, then
FF3549 and 28D091 on the timeouts, which are the two colours of the banner
itself, so the key you press is the colour that appears on stream. Clear is
deliberately drab: it should not catch your eye mid round.

The three graphics buttons fire whatever is currently typed into Graphics OP.
They do not carry content of their own, so the words are still yours to set in
the console before the show.

**About the key.** These URLs carry one, because the deck can only fetch a plain
web address and has nowhere to put a password. It is not your login: it can only
press these six buttons, it can never read or change anything else, and it is
never included in the overlay state the browser source polls. **Regenerate key**
in the console mints a new one and every URL already in your deck stops working
immediately, so treat it like the links themselves - fine in your own Stream
Deck, not in a screenshot or a shared channel.

Run the migration once before any of this works:

```
npx wrangler d1 execute overlay-db --remote --file=migrate-deck.sql
```

"duplicate column name: deck_key" means it already applied.

### Camera
Camera video/audio is carried over [Cloudflare Calls](https://developers.cloudflare.com/realtime/sfu/) (Cloudflare's own WebRTC infrastructure) instead of a third-party service - nothing leaves your Cloudflare account.

- Set the camera layout (Duo, Solo, None)
- Click **Copy** next to a camera's **Push Link** and send it to that caster. It's a stable URL (`/cam/push.html?slot=left&id=ACCOUNT_ID`) - no need to regenerate it.
- The caster opens the link, grants camera/mic access, and stays live as long as the tab is open. A 🟢/⚪ badge on each camera card shows whether they're currently connected.
- Adjust **Mic Gain** and **Compressor** - these update live on the caster's page via the Web Audio API, no reload needed.
- **Noise Suppression / Echo Cancellation / Auto Gain Control / Audio Bitrate** are applied when the caster's page loads (they need to refresh their push link to pick up changes).
- Volume/Panning/Mute (under "Real-time controls") apply on the overlay side and update instantly.

### Desk mode

A second cam layout for a three person desk, on its own browser source so it
and the caster cams can each be on screen without the other.

- Tick **Desk mode** in the Camera panel. It applies immediately, no Save press.
- Send each of the three **Desk** push links out the same way as the casters'.
- Add a second **Browser Source** in OBS:
  ```
  https://overlaysystem.road2.workers.dev/castcams/castcams-index.html?id=ACCOUNT_ID&view=desk
  ```
  1920 x 1080. It shows nothing at all while desk mode is off, so it can live in
  a scene without three empty windows appearing between segments.
- Your two casters drop to **mic only** for as long as desk mode is on: their
  camera stops encoding, their audio keeps going, and their push page says so
  rather than just going black on them. Untick it and the picture comes back
  with no reconnection.
- The caster source is left alone either way. Switch scenes as normal.

The desk windows are portrait, unlike the duo openings which are nearly 16:9, so
a webcam is centre cropped to fill one: roughly **half the width of a 16:9 shot
is cut**. Heads and shoulders sit fine, but tell desk guests to centre
themselves and not sit too close.

### Spotify
- Check **Show Now Playing** to display the current song on the overlay
- Click **Connect Spotify** to authenticate
- Click **Disconnect** to remove the connection

---

## OBS Setup

### Intermission overlay

1. Add a **Browser Source**
2. Set the URL to your overlay URL:
   ```
   https://overlaysystem.road2.workers.dev/overlay/index.html?id=ACCOUNT_ID
   ```
3. Set width to **1920** and height to **1080**
4. Check **Refresh browser when scene becomes active**

### Graphics OP overlay

Add this as a **second** browser source on your in-game scene, above the game capture:

1. Add a **Browser Source**
2. Set the URL to:
   ```
   https://overlaysystem.road2.workers.dev/overlay/gfx.html?id=ACCOUNT_ID
   ```
3. Set width to **1920** and height to **1080**
4. Leave **Refresh browser when scene becomes active** UNCHECKED

The page is fully transparent, so it sits over gameplay without covering it. It deliberately does not replay the last **shoutout or toast** when it loads, which is why the refresh option should stay off - otherwise a scene change could re-fire an old shoutout on stream.

The **caster name tags** are the exception, on purpose. They are a toggle rather than a timed graphic, so if they are up when the source reloads they come straight back, without the slide-in animation. A timed graphic replaying itself is a bug; a toggle quietly dropping off stream is also a bug, and they need opposite handling.

The tags are positioned for the **New Dawn duo-cam frame**, sitting under each cam window in the gap above the bottom bar. If that frame's geometry ever changes, `--tag-top` and the two `left` values at the top of `gfx.html` are the only things to move.

---

## Notes

- The Graphics OP page polls every **1 second**; the intermission overlay polls every **2 seconds** - there may be a short delay between saving in the console and the change appearing on stream
- Each account is fully isolated - changes made in one console do not affect any other overlay
- Spotify tokens are stored locally in your browser - if you clear browser data you will need to reconnect
