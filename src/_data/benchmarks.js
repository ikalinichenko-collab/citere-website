// Benchmark figures, derived from the metrics store rather than from a
// precomputed file. Every rate here names one persona, one market and one run,
// because that is the only shape a rate can have (CM §5.1); the reference
// market is the largest current run, and it is printed beside the figures.
//
// The Benchmarks page itself is not yet specified (CLAUDE_CODE_BRIEF §4). What
// exists here is the shell plus the two things the brief says it will absorb:
// the grain-of-truth split and the coverage matrix.
const { CHATBOTS, MONTHS, SPLICES, SPLICE_SHORT } = require("../_lib/labels.cjs");
const clusters = require("./clusters.js");
const metrics = require("./metrics.js");
const runs = require("./runs.js");

const region = new Intl.DisplayNames(["en"], { type: "region" });
const safeRegion = (v) => { try { return region.of(String(v).toUpperCase()) || v; } catch { return v; } };
const monthOf = (iso) => `${MONTHS[Number(String(iso).slice(5, 7)) - 1]} ${String(iso).slice(0, 4)}`;

const PERSONA = "P2"; // the news-style question, where contamination peaks
const personas = metrics.dimensions.personas || ["P1", "P2", "P3", "P4"];

// The reference run: the current run with the most answers. Every rate below is
// inside it, and every caption names it.
const current = Object.values(runs.current || {});
const reference = current.slice().sort((a, b) => b.valid - a.valid)[0] || null;
const where = reference ? { run: reference.key, is_live: false } : { run: "__none__" };
const label = reference ? monthOf(reference.collected_at) : "";
const marketName = reference ? safeRegion(reference.country) : "";

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

const botRows = metrics.group({ ...where, persona: PERSONA }, "chatbot");
const claimRows = metrics.group(where, "claim", { order: "key" });
const clusterRows = metrics.group({ ...where, persona: PERSONA }, "cluster");

// A change between runs, where the market has two comparable ones.
const trendMarket = (runs.withTrend || [])[0] || null;
const trendRuns = trendMarket
  ? (runs.byMarket[trendMarket] || []).slice().sort((a, b) => a.collected_at.localeCompare(b.collected_at))
  : [];
const deltaFor = (chatbot) => {
  if (trendRuns.length < 2) return null;
  const before = metrics.poolOf({ chatbot, run: trendRuns[0].key, persona: PERSONA, is_live: false });
  const after = metrics.poolOf({ chatbot, run: trendRuns[trendRuns.length - 1].key, persona: PERSONA, is_live: false });
  const c = metrics.compare(before, after);
  return c ? c.delta : null;
};

const leaderboards = {
  chatbot_repeat: board(botRows
    .filter((r) => r.repeat_rate)
    .map((r) => ({ key: r.value, label: (CHATBOTS[r.value] || {}).name || r.value,
                   value: r.repeat_rate.rate, n: r.repeat_rate.n, ci: r.repeat_rate.ci,
                   low_n: r.repeat_rate.low_n, delta: deltaFor(r.value) })), PERSONA),
  chatbot_contamination: board(botRows
    .filter((r) => r.contamination_rate)
    .map((r) => ({ key: r.value, label: (CHATBOTS[r.value] || {}).name || r.value,
                   value: r.contamination_rate.rate, n: r.contamination_rate.n }))
    .sort((a, b) => b.value - a.value), PERSONA),
  cluster_repeat: board(clusterRows
    .filter((r) => r.repeat_rate)
    .map((r) => ({ key: r.value, label: (clusters[r.value] || {}).name_en || r.value,
                   value: r.repeat_rate.rate, n: r.repeat_rate.n })), PERSONA),
  most_repeated_claims: board(claimRows
    .map((r) => ({ key: r.value, label: r.value, value: r.counts.repeat, n: r.n }))
    .sort((a, b) => b.value - a.value).slice(0, 6), null)
};

// Markets set side by side at one question type. Comparing markets is allowed;
// merging them is not, and each row is its own market's current run.
leaderboards.market_repeat = board(
  Object.values(runs.current || {})
    .map((run) => {
      const cell = metrics.poolOf({ run: run.key, persona: PERSONA, is_live: false });
      return cell.repeat_rate && { key: run.country, label: safeRegion(run.country),
        value: cell.repeat_rate.rate, n: cell.repeat_rate.n, ci: cell.repeat_rate.ci,
        low_n: cell.repeat_rate.low_n };
    })
    .filter(Boolean)
    .sort((a, b) => b.value - a.value), PERSONA);

// How the lie is attached to the truth (Entity Model Part II). This is the
// split that separates a fabrication from a distorted real event.
leaderboards.splice_repeat = board(
  metrics.group({ ...where, persona: PERSONA }, "splice")
    .filter((r) => r.value && r.repeat_rate)
    .map((r) => ({ key: r.value, label: `${r.value} — ${SPLICES[r.value]}`,
                   short: `${r.value} · ${SPLICE_SHORT[r.value]}`,
                   value: r.repeat_rate.rate, n: r.repeat_rate.n })), PERSONA);

const heatmapRows = (metrics.dimensions.chatbots || []).map((chatbot) => ({
  chatbot,
  cells: personas.map((persona) => {
    const cell = metrics.poolOf({ ...where, chatbot, persona });
    return { chatbot, persona, rate: cell.repeat_rate ? cell.repeat_rate.rate : null,
             n: cell.repeat_rate ? cell.repeat_rate.n : 0,
             low_confidence: cell.repeat_rate ? cell.repeat_rate.low_n : true,
             level: level(cell.repeat_rate && cell.repeat_rate.rate) };
  })
}));

// A x B tiers are fixed by the methodology, not by the run.
const pooled = metrics.poolOf(where);
const abxRows = [
  { key: "repeat", label: "REPEAT", cls: "r-rep", clean: "high", flagged: "critical" },
  { key: "u_context", label: "U_context", cls: "r-ctx", clean: "none", flagged: "review" },
  { key: "refute", label: "REFUTE", cls: "r-ref", clean: "none", flagged: "low" },
  { key: "dodge", label: "DODGE", cls: "r-dod", clean: "none", flagged: "none" }
].map((r) => ({ ...r, cleanN: pooled.abx[r.key].clean, flaggedN: pooled.abx[r.key].listed }));

const allGrid = metrics.poolOf({ is_live: false });
const funnel = [
  { label: "Responses collected", detail: "one row per recorded answer", n: allGrid.received },
  { label: "Valid", detail: "quarantine and unresolved removed", n: allGrid.n },
  { label: "Source-flagged", detail: "cited a listed domain", n: allGrid.contaminated },
  { label: "Critical", detail: "repeated the claim and cited a listed source", n: allGrid.tiers.critical }
];

const verdict_split = personas.map((persona) => {
  const cell = metrics.poolOf({ ...where, persona });
  return { persona, n: cell.n,
    repeated: cell.verdict_shares.repeat.rate, contextualised: cell.verdict_shares.u_context.rate,
    refuted: cell.verdict_shares.refute.rate, dodged: cell.verdict_shares.dodge.rate };
});

const contamination_by_persona = personas.map((persona) => {
  const cell = metrics.poolOf({ ...where, persona });
  return { persona, rate: cell.contamination_rate.rate, n: cell.contamination_rate.n };
});

// CM §5.7: the split runs on splice, never on the grain_of_truth field.
const grain_of_truth = personas.map((persona) => {
  const d = metrics.grainDifferential({ ...where, persona });
  const cell = metrics.poolOf({ ...where, persona });
  return d ? { persona, with_grain: d.grain.rate, pure: d.fabrication.rate,
               n: cell.n, significant: d.significant } : null;
}).filter(Boolean);

const trend = trendRuns.map((run) => {
  const cell = metrics.poolOf({ run: run.key, persona: PERSONA, is_live: false });
  return { month: monthOf(run.collected_at), median_repeat: cell.repeat_rate ? cell.repeat_rate.rate : 0 };
});

const headlineGrain = grain_of_truth.find((r) => r.persona === PERSONA) || grain_of_truth[0] || null;

// One issue per cluster x month: the unit the brief fixes for this page.
const issues = [];
for (const cluster of metrics.dimensions.clusters || []) {
  const byMonth = new Map();
  for (const run of runs.all) {
    if (!run.claims.some((id) => metrics.select({ claim: id, cluster }).length)) continue;
    const month = String(run.collected_at).slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(run);
  }
  for (const [month, list] of [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    issues.push({
      key: `${cluster}-${month}`,
      cluster,
      clusterName: (clusters[cluster] || {}).name_en || cluster,
      month,
      monthLabel: monthOf(`${month}-01`),
      url: `/benchmarks/${cluster}-${month}/`,
      runs: list,
      markets: [...new Set(list.map((r) => r.market))].sort(),
      claims: [...new Set(list.flatMap((r) => r.claims))].filter(
        (id) => metrics.select({ claim: id, cluster }).length).sort(),
      responses: list.reduce((n, r) => n + r.valid, 0)
    });
  }
}

module.exports = {
  label, marketName, reference, personas, issues,
  responses: pooled.n,
  stripCaption: `news question (${PERSONA}) · ${marketName}, ${label}`,
  headline: headlineGrain && {
    run_label: `${marketName}, ${label}`,
    persona: PERSONA,
    grain_repeated: headlineGrain.with_grain,
    pure_repeated: headlineGrain.pure,
    pure_refuted: 1 - headlineGrain.pure,
    significant: headlineGrain.significant
  },
  leaderboards, heatmapRows, abxRows, funnel,
  verdict_split, contamination_by_persona, grain_of_truth, trend,
  strip: (leaderboards.chatbot_repeat || []).slice().sort(
    (a, b) => Object.keys(CHATBOTS).indexOf(a.key) - Object.keys(CHATBOTS).indexOf(b.key)),
  raw: {
    reference: reference && reference.key, persona: PERSONA, label, market: marketName,
    leaderboards, heatmap: heatmapRows, abx: abxRows, funnel,
    verdict_split, contamination_by_persona, grain_of_truth, trend, issues: issues.map((i) => i.key)
  }
};
