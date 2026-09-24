// The metrics store as the templates see it: the pre-computed cells from
// data/metrics.json, plus the only sanctioned way to combine them.
//
// CM §5.1 fixes which aggregations exist. Pooling across claims, across bots,
// or across both is permitted; pooling across personas or across runs is never
// permitted, and a market belongs to a run. Those rules are enforced here
// rather than trusted to each page: counts may be summed across anything, but a
// *rate* only forms inside one persona, one market and one run. Pool across any
// of those and the rate comes back null with the reason attached.
const { readJson } = require("../_lib/markdown.cjs");
const M = require("../_lib/metrics.cjs");
const { share, significant, LOW_N, spliceGroup } = M;

// The seed metrics store is marked demo:true. While the site serves the
// published Claim Report feed, templates must not read those cells — otherwise
// turning demo off would still publish fabricated rates via leftover pages and
// machine exports. Validate still checks the file on disk; this loader simply
// hides it from the render path.
const loaded = readJson("data/metrics.json") || { cells: [], dimensions: {}, totals: {} };
const store = loaded.demo === true
  ? { cells: [], incidents: [], dimensions: {}, totals: {}, runs: [], low_n: LOW_N, demo: true }
  : loaded;
const cells = store.cells || [];

const FORBIDDEN = ["persona", "market", "run"];
const DIMS = ["run", "claim", "cluster", "chatbot", "persona", "country", "language", "market", "splice_group"];
const CATEGORIES = ["repeat", "u_context", "refute", "dodge"];

const asList = (v) => (v === undefined || v === null ? null : Array.isArray(v) ? v : [v]);
const uniq = (xs) => [...new Set(xs)].sort();

// select({chatbot:"grok", persona:"P2", market:["de-de","us-en"]})
function select(where = {}) {
  const tests = Object.entries(where)
    .map(([dim, value]) => [dim, asList(value)])
    .filter(([, list]) => list && list.length);
  if (!tests.length) return cells;
  return cells.filter((c) => tests.every(([dim, list]) => list.includes(c[dim])));
}

function pool(list) {
  const counts = { repeat: 0, u_context: 0, refute: 0, dodge: 0 };
  const tiers = { critical: 0, high: 0, review: 0, low: 0, none: 0 };
  const layerB = { clean: 0, "flag-present": 0 };
  const abx = { repeat: { clean: 0, listed: 0 }, u_context: { clean: 0, listed: 0 },
                refute: { clean: 0, listed: 0 }, dodge: { clean: 0, listed: 0 } };
  const domains = {};
  let received = 0, quarantined = 0, unresolved = 0;
  let n = 0, substantive = 0, contaminated = 0, needsReview = 0;

  for (const c of list) {
    received += c.received; quarantined += c.quarantined; unresolved += c.unresolved;
    n += c.n; substantive += c.substantive; contaminated += c.contaminated;
    needsReview += c.review.needs_human_review;
    for (const k of Object.keys(counts)) counts[k] += c.counts[k];
    for (const k of Object.keys(tiers)) tiers[k] += c.tiers[k];
    for (const k of Object.keys(layerB)) layerB[k] += c.layer_b[k] || 0;
    for (const k of Object.keys(abx)) {
      abx[k].clean += (c.abx && c.abx[k] ? c.abx[k].clean : 0);
      abx[k].listed += (c.abx && c.abx[k] ? c.abx[k].listed : 0);
    }
    for (const [d, e] of Object.entries(c.domains || {})) {
      const acc = (domains[d] ||= { cited: 0, repeat: 0, u_context: 0, refute: 0, dodge: 0, critical: 0, listed: e.listed });
      for (const k of ["cited", ...CATEGORIES, "critical"]) acc[k] += e[k] || 0;
    }
  }

  const dims = Object.fromEntries(DIMS.map((d) => [d, uniq(list.map((c) => c[d]))]));
  const blocked = FORBIDDEN.filter((d) => dims[d].length > 1);
  const rate = (k, d) => (blocked.length ? null : share(k, d));

  return {
    cells: list.length,
    received, quarantined, unresolved,
    n, substantive, contaminated, counts, tiers, abx, layer_b: layerB, domains, dims, blocked,
    needs_human_review: needsReview,
    // CM §5.2-5.5: Repeat Rate over substantive answers, everything else over
    // all valid answers.
    repeat_rate: rate(counts.repeat, substantive),
    contamination_rate: rate(contaminated, n),
    dodge_rate: rate(counts.dodge, n),
    verdict_shares: blocked.length
      ? null
      : Object.fromEntries(CATEGORIES.map((k) => [k, share(counts[k], n)])),
    no_substantive: substantive === 0,
    low_n: substantive < LOW_N,
    // SR §5: counts, never rates. One response counts once per domain.
    listedDomains: Object.entries(domains)
      .filter(([, e]) => e.listed)
      .map(([domain, e]) => ({ domain, ...e }))
      .sort((a, b) => b.cited - a.cited || a.domain.localeCompare(b.domain))
  };
}

// group({persona:"P2", market:"de-de"}, "chatbot") -> one pooled row per bot.
function group(where, dim, { order = "rate" } = {}) {
  const buckets = new Map();
  for (const c of select(where)) {
    if (!buckets.has(c[dim])) buckets.set(c[dim], []);
    buckets.get(c[dim]).push(c);
  }
  const rows = [...buckets.entries()].map(([value, group]) => ({ dim, value, ...pool(group) }));
  if (order === "rate") {
    rows.sort((a, b) => {
      const x = a.repeat_rate && a.repeat_rate.rate, y = b.repeat_rate && b.repeat_rate.rate;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return y - x || String(a.value).localeCompare(String(b.value));
    });
  } else rows.sort((a, b) => String(a.value).localeCompare(String(b.value)));
  return rows;
}

// CM §5.6: a ranking may not contain a cell nobody can read.
const rankable = (rows, metric = "repeat_rate") =>
  rows.filter((r) => r[metric] && !r[metric].low_n && r[metric].rate !== null);

// CM §6.3 / §5.7: both shares, both intervals, the delta, the significance
// flag. Never a single figure "improved by X%".
function compare(a, b, metric = "repeat_rate") {
  const x = a && a[metric], y = b && b[metric];
  if (!x || !y || x.rate === null || y.rate === null) return null;
  return {
    a: x, b: y,
    delta: y.rate - x.rate,
    significant: significant(x, y),
    // Overlapping intervals mean the sample cannot tell us anything.
    direction: significant(x, y) ? (y.rate > x.rate ? "higher" : "lower") : "directional"
  };
}

// CM §5.7: the split is by splice, never by the grain_of_truth field - that
// field is non-empty even for pure fabrications.
function grainDifferential(where) {
  const gt = pool(select({ ...where, splice_group: "GT" }));
  const f = pool(select({ ...where, splice_group: "F" }));
  if (!gt.cells || !f.cells) return null;
  const c = compare(f, gt);
  return c && { grain: gt.repeat_rate, fabrication: f.repeat_rate, differential: c.delta, significant: c.significant };
}

module.exports = {
  raw: store,
  cells,
  // The flagged answers, critical first (Claim Report Spec, Layer 3).
  incidents: store.incidents || [],
  lowN: store.low_n || LOW_N,
  totals: store.totals || {},
  dimensions: store.dimensions || {},
  categories: CATEGORIES,
  select, pool, group, rankable, compare, grainDifferential, significant, spliceGroup,
  poolOf: (where) => pool(select(where))
};
