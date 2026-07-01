// ============================================================
// fetch.mjs — pull recent Instagram posts into posts.json
// ------------------------------------------------------------
// Uses Meta's official Instagram Graph API. Each account uses a
// PERMANENT Page access token (never expires), so this runs
// forever with no token renewal.
//
// Environment variable:
//   IG_ACCOUNTS  — comma-separated "ig_user_id|page_token" pairs, e.g.
//                  "17841400468201311|EAA...,17841471516320001|EAA..."
//
// (Back-compat: if IG_ACCOUNTS is unset it falls back to
//  IG_USER_ID + IG_ACCESS_TOKEN with one shared token.)
//
// Optional:
//   DAYS_WINDOW  — only keep posts from the last N days (default 90)
//   MAX_POSTS    — cap the merged pool size (default 200)
// ============================================================

import { writeFileSync } from "node:fs";

const DAYS = Number(process.env.DAYS_WINDOW || 90);
const MAX  = Number(process.env.MAX_POSTS  || 200);
const VER  = "v21.0";

// build the account list: prefer IG_ACCOUNTS (id|token pairs)
let accounts = [];
if (process.env.IG_ACCOUNTS) {
  accounts = process.env.IG_ACCOUNTS.split(",").map(s => {
    const [id, token] = s.split("|").map(x => x.trim());
    return { id, token };
  }).filter(a => a.id && a.token);
} else if (process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN) {
  accounts = process.env.IG_USER_ID.split(",").map(s => s.trim()).filter(Boolean)
    .map(id => ({ id, token: process.env.IG_ACCESS_TOKEN }));
}

if (!accounts.length) {
  console.error("Set IG_ACCOUNTS (\"id|token,id|token\") or IG_USER_ID + IG_ACCESS_TOKEN.");
  process.exit(1);
}

const FIELDS = "id,media_type,media_url,thumbnail_url,permalink,timestamp";
const cutoff = Date.now() - DAYS * 86400000;

// carousels (albums) don't expose media_url directly — grab the first child
async function firstChildUrl(id, token) {
  const u = `https://graph.facebook.com/${VER}/${id}/children?fields=media_url&access_token=${token}`;
  try {
    const d = await (await fetch(u)).json();
    return d?.data?.[0]?.media_url || "";
  } catch { return ""; }
}

async function fetchAccount({ id, token }) {
  // resolve the @handle for this account
  let username = id;
  try {
    const u = await (await fetch(`https://graph.facebook.com/${VER}/${id}?fields=username&access_token=${token}`)).json();
    if (u.username) username = u.username;
  } catch { /* keep id as fallback */ }

  const out = [];
  let url = `https://graph.facebook.com/${VER}/${id}/media?fields=${FIELDS}&limit=50&access_token=${token}`;
  while (url) {
    const data = await (await fetch(url)).json();
    if (data.error) { console.error(`Graph API error for ${id}:`, data.error); break; }

    let stop = false;
    for (const m of (data.data || [])) {
      if (new Date(m.timestamp).getTime() < cutoff) { stop = true; break; }  // newest-first
      let mediaUrl = m.media_url;
      if (!mediaUrl && m.media_type === "CAROUSEL_ALBUM") mediaUrl = await firstChildUrl(m.id, token);
      if (!mediaUrl) continue;
      out.push({
        username,
        mediaType:    m.media_type === "VIDEO" ? "VIDEO" : "IMAGE",
        mediaUrl,
        thumbnailUrl: m.thumbnail_url || "",
        permalink:    m.permalink || "",
        timestamp:    m.timestamp,
      });
    }
    if (stop) break;
    url = data.paging?.next || null;
  }
  console.log(`@${username}: ${out.length} posts`);
  return out;
}

let all = [];
for (const acc of accounts) all = all.concat(await fetchAccount(acc));
all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));   // newest first across all accounts
all = all.slice(0, MAX);

writeFileSync("posts.json", JSON.stringify({ posts: all }, null, 2));
console.log(`Wrote ${all.length} posts from ${accounts.length} account(s) -> posts.json`);
