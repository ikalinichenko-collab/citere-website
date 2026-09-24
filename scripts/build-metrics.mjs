#!/usr/bin/env node
// Builds the metrics store: the single pre-computed table every page filters.
//
// Reads   data/observations/*.csv  one row per recorded answer
//         data/claims/*.json   the claim cards
//         data/sources.json    the watchlist, which decides what "listed" means
//         data/site.json       version stamps
// Writes  data/runs.json       one record per run x market
//         data/metrics.json    one cell per bot x claim x persona x market x run
//
// Normative: docs/citere-spec/Citere_Calculation_Methodology.md (CM) and
// Citere_Sources_Registry_Business_Logic.md (SR). Nothing downstream divides.
// The store is derived, so scripts/validate.mjs rebuilds it and fails if the
// committed file is stale.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const M = require(path.join(ROOT, "src/_lib/metrics.cjs"));
const {
  share, tier, market, LOW_N, COUNT_KEY, BEHAVIOURS, WL_CATEGORIES, NETWORK_CATEGORY,
  worstCategory, normaliseDomain, matchWatchlist, spliceGroup, comparableRuns, DEFAULT_EXCLUSIONS
} = M;

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const zeroCounts = () => ({ repeat: 0, u_context: 0, refute: 0, dodge: 0 });
const zeroTiers = () => ({ critical: 0, high: 0, review: 0, low: 0, none: 0 });
// The A x B matrix itself: what the bot did, against whether it cited a listed
// source (CM §5.9). The tiers above are the same eight cells named by severity;
// the matrix needs them named by their axes.
const zeroAbx = () => ({
  repeat: { clean: 0, listed: 0 }, u_context: { clean: 0, listed: 0 },
  refute: { clean: 0, listed: 0 }, dodge: { clean: 0, listed: 0 }
});
const zeroCats = () => Object.fromEntries(WL_CATEGORIES.map((c) => [c, 0]));
const uniq = (xs) => [...new Set(xs)].sort();
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Seed claim cards keep demo:true even after the public site flips site.demo off.
// The metrics store built from those cards must stay marked demo so templates
// never publish seed rates as findings.
function seedClaimCardsPresent() {
  const dir = path.join(ROOT, "data/claims");
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).some((f) => {
    try {
      return read(path.join("data/claims", f)).demo === true;
    } catch {
      return false;
    }
  });
}

// RFC 4180: quoted fields carry commas, newlines and doubled quotes. The
// observation files hold prompt and response text, so a naive split loses the
// column alignment and silently corrupts every count downstream.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    if (c === "\r") continue;
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function readCsv(file) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const cols = rows.shift() || [];
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] === undefined ? "" : r[i]])));
}

export function build() {
  const claims = Object.fromEntries(
    fs.readdirSync(path.join(ROOT, "data/claims"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => read(`data/claims/${f}`))
      .map((c) => [c.id, c])
  );
  const sources = read("data/sources.json");
  const site = read("data/site.json");
  // data/runs.json is a source table: prompts, repeats and frozen versions
  // cannot be derived from the answers (Entity Model §5, CM §1.1).
  const runSource = read("data/runs.json").runs || [];

  // SR §3: the watchlist is normalised the same way as everything else, and
  // folded onto the three Layer B categories (pipeline guide §4.1).
  const watchlist = (sources.domains || []).map((d) => ({
    domain: normaliseDomain(d.domain),
    category: NETWORK_CATEGORY[d.network] || "laundering_network",
    network: d.network
  }));
  const matchOpts = {
    exclusions: sources.exclusions || DEFAULT_EXCLUSIONS,
    patterns: sources.patterns || []
  };

  const obsDir = path.join(ROOT, "data/observations");
  const files = fs.existsSync(obsDir) ? fs.readdirSync(obsDir).filter((f) => f.endsWith(".csv")) : [];
  const responses = files.flatMap((f) => readCsv(path.join(obsDir, f)));

  const cells = new Map();
  const runs = new Map();
  // The flagged answers the Claim Report shows as evidence: CRITICAL and HIGH,
  // critical first (Claim Report Spec, Layer 3 "Evidence").
  const incidents = [];
  const unlisted = new Map();
  const stability = new Map(); // prompt|bot|run -> [verdict...] (CM §5.11)

  for (const meta of runSource) {
    runs.set(meta.run_id, {
      key: meta.run_id,
      run_id: meta.run_id,
      cluster: meta.cluster,
      market: market(meta.country, meta.language),
      country: meta.country,
      language: meta.language,
      collected_at: meta.collected_at,
      collected_until: meta.collected_until || meta.collected_at,
      claims: [...(meta.claims || [])].sort(),
      models: [...(meta.models || [])].sort(),
      personas: [...(meta.personas || [])].sort(),
      model_versions: [],
      prompts: meta.prompts ?? null,
      variations: meta.variations ?? null,
      repeats: meta.repeats ?? null,
      live_prompts: meta.live_prompts ?? 0,
      received: 0, valid: 0, quarantined: 0, unresolved: 0, live: 0,
      reconciliation: { expected: null, received: 0, missing: null, extra: null, blocked: false, known: false },
      judge_validation: meta.judge_validation || { status: "pending", alpha: null },
      versions: {
        catalog: (meta.versions || {}).catalog ?? null,
        grid: (meta.versions || {}).grid ?? null,
        judge: (meta.versions || {}).judge ?? null,
        watchlist: (meta.versions || {}).watchlist ?? site.watchlist_version ?? null
      },
      comparable_with: []
    });
  }

  for (const o of responses) {
    const run = runs.get(o.run_id);
    if (!run) throw new Error(`response ${o.response_id}: run ${o.run_id} is not in data/runs.json`);
    const claim = claims[o.claim_id];
    if (!claim) throw new Error(`response ${o.response_id}: claim ${o.claim_id} does not exist`);
    const isLive = o.is_live === "true";
    const mk = run.market;
    const key = [o.run_id, o.claim_id, o.model_name, o.persona, mk, isLive ? "live" : "grid"].join("|");

    let cell = cells.get(key);
    if (!cell) {
      cell = {
        key, run: o.run_id, claim: o.claim_id, cluster: claim.cluster,
        chatbot: o.model_name, persona: o.persona,
        country: run.country, language: run.language, market: mk,
        splice: claim.splice || null,
        splice_group: spliceGroup(claim.splice),
        grain_of_truth: claim.grain_of_truth === true,
        // Entity Model §4: live formulations control for artefacts of our own
        // constructed prompts, and are never pooled with the grid.
        is_live: isLive,
        first_seen: o.collected_at, last_seen: o.collected_at,
        model_versions: [],
        received: 0, quarantined: 0, unresolved: 0,
        n: 0, substantive: 0, contaminated: 0,
        counts: zeroCounts(), tiers: zeroTiers(), abx: zeroAbx(),
        layer_b: { clean: 0, "flag-present": 0 },
        layer_b_cat: zeroCats(),
        dodge_types: {},
        review: { needs_human_review: 0, human_labelled: 0 },
        judgeConfidence: [], judgeAgreement: [],
        acknowledged_grain: { yes: 0, known: 0 },
        flagged_truth_as_false: { yes: 0, known: 0 },
        retrieved: 0,
        domains: {}
      };
      cells.set(key, cell);
    }

    cell.received += 1;
    run.received += 1;
    if (isLive) run.live += 1;
    if (o.collected_at < cell.first_seen) cell.first_seen = o.collected_at;
    if (o.collected_at > cell.last_seen) cell.last_seen = o.collected_at;
    if (o.model_version && !cell.model_versions.includes(o.model_version)) cell.model_versions.push(o.model_version);
    if (o.model_version && !run.model_versions.includes(o.model_version)) run.model_versions.push(o.model_version);

    // CM §0.3: quarantine and UNRESOLVED are counted, then dropped before every
    // metric. Nothing is silently deleted.
    if (o.status === "quarantine") { cell.quarantined += 1; run.quarantined += 1; continue; }
    if (o.layer_a === "unresolved" || o.layer_a === "UNRESOLVED") { cell.unresolved += 1; run.unresolved += 1; continue; }
    const behaviour = o.layer_a;
    if (!BEHAVIOURS.includes(behaviour)) throw new Error(`${o.response_id}: unknown layer_a ${behaviour}`);
    run.valid += 1;

    // Layer B. SR §4-5: one edge per response per domain, whatever the answer
    // cited it for; a response counts at most +1 per domain (CM §5.8).
    const cited = (o.domains || "").split(/\s+/).filter(Boolean);
    const seen = new Map(); // normalised domain -> watchlist category, or null
    for (const rawDomain of cited) {
      const hit = matchWatchlist(rawDomain, watchlist, matchOpts);
      const domain = hit ? hit.domain : normaliseDomain(rawDomain);
      if (!domain || seen.has(domain)) continue;
      seen.set(domain, hit ? hit.category : null);
      if (!hit) unlisted.set(domain, (unlisted.get(domain) || 0) + 1);
      const e = (cell.domains[domain] ||= { cited: 0, repeat: 0, u_context: 0, refute: 0, dodge: 0, critical: 0, listed: Boolean(hit) });
      e.cited += 1;
      e[COUNT_KEY[behaviour]] += 1;
    }
    const hitCats = [...seen.values()].filter(Boolean);
    const contaminated = hitCats.length > 0;
    // CM §3.3: the worst category among the hits, by fixed priority.
    const layerBCat = worstCategory(hitCats);

    cell.n += 1;
    if (behaviour !== "dodged") cell.substantive += 1;
    if (cited.length) cell.retrieved += 1;
    cell.counts[COUNT_KEY[behaviour]] += 1;
    cell.abx[COUNT_KEY[behaviour]][contaminated ? "listed" : "clean"] += 1;
    const t = tier(behaviour, contaminated);
    cell.tiers[t] += 1;
    if (t === "critical" || t === "high") {
      incidents.push({
        response_id: o.response_id,
        run: o.run_id, claim: o.claim_id, chatbot: o.model_name, persona: o.persona,
        market: mk, country: run.country, language: run.language,
        date: o.collected_at, model_version: o.model_version || null,
        repeat_n: Number(o.repeat_n) || null,
        is_live: isLive,
        tier: t,
        prompt_text: o.prompt_text || null,
        quote: o.layer_a_quote || null,
        // Generated from the claim card, not a recorded response. Anything
        // carrying this must be labelled where it is shown, not only in a
        // banner at the top of the page.
        synthetic: o.synthetic === "true",
        domains: [...seen.keys()],
        listed: [...seen.entries()].filter(([, cat]) => cat).map(([d]) => d),
        review: o.human_review_status || null,
        judge_confidence: null
      });
    }
    if (t === "critical") for (const [d, cat] of seen) if (cat) cell.domains[d].critical += 1;
    cell.layer_b[contaminated ? "flag-present" : "clean"] += 1;
    if (layerBCat) cell.layer_b_cat[layerBCat] += 1;
    if (contaminated) cell.contaminated += 1;
    if (behaviour === "dodged" && o.dodge_type) {
      cell.dodge_types[o.dodge_type] = (cell.dodge_types[o.dodge_type] || 0) + 1;
    }
    const confidence = o.layer_a_confidence === "" ? null : Number(o.layer_a_confidence);
    const agreement = o.layer_a_agreement === "" ? null : Number(o.layer_a_agreement);
    if (incidents.length && incidents[incidents.length - 1].response_id === o.response_id) {
      incidents[incidents.length - 1].judge_confidence = Number.isFinite(confidence) ? confidence : null;
    }
    if (Number.isFinite(confidence)) cell.judgeConfidence.push(confidence);
    if (Number.isFinite(agreement)) cell.judgeAgreement.push(agreement);
    if (o.needs_human_review === "true") cell.review.needs_human_review += 1;
    if (o.human_review_status) cell.review.human_labelled += 1;
    for (const [field, bucket] of [["acknowledged_grain", cell.acknowledged_grain],
                                   ["flagged_truth_as_false", cell.flagged_truth_as_false]]) {
      if (o[field] === "true" || o[field] === "false") {
        bucket.known += 1;
        if (o[field] === "true") bucket.yes += 1;
      }
    }

    // CM §5.11: one prompt x bot pair, its repeats, and how often they agree.
    if (o.prompt_id) {
      const sk = `${o.run_id}|${o.prompt_id}|${o.model_name}`;
      if (!stability.has(sk)) stability.set(sk, { cell: key, verdicts: [] });
      stability.get(sk).verdicts.push(behaviour);
    }
  }

  // CM §5.11: a pair is stable when its repeats land on one verdict; three
  // different verdicts means no majority, and the pair is flagged unstable.
  const stabilityByCell = new Map();
  for (const { cell: key, verdicts } of stability.values()) {
    const tally = {};
    for (const v of verdicts) tally[v] = (tally[v] || 0) + 1;
    const top = Math.max(...Object.values(tally));
    const value = top >= 2 ? top / verdicts.length : 0;
    if (!stabilityByCell.has(key)) stabilityByCell.set(key, { values: [], unstable: 0 });
    const acc = stabilityByCell.get(key);
    acc.values.push(value);
    if (top < 2) acc.unstable += 1;
  }

  for (const cell of cells.values()) {
    const c = cell.counts;
    // CM §5.2-5.5: two denominators, never interchanged. D_all is every valid
    // answer; D_sub is D_all minus DODGE.
    cell.repeat_rate = share(c.repeat, cell.substantive);
    cell.contamination_rate = share(cell.contaminated, cell.n);
    cell.dodge_rate = share(c.dodge, cell.n);
    // Countries Index §5: the share of answers that cited anything at all, so a
    // reader can tell a bot that is clean because it refused from one that
    // looked and got it right.
    cell.retrieval_rate = share(cell.retrieved, cell.n);
    cell.no_substantive = cell.substantive === 0;
    // CM §5.5: the four shares over D_all, the only metric with DODGE on top.
    cell.verdict_shares = Object.fromEntries(
      Object.entries(c).map(([k, v]) => [k, share(v, cell.n)])
    );
    cell.judge = { confidence: mean(cell.judgeConfidence), agreement: mean(cell.judgeAgreement) };
    delete cell.judgeConfidence;
    delete cell.judgeAgreement;
    cell.model_versions.sort();
    const st = stabilityByCell.get(cell.key);
    cell.stability = st ? Number((mean(st.values) || 0).toFixed(4)) : null;
    cell.unstable_pairs = st ? st.unstable : 0;
  }

  const list = [...cells.values()].sort((a, b) => a.key.localeCompare(b.key));
  const runList = [...runs.values()].sort((a, b) => a.key.localeCompare(b.key)).map((r) => {
    r.model_versions.sort();
    r.claims_count = r.claims.length;
    const rec = r.reconciliation;
    // CM §1.1-1.3. Live formulations are a separate entity and are not part of
    // the grid's expected count.
    rec.received = r.received - r.live;
    if (r.prompts && r.repeats && r.models.length) {
      rec.expected = r.prompts * r.models.length * r.repeats;
      rec.missing = Math.max(0, rec.expected - rec.received);
      rec.extra = Math.max(0, rec.received - rec.expected);
      rec.known = true;
      // CM §1.3: a surplus response blocks calculation until it is found.
      rec.blocked = rec.extra > 0;
    }
    return r;
  });
  // CM §6.1: which runs may be put side by side at all.
  for (const a of runList) {
    a.comparable_with = runList.filter((b) => comparableRuns(a, b)).map((b) => b.key);
  }

  const unlistedRows = [...unlisted.entries()]
    .map(([domain, cited]) => ({ domain, cited }))
    .sort((a, b) => b.cited - a.cited || a.domain.localeCompare(b.domain));

  const header = {
    demo: site.demo === true || seedClaimCardsPresent(),
    generated_from: "data/observations/*.csv",
    low_n: LOW_N,
    watchlist_version: site.watchlist_version || null,
    totals: {
      cells: list.length,
      received: list.reduce((n, c) => n + c.received, 0),
      responses: list.reduce((n, c) => n + c.n, 0),
      quarantined: list.reduce((n, c) => n + c.quarantined, 0),
      unresolved: list.reduce((n, c) => n + c.unresolved, 0),
      contaminated: list.reduce((n, c) => n + c.contaminated, 0),
      critical: list.reduce((n, c) => n + c.tiers.critical, 0),
      needs_human_review: list.reduce((n, c) => n + c.review.needs_human_review, 0)
    },
    dimensions: {
      runs: uniq(list.map((c) => c.run)),
      markets: uniq(list.map((c) => c.market)),
      countries: uniq(list.map((c) => c.country)),
      languages: uniq(list.map((c) => c.language)),
      chatbots: uniq(list.map((c) => c.chatbot)),
      personas: uniq(list.map((c) => c.persona)),
      clusters: uniq(list.map((c) => c.cluster)),
      claims: uniq(list.map((c) => c.claim)),
      splice_groups: uniq(list.map((c) => c.splice_group).filter(Boolean))
    },
    runs: runList,
    incidents,
    // SR §7.1-7.2: what the analyst has to look at after this rebuild.
    queues: {
      // Domains a bot cited that are on no list at all.
      unmatched: unlistedRows.filter((d) => d.cited >= 3),
      unmatched_all: unlistedRows.length
    }
  };

  incidents.sort((a, b) => (a.tier === b.tier ? 0 : a.tier === "critical" ? -1 : 1) ||
    a.claim.localeCompare(b.claim) || a.date.localeCompare(b.date));
  return { header, cells: list, runs: runList, incidents, unlisted: unlistedRows, blocked: runList.filter((r) => r.reconciliation.blocked).map((r) => r.key) };
}

// One row per line: a 1,600-row table has to stay reviewable in a diff.
export function serialise(header, listKey, rows) {
  const head = JSON.stringify(header, null, 2).replace(/\n\}\s*$/, "");
  const body = rows.map((r) => "    " + JSON.stringify(r)).join(",\n");
  return `${head},\n  "${listKey}": [\n${body}\n  ]\n}\n`;
}

export function files() {
  const { header, cells, unlisted, blocked } = build();
  return {
    unlisted, blocked, header,
    "data/metrics.json": serialise(header, "cells", cells)
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = files();
  fs.writeFileSync(path.join(ROOT, "data/metrics.json"), out["data/metrics.json"]);
  const t = out.header.totals;
  console.log(`metrics: ${t.cells} cells, ${t.responses} valid of ${t.received} received`);
  console.log(`         ${t.quarantined} quarantined, ${t.unresolved} unresolved, ${t.contaminated} contaminated, ${t.critical} critical`);
  const queue = out.header.queues.unmatched;
  if (queue.length) {
    console.log(`queue:   ${queue.length} unmatched domain(s) cited 3+ times: ${queue.slice(0, 6).map((d) => `${d.domain} (${d.cited})`).join(", ")}`);
  }
  // CM §1.3: no metric is computed while extra > 0.
  if (out.blocked.length) {
    console.error(`blocked: surplus responses in ${out.blocked.join(", ")} - locate, remove or quarantine before publishing`);
    process.exit(1);
  }
}
