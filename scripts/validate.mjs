#!/usr/bin/env node
// JSON Schema validation for everything under /data. Run before every build.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { files as metricsFiles } from "./build-metrics.mjs";

// fileURLToPath, not URL.pathname: on Windows the latter yields "/D:/..." which
// fs cannot resolve (same fix as scripts/check.mjs).
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const schema = (name) => ajv.compile(read(`schemas/${name}.schema.json`));

const errors = [];

function validate(label, validator, value) {
  if (!validator(value)) {
    for (const e of validator.errors) {
      errors.push(`${label}: ${e.instancePath || "/"} ${e.message}`);
    }
  }
}

validate("data/site.json", schema("site"), read("data/site.json"));
validate("data/sources.json", schema("sources"), read("data/sources.json"));
validate("data/platforms.json", schema("platforms"), read("data/platforms.json"));
validate("data/countries.json", schema("countries"), read("data/countries.json"));
validate("data/clusters.json", schema("clusters"), read("data/clusters.json"));
validate("data/countermeasures.json", schema("countermeasures"), read("data/countermeasures.json"));
validate("data/reports.json", schema("reports"), read("data/reports.json"));
validate("data/citation-drift.json", schema("citation-drift"), read("data/citation-drift.json"));
validate("data/metrics.json", schema("metrics"), read("data/metrics.json"));
validate("data/runs.json", schema("runs"), read("data/runs.json"));

// The metrics store is derived. Rebuild it here and fail on any drift, so a
// hand-edit or a forgotten `npm run metrics` cannot ship stale numbers.
const rebuilt = metricsFiles();
if (readFileSync(join(ROOT, "data/metrics.json"), "utf8") !== rebuilt["data/metrics.json"]) {
  errors.push("data/metrics.json: stale - does not match a rebuild from data/observations. Run: npm run metrics");
}
for (const key of rebuilt.blocked || []) {
  // Calculation Methodology 1.3: a surplus response blocks every metric.
  errors.push(`data/runs.json: ${key} has surplus responses - no metric may be computed until it is resolved`);
}

// Store assertions (Sources Registry Business Logic 12: a failed assertion
// blocks publication). Each one catches a class of arithmetic that would be
// wrong on the page rather than merely odd in the file.
{
  const store = read("data/metrics.json");
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  for (const c of store.cells) {
    const where = `data/metrics.json: ${c.key}`;
    if (sum(c.counts) !== c.n) errors.push(`${where}: verdict counts sum to ${sum(c.counts)}, not n=${c.n}`);
    if (sum(c.tiers) !== c.n) errors.push(`${where}: escalation tiers sum to ${sum(c.tiers)}, not n=${c.n}`);
    if (sum(c.layer_b) !== c.n) errors.push(`${where}: layer_b sums to ${sum(c.layer_b)}, not n=${c.n}`);
    if (c.n !== c.received - c.quarantined - c.unresolved) {
      errors.push(`${where}: n=${c.n} does not equal received minus quarantined and unresolved`);
    }
    if (c.substantive !== c.n - c.counts.dodge) errors.push(`${where}: substantive is not n minus DODGE`);
    if (c.contaminated !== c.layer_b["flag-present"]) errors.push(`${where}: contaminated does not match layer_b`);
    if (sum(c.layer_b_cat) !== c.contaminated) {
      errors.push(`${where}: layer_b categories sum to ${sum(c.layer_b_cat)}, not contaminated=${c.contaminated}`);
    }
    if (c.n) {
      const shares = ["repeat", "u_context", "refute", "dodge"].reduce((a, k) => a + c.verdict_shares[k].rate, 0);
      if (Math.abs(shares - 1) > 1e-9) errors.push(`${where}: verdict distribution sums to ${shares}, not 1`);
    }
    for (const [domain, e] of Object.entries(c.domains)) {
      const split = e.repeat + e.u_context + e.refute + e.dodge;
      if (split !== e.cited) errors.push(`${where}: ${domain} verdict split ${split} does not equal cited ${e.cited}`);
      if (e.cited > c.n) errors.push(`${where}: ${domain} cited ${e.cited} times in ${c.n} responses`);
    }
  }
}

const claimSchema = schema("claim");
const claimDir = join(ROOT, "data/claims");
const claimFiles = existsSync(claimDir) ? readdirSync(claimDir).filter((f) => f.endsWith(".json")) : [];
const clusterIds = new Set(read("data/clusters.json").clusters.map((c) => c.id));
const seenSlugs = new Map();
const claimIds = new Set();

for (const file of claimFiles) {
  const claim = read(`data/claims/${file}`);
  validate(`data/claims/${file}`, claimSchema, claim);
  if (claim.id && `${claim.id}.json` !== file) {
    errors.push(`data/claims/${file}: id "${claim.id}" does not match filename`);
  }
  if (claim.slug) {
    if (seenSlugs.has(claim.slug)) {
      errors.push(`data/claims/${file}: slug "${claim.slug}" already used by ${seenSlugs.get(claim.slug)}`);
    }
    seenSlugs.set(claim.slug, file);
  }
  if (claim.cluster && !clusterIds.has(claim.cluster)) {
    errors.push(`data/claims/${file}: cluster "${claim.cluster}" has no entry in data/clusters.json`);
  }
  if (claim.id) claimIds.add(claim.id);
}

// Cross-file referential integrity.
for (const file of claimFiles) {
  const claim = read(`data/claims/${file}`);
  for (const rel of claim.related || []) {
    if (!claimIds.has(rel)) errors.push(`data/claims/${file}: related claim ${rel} does not exist`);
  }
}
for (const entry of read("data/countermeasures.json").actions) {
  if (entry.claim_id && !claimIds.has(entry.claim_id)) {
    errors.push(`data/countermeasures.json: claim_id ${entry.claim_id} does not exist`);
  }
}
for (const source of read("data/sources.json").domains) {
  for (const id of source.cited_in || []) {
    if (!claimIds.has(id)) errors.push(`data/sources.json: ${source.domain} cites unknown claim ${id}`);
  }
}

// Cross-file: the source run table against the recorded answers.
const runIds = new Set(read("data/runs.json").runs.map((r) => r.run_id));
const botKeys = new Set(Object.keys(read("data/platforms.json").platforms));
for (const run of read("data/runs.json").runs) {
  for (const model of run.models) {
    if (!botKeys.has(model)) errors.push(`data/runs.json: ${run.run_id} names unknown chatbot ${model}`);
  }
  for (const id of run.claims) {
    if (!claimIds.has(id)) errors.push(`data/runs.json: ${run.run_id} names unknown claim ${id}`);
  }
  if (!clusterIds.has(run.cluster)) errors.push(`data/runs.json: ${run.run_id} names unknown cluster ${run.cluster}`);
}
const obsDir = join(ROOT, "data/observations");
const obsFiles = existsSync(obsDir) ? readdirSync(obsDir).filter((f) => f.endsWith(".csv")) : [];
for (const file of obsFiles) {
  const id = file.replace(/\.csv$/, "");
  if (!runIds.has(id)) errors.push(`data/observations/${file}: no run with id ${id} in data/runs.json`);
}
for (const id of runIds) {
  if (!obsFiles.includes(`${id}.csv`)) errors.push(`data/runs.json: ${id} has no data/observations/${id}.csv`);
}

if (errors.length) {
  console.error(`validate: ${errors.length} problem(s)\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`validate: ok (${claimFiles.length} claim file(s))`);
