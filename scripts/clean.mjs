#!/usr/bin/env node
// Cross-platform replacement for `rm -rf <dir>` (works on Windows, macOS, Linux).
// Defaults to _site; pass one or more directories to remove others.
import { rmSync } from "node:fs";

const targets = process.argv.slice(2);
if (targets.length === 0) targets.push("_site");

for (const dir of targets) {
  rmSync(dir, { recursive: true, force: true });
}
