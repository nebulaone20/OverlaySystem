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
- Set the camera layout (Duo, Solo, None)
- Click **Generate VDO Link** to create a VDO.Ninja push link - it copies to your clipboard automatically, send it to the player
- Paste the view URL into the URL field
- Adjust gain and compressor levels per camera
- Click **Save Camera Config**

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
