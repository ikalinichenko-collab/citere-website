// The public Platform-channel feed (ch.2 Table B), derived strictly from the
// PUBLISHED Claim Report feed — same coherence rule as publishedSources.js. The
// app's exporter writes data/platforms-registry.json (buildWebsiteExport →
// buildPlatformsRegistry): blacklist channels (social_channel Layer B hits) +
// channel candidates (review queue), scoped to published claims. Pure renderer.
//
// Empty-safe: no feed → an empty list, the /sources Platforms table hides.
const fs = require("node:fs");
const path = require("node:path");

const FEED = path.join(__dirname, "..", "..", "data", "platforms-registry.json");

// App model token → the site's chatbot slug (same map as publishedSources.js).
const MODEL_SLUG = {
  "gpt-web": "chatgpt", "gemini-web": "gemini", "claude-web": "claude",
  "perplexity-web": "perplexity", "grok-web": "grok", "copilot-web": "copilot",
  "deepseek-web": "deepseek", "google-ai": "google-ai",
};
const pslug = (m) => MODEL_SLUG[m] || String(m || "");
const dateOnly = (v) => (typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : null);

function readFeed() {
  try {
    const raw = JSON.parse(fs.readFileSync(FEED, "utf8"));
    return {
      version: raw.version ?? null,
      updated: raw.updated ?? null,
      platforms: Array.isArray(raw.platforms) ? raw.platforms : [],
    };
  } catch {
    return { version: null, updated: null, platforms: [] };
  }
}

function record(p) {
  const byBot = Object.fromEntries((p.byBot || []).map((x) => [pslug(x.model), x.citedCount]));
  const byMarket = Object.fromEntries((p.byMarket || []).map((x) => [x.market, x.citedCount]));
  return {
    channel: p.channel,
    platform: p.platform,
    defanged: p.defanged || String(p.channel || "").replace(/\./g, "[.]"),
    slug: p.slug,
    listStatus: p.listStatus || "blacklist",
    category: p.category || "social_channel",
    citedCount: p.citedCount || 0,
    repeatCount: p.repeatCount || 0,
    criticalCount: p.criticalCount || 0,
    claimsReachedCount: p.claimsReachedCount || 0,
    citedBy: Object.keys(byBot).sort(),
    byBot,
    markets: Object.keys(byMarket).sort(),
    byMarket,
    lastCitedAt: dateOnly(p.lastCitedAt),
    firstCitedAt: dateOnly(p.firstCitedAt),
  };
}

const feed = readFeed();
const registry = feed.platforms
  .map(record)
  .sort((a, b) => b.criticalCount - a.criticalCount || b.citedCount - a.citedCount || a.channel.localeCompare(b.channel));

module.exports = registry;
module.exports.version = feed.version;
module.exports.updated = feed.updated;
