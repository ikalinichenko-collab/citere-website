// The public Sources Registry, derived strictly from the PUBLISHED Claim Report
// feed — the same coherence rule as countriesReport.js / benchmarks.js: a domain
// is public only once a claim it touched has a published report. The app's
// exporter writes the domain-centric feed to data/sources-registry.json
// (buildWebsiteExport → buildSourcesRegistry), aggregating the Sources Registry
// tables over the published claims and enriching attribution/rating from the
// live intel index. This module is a pure renderer: it reshapes that feed into
// the record shape the /sources templates read, and computes nothing about the
// findings.
//
// Kept separate from the demo sources.js so the (still-demo) Chatbots pages that
// require it (profiles.js) and the demo-metrics citations.csv stay untouched.
//
// Empty-safe: no feed → an empty registry, the /sources page shows its empty
// state and no domain pages are generated (same as published.js).
const fs = require("node:fs");
const path = require("node:path");

const FEED = path.join(__dirname, "..", "..", "data", "sources-registry.json");

function readFeed() {
  try {
    const raw = JSON.parse(fs.readFileSync(FEED, "utf8"));
    return { version: raw.version ?? null, updated: raw.updated ?? null, domains: Array.isArray(raw.domains) ? raw.domains : [] };
  } catch {
    return { version: null, updated: null, domains: [] };
  }
}
const feed = readFeed();

// The app's blacklist category → the site's network chip token. `disinfo_outlet`
// (EUvsDisinfo's neutral bucket) and anything unclassified fold onto "other".
const CATEGORY_NETWORK = {
  pravda_network: "pravda",
  state_media: "state-media",
  laundering_network: "laundering",
  disinfo_outlet: "other",
};

// App model token → the site's chatbot slug (CHATBOTS / botName keys), same map
// countriesReport.js uses. google-ai has no site profile → passes through.
const MODEL_SLUG = {
  "gpt-web": "chatgpt", "gemini-web": "gemini", "claude-web": "claude",
  "perplexity-web": "perplexity", "grok-web": "grok", "copilot-web": "copilot",
  "deepseek-web": "deepseek", "google-ai": "google-ai",
};
const pslug = (m) => MODEL_SLUG[m] || String(m || "");

// A feed date is a full ISO timestamp; the display filters expect a plain date.
const dateOnly = (v) => (typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : null);

function record(d) {
  const byBot = Object.fromEntries((d.byBot || []).map((x) => [pslug(x.model), x.citedCount]));
  const byMarket = Object.fromEntries((d.byMarket || []).map((x) => [x.market, x.citedCount]));
  const byRun = Object.fromEntries((d.byRun || []).map((x) => [x.run, x.citedCount]));
  const grid = {};
  const byPersona = {};
  for (const [model, row] of Object.entries(d.grid || {})) {
    grid[pslug(model)] = row;
    for (const [persona, n] of Object.entries(row)) byPersona[persona] = (byPersona[persona] || 0) + n;
  }
  const claimObj = (c) => ({ id: c.slug, url: `/registry/${c.slug}/`, title_en: c.label, verdict: c.verdict });
  const claims = d.claims || [];
  const byClaim = {};
  for (const c of claims) byClaim[c.slug] = c.citedCount;
  const distributed = claims.filter((c) => c.distributed);
  const reached = claims.filter((c) => c.reached);
  const reachedOnly = reached.filter((c) => !c.distributed);
  const injection = claims.filter((c) => c.injectionLine);
  return {
    domain: d.domain,
    slug: d.slug,
    defanged: d.defanged,
    url: `/sources/${d.slug}/`,
    // Present in the demo taxonomy; here they carry the app's stable category and
    // its folded network token, so the existing chips/labels keep working.
    network: CATEGORY_NETWORK[d.category] || "other",
    category: d.category,
    inWatchlist: d.inWatchlist,
    status: d.status,
    // Fields the feed does not carry (editorial in the demo): kept null so the
    // templates fall through their existing guards.
    label: null,
    note_en: null,
    language: null,
    first_seen: dateOnly(d.firstCitedAt),
    lastCitedAt: dateOnly(d.lastCitedAt),
    attribution: d.attribution || [],
    rating: d.rating || null,
    citedCount: d.citedCount || 0,
    criticalCount: d.criticalCount || 0,
    repeatCount: d.repeatCount || 0,
    injectionCount: d.injectionCount || 0,
    citedBy: Object.keys(byBot).sort(),
    byBot,
    byMarket,
    byRun,
    byPersona,
    byClaim,
    grid,
    verdicts: { repeat: d.repeatCount || 0 },
    markets: Object.keys(byMarket).sort(),
    runs: Object.keys(byRun).sort(),
    claimsDistributed: distributed.map(claimObj),
    claimsReached: reached.map(claimObj),
    claimsReachedOnly: reachedOnly.map(claimObj),
    claimsInjection: injection.map(claimObj),
    claims: reached.map(claimObj),
    cited_in: reached.map((c) => c.claimKey),
    // Not in the feed (no complaint log in the pipeline yet).
    complaints: [],
    complaintStatus: null,
    // Article evidence: clean host, dirty article (flagged_articles).
    article_evidence: (d.articles || []).map((a) => ({ url: a.url, status: a.status })),
  };
}

const registry = feed.domains
  .map(record)
  .sort((a, b) => b.injectionCount - a.injectionCount || b.citedCount - a.citedCount || a.domain.localeCompare(b.domain));

module.exports = registry;
// Domains actually cited at least once, worst-first — the set the locality table
// and any "cited sources" view iterate. Bounded rendering slices this; the full
// set stays in sources.csv.
module.exports.cited = registry.filter((s) => s.citedCount > 0);
module.exports.version = feed.version;
module.exports.updated = feed.updated;
module.exports.lastRun = feed.updated;
module.exports.byDomain = Object.fromEntries(registry.map((s) => [s.domain, s]));
