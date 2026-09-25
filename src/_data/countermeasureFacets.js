// The countermeasures log has no JavaScript, so every filter the brief lists
// (§4, "/countermeasures") is also a URL. Free-text search is the one filter
// that cannot be a page; the CSV export covers it.
const countermeasures = require("./countermeasures.js");
const { COUNTERMEASURE_TYPES, COUNTERMEASURE_STATUSES, REMEASUREMENT } = require("../_lib/labels.cjs");

// A non-latin target (e.g. a Cyrillic recipient like "ЦПД") strips down to an
// empty ascii slug, which would yield "/countermeasures/target//" — a double
// slash Eleventy collapses, breaking the sitemap. Fall back to a percent-encoded
// segment so every target keeps a stable, non-empty facet URL.
const slug = (s) => {
  const ascii = String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return ascii || encodeURIComponent(String(s).trim());
};

const TYPES = [
  { type: "type", heading: "Type", values: (a) => [a.displayType],
    label: (v) => (v === REMEASUREMENT.key ? REMEASUREMENT.label : (COUNTERMEASURE_TYPES[v] || {}).label || v),
    key: (v) => v },
  { type: "status", heading: "Status", values: (a) => [a.status],
    label: (v) => (COUNTERMEASURE_STATUSES[v] || {}).label || v, key: (v) => v },
  { type: "target", heading: "Target", values: (a) => (a.target ? [a.target] : []),
    label: (v) => v, key: slug },
  { type: "market", heading: "Country", values: (a) => (a.market ? [a.market] : []),
    label: (v) => v.toUpperCase(), key: (v) => v },
  { type: "claim", heading: "Claim", values: (a) => a.claims, label: (v) => v, key: (v) => v.toLowerCase() }
];

const facets = [];
for (const spec of TYPES) {
  const buckets = new Map();
  for (const action of countermeasures.actions) {
    for (const value of spec.values(action) || []) {
      if (!value) continue;
      if (!buckets.has(value)) buckets.set(value, []);
      buckets.get(value).push(action);
    }
  }
  for (const [value, list] of [...buckets.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    facets.push({
      type: spec.type,
      heading: spec.heading,
      value,
      label: spec.label(value),
      url: `/countermeasures/${spec.type}/${spec.key(value)}/`,
      actions: list,
      taken: list.filter((a) => a.taken).length,
      awaiting: list.filter((a) => a.awaitingConfirmation).length
    });
  }
}

module.exports = facets;
