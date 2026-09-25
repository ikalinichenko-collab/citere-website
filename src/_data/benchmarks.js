// Benchmark figures, derived strictly from the PUBLISHED Claim Report feed — the
// same set the Registry shows. Every number is a sum over the published claims'
// frozen per-cell figures, so the site stays coherent: a benchmark or country
// rate can only include a claim that has a published report. (We deliberately do
// NOT read whole-run metrics snapshots — those would pull in unpublished claims.)
//
// A rate is therefore "the share among the published claims of this market/run",
// not a complete-grid benchmark; the page labels it with the published-claim
// count. Rates form inside one persona, one market, one run (CM §5.1); counts
// sum across claims and bots (CM §5.8). Trend comes from each report's own
// per-run points (claims with ≥2 comparable runs); everything else from cells.
const published = require("./published.js");
const { MONTHS, SPLICES, SPLICE_SHORT, CHATBOTS } = require("../_lib/labels.cjs");
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
const PLATFORMS = new Set([...Object.keys(CHATBOTS), "google-ai"]);
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
const poolBy = (list, field) => {
  const m = new Map();
  for (const c of list) {
    const key = c[field];
    const g = m.get(key) || { key, repeat: 0, substantive: 0, contaminated: 0, valid: 0 };
    g.repeat += c.repeat; g.substantive += c.substantive; g.contaminated += c.contaminated; g.valid += c.valid;
    m.set(key, g);
  }
  return [...m.values()];
};

// ── Flatten every published report's frozen cells into one grid ─────────────
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
const publishedClaims = published.index.length;

// Reference run: the (market, run) with the most news-question answers. Every
// rate is pooled inside it (CM §5.1); the caption names it + the claim count.
const groups = new Map();
for (const c of cells) {
  const key = `${c.market}|${c.runKey}`;
  const g = groups.get(key) || { market: c.market, runKey: c.runKey, n: 0, nP2: 0 };
  g.n += c.substantive; if (c.pcode === PERSONA) g.nP2 += c.substantive;
  groups.set(key, g);
}
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

// Repeat rate by splice — the kind of lie that gets through (CM 5.7). One row per
// splice type present in the reference run, worst first. `short` is the reader
// label "A · one fact swapped out"; a composite splice keeps its raw key.
leaderboards.splice_repeat = board(poolBy(refP2, "splice").filter((g) => g.key).map((g) => {
  const rc = rateCell(g.repeat, g.substantive);
  const key = String(g.key);
  const short = SPLICE_SHORT[key] ? `${key} · ${SPLICE_SHORT[key]}` : (SPLICES[key] || key);
  return rc && { key: slugify(key), label: short, short, value: rc.rate, n: rc.n, ci: rc.ci, low_n: rc.low_n };
}).filter(Boolean).sort((a, b) => b.value - a.value), PERSONA);

const bots = [...new Set(refCells.map((c) => c.bot))].sort((a, b) => MODEL_ORDER.indexOf(a) - MODEL_ORDER.indexOf(b));
const heatmapRows = bots.map((bot) => ({
  chatbot: pslug(bot),
  cells: PERSONAS.map((pc) => { const l = refCells.filter((c) => c.bot === bot && c.pcode === pc); const rc = rateCell(sum(l, "repeat"), sum(l, "substantive")); return { chatbot: pslug(bot), persona: pc, rate: rc ? rc.rate : null, n: rc ? rc.n : 0, low_confidence: rc ? rc.low_n : true, level: level(rc && rc.rate) }; })
}));

// A×B + funnel: counts, summed across every published report.
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

// Trend: each published report carries its own per-run points (claims run ≥2×);
// pool them by market over time. Only published claims contribute.
const trendByMarket = new Map();
for (const rep of reports) {
  for (const pt of (rep.payload && rep.payload.trend && rep.payload.trend.points) || []) {
    const mkt = pt.market || "";
    const runs = trendByMarket.get(mkt) || new Map();
    const rk = pt.runKey || pt.date || "";
    const acc = runs.get(rk) || { runKey: rk, date: pt.date, repeat: 0, substantive: 0 };
    acc.repeat += pt.repeat || 0; acc.substantive += pt.substantive || 0;
    runs.set(rk, acc); trendByMarket.set(mkt, runs);
  }
}
const trend = [];
for (const [mkt, runs] of trendByMarket) {
  const series = [...runs.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (series.length < 2) continue;
  for (const s of series) trend.push({ market: safeRegion(mkt), month: monthOf(s.date), median_repeat: s.substantive ? s.repeat / s.substantive : 0 });
}

// Issues: cluster × publish-month over published reports; link to the Registry
// cluster facet (no separate detail page — the claim reports are the unit).
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

// Homepage strip: each assistant at its WORST single market on the news-style
// persona — the same headline the platform/benchmark pages use — not the shared
// reference run. Tying it to one run made the strip hostage to whichever market
// happened to have the most P2 answers (often a 2-sample market), so it read
// all-zero and dropped bots with no cell there. Every rate still forms inside one
// market (CM §5.1); the caption says "worst market".
const stripBots = [...new Set(cells.map((c) => c.bot))].filter((b) => PLATFORMS.has(pslug(b)));
const strip = stripBots
  .map((bot) => {
    let best = null;
    for (const mkt of [...new Set(cells.filter((c) => c.bot === bot).map((c) => c.market))]) {
      const l = cells.filter((c) => c.bot === bot && c.market === mkt && c.pcode === PERSONA);
      const rc = rateCell(sum(l, "repeat"), sum(l, "substantive"));
      if (rc && rc.rate !== null && (!best || rc.rate > best.value || (rc.rate === best.value && rc.n > best.n))) {
        best = { key: pslug(bot), label: modelLabel(bot), value: rc.rate, n: rc.n, ci: rc.ci, low_n: rc.low_n, persona: PERSONA, market: mkt };
      }
    }
    return best;
  })
  .filter(Boolean)
  .sort((a, b) => b.value - a.value || b.n - a.n);
module.exports = {
  label, marketName, reference: ref && ref.market, personas: PERSONAS, issues, responses: totValid,
  publishedClaims,
  claimScopeNote: `across ${publishedClaims} published ${publishedClaims === 1 ? "claim" : "claims"}${marketName ? ` · ${marketName}, ${label}` : ""}`,
  stripCaption: `each at its worst market · news question (${PERSONA})`,
  headline: headlineGrain && { run_label: `${marketName}, ${label}`, persona: PERSONA, grain_repeated: headlineGrain.with_grain, pure_repeated: headlineGrain.pure, pure_refuted: 1 - headlineGrain.pure, significant: headlineGrain.significant },
  leaderboards, heatmapRows, abxRows, funnel, verdict_split: [], contamination_by_persona: [], grain_of_truth, trend, strip,
  raw: { source: "claim-reports", publishedClaims, reference: ref && `${ref.market}|${ref.runKey}`, persona: PERSONA, label, market: marketName }
};
