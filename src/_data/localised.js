// Every generated page, once per language. Eleventy paginates one dimension at
// a time, so the language dimension is folded in here.
const build = require("./build.js");
const claims = require("./claims.js");
const facets = require("./facets.js");
const sources = require("./publishedSources.js");
const sourceFacets = require("./sourceFacets.js");
const countermeasureFacets = require("./countermeasureFacets.js");
const benchmarks = require("./benchmarks.js");
const platformsReport = require("./platformsReport.js");
const countriesReport = require("./countriesReport.js");
const reports = require("./reports.js");

const expand = (items, urlOf) =>
  build.languages.flatMap((lang) =>
    items.map((item) => ({ lang, item, url: lang === "en" ? urlOf(item) : `/${lang}${urlOf(item)}` }))
  );

module.exports = {
  languages: build.languages,
  claims: expand(claims, (c) => c.url),
  facets: expand(facets, (f) => f.url),
  sources: expand(sources, (s) => s.url),
  sourceFacets: expand(sourceFacets, (f) => f.url),
  countermeasureFacets: expand(countermeasureFacets, (f) => f.url),
  // Issue detail pages exist only when the app's run feed backs them (variant 2);
  // in the claim-report fallback, issues link to the Registry cluster facet and
  // no detail page is generated.
  benchmarkIssues: expand(benchmarks.issues.filter((i) => i.hasDetail), (i) => i.url),
  chatbots: expand(platformsReport.chatbots, (p) => p.url),
  countries: expand(countriesReport.countries, (p) => p.url),
  reports: expand(reports, (r) => r.url)
};
