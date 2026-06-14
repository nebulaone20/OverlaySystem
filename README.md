# Overlay System - Setup Guide

## File Structure
```
overlay-system/
├── src/index.js          ← Cloudflare Worker (all API routes + static serving)
├── public/
│   ├── login.html        ← Login page (everyone lands here)
│   ├── admin.html        ← Admin panel (create/delete accounts)
│   ├── console/
│   │   ├── index.html    ← Overlay control console
│   │   └── spotify.js    ← Spotify PKCE auth (copy from your existing file)
│   └── overlay/
│       └── index.html    ← The actual OBS overlay (add ?id=ACCOUNT_ID)
├── schema.sql            ← D1 database schema
├── setup.js              ← Run once to create admin account
├── wrangler.toml         ← Cloudflare config
└── package.json
```

---

## 1. Install Wrangler
```bash
npm install
```

---

## 2. Create D1 Database
```bash
wrangler d1 create overlay-db
```
Copy the `database_id` from the output and paste it into `wrangler.toml`.

---

## 3. Create KV Namespace (for sessions)
```bash
wrangler kv:namespace create SESSIONS
```
Copy the `id` from the output and paste it into `wrangler.toml`.

---

## 4. Run Schema
```bash
npm run db:init:remote
```

---

## 5. Create Admin Account
```bash
node setup.js
# Then run the printed wrangler command, e.g.:
wrangler d1 execute overlay-db --remote --file=admin-seed.sql
```

---

## 6. Copy Your Assets
Copy these files into `public/overlay/` (same folder as overlay index.html):
- `Intermission26Frame.png`
- `jefferies.otf`
- `jefferies bold.otf`
- All sponsor/logo PNG files

Copy into `public/console/`:
- `spotify.js`

---

## 7. Deploy
```bash
npm run deploy
```

---

## 8. Usage

| URL | Who uses it |
|-----|-------------|
| `https://your-worker.workers.dev/` | Redirects to login |
| `https://your-worker.workers.dev/login.html` | Login page |
| `https://your-worker.workers.dev/admin.html` | You (admin only) |
| `https://your-worker.workers.dev/console/index.html` | Each operator after login |
| `https://your-worker.workers.dev/overlay/index.html?id=ACCOUNT_ID` | OBS browser source |

---

## 9. OBS Setup
Add a **Browser Source** with URL:
```
https://your-worker.workers.dev/overlay/index.html?id=ACCOUNT_ID
```
Width: `1920`, Height: `1080`

Each account gets its own URL. Changes made in one console only affect that account's overlay.

---

## How accounts work
1. You log in as admin → go to `/admin.html`
2. Create a new account (e.g. username: `waveoce`, display: `Wave OCE`)
3. The account gets a unique ID (e.g. `a3f9b2c1`)
4. Share login credentials with the operator
5. Their overlay URL is `...?id=a3f9b2c1`
6. Their console changes ONLY affect their overlay
