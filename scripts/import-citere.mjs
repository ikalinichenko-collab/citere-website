#!/usr/bin/env node
// The only sanctioned way numbers enter this repo (CLAUDE.md section 9).
//   node scripts/import-citere.mjs <export-dir> [--dry-run]
// Validates every file against schemas/, refuses to overwrite a claim whose
// stored `updated` is newer than the incoming one, and prints a diff summary.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

// fileURLToPath, not URL.pathname: on Windows the latter yields "/D:/..." which
// fs cannot resolve (same fix as scripts/check.mjs).
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const [, , exportDir, ...flags] = process.argv;
const dryRun = flags.includes("--dry-run");

if (!exportDir) {
  console.error("usage: node scripts/import-citere.mjs <export-dir> [--dry-run]");
  process.exit(1);
}
if (!existsSync(exportDir)) {
  console.error(`import: ${exportDir} does not exist`);
  process.exit(1);
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const compile = (name) =>
  ajv.compile(JSON.parse(readFileSync(join(ROOT, "schemas", `${name}.schema.json`), "utf8")));

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const added = [];
const updated = [];
const skipped = [];
const rejected = [];

function check(validator, label, value) {
  if (validator(value)) return true;
  rejected.push(`${label}: ${validator.errors.map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ")}`);
  return false;
}

// --- claims ----------------------------------------------------------------
const claimValidator = compile("claim");
const inClaims = join(exportDir, "claims");
if (existsSync(inClaims)) {
  mkdirSync(join(ROOT, "data/claims"), { recursive: true });
  for (const file of readdirSync(inClaims).filter((f) => f.endsWith(".json"))) {
    const incoming = readJson(join(inClaims, file));
    if (!check(claimValidator, `claims/${file}`, incoming)) continue;

    const target = join(ROOT, "data/claims", file);
    if (existsSync(target)) {
      const current = readJson(target);
      if (current.updated > incoming.updated) {
        skipped.push(`claims/${file}: repo copy updated ${current.updated} is newer than import ${incoming.updated}`);
        continue;
      }
      const changes = [];
      if (current.verdict !== incoming.verdict) changes.push(`verdict ${current.verdict} -> ${incoming.verdict}`);
      const dObs = (incoming.observations || []).length - (current.observations || []).length;
      const dAct = (incoming.actions || []).length - (current.actions || []).length;
      if (dObs) changes.push(`${dObs > 0 ? "+" : ""}${dObs} observations`);
      if (dAct) changes.push(`${dAct > 0 ? "+" : ""}${dAct} actions`);
      if (!changes.length) changes.push("no structural change");
      updated.push(`claims/${file}: ${changes.join(", ")}`);
    } else {
      added.push(`claims/${file}: ${(incoming.observations || []).length} observations`);
    }
    if (!dryRun) writeFileSync(target, JSON.stringify(incoming, null, 2) + "\n");
  }
}

// --- flat data files -------------------------------------------------------
for (const [file, schemaName] of [
  ["sources.json", "sources"],
  ["platforms.json", "platforms"],
  ["countries.json", "countries"],
  ["countermeasures.json", "countermeasures"],
  ["reports.json", "reports"]
]) {
  const src = join(exportDir, file);
  if (!existsSync(src)) continue;
  const incoming = readJson(src);
  if (!check(compile(schemaName), file, incoming)) continue;
  const target = join(ROOT, "data", file);
  const before = existsSync(target) ? readJson(target) : null;
  const size = (v) => (Array.isArray(v) ? v.length : Object.keys(v || {}).length);
  updated.push(`${file}: ${before ? size(before) : 0} -> ${size(incoming)} entries`);
  if (!dryRun) writeFileSync(target, JSON.stringify(incoming, null, 2) + "\n");
}

// --- per-run observation CSVs ---------------------------------------------
const inObs = join(exportDir, "observations");
if (existsSync(inObs)) {
  mkdirSync(join(ROOT, "data/observations"), { recursive: true });
  for (const file of readdirSync(inObs).filter((f) => f.endsWith(".csv"))) {
    added.push(`observations/${file}`);
    if (!dryRun) copyFileSync(join(inObs, file), join(ROOT, "data/observations", basename(file)));
  }
}

// The metrics store is derived from the claims that just landed, so it is
// rebuilt here rather than left for someone to remember (build-metrics.mjs).
if (!dryRun) {
  const { files: metricsFiles } = await import("./build-metrics.mjs");
  const out = metricsFiles();
  for (const name of ["data/metrics.json", "data/runs.json"]) {
    writeFileSync(join(ROOT, name), out[name]);
  }
  updated.push(`metrics.json (${out.header.totals.cells} cells)`, "runs.json");
}

console.log(`import: ${dryRun ? "dry run of " : ""}${exportDir}\n`);
for (const [label, list] of [["added", added], ["updated", updated], ["skipped", skipped]]) {
  if (!list.length) continue;
  console.log(`${label} (${list.length}):`);
  for (const line of list) console.log(`  ${line}`);
  console.log("");
}
if (rejected.length) {
  console.error(`rejected (${rejected.length}) - schema validation failed:`);
  for (const line of rejected) console.error(`  ${line}`);
  process.exit(1);
}
console.log("Run: npm run validate && npm run build && npm run check");
