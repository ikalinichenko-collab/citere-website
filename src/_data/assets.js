// Cache-busting stamps for static assets served at a stable URL. site.css lives
// at /css/site.css with no content hash in the path, so browsers and the CDN
// keep serving a stale copy after a deploy until its TTL expires — which is how
// a CSS change (e.g. the About language toggle) can look broken to a returning
// visitor. Appending ?v=<content-hash> to the <link> makes the URL change
// whenever the file's bytes change, so a new CSS is fetched immediately and an
// unchanged one still caches. The hash is of the SOURCE file, whose bytes are
// identical to the passthrough-copied file the browser gets.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { ROOT } = require("../_lib/markdown.cjs");

function hash(rel) {
  try {
    return crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex").slice(0, 8);
  } catch {
    return "";
  }
}

module.exports = { cssV: hash("src/css/site.css") };
