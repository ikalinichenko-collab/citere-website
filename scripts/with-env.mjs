#!/usr/bin/env node
// Minimal, zero-dependency cross-platform env-setter (a tiny `cross-env`).
// Usage: node scripts/with-env.mjs KEY=VAL [KEY=VAL ...] -- <command> [args...]
// Sets the given env vars, then runs the command with them, on any OS.
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
const assignments = sep === -1 ? [] : argv.slice(0, sep);
const command = sep === -1 ? argv : argv.slice(sep + 1);

const env = { ...process.env };
for (const a of assignments) {
  const i = a.indexOf("=");
  if (i === -1) continue;
  env[a.slice(0, i)] = a.slice(i + 1);
}

if (command.length === 0) process.exit(0);

// shell:true so Windows can resolve .cmd bin shims (e.g. eleventy) on PATH.
const result = spawnSync(command[0], command.slice(1), {
  stdio: "inherit",
  shell: true,
  env,
});
process.exit(result.status ?? 1);
