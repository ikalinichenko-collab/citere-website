// Published Claim Reports handed to the site by the app's exporter as frozen
// JSON. The site is a pure renderer: it reads these two inputs and computes
// nothing about the findings.
//
//   data/claim-index.json        — array of report summaries → the Registry index
//   data/claim-reports/{slug}.json — one full report (summary + payload + analyst)
//
// Neither file exists until the exporter has run at least once, so this loader
// is empty-safe: no feed → the site still builds, the Registry index shows its
// empty state and no report pages are generated.
const fs = require("node:fs");
const path = require("node:path");
const { slugify } = require("../_lib/markdown.cjs");

const DATA = path.join(__dirname, "..", "..", "data");
const INDEX = path.join(DATA, "claim-index.json");
const REPORTS_DIR = path.join(DATA, "claim-reports");

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

// The index: an array of summaries. Anything malformed collapses to [].
const index = (() => {
  const raw = readJson(INDEX, []);
  return Array.isArray(raw) ? raw : [];
})();

// Every full report, keyed by slug. A missing directory → {}.
const reports = (() => {
  const out = {};
  let files = [];
  try {
    files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return out;
  }
  for (const file of files) {
    const report = readJson(path.join(REPORTS_DIR, file), null);
    if (report && report.slug) out[report.slug] = report;
  }
  return out;
})();

// The generator paginates over this list. Prefer the index order (worst first,
// as the exporter froze it); fall back to whatever full reports exist so a
// report is renderable even if it is missing from the index.
const list = index.length
  ? index.map((entry) => reports[entry.slug]).filter(Boolean)
  : Object.values(reports);

// One entry per report per language, folded here because Eleventy paginates a
// single dimension at a time (same pattern as src/_data/localised.js). English
// content is rendered for both languages in v1; the uk/ page exists so
// breadcrumbs and hreflang resolve. Empty list → no report pages.
const build = require("./build.js");
const entries = build.languages.flatMap((lang) =>
  list.map((report) => ({
    lang,
    report,
    url: lang === "en" ? `/registry/${report.slug}/` : `/${lang}/registry/${report.slug}/`
  }))
);

// Registry facets: the published summaries grouped by cluster and by splice, for
// the Registry filter chips and the /registry/{cluster,splice}/{slug}/ pages.
// Slugs come from the shared slugify, so a report's badge link, a filter chip and
// the facet page's own permalink all resolve to the same URL.
function group(keyOf, labelOf) {
  const map = new Map();
  for (const r of index) {
    const value = keyOf(r);
    if (value == null || value === "") continue;
    const slug = slugify(String(value));
    if (!slug) continue;
    let g = map.get(slug);
    if (!g) map.set(slug, (g = { slug, value: String(value), label: labelOf(String(value)), reports: [] }));
    g.reports.push(r);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}
const facets = {
  clusters: group((r) => r.clusterName, (v) => v),
  splices: group((r) => r.splice, (v) => `Splice ${v}`)
};

// One page per facet per language (same fold as entries), for the facet generator.
const facetEntries = build.languages.flatMap((lang) => {
  const at = (kind, f) => ({
    kind, slug: f.slug, label: f.label, value: f.value, reports: f.reports, lang,
    url: `${lang === "en" ? "" : `/${lang}`}/registry/${kind}/${f.slug}/`
  });
  return [
    ...facets.clusters.map((f) => at("cluster", f)),
    ...facets.splices.map((f) => at("splice", f))
  ];
});

// claimKey → its report URL. Surfaces that reference a claim by key (the
// countermeasures log links each action's claims to their pages) resolve it here
// instead of the seed `claims` collection, which is empty once demo is off.
const claimLinks = index
  .filter((entry) => entry && entry.claimKey && entry.slug)
  .map((entry) => ({ id: entry.claimKey, url: `/registry/${entry.slug}/` }));

module.exports = { index, reports, list, entries, facets, facetEntries, claimLinks };
