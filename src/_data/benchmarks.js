// Benchmark figures. Two sources, one active at a time:
//
//   1. data/benchmarks.json — the app's variant-2 feed: one distilled record per
//      run that backs a published report, straight from that run's frozen metrics
//      snapshot (Wilson, splice grain-split, A×B tiers already computed by the
//      pipeline). This is the real source; it carries run history, so Trend and
//      the per-issue run comparison work. Preferred when present.
//   2. Fallback — derived from the published Claim Report feed (per-report cells).
//      Covers the settled figure sets (issues coverage, A×B, funnel, grain,
//      leaderboards) but has no run history, so Trend is empty and issues link to
//      the Registry cluster facet instead of a detail page. Used until the app
//      publishes benchmarks.json.
//
// Either way the export shape is identical, so the Benchmarks page and the
// homepage read one contract. Every rate is pooled inside one persona, one market
// and one run (CM §5.1); counts are summed across reports/runs (CM §5.8).
const fs = require("node:fs");
const path = require("node:path");
const published = require("./published.js");
const profiles = require("./profiles.js");
const { MONTHS, SPLICES, SPLICE_SHORT } = require("../_lib/labels.cjs");
const { slugify } = require("../_lib/markdown.cjs");

const MODEL_LABEL = {
  "gpt-web": "ChatGPT", "gemini-web": "Gemini", "claude-web": "Claude",
  "perplexity-web": "Perplexity", "google-ai": "Google AI Overviews", "grok-web": "Grok",
  "copilot-web": "Copilot", "deepseek-web": "DeepSeek"
};
const MODEL_ORDER = Object.keys(MODEL_LABEL);
const modelLabel = (m) => MODEL_LABEL[m] || String(m || "");
const PLATFORM_SLUG = {
  "gpt-web": "chatgpt", "gemini-web": "gemini", "claude-web": "claude",
  "perplexity-web": "perplexity", "grok-web": "grok", "copilot-web": "copilot",
  "deepseek-web": "deepseek", "google-ai": "google-ai"
};
const pslug = (m) => PLATFORM_SLUG[m] || String(m || "");
const PLATFORMS = new Set((profiles.chatbots || []).map((p) => String(p.key)));
const region = new Intl.DisplayNames(["en"], { type: "region" });
const safeRegion = (v) => { try { return region.of(String(v).toUpperCase()) || v; } catch { return v; } };
const monthOf = (iso) => `${MONTHS[Number(String(iso).slice(5, 7)) - 1]} ${String(iso).slice(0, 4)}`;
const pcodeOf = (p) => String(p || "").split("_")[0];
const PERSONA = "P2";
const PERSONAS = ["P1", "P2", "P3", "P4"];
const GRAIN = new Set(["A", "B", "C"]);

function wilson(k, n) {
  if (!n) return null;
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z / d) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [c - h, c + h];
}
const rateCell = (k, n) => (n ? { rate: k / n, n, ci: wilson(k, n), low_n: n < 20 } : null);
const sum = (list, field) => list.reduce((n, c) => n + (Number(c[field]) || 0), 0);
const level = (rate) => {
  if (!rate) return "lv0";
  if (rate < 0.085) return "lv1";
  if (rate < 0.12) return "lv2";
  if (rate < 0.18) return "lv3";
  return "lv4";
};
const board = (rows, persona) => {
  const max = rows.reduce((m, r) => Math.max(m, Math.abs(r.value || 0)), 0);
  return rows.map((row) => ({
    ...row, persona,
    width: max && row.value !== undefined ? Math.max(2, Math.round((Math.abs(row.value) / max) * 100)) : 0
  }));
};
// A snapshot Proportion ({k,n,pct,ciLoPct,ciHiPct,lowN}; pct is 0–100) → the
// site's rate cell (rate 0–1, ci 0–1). null when the cell has no data.
const P = (prop) => (prop && prop.pct != null)
  ? { rate: prop.pct / 100, n: prop.n, ci: [(prop.ciLoPct ?? 0) / 100, (prop.ciHiPct ?? 0) / 100], low_n: !!prop.lowN, k: prop.k }
  : null;
// Collapse the app's Layer-A categories (grid or legacy) into the four display
// rows of the A×B matrix, summing clean/flagged counts.
function axbRowsFrom(matrix) {
  const REP = new Set(["ENDORSEMENT", "HEDGED_REPEAT", "REPEAT"]);
  const UC = new Set(["U_CONTEXT", "U_context"]);
  const REF = new Set(["DEBUNK", "REFUTE"]);
  const DOD = new Set(["NON_RESPONSE", "DODGE"]);
  const cnt = (set) => {
    let clean = 0, flagged = 0;
    for (const c of matrix || []) if (set.has(c.layerA)) { if (c.tainted) flagged += c.count || 0; else clean += c.count || 0; }
    return { clean, flagged };
  };
  const row = (key, label, cls, clean, flagged, set) => { const x = cnt(set); return { key, label, cls, clean, flagged, cleanN: x.clean, flaggedN: x.flagged }; };
  return [
    row("repeat", "REPEAT", "r-rep", "high", "critical", REP),
    row("u_context", "U_context", "r-ctx", "none", "review", UC),
    row("refute", "REFUTE", "r-ref", "none", "low", REF),
    row("dodge", "DODGE", "r-dod", "none", "none", DOD)
  ];
}
// Escalation-tier counts from an A×B matrix, for the per-issue coverage table.
function tiersFrom(matrix) {
  const t = { critical: 0, high: 0, review: 0, low: 0, none: 0 };
  for (const c of matrix || []) { const k = String(c.tier || "none").toLowerCase(); if (k in t) t[k] += c.count || 0; else t.none += c.count || 0; }
  return t;
}
// The grain-of-truth split at the news question (P2) for one run.
function grainP2From(grain) {
  const g = ((grain || {}).byPersona || []).find((x) => pcodeOf(x.persona) === PERSONA);
  if (!g) return null;
  const gr = P(g.grain), fr = P(g.fabrication);
  const significant = !!(gr && fr && gr.ci && fr.ci && (gr.ci[0] > fr.ci[1] || fr.ci[0] > gr.ci[1]));
  return { grain: gr, fabrication: fr, significant };
}

// ── Source 1: the app's run feed (variant 2) ────────────────────────────────
function readRunFeed() {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "data", "benchmarks.json"), "utf8"));
    return Array.isArray(raw.runs) && raw.runs.length ? raw.runs : null;
  } catch { return null; }
}

function buildFromRuns(runs) {
  const p2sub = (run) => (run.botPersona || []).filter((b) => pcodeOf(b.persona) === PERSONA).reduce((n, b) => n + ((b.repeat && b.repeat.n) || 0), 0);
  const ref = runs.slice().sort((a, b) => (p2sub(b) - p2sub(a)) || (((b.ingest || {}).valid || 0) - ((a.ingest || {}).valid || 0)))[0] || null;
  const marketName = ref ? safeRegion(ref.market) : "";
  const label = ref ? monthOf(ref.collectedAt) : "";
  const refBP = (ref && ref.botPersona) || [];

  const leaderboards = {
    chatbot_repeat: board(refBP.filter((b) => pcodeOf(b.persona) === PERSONA)
      .map((b) => { const rc = P(b.repeat); return rc && { key: pslug(b.model), label: modelLabel(b.model), value: rc.rate, n: rc.n, ci: rc.ci, low_n: rc.low_n }; })
      .filter(Boolean).sort((a, b) => b.value - a.value), PERSONA),
    chatbot_contamination: board(refBP.filter((b) => pcodeOf(b.persona) === PERSONA)
      .map((b) => { const rc = P(b.contamination); return rc && { key: pslug(b.model), label: modelLabel(b.model), value: rc.rate, n: rc.n }; })
      .filter(Boolean).sort((a, b) => b.value - a.value), PERSONA)
  };
  // Latest run per market / per cluster (runs sorted oldest→newest, last wins).
  const chron = runs.slice().sort((a, b) => String(a.collectedAt).localeCompare(String(b.collectedAt)));
  const latestByMarket = new Map(); for (const r of chron) latestByMarket.set(r.market, r);
  const latestByCluster = new Map(); for (const r of chron) latestByCluster.set(r.clusterSlug, r);
  const p2repeat = (run) => { const ps = (run.persona || []).find((p) => pcodeOf(p.persona) === PERSONA); return ps && P(ps.repeat); };
  leaderboards.market_repeat = board([...latestByMarket.values()]
    .map((run) => { const rc = p2repeat(run); return rc && { key: run.market, label: safeRegion(run.market), value: rc.rate, n: rc.n, ci: rc.ci, low_n: rc.low_n }; })
    .filter(Boolean).sort((a, b) => b.value - a.value), PERSONA);
  leaderboards.cluster_repeat = board([...latestByCluster.values()]
    .map((run) => { const rc = p2repeat(run); return rc && { key: run.clusterSlug, label: run.cluster, value: rc.rate, n: rc.n }; })
    .filter(Boolean).sort((a, b) => b.value - a.value), PERSONA);

  const bots = [...new Set(refBP.map((b) => b.model))].sort((a, b) => MODEL_ORDER.indexOf(a) - MODEL_ORDER.indexOf(b));
  const heatmapRows = bots.map((bot) => ({
    chatbot: pslug(bot),
    cells: PERSONAS.map((pc) => {
      const b = refBP.find((x) => x.model === bot && pcodeOf(x.persona) === pc);
      const rc = b && P(b.repeat);
      return { chatbot: pslug(bot), persona: pc, rate: rc ? rc.rate : null, n: rc ? rc.n : 0, low_confidence: rc ? rc.low_n : true, level: level(rc && rc.rate) };
    })
  }));

  const abxRows = axbRowsFrom((ref && ref.axbMatrix) || []);
  const sumI = (f) => runs.reduce((n, r) => n + (((r.ingest || {})[f]) || 0), 0);
  const sumFn = (f) => runs.reduce((n, r) => n + (((r.funnel || {})[f]) || 0), 0);
  const funnel = [
    { label: "Responses collected", detail: "one row per recorded answer", n: sumI("collected") || sumFn("collected") },
    { label: "Valid", detail: "quarantine and unresolved removed", n: sumI("valid") || sumFn("judged") },
    { label: "Source-flagged", detail: "cited a listed domain", n: sumFn("contaminated") },
    { label: "Critical", detail: "repeated the claim and cited a listed source", n: sumFn("critical") }
  ];

  const grain_of_truth = (((ref && ref.grain) || {}).byPersona || []).map((g) => {
    const gr = P(g.grain), fr = P(g.fabrication);
    if (!gr && !fr) return null;
    const significant = !!(gr && fr && gr.ci && fr.ci && (gr.ci[0] > fr.ci[1] || fr.ci[0] > gr.ci[1]));
    return { persona: pcodeOf(g.persona), with_grain: gr ? gr.rate : 0, pure: fr ? fr.rate : 0, n: (gr ? gr.n : 0) + (fr ? fr.n : 0), significant };
  }).filter(Boolean);
  const headlineGrain = grain_of_truth.find((r) => r.persona === PERSONA) || grain_of_truth[0] || null;

  // Trend: per market, each run's P2 repeat rate over time.
  const byMarketRuns = new Map();
  for (const r of chron) { const a = byMarketRuns.get(r.market) || []; a.push(r); byMarketRuns.set(r.market, a); }
  const trend = [...byMarketRuns.entries()].flatMap(([mkt, list]) => list.length >= 2
    ? list.map((run) => { const rc = p2repeat(run); return { market: safeRegion(mkt), month: monthOf(run.collectedAt), median_repeat: rc ? rc.rate : 0 }; })
    : []);

  // Issues: cluster × collection-month, runs grouped, with a real detail page.
  const byCM = new Map();
  for (const run of runs) {
    const month = String(run.collectedAt).slice(0, 7);
    const key = `${run.clusterSlug}|${month}`;
    const g = byCM.get(key) || { cluster: run.cluster, clusterSlug: run.clusterSlug, month, runs: [] };
    g.runs.push(run); byCM.set(key, g);
  }
  const issues = [...byCM.values()].map((g) => ({
    key: `${g.clusterSlug}-${g.month}`, cluster: g.cluster, clusterName: g.cluster, clusterSlug: g.clusterSlug,
    month: g.month, monthLabel: monthOf(`${g.month}-01`), url: `/benchmarks/${g.clusterSlug}-${g.month}/`, hasDetail: true,
    runs: g.runs.map((r) => ({ ...r, tiers: tiersFrom(r.axbMatrix), grainP2: grainP2From(r.grain) })),
    markets: [...new Set(g.runs.map((r) => r.market).filter(Boolean))].sort(),
    claimsCount: g.runs.reduce((n, r) => n + (r.claimsCount || 0), 0),
    responses: g.runs.reduce((n, r) => n + (((r.ingest || {}).valid) || 0), 0)
  })).sort((a, b) => b.month.localeCompare(a.month));

  const strip = (leaderboards.chatbot_repeat || []).filter((r) => PLATFORMS.has(r.key));
  return {
    label, marketName, reference: ref && ref.key, personas: PERSONAS, issues, responses: sumI("valid"),
    stripCaption: `news question (${PERSONA}) · ${marketName}, ${label}`,
    headline: headlineGrain && { run_label: `${marketName}, ${label}`, persona: PERSONA, grain_repeated: headlineGrain.with_grain, pure_repeated: headlineGrain.pure, pure_refuted: 1 - headlineGrain.pure, significant: headlineGrain.significant },
    leaderboards, heatmapRows, abxRows, funnel, verdict_split: [], contamination_by_persona: [], grain_of_truth, trend, strip,
    raw: { source: "runs", reference: ref && ref.key, persona: PERSONA, label, market: marketName }
  };
}

// ── Source 2: fallback derivation from the published Claim Report feed ───────
function buildFromClaimReports() {
  const reports = Object.values(published.reports || {});
  const cells = [];
  for (const rep of reports) {
    const p = rep.payload || {};
    const meta = p.meta || {};
    const runKey = (meta.runKeys && meta.runKeys[0]) || rep.slug;
    const month = String(rep.publishedAt || "").slice(0, 10);
    for (const c of (p.resultsByBot && p.resultsByBot.cells) || []) {
      cells.push({
        claimKey: rep.claimKey, cluster: rep.clusterName || "", splice: rep.splice || null,
        runKey, month, market: c.market || "", bot: c.model, pcode: pcodeOf(c.persona),
        repeat: c.repeat || 0, substantive: c.substantive || 0, contaminated: c.contaminated || 0, valid: c.valid || 0
      });
    }
  }
  const poolBy = (list, field) => {
    const m = new Map();
    for (const c of list) { const key = c[field]; const g = m.get(key) || { key, repeat: 0, substantive: 0, contaminated: 0, valid: 0 }; g.repeat += c.repeat; g.substantive += c.substantive; g.contaminated += c.contaminated; g.valid += c.valid; m.set(key, g); }
    return [...m.values()];
  };
  const groups = new Map();
  for (const c of cells) { const key = `${c.market}|${c.runKey}`; const g = groups.get(key) || { market: c.market, runKey: c.runKey, n: 0, nP2: 0 }; g.n += c.substantive; if (c.pcode === PERSONA) g.nP2 += c.substantive; groups.set(key, g); }
  const ref = [...groups.values()].sort((a, b) => (b.nP2 - a.nP2) || (b.n - a.n))[0] || null;
  const refCells = ref ? cells.filter((c) => c.market === ref.market && c.runKey === ref.runKey) : [];
  const refP2 = refCells.filter((c) => c.pcode === PERSONA);
  const refMonth = refCells.length ? refCells.map((c) => c.month).sort().pop() : "";
  const label = refMonth ? monthOf(refMonth) : "";
  const marketName = ref ? safeRegion(ref.market) : "";

  const leaderboards = {
    chatbot_repeat: board(poolBy(refP2, "bot").map((g) => { const rc = rateCell(g.repeat, g.substantive); return rc && { key: pslug(g.key), label: modelLabel(g.key), value: rc.rate, n: rc.n, ci: rc.ci, low_n: rc.low_n }; }).filter(Boolean).sort((a, b) => b.value - a.value), PERSONA),
    chatbot_contamination: board(poolBy(refP2, "bot").map((g) => { const rc = rateCell(g.contaminated, g.valid); return rc && { key: pslug(g.key), label: modelLabel(g.key), value: rc.rate, n: rc.n }; }).filter(Boolean).sort((a, b) => b.value - a.value), PERSONA),
    cluster_repeat: board(poolBy(refP2, "cluster").map((g) => { const rc = rateCell(g.repeat, g.substantive); return rc && { key: slugify(String(g.key)), label: g.key, value: rc.rate, n: rc.n }; }).filter(Boolean).sort((a, b) => b.value - a.value), PERSONA)
  };
  const markets = [...new Set(cells.map((c) => c.market).filter(Boolean))];
  leaderboards.market_repeat = board(markets.map((mkt) => {
    const byRun = new Map();
    for (const c of cells.filter((x) => x.market === mkt && x.pcode === PERSONA)) { const g = byRun.get(c.runKey) || { repeat: 0, substantive: 0 }; g.repeat += c.repeat; g.substantive += c.substantive; byRun.set(c.runKey, g); }
    const best = [...byRun.values()].sort((a, b) => b.substantive - a.substantive)[0];
    if (!best) return null;
    const rc = rateCell(best.repeat, best.substantive);
    return rc && { key: mkt, label: safeRegion(mkt), value: rc.rate, n: rc.n, ci: rc.ci, low_n: rc.low_n };
  }).filter(Boolean).sort((a, b) => b.value - a.value), PERSONA);

  const bots = [...new Set(refCells.map((c) => c.bot))].sort((a, b) => MODEL_ORDER.indexOf(a) - MODEL_ORDER.indexOf(b));
  const heatmapRows = bots.map((bot) => ({
    chatbot: pslug(bot),
    cells: PERSONAS.map((pc) => { const l = refCells.filter((c) => c.bot === bot && c.pcode === pc); const rc = rateCell(sum(l, "repeat"), sum(l, "substantive")); return { chatbot: pslug(bot), persona: pc, rate: rc ? rc.rate : null, n: rc ? rc.n : 0, low_confidence: rc ? rc.low_n : true, level: level(rc && rc.rate) }; })
  }));

  const axb = { repeatClean: 0, repeatListed: 0, uContextClean: 0, uContextListed: 0, refuteClean: 0, refuteListed: 0, dodgeClean: 0, dodgeListed: 0, validTotal: 0, unresolved: 0, quarantined: 0 };
  for (const rep of reports) { const a = (rep.payload && rep.payload.axb) || {}; for (const k of Object.keys(axb)) axb[k] += Number(a[k] || 0); }
  const abxRows = [
    { key: "repeat", label: "REPEAT", cls: "r-rep", clean: "high", flagged: "critical", cleanN: axb.repeatClean, flaggedN: axb.repeatListed },
    { key: "u_context", label: "U_context", cls: "r-ctx", clean: "none", flagged: "review", cleanN: axb.uContextClean, flaggedN: axb.uContextListed },
    { key: "refute", label: "REFUTE", cls: "r-ref", clean: "none", flagged: "low", cleanN: axb.refuteClean, flaggedN: axb.refuteListed },
    { key: "dodge", label: "DODGE", cls: "r-dod", clean: "none", flagged: "none", cleanN: axb.dodgeClean, flaggedN: axb.dodgeListed }
  ];
  const totValid = axb.validTotal;
  const funnel = [
    { label: "Responses collected", detail: "one row per recorded answer", n: totValid + axb.quarantined + axb.unresolved },
    { label: "Valid", detail: "quarantine and unresolved removed", n: totValid },
    { label: "Source-flagged", detail: "cited a listed domain", n: sum(cells, "contaminated") },
    { label: "Critical", detail: "repeated the claim and cited a listed source", n: axb.repeatListed }
  ];
  const grain_of_truth = PERSONAS.map((persona) => {
    const l = refCells.filter((c) => c.pcode === persona && c.splice);
    const g = { repeat: 0, substantive: 0 }, f = { repeat: 0, substantive: 0 };
    for (const c of l) { const t = GRAIN.has(c.splice) ? g : f; t.repeat += c.repeat; t.substantive += c.substantive; }
    const gr = rateCell(g.repeat, g.substantive), fr = rateCell(f.repeat, f.substantive);
    if (!gr && !fr) return null;
    const significant = !!(gr && fr && gr.ci && fr.ci && (gr.ci[0] > fr.ci[1] || fr.ci[0] > gr.ci[1]));
    return { persona, with_grain: gr ? gr.rate : 0, pure: fr ? fr.rate : 0, n: g.substantive + f.substantive, significant };
  }).filter(Boolean);
  const headlineGrain = grain_of_truth.find((r) => r.persona === PERSONA) || grain_of_truth[0] || null;

  const byCM = new Map();
  for (const rep of reports) {
    const month = String(rep.publishedAt || "").slice(0, 7);
    const cluster = rep.clusterName || "";
    const cslug = slugify(String(cluster));
    const key = `${cslug}|${month}`;
    const g = byCM.get(key) || { cluster, clusterSlug: cslug, month, reports: [] };
    g.reports.push(rep); byCM.set(key, g);
  }
  const issues = [...byCM.values()].map((g) => ({
    key: `${g.clusterSlug}-${g.month}`, cluster: g.cluster, clusterName: g.cluster, clusterSlug: g.clusterSlug,
    month: g.month, monthLabel: monthOf(`${g.month}-01`), url: `/registry/cluster/${g.clusterSlug}/`, hasDetail: false,
    reports: g.reports, markets: [...new Set(g.reports.flatMap((r) => ((r.payload && r.payload.meta && r.payload.meta.countries) || [])))].sort(),
    claims: [...new Set(g.reports.map((r) => r.claimKey))].sort(),
    claimsCount: new Set(g.reports.map((r) => r.claimKey)).size,
    responses: g.reports.reduce((n, r) => n + ((r.strip && r.strip.answers) || 0), 0)
  })).sort((a, b) => b.month.localeCompare(a.month));

  const strip = (leaderboards.chatbot_repeat || []).filter((r) => PLATFORMS.has(r.key));
  return {
    label, marketName, reference: ref && ref.market, personas: PERSONAS, issues, responses: totValid,
    stripCaption: `news question (${PERSONA}) · ${marketName}, ${label}`,
    headline: headlineGrain && { run_label: `${marketName}, ${label}`, persona: PERSONA, grain_repeated: headlineGrain.with_grain, pure_repeated: headlineGrain.pure, pure_refuted: 1 - headlineGrain.pure, significant: headlineGrain.significant },
    leaderboards, heatmapRows, abxRows, funnel, verdict_split: [], contamination_by_persona: [], grain_of_truth, trend: [], strip,
    raw: { source: "claim-reports", reference: ref && `${ref.market}|${ref.runKey}`, persona: PERSONA, label, market: marketName }
  };
}

const runFeed = readRunFeed();
module.exports = runFeed ? buildFromRuns(runFeed) : buildFromClaimReports();
