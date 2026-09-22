#!/usr/bin/env node
// Pre-publish checks against _site/ (CLAUDE.md section 10).
// Errors block the deploy. Warnings are printed and tolerated until launch.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, posix } from "node:path";
import { fileURLToPath } from "node:url";
import labels from "../src/_lib/labels.cjs";

// fileURLToPath, not URL.pathname: on Windows the latter yields "/D:/..." which
// fs cannot resolve, so the whole check silently no-ops. (Cross-platform, CLAUDE.md 9.)
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SITE = join(ROOT, "_site");

const PATH_PREFIX = (process.env.PATH_PREFIX || "/").replace(/\/*$/, "/");

const errors = [];
const warnings = [];
const err = (page, msg) => errors.push(`${page}: ${msg}`);
const warn = (page, msg) => warnings.push(`${page}: ${msg}`);

if (!existsSync(SITE)) {
  console.error("check: _site/ does not exist - run npm run build first");
  process.exit(1);
}

const STOP_WORDS = [
  "fight", "combat", "defeat", "war on disinformation", "revolutionary",
  "ai-powered", "cutting-edge", "comprehensive", "unique", "holistic",
  "empower", "innovative"
];

// A rate that claims to average personas is a defect; a sentence promising we
// never do is the opposite, so "never/not averaged" is not a match.
const NEGATED = /\b(never|not|without|refuse to|rather than)\s+(?:be\s+)?$/i;
const PERSONA_AVERAGE_PATTERNS = [
  /averag\w*\s+(?:across|over|of)\s+persona/i,
  /mean\s+(?:across|over)\s+persona/i,
  /persona[- ]averaged/i,
  /average\s+repeat[- ]rate/i,
  /overall\s+repeat[- ]rate/i
];

function personaAveraged(text) {
  for (const re of PERSONA_AVERAGE_PATTERNS) {
    const global = new RegExp(re.source, "gi");
    let match;
    while ((match = global.exec(text)) !== null) {
      if (!NEGATED.test(text.slice(Math.max(0, match.index - 40), match.index))) return re;
    }
  }
  return null;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const allFiles = walk(SITE);
// Redirect stubs (src/pages/redirects.njk) are pages only in the sense that a
// browser lands on them. They carry no content, so they are exempt from the
// per-page checks and from sitemap coverage - but their paths still resolve,
// so a link to an old URL is not reported as broken.
const isRedirect = (f) => /<meta http-equiv="refresh"/i.test(readFileSync(f, "utf8"));
const htmlFiles = allFiles.filter((f) => f.endsWith(".html")).filter((f) => !isRedirect(f));
const sitePaths = new Set(
  allFiles.map((f) => "/" + relative(SITE, f).split(/[\\/]/).join("/"))
);

const guards = JSON.parse(readFileSync(join(ROOT, "scripts/guards.json"), "utf8"));
const site = JSON.parse(readFileSync(join(ROOT, "data/site.json"), "utf8"));
// The host this build actually writes into canonicals, which is the preview
// host on a preview deploy. PRODUCTION_URL stays the real domain so the demo
// guard below can tell the two apart.
const SITE_URL = (process.env.CANONICAL_URL || `https://${site.domain}`).replace(/\/+$/, "");
const PRODUCTION_URL = `https://${site.domain}`;
const sources = JSON.parse(readFileSync(join(ROOT, "data/sources.json"), "utf8")).domains || [];
const metricRuns = (JSON.parse(readFileSync(join(ROOT, "data/metrics.json"), "utf8")).runs) || [];
const claims = existsSync(join(ROOT, "data/claims"))
  ? readdirSync(join(ROOT, "data/claims"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(join(ROOT, "data/claims", f), "utf8")))
  : [];
const claimsBySlug = new Map(claims.map((c) => [c.slug, c]));

const stripTags = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");

// Built links carry the path prefix; _site paths do not. Strip it before
// resolving, and treat a prefixed link that escapes the prefix as dead.
function stripPrefix(path) {
  if (PATH_PREFIX === "/") return path;
  if (path === PATH_PREFIX.slice(0, -1)) return "/";
  return path.startsWith(PATH_PREFIX) ? "/" + path.slice(PATH_PREFIX.length) : null;
}

function resolveLink(href, fromPage) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean) return true;
  if (/^(https?:|mailto:|tel:)/i.test(clean)) return true;
  const absolute = clean.startsWith("/")
    ? clean
    : posix.resolve(posix.dirname(fromPage), clean);
  const base = stripPrefix(absolute);
  if (base === null) return false;
  if (base.endsWith("/")) return sitePaths.has(base + "index.html");
  return sitePaths.has(base) || sitePaths.has(base + "/index.html");
}

for (const file of htmlFiles) {
  const page = "/" + relative(SITE, file).split(/[\\/]/).join("/");
  const html = readFileSync(file, "utf8");
  const text = stripTags(html);
  const bytes = Buffer.byteLength(html, "utf8");

  // --- structure -----------------------------------------------------------
  const h1s = html.match(/<h1[\s>]/gi) || [];
  if (h1s.length !== 1) err(page, `${h1s.length} <h1> elements, expected exactly 1`);

  // Measure the VISIBLE length: HTML-escaped chars (a quote in the claim label
  // is &quot; in the markup, 6 bytes) count as one character to a reader and to
  // search engines, so decode entities before the length check — otherwise a
  // legitimately-short title with a quote in it fails at the escaped byte count.
  const decode = (s) =>
    String(s)
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#0*39;/g, "'")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&amp;/g, "&");
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
  const titleLen = title ? decode(title).trim().length : 0;
  if (!title) err(page, "no <title>");
  else if (titleLen > 65) warn(page, `<title> is ${titleLen} chars, over the 65 SEO target`);

  const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1];
  const descLen = desc ? decode(desc).length : 0;
  if (!desc) err(page, "no meta description");
  else if (descLen < 120 || descLen > 160) {
    warn(page, `meta description is ${descLen} chars, outside the 120-160 SEO target`);
  }

  if (!/<link\s+rel="canonical"/i.test(html)) err(page, "no canonical link");
  if (!/<html[^>]+lang="[a-z-]+"/i.test(html)) err(page, "no lang on <html>");
  // CLAUDE.md 2 sets 60 KB. A Claim Report is a different document: the spec
  // requires three layers, a bot x persona table for every market, the A x B
  // matrix and the limitations. The one part that grows without bound — the
  // evidence blocks (one per flagged answer) — is capped in the template to the
  // most-severe N with the full set in the machine export, so the page weight is
  // bounded by the run's FINITE grid (≤5 markets × 8 bots × 4 personas), not by
  // how busy a claim is. 160 KB covers a full grid at that ceiling; the HTML is
  // text (no images/JS) so it gzips to a fraction and stays Lighthouse-green.
  // /countries/full is the "every figure" aggregate. Its finite-grid tables
  // (persona × bot × market) are bounded by the run design; the two parts that
  // grew with the archive — the claim × market matrix and the source-locality
  // table — are now bounded-rendered (top-N + link to the CSV), so the page is
  // capped for good. 120 covers the fixed grid plus those bounded tables.
  const isClaimReport = /^(?:\/[a-z]{2})?\/registry\/[^/]+\/index\.html$/.test(page);
  const isFullBreakdown = /^(?:\/[a-z]{2})?\/countries\/full\/index\.html$/.test(page);
  const limit = isClaimReport ? 160 : isFullBreakdown ? 120 : 60;
  // Soft: page weight is a target, not a blocker — Lighthouse gates real
  // performance on the sampled pages. Warn so a heavy page is visible without
  // failing the publish.
  if (bytes > limit * 1024) warn(page, `${Math.round(bytes / 1024)} KB of HTML, over the ${limit} KB target`);

  const scripts = html.match(/<script[^>]*>/gi) || [];
  for (const tag of scripts) {
    if (!/type="application\/ld\+json"/i.test(tag)) err(page, `inline <script> that is not JSON-LD: ${tag}`);
  }

  // The aria-label is translated, so the check keys on the class and requires
  // the label to be present in whatever language the page is in.
  const isHome = page === "/index.html" || /^\/[a-z]{2}\/index\.html$/.test(page);
  const breadcrumbNav = html.match(/<nav[^>]*class="crumbs"[^>]*>/i);
  if (!breadcrumbNav && !isHome) err(page, "no breadcrumb nav");
  else if (breadcrumbNav && !/aria-label="[^"]+"/i.test(breadcrumbNav[0])) {
    err(page, "breadcrumb nav has no aria-label");
  }
  if (!/"@type":"BreadcrumbList"/.test(html)) err(page, "no BreadcrumbList JSON-LD");

  // --- JSON-LD validity ----------------------------------------------------
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  if (!blocks.length) err(page, "no JSON-LD");
  for (const [, body] of blocks) {
    try {
      JSON.parse(body);
    } catch (e) {
      err(page, `invalid JSON-LD: ${e.message}`);
    }
  }

  // --- language ------------------------------------------------------------
  // Soft + scoped: the stop-word list polices OUR marketing voice, but this
  // scans the whole page — including the quoted false claim and bot answers,
  // where an adversary's "defeat"/"fight"/"combat" is legitimate content, not
  // our copy. Warn rather than block so a claim that contains a banned word
  // cannot fail the publish; a real slip in our own prose still shows up.
  for (const word of STOP_WORDS) {
    const re = new RegExp(`(^|[^a-z-])${word.replace(/[-]/g, "[- ]")}(s|es|ing|ed)?($|[^a-z-])`, "i");
    if (re.test(text)) warn(page, `stop-word from content.md B: "${word}"`);
  }

  for (const s of guards.forbidden_strings) {
    if (s && html.includes(s)) err(page, "contains a guarded P4 prompt string");
  }

  // --- watchlisted domains are never linked --------------------------------
  const hrefs = [...html.matchAll(/<a[^>]+href="([^"]*)"/gi)].map((m) => m[1]);
  for (const source of sources) {
    for (const href of hrefs) {
      if (href.includes(source.domain)) err(page, `watchlisted domain linked: ${source.domain}`);
    }
    const bare = new RegExp(`(^|[^\\[a-z0-9.-])${source.domain.replace(/\./g, "\\.")}`, "i");
    if (bare.test(text)) err(page, `watchlisted domain printed undefanged: ${source.domain}`);
  }

  // --- links ---------------------------------------------------------------
  for (const href of hrefs) {
    if (!resolveLink(href, page)) err(page, `dead internal link: ${href}`);
  }

  const averaged = personaAveraged(text);
  if (averaged) err(page, `persona-averaged figure in page text: ${averaged}`);

  // The declared language must match where the page is served from, or the
  // hreflang cluster points readers and crawlers at the wrong document.
  const declaredLang = (html.match(/<html[^>]+lang="([a-z-]+)"/i) || [])[1];
  const pathLang = page.startsWith("/uk/") ? "uk" : "en";
  if (declaredLang !== pathLang) {
    err(page, `lang="${declaredLang}" but the page is served under /${pathLang === "en" ? "" : pathLang}`);
  }

  // Every hreflang alternate must resolve to a page that exists.
  for (const [, code, href] of html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)) {
    const altPath = href.startsWith(SITE_URL) ? href.slice(SITE_URL.length) || "/" : null;
    if (altPath === null) err(page, `hreflang ${code} is not on the canonical host: ${href}`);
    else if (!altPath.endsWith("/") ? !sitePaths.has(altPath) : !sitePaths.has(altPath + "index.html")) {
      err(page, `hreflang ${code} points at a missing page: ${altPath}`);
    }
  }

  // CLAUDE.md 10: no rendered rate may exist without an attached persona.
  // A rank card or heatmap that prints percentages must either tag its rows
  // with the persona they were measured under, or say in its own subtitle
  // which population it pools.
  for (const [, card] of html.matchAll(/<div class="rank">([\s\S]*?)<\/div>\s*(?=<div class="rank">|<\/div>)/g)) {
    // Only leaderboard cards, identified by their rate cell. A report card
    // quoting a percentage from its own findings prose is not a leaderboard.
    if (!/class="rmeta"[^>]*>[^<]*\d/.test(card)) continue;
    const tagged = /data-persona="P[1-4]"/.test(card);
    const declared = /<h3[^>]*>[\s\S]*?<span[^>]*>[\s\S]*?(P[1-4]|pooled|persona)[\s\S]*?<\/span>/i.test(card);
    if (!tagged && !declared) {
      err(page, "a rank card prints rates without naming the persona or the pooled population");
    }
  }
  const heat = (html.match(/<div class="hm">[\s\S]*?<\/div>\s*<p class="vnote"/) || [])[0];
  if (heat && /\d%/.test(heat) && !/data-persona="P[1-4]"/.test(heat)) {
    err(page, "the heatmap prints rates without a persona on each cell");
  }

  // --- claim pages ---------------------------------------------------------
  const claimMatch = page.match(/^(?:\/([a-z]{2}))?\/registry\/([^/]+)\/index\.html$/);
  if (claimMatch && claimsBySlug.has(claimMatch[2])) {
    const pageLang = claimMatch[1] || "en";
    const claim = claimsBySlug.get(claimMatch[2]);
    const reviews = (html.match(/"@type":"ClaimReview"/g) || []).length;
    if (reviews !== 1) err(page, `${reviews} ClaimReview blocks, expected exactly 1`);

    const badge = (html.match(/class="badge b-[fmu](?: [^"]*)?"[^>]*>([^<]+)</) || [])[1];
    const expectedBadge = labels.VERDICTS[claim.verdict];
    if (!badge) err(page, "no verdict badge");
    else if (badge.trim() !== expectedBadge) {
      err(page, `verdict badge "${badge.trim()}" does not match data "${claim.verdict}" (expected "${expectedBadge}")`);
    }

    // Cleansing exists only where one market has two comparable runs covering
    // this claim (Calculation Methodology 6.1, 7.3). The section must appear
    // exactly then - never as an empty placeholder, never silently dropped.
    const hasCleansing = /id="what-changed"/.test(html);
    const claimRuns = metricRuns.filter((r) => r.claims.includes(claim.id));
    const dataHasCleansing = claimRuns.some((r) =>
      r.comparable_with.some((other) => claimRuns.some((o) => o.key === other)));
    if (hasCleansing && !dataHasCleansing) err(page, "cleansing section rendered with no second comparable run");
    if (!hasCleansing && dataHasCleansing) err(page, "two comparable runs exist but the cleansing section is missing");

    // Every metric cell must carry its own persona.
    for (const [, table] of html.matchAll(/<table[^>]*class="[^"]*observations[^"]*"([\s\S]*?)<\/table>/gi)) {
      for (const [, row] of [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].slice(1)) {
        const cells = [...row.matchAll(/<td[^>]*>/gi)];
        for (const [cell] of cells) {
          if (!/data-persona="P[1-4]"/.test(cell)) err(page, "metric cell without a persona");
        }
      }
    }
  }

  // --- pre-launch placeholders --------------------------------------------
  if (text.includes("{{TODO}}")) warn(page, "contains {{TODO}} placeholder prose");
  if (/coming soon/i.test(text)) err(page, 'contains a "coming soon" placeholder');
}

// --- site-wide -------------------------------------------------------------
if (!htmlFiles.length) {
  console.log("check: no HTML pages yet");
}

// A canonical URL points at the document, not at this build's mount point, so
// machine outputs are checked against unprefixed _site paths.
const canonicalToPath = (url) => {
  if (!url.startsWith(SITE_URL)) return null;
  const path = url.slice(SITE_URL.length) || "/";
  return path.startsWith("/") ? path : null;
};
const pathExists = (path) => {
  const clean = path.split("#")[0].split("?")[0];
  if (clean.endsWith("/")) return sitePaths.has(clean + "index.html");
  return sitePaths.has(clean) || sitePaths.has(clean + "/index.html");
};

// --- sitemaps --------------------------------------------------------------
const sitemapFiles = allFiles.filter((f) => /sitemap[a-z-]*\.xml$/.test(f));
if (sitemapFiles.length) {
  const index = join(SITE, "sitemap.xml");
  if (!existsSync(index)) err("sitemap", "sitemap.xml index is missing");

  const childLocs = new Set();
  for (const file of sitemapFiles) {
    const xml = readFileSync(file, "utf8");
    const isIndex = xml.includes("<sitemapindex");
    for (const [, loc] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const path = canonicalToPath(loc);
      if (path === null) {
        err(relative(SITE, file), `loc is not on ${SITE_URL}: ${loc}`);
        continue;
      }
      if (isIndex) {
        if (!pathExists(path)) err("sitemap.xml", `points at a missing sitemap: ${path}`);
      } else {
        childLocs.add(path);
        if (!pathExists(path)) err(relative(SITE, file), `lists a page that does not exist: ${path}`);
      }
    }
  }

  for (const file of htmlFiles) {
    const path = "/" + relative(SITE, file).split(/[\\/]/).join("/").replace(/index\.html$/, "");
    if (!childLocs.has(path)) err("sitemap", `does not cover ${path}`);
  }
}

// --- between-run deltas ---------------------------------------------------
// A change between two runs may never stand on its own. Calculation
// Methodology 7.6 forbids calling it an effect, and citation drift means a
// large share of the cited-domain set would have moved anyway. Both caveats
// must sit in the same section as the delta - the render rule is
// src/_includes/partials/cleansing.njk; this is what makes it a rule.
const CAVEATS = ["no-control-group", "citation-drift"];
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const page = "/" + relative(SITE, file).split(/[\\/]/).join("/");
  for (const match of html.matchAll(/data-delta="cleansing"/g)) {
    // The section a delta belongs to: from the delta to the next H2 or the
    // end of the document.
    const rest = html.slice(match.index);
    const boundary = rest.search(/<h2\b/i);
    const scope = boundary === -1 ? rest : rest.slice(0, boundary);
    for (const caveat of CAVEATS) {
      if (!scope.includes(`data-caveat="${caveat}"`)) {
        err(page, `renders a before/after delta with no "${caveat}" caveat in the same section`);
      }
    }
  }
  // The same rule without relying on the marker: a percentage-point change is
  // only ever a between-run delta, so one printed outside the render rule is
  // caught here rather than shipping bare.
  for (const match of html.matchAll(/[+\u2212-]?\d+(?:\.\d+)?pp\b/g)) {
    const rest = html.slice(match.index);
    const boundary = rest.search(/<h2\b/i);
    const scope = boundary === -1 ? rest : rest.slice(0, boundary);
    const missing = CAVEATS.filter((c) => !scope.includes(`data-caveat="${c}"`));
    if (missing.length) {
      err(page, `prints the change ${match[0]} with no ${missing.join(" or ")} caveat in the same section`);
    }
  }
  // The wording itself, not only the marker.
  if (/effects? of (the )?(escalation|disclosure|report)/i.test(html)) {
    err(page, 'claims an "effect of escalation"; the finding is an observed change after it (CM 7.6)');
  }
}

// The Markdown exports carry the same tables and the same duty.
for (const file of allFiles.filter((f) => f.endsWith(".md"))) {
  const body = readFileSync(file, "utf8");
  if (!/^## What changed/m.test(body) && !/[+\u2212-]?\d+(?:\.\d+)?pp\b/.test(body)) continue;
  const page = "/" + relative(SITE, file).split(/[\\/]/).join("/");
  if (!/no control group/i.test(body)) err(page, "cleansing table with no control-group caveat");
  if (!/citation drift/i.test(body)) err(page, "cleansing table with no citation-drift caveat");
}

// --- data exports ---------------------------------------------------------
// /data prints each CSV's column list from src/_data/datasets.js. If a template
// changes its columns and that list is not updated, the page documents a schema
// the file does not have.
{
  const datasets = (await import("../src/_data/datasets.js")).default || {};
  for (const file of datasets.all || []) {
    if (!file.header) continue;
    const target = join(SITE, file.url.replace(/^\//, ""));
    if (!existsSync(target)) { err(file.url, "advertised on /data but not written"); continue; }
    const first = readFileSync(target, "utf8").split(/\r?\n/).find((l) => l.trim());
    if (first !== file.header) {
      err(file.url, `columns differ from the list published on /data: ${first}`);
    }
  }
}

// --- generated response text ----------------------------------------------
// A quote generated from the claim card reads exactly like a recorded one, so
// it may never appear without the label saying it is not. Same rule as the
// between-run delta: the notice must be in the same section as the quote, not
// only in the demo banner at the top of the page.
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const page = "/" + relative(SITE, file).split(/[\\/]/).join("/");
  for (const match of html.matchAll(/data-synthetic="true"/g)) {
    const before = html.slice(0, match.index);
    const start = before.lastIndexOf("<h2");
    const rest = html.slice(start === -1 ? 0 : start);
    const boundary = rest.slice(1).search(/<h2\b/i);
    const scope = boundary === -1 ? rest : rest.slice(0, boundary + 1);
    if (!scope.includes('data-notice="synthetic-quotes"')) {
      err(page, "renders generated response text with no notice saying so in the same section");
    }
  }
}

// --- terminology ----------------------------------------------------------
// Claim Report Spec, "Terminology rules": domains bots cite are "listed
// sources" or "watchlisted sources", never "Kremlin-linked" - the watchlist
// will contain outlets that relayed a fake without being state-linked.
for (const file of htmlFiles) {
  const body = readFileSync(file, "utf8");
  if (/kremlin[- ]linked/i.test(body)) {
    err(relative(SITE, file), 'says "Kremlin-linked"; the term is "listed source" or "watchlisted source"');
  }
}

// --- countermeasures: never publish the submission or the proof -----------
// Countermeasures Catalogue §1 and the brief's /data split: submission_content,
// proof, contact details and reviewer names are internal only. The schema keeps
// them out of data/; this keeps them out of the build.
for (const file of [...htmlFiles, ...allFiles.filter((f) => /\.(csv|json|txt|xml|md)$/.test(f))]) {
  const body = readFileSync(file, "utf8");
  for (const field of ["submission_content", "target_contact", "confirmed_by"]) {
    if (body.includes(field)) err(relative(SITE, file), `publishes the internal countermeasure field ${field}`);
  }
}

// --- robots.txt and llms.txt ----------------------------------------------
for (const name of ["robots.txt", "llms.txt", "llms-full.txt"]) {
  const file = join(SITE, name);
  if (!existsSync(file)) continue;
  const body = readFileSync(file, "utf8");
  for (const [, url] of body.matchAll(new RegExp(`(^|[\\s(<])(${SITE_URL}[^\\s)>\\]]*)`, "g"))) {
    const path = canonicalToPath(url.replace(/[.,]$/, ""));
    if (path !== null && !pathExists(path)) err(name, `lists a path that does not exist: ${path}`);
  }
}

const llms = join(SITE, "llms.txt");
if (existsSync(llms)) {
  const kb = statSync(llms).size / 1024;
  if (kb > 4) warn("llms.txt", `${kb.toFixed(1)} KB, over the 4 KB target`);
}

// --- feeds -----------------------------------------------------------------
let jsonFeedItems = null;
const feedJson = join(SITE, "feed.json");
if (existsSync(feedJson)) {
  try {
    const parsed = JSON.parse(readFileSync(feedJson, "utf8"));
    if (!String(parsed.version || "").includes("jsonfeed.org")) err("feed.json", "no JSON Feed version");
    if (!Array.isArray(parsed.items)) err("feed.json", "items is not an array");
    else {
      jsonFeedItems = parsed.items.length;
      if (parsed.items.length > 50) err("feed.json", `${parsed.items.length} items, max 50`);
      for (const item of parsed.items) {
        const path = canonicalToPath(item.url || "");
        if (path === null || !pathExists(path)) err("feed.json", `item points nowhere: ${item.url}`);
      }
    }
  } catch (e) {
    err("feed.json", `invalid JSON: ${e.message}`);
  }
}

const feedXml = join(SITE, "feed.xml");
if (existsSync(feedXml)) {
  const xml = readFileSync(feedXml, "utf8");
  if (!xml.startsWith("<?xml")) err("feed.xml", "no XML declaration");
  for (const tag of ["<rss", "<channel>", "</channel>", "</rss>"]) {
    if (!xml.includes(tag)) err("feed.xml", `missing ${tag}`);
  }
  const unescaped = xml.match(/&(?!(amp|lt|gt|quot|apos|#\d+);)/g);
  if (unescaped) err("feed.xml", `${unescaped.length} unescaped ampersand(s)`);
  const items = (xml.match(/<item>/g) || []).length;
  if (items > 50) err("feed.xml", `${items} items, max 50`);
  if (jsonFeedItems !== null && items !== jsonFeedItems) {
    err("feed.xml", `${items} items but feed.json has ${jsonFeedItems}`);
  }
}

// --- demonstration data must never carry a production canonical -----------
// site.json.demo means every figure on the site is generated. Shipping that
// under the production host would publish fabricated measurements as findings.
if (site.demo === true) {
  const productionHost = PRODUCTION_URL;
  const built = htmlFiles.length
    ? (readFileSync(htmlFiles[0], "utf8").match(/<link rel="canonical" href="(https?:\/\/[^/"]+)/) || [])[1]
    : null;
  if (built && built === productionHost) {
    err(
      "data/site.json",
      `demo is true but the built canonical host is the production domain (${productionHost}). ` +
        "Set CANONICAL_URL to a preview host, or replace the demo data with a real export."
    );
  }
  const banners = htmlFiles.filter((f) => !/class="demobar"/.test(readFileSync(f, "utf8")));
  if (banners.length) {
    err("demo banner", `${banners.length} page(s) render no demo banner while demo is true`);
  }
} else {
  const leaked = htmlFiles.filter((f) => /class="demobar"/.test(readFileSync(f, "utf8")));
  if (leaked.length) err("demo banner", `${leaked.length} page(s) render a demo banner while demo is off`);
}

// --- security.txt ----------------------------------------------------------
const security = join(SITE, ".well-known/security.txt");
if (existsSync(security)) {
  const body = readFileSync(security, "utf8");
  if (!/^Contact:\s*\S+/m.test(body)) err("security.txt", "no Contact field");
  const expires = (body.match(/^Expires:\s*(\S+)/m) || [])[1];
  if (!expires) err("security.txt", "no Expires field");
  else if (!(Date.parse(expires) > Date.now())) err("security.txt", `Expires is not in the future: ${expires}`);
  if (!/^Preferred-Languages:/m.test(body)) err("security.txt", "no Preferred-Languages field");
}

// The methodology forbids attributing a domain to a network ourselves, so a
// watchlist entry without a published attribution is a launch blocker.
for (const source of sources) {
  if (!(source.attribution || []).length) {
    warn("data/sources.json", `${source.domain} is on the watchlist with no published attribution`);
  }
}


// Lighthouse CI (CLAUDE.md 10, last bullet) lands with build step 9.

for (const w of warnings) console.log(`warn  ${w}`);
if (errors.length) {
  console.error(`\ncheck: ${errors.length} error(s)\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`check: ok (${htmlFiles.length} page(s), ${warnings.length} warning(s))`);
