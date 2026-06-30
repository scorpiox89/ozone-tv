// ============================================================
// fetch.mjs — pull recent Instagram posts into posts.json
// ------------------------------------------------------------
// Uses Meta's official Instagram Graph API. Free + unlimited for
// your own Business/Creator account. Run on a schedule (see the
// GitHub Actions workflow) so posts.json always has fresh posts
// and fresh media URLs.
//
// Required environment variables:
//   IG_ACCESS_TOKEN  — a long-lived access token
//   IG_USER_ID       — your Instagram Business account user id
// Optional:
//   DAYS_WINDOW      — only keep posts from the last N days (default 90)
//   MAX_POSTS        — cap the pool size (default 120)
// ============================================================

import { writeFileSync } from "node:fs";

const TOKEN = process.env.IG_ACCESS_TOKEN;
const USER  = process.env.IG_USER_ID;
const DAYS  = Number(process.env.DAYS_WINDOW || 90);
const MAX   = Number(process.env.MAX_POSTS  || 120);
const VER   = "v21.0";

if (!TOKEN || !USER) {
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

const out = [];
let url = `https://graph.facebook.com/${VER}/${USER}/media?fields=${FIELDS}&limit=50&access_token=${TOKEN}`;

while (url && out.length < MAX) {
  const data = await (await fetch(url)).json();
  if (data.error) { console.error("Graph API error:", data.error); process.exit(1); }

  for (const m of (data.data || [])) {
    // media is returned newest-first, so once we pass the window we can stop
    if (new Date(m.timestamp).getTime() < cutoff) { url = null; break; }

    let mediaUrl = m.media_url;
    if (!mediaUrl && m.media_type === "CAROUSEL_ALBUM") mediaUrl = await firstChildUrl(m.id);
    if (!mediaUrl) continue;

    out.push({
      mediaType:    m.media_type === "VIDEO" ? "VIDEO" : "IMAGE",
      mediaUrl,
      thumbnailUrl: m.thumbnail_url || "",
      permalink:    m.permalink || "",
      timestamp:    m.timestamp,
    });
    if (out.length >= MAX) break;
  }
  if (url) url = data.paging?.next || null;
}

writeFileSync("posts.json", JSON.stringify({ username: "ozonefc.uz", posts: out }, null, 2));
console.log(`Wrote ${out.length} posts -> posts.json`);
