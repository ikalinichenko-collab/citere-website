const { home, crumb } = require("../_lib/crumbs.cjs");
const crumbLabel = (data) => String(data.entry.item.name);
const { fitTitle, fitDescription } = require("../_lib/meta.cjs");

module.exports = {
  eleventyComputed: {
    lang: (data) => data.entry.lang,
    profile: (data) => data.entry.item,
    title: (data) => fitTitle(`${data.entry.item.name} and Russian disinformation on Ukraine — Citere`),
    description: (data) => {
      const p = data.profile;
      const pct = (v) => `${Math.round((v || 0) * 1000) / 10}%`;
      return fitDescription(
        [
          `How ${p.name} (${p.company}) handled documented false claims about Ukraine:`,
          `${pct(p.repeatRate)} repeat-rate on the topical-news persona,`,
          `${pct(p.contaminationRate)} of answers cited a watchlisted domain.`,
          "Per persona and per market."
        ],
        p.url
      );
    },
    articleHeadline: (data) => `How ${data.entry.item.name} handles Russian disinformation about Ukraine`,
    articlePublished: (data) => data.site.last_update,
    articleModified: (data) => data.site.last_update,
    dataset: (data) => ({
      name: `Citere observations: ${data.entry.item.name}`,
      description: `Recorded answers from ${data.entry.item.name}, per persona and per market.`,
      keywords: [data.entry.item.name, "AI chatbots", "disinformation", "Ukraine"]
    }),
    breadcrumbTrail: (data) => [
      home(data.entry.lang),
      crumb(data.entry.lang, "crumb.benchmarks", "/benchmarks/"),
      { title: crumbLabel(data), url: String(data.entry.item.url || data.entry.url) }
    ]
  }
};
