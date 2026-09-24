// Runs for templates and machine exports.
//
// Prefer run keys frozen inside published Claim Reports. The seed metrics store
// (demo:true) is hidden from the render path, so its runs table must not appear
// in /runs.json once the site is off demo mode.
const published = require("./published.js");
const metrics = require("./metrics.js");

function fromPublished() {
  const byKey = new Map();
  for (const rep of Object.values(published.reports || {})) {
    const meta = (rep.payload && rep.payload.meta) || {};
    const collected = meta.builtAt || rep.publishedAt || "";
    const countries = meta.countries || [];
    for (const key of meta.runKeys || []) {
      if (!key || byKey.has(key)) continue;
      byKey.set(key, {
        key,
        run_id: key,
        cluster: rep.clusterName || "",
        country: "",
        language: "",
        // Multi-market runs have no single market key; list countries separately.
        market: "",
        markets: countries,
        collected_at: collected,
        collected_until: collected,
        claims_count: 1,
        models: meta.bots || [],
        personas: ["P1", "P2", "P3", "P4"],
        prompts: null,
        variations: null,
        repeats: null,
        live_prompts: null,
        received: null,
        valid: null,
        quarantined: null,
        unresolved: null,
        reconciliation: { expected: null, missing: null },
        versions: meta.versions || {},
        judge_validation: { status: meta.judgeValidation || "" },
        comparable_with: [],
        per_run: meta.perRun || "",
        claim_keys: [rep.claimKey]
      });
    }
  }
  // A run may back several published claims — fold claim_keys and bump count.
  for (const rep of Object.values(published.reports || {})) {
    const meta = (rep.payload && rep.payload.meta) || {};
    for (const key of meta.runKeys || []) {
      const row = byKey.get(key);
      if (!row) continue;
      if (!row.claim_keys.includes(rep.claimKey)) {
        row.claim_keys.push(rep.claimKey);
        row.claims_count = row.claim_keys.length;
      }
    }
  }
  return [...byKey.values()].sort((a, b) =>
    String(b.collected_at).localeCompare(String(a.collected_at)) || String(a.key).localeCompare(String(b.key))
  );
}

const seedRuns = (metrics.raw && metrics.raw.demo === true) ? [] : (metrics.raw.runs || []);
const runs = seedRuns.length ? seedRuns.slice() : fromPublished();

const index = (key) => {
  const map = {};
  for (const r of runs) {
    const v = r[key];
    if (v == null || v === "") continue;
    (map[v] ||= []).push(r);
  }
  return map;
};

const byMarket = index("market");
const current = Object.fromEntries(
  Object.entries(byMarket).map(([market, list]) => [
    market,
    [...list].sort((a, b) => String(b.collected_at).localeCompare(String(a.collected_at)))[0]
  ])
);

module.exports = {
  all: runs,
  byKey: Object.fromEntries(runs.map((r) => [r.key, r])),
  byMarket,
  byRunId: Object.fromEntries(runs.map((r) => [r.run_id, r])),
  current,
  currentKeys: Object.values(current).map((r) => r.key),
  markets: Object.keys(byMarket).sort(),
  withTrend: Object.entries(byMarket)
    .filter(([, list]) => list.some((r) => (r.comparable_with || []).length))
    .map(([market]) => market),
  latest: [...runs].sort((a, b) => String(b.collected_at).localeCompare(String(a.collected_at)))[0] || null
};
