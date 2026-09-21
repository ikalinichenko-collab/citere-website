const { home, crumb } = require("../_lib/crumbs.cjs");
const { fitTitle, fitDescription } = require("../_lib/meta.cjs");

module.exports = {
  eleventyComputed: {
    lang: (data) => data.entry.lang,
    issue: (data) => data.entry.item,
    title: (data) => fitTitle(`${data.entry.item.clusterName} — ${data.entry.item.monthLabel} benchmark`),
    description: (data) => {
      const i = data.entry.item;
      return fitDescription(
        [
          `${i.claimsCount} claims of the ${i.clusterName} cluster, put to the assistants in ${i.markets.length} markets during ${i.monthLabel}.`,
          `${i.responses} valid answers, compared market by market and never merged.`,
          "Coverage, the grain-of-truth split and the escalation matrix for this issue.",
          "Open data under CC BY 4.0."
        ],
        i.url
      );
    },
    breadcrumbTrail: (data) => [
      home(data.entry.lang),
      crumb(data.entry.lang, "crumb.benchmarks", "/benchmarks/"),
      { title: String(data.entry.item.monthLabel), url: String(data.entry.item.url) }
    ]
  }
};
