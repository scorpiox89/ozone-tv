# Ozone FC — Instagram TV Wall

A scattered collage of your latest Instagram posts for the gym TVs.

- 10 posts per screen, from the **last 90 days**, rotating to 10 more every 15s
- **true aspect ratio** (no cropping), **videos autoplay** muted + looped
- random position / size, recessed background tiles, edge bleed — matches the brand mockups
- each tile shows only **@ozonefc.uz** + **how long ago** it was posted (no captions)
- pinned **logo box** with your `logo.png`

The wall is one file: `index.html`. It reads posts from `posts.json`, which a free
scheduled job keeps up to date. **No paid services, no post limit.**

---

## How it works (all free)

```
Instagram Graph API  ──(fetch.mjs, runs hourly)──►  posts.json  ──►  index.html on the TVs
        ▲ your own free Business account                ▲ hosted on GitHub Pages
        └ scheduled by GitHub Actions ───────────────────┘
```

| Piece | Cost |
|---|---|
| Instagram Graph API (your own account) | Free, unlimited |
| GitHub account | Free |
| GitHub Actions (the scheduler) | Free |
| GitHub Pages (hosting the URL) | Free |

---

## One-time setup

### Part A — Get an Instagram Graph API token (~15 min)

You need your Instagram to be a **Business or Creator** account, linked to a
**Facebook Page**. (Instagram app → Settings → Account type and tools.)

1. Go to **developers.facebook.com** → **My Apps** → **Create App** → type **Business**.
2. Add the **Instagram** product to the app.
3. Open the **Graph API Explorer** (Tools menu). Select your app, and add these
   permissions: `instagram_basic`, `pages_show_list`, `pages_read_engagement`,
   `business_management`.
4. Click **Generate Access Token** and approve. Copy the token.
5. Get your **Instagram user id**: in the Explorer, run
   `me/accounts` → note your Page id, then run
   `{page-id}?fields=instagram_business_account` → that returns your **IG user id**.
6. Make the token **long-lived** (60 days) — run this once (replace the parts in caps):

   ```
   https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN
   ```

   Keep the returned long-lived token. (Re-run this every ~2 months, or we can
   automate the refresh later.)

You now have two values: **IG_ACCESS_TOKEN** and **IG_USER_ID**.

### Part B — Put it on GitHub (~10 min)

1. Create a free **GitHub** account and a new **public** repo (e.g. `ozone-tv`).
2. Upload these files to it: `index.html`, `logo.png`, `fetch.mjs`,
   and the `.github/workflows/refresh.yml` folder/file.
3. In the repo: **Settings → Secrets and variables → Actions → New repository secret**.
   Add two secrets:
   - `IG_ACCESS_TOKEN` = your long-lived token
   - `IG_USER_ID` = your Instagram user id
4. **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `root` → Save.
   GitHub gives you a URL like `https://YOURNAME.github.io/ozone-tv/`.
5. **Actions** tab → run **Refresh Instagram feed** once (the ▶ "Run workflow" button).
   It creates `posts.json`. After that it runs **automatically every hour**.

### Part C — Point the TVs at it

Open the Pages URL on each TV browser and press **F11** for fullscreen. Done.
The page re-pulls the feed every 60 minutes, so new posts appear on their own.

---

## Daily vs hourly refresh
In `.github/workflows/refresh.yml`, the `cron` line controls it:
- `"0 * * * *"` = every hour (default)
- `"0 6 * * *"` = once a day at 06:00 UTC

---

## Settings (top of `index.html`, the `CONFIG` block)

| Setting             | Meaning                                   | Default        |
|---------------------|-------------------------------------------|----------------|
| `POSTS_JSON`        | primary feed file (from fetch.mjs)        | `posts.json`   |
| `BEHOLD_FEED_URL`   | fallback feed if posts.json is missing    | (your Behold)  |
| `POSTS_PER_SCREEN`  | tiles per screen                          | `10`           |
| `ROTATE_MS`         | rotation interval (ms)                    | `15000`        |
| `DAYS_WINDOW`       | only posts newer than N days              | `90`           |
| `REFRESH_MIN`       | re-pull the feed every N minutes          | `60`           |
| `SHOW_LOGO_CARD`    | show the lime logo box                    | `true`         |
| `LOGO_URL`          | your logo image (blank = wordmark)        | `logo.png`     |

---

## Notes
- **No token yet?** The wall still runs — it falls back to your Behold feed (6 posts),
  then to demo images, so a TV is never blank.
- **Graph API media URLs expire** after a day or two — that's why the fetcher runs
  on a schedule and the page re-pulls every 60 min. Both keep the URLs fresh.
- **Videos** only autoplay when muted (handled).
