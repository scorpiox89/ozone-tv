// ============================================================
// fetch.mjs — pull recent Instagram posts into posts.json
// ------------------------------------------------------------
// Uses Meta's official Instagram Graph API. Free + unlimited for
// your own Business/Creator accounts. Supports ONE OR MORE
// accounts: set IG_USER_ID to a comma-separated list of IG user
// ids. Each post is tagged with its own @handle so the wall shows
// the right account on every tile.
//
// Environment variables:
//   IG_ACCESS_TOKEN  — a long-lived token that can access ALL the accounts
//   IG_USER_ID       — one id, or several comma-separated
//                      e.g. "17841400468201311,17841400000000000"
//   DAYS_WINDOW      — only keep posts from the last N days (default 90)
//   MAX_POSTS        — cap the merged pool size (default 200)
// ============================================================

import { writeFileSync } from "node:fs";

const TOKEN = process.env.IG_ACCESS_TOKEN;
const USERS = (process.env.IG_USER_ID || "").split(",").map(s => s.trim()).filter(Boolean);
const DAYS  = Number(process.env.DAYS_WINDOW || 90);
const MAX   = Number(process.env.MAX_POSTS  || 200);
const VER   = "v21.0";

if (!TOKEN || !USERS.length) {
  console.error("Missing IG_ACCESS_TOKEN or IG_USER_ID environment variables.");
  process.exit(1);
}

const FIELDS = "id,media_type,media_url,thumbnail_url,permalink,timestamp";
const cutoff = Date.now() - DAYS * 86400000;

// carousels (albums) don't expose media_url directly — grab the first child
async function firstChildUrl(id) {
  const u = `https://graph.facebook.com/${VER}/${id}/children?fields=media_url&access_token=${TOKEN}`;
  try {
    const d = await (await fetch(u)).json();
    return d?.data?.[0]?.media_url || "";
  } catch { return ""; }
}

async function fetchAccount(user) {
  // resolve the @handle for this account
  let username = user;
  try {
    const u = await (await fetch(`https://graph.facebook.com/${VER}/${user}?fields=username&access_token=${TOKEN}`)).json();
    if (u.username) username = u.username;
  } catch { /* keep id as fallback */ }

  const out = [];
  let url = `https://graph.facebook.com/${VER}/${user}/media?fields=${FIELDS}&limit=50&access_token=${TOKEN}`;
  while (url) {
    const data = await (await fetch(url)).json();
    if (data.error) { console.error(`Graph API error for ${user}:`, data.error); break; }

    let stop = false;
    for (const m of (data.data || [])) {
      if (new Date(m.timestamp).getTime() < cutoff) { stop = true; break; }  // newest-first
      let mediaUrl = m.media_url;
      if (!mediaUrl && m.media_type === "CAROUSEL_ALBUM") mediaUrl = await firstChildUrl(m.id);
      if (!mediaUrl) continue;
      out.push({
        username,                                       // per-post handle
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
for (const user of USERS) all = all.concat(await fetchAccount(user));
all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));   // newest first across all accounts
all = all.slice(0, MAX);

writeFileSync("posts.json", JSON.stringify({ posts: all }, null, 2));
console.log(`Wrote ${all.length} posts from ${USERS.length} account(s) -> posts.json`);
