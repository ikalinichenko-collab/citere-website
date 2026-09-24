// Site-wide data. Counters in data/site.json are placeholders: they are
// recomputed here from the published feeds on every build and the stored values
// are ignored (CLAUDE.md section 5.5).
const { readJson } = require("../_lib/markdown.cjs");
const published = require("./published.js");
const publishedSources = require("./publishedSources.js");
const countermeasures = require("./countermeasures.js");
const countriesReport = require("./countriesReport.js");
const platformsReport = require("./platformsReport.js");

const site = readJson("data/site.json");

// Catalogue §2.4 and §2.6 are internal: a catalog update and a dataset
// publication are things we did to our own records, not things we sent anyone.
// A re-measurement is our own re-run and is already excluded by `taken`.
const INTERNAL = new Set(["catalog", "github"]);
const ANSWERED = new Set(["acknowledged", "responded", "closed", "declined"]);

const sent = countermeasures.actions.filter((e) => e.taken && !INTERNAL.has(e.type));
const answered = sent.filter((e) => e.response_date || ANSWERED.has(e.status));
const actioned = sent.filter((e) => e.status === "responded" || e.status === "closed");

const responseDays = answered
  .filter((e) => e.response_date)
  .map((e) => (Date.parse(e.response_date) - Date.parse(e.date)) / 86400000)
  .sort((a, b) => a - b);
const median = responseDays.length
  ? Math.round(responseDays[Math.floor(responseDays.length / 2)])
  : null;

const index = published.index || [];
const reports = Object.values(published.reports || {});
const sumStrip = (field) => index.reduce((n, it) => n + (Number((it.strip || {})[field]) || 0), 0);

const publishedAt = index.map((r) => r.publishedAt).filter(Boolean).sort();
const lastUpdate = [site.last_update, ...publishedAt.map((d) => String(d).slice(0, 10))]
  .filter(Boolean)
  .sort()
  .pop();

module.exports = {
  ...site,
  // The canonical host. Defaults to the production domain; CANONICAL_URL
  // overrides it for a preview deploy, which is what lets a demo build ship
  // somewhere that is not production (see scripts/check.mjs).
  url: (process.env.CANONICAL_URL || `https://${site.domain}`).replace(/\/+$/, ""),
  productionUrl: `https://${site.domain}`,
  isDemo: site.demo === true,
  counters: {
    claims: index.length,
    clusters: new Set(index.map((r) => String(r.clusterName || ""))).size,
    chatbots: (platformsReport.chatbots || []).length,
    personas: 4,
    markets: (countriesReport.countries || []).length,
    runs: new Set(
      reports.flatMap((r) => ((r.payload && r.payload.meta && r.payload.meta.runKeys) || []))
    ).size,
    languages: new Set(
      (countriesReport.countries || []).map((c) => c.language).filter(Boolean)
    ).size,
    domains: publishedSources.length,
    responses: sumStrip("answers"),
    quarantined: 0,
    unresolved: 0,
    critical: sumStrip("critical"),
    countermeasures_sent: sent.length,
    countermeasures_answered: answered.length,
    countermeasures_actioned: actioned.length,
    countermeasures_taken: countermeasures.totals.taken,
    countermeasures_total: countermeasures.totals.logged,
    remeasurements: countermeasures.totals.remeasurements,
    median_response_days: median
  },
  last_update: lastUpdate
};
