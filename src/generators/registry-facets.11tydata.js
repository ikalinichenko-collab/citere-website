// Registry facet pages: /registry/cluster/{slug}/ and /registry/splice/{slug}/,
// one filtered view of the published Claim Reports per cluster and per splice.
// Paginated over published.facetEntries (built in src/_data/published.js).
const { home, crumb } = require("../_lib/crumbs.cjs");
const { fitTitle, fitDescription } = require("../_lib/meta.cjs");

module.exports = {
  eleventyComputed: {
    lang: (data) => data.facet.lang,
    facetH1: (data) =>
      data.facet.kind === "cluster"
        ? `False claims in the “${data.facet.label}” topic`
        : `False claims — ${data.facet.label}`,
    facetLede: (data) =>
      data.facet.kind === "cluster"
        ? "Every documented false claim in this topic that a public AI assistant reproduced, worst first."
        : "Every documented false claim built this way — how the lie is attached to the truth — that a public AI assistant reproduced.",
    title: (data) => fitTitle(`${data.facet.label} — Registry — Citere`),
    description: (data) =>
      fitDescription(
        [
          data.facet.kind === "cluster"
            ? `Documented false claims in the “${data.facet.label}” topic that public AI assistants reproduced.`
            : `Documented false claims of ${data.facet.label} — how the lie is attached to the truth — that public AI assistants reproduced.`,
          "Each report carries the verdict, the evidence and the assistants that repeated it.",
          "Rates are reported per persona, market and run and never averaged.",
          "A filtered view of the Citere registry."
        ],
        `registry ${data.facet.slug}`
      ),
    breadcrumbTrail: (data) => [
      home(data.facet.lang),
      crumb(data.facet.lang, "crumb.registry", "/registry/"),
      { title: data.facet.label, url: String(data.facet.url) }
    ]
  }
};
