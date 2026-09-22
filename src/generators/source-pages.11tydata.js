const { home, crumb } = require("../_lib/crumbs.cjs");
const crumbLabel = (data) => String(data.entry.item.defanged);
const { fitTitle, fitDescription } = require("../_lib/meta.cjs");
const { NETWORK_NAMES } = require("../_lib/labels.cjs");

module.exports = {
  eleventyComputed: {
    lang: (data) => data.entry.lang,
    source: (data) => data.entry.item,
    title: (data) => fitTitle(`${data.entry.item.defanged} — a domain cited by AI chatbots`),
    description: (data) => {
      const s = data.source;
      return fitDescription(
        [
          `${s.defanged} was identified in the Citere sources registry as part of the ${NETWORK_NAMES[s.network] || s.network} network.`,
          s.citedCount
            ? `Cited ${s.citedCount} times in recorded chatbot answers${s.first_seen ? ` since ${s.first_seen}` : ""}.`
            : "Recorded as distributing a claim, not yet observed cited in a chatbot answer.",
          "Attribution, the claims involved and the evidence we logged.",
          "Open data under CC BY 4.0."
        ],
        s.url
      );
    },
    breadcrumbTrail: (data) => [
      home(data.entry.lang),
      crumb(data.entry.lang, "crumb.sources", "/sources/"),
      { title: crumbLabel(data), url: String(data.entry.item.url || data.entry.url) }
    ]
  }
};
