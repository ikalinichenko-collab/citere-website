// Filter states for the sources registry as static URLs: the index has no
// JavaScript, so every combination the spec lists (SR §10.1) that is worth
// having is also a page. Claim, cluster and persona filters are not generated -
// that breakdown lives on the domain page itself, where it belongs.
const sources = require("./publishedSources.js");
const { NETWORK_NAMES, CHATBOTS, WATCHLIST_CATEGORIES } = require("../_lib/labels.cjs");

const TYPES = [
  { type: "network", heading: "Network", values: (s) => [s.network],
    label: (v) => NETWORK_NAMES[v] || v },
  { type: "category", heading: "Category", values: (s) => [s.category],
    label: (v) => WATCHLIST_CATEGORIES[v] || v },
  { type: "chatbot", heading: "Cited by", values: (s) => Object.keys(s.byBot),
    label: (v) => (CHATBOTS[v] || {}).name || v },
  { type: "market", heading: "Market", values: (s) => Object.keys(s.byMarket),
    label: (v) => v.toUpperCase() },
  { type: "flag", heading: "Only", values: (s) => [
      ...(s.injectionCount ? ["injection-lines"] : []),
      ...(s.criticalCount ? ["critical"] : [])],
    label: (v) => (v === "critical" ? "with a critical incident" : "with a source-to-answer line") }
];

const facets = [];
for (const spec of TYPES) {
  const buckets = new Map();
  for (const source of sources) {
    for (const value of spec.values(source) || []) {
      if (!value) continue;
      if (!buckets.has(value)) buckets.set(value, []);
      buckets.get(value).push(source);
    }
  }
  for (const [value, list] of [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    facets.push({
      type: spec.type,
      heading: spec.heading,
      value,
      label: spec.label(value),
      url: `/sources/${spec.type}/${value}/`,
      sources: list.sort((a, b) => b.citedCount - a.citedCount),
      citations: list.reduce((n, s) => n + s.citedCount, 0),
      critical: list.reduce((n, s) => n + s.criticalCount, 0)
    });
  }
}

module.exports = facets;
