// Feed entries: published Claim Reports, newest first, capped at 50.
// Demo seed cards and monitor stubs are not listed once the app feed is live.
const published = require("./published.js");
const { VERDICTS } = require("../_lib/labels.cjs");

const items = (published.index || [])
  .map((r) => {
    const strip = r.strip || {};
    const verdict = VERDICTS[r.verdict] || String(r.verdict || "").toUpperCase();
    return {
      kind: "claim",
      url: `/registry/${r.slug}/`,
      title: `${verdict}: ${r.label}`,
      summary: [
        `Verdict ${r.verdict}.`,
        `${strip.answers || 0} recorded answers across ${strip.countries || 0} markets;`,
        `${strip.repeatedFake || 0} repeated the fake, ${strip.critical || 0} critical.`,
        `${strip.botsTested || 0} assistants tested.`
      ].join(" "),
      published: String(r.publishedAt || "").slice(0, 10),
      updated: String(r.publishedAt || "").slice(0, 10)
    };
  })
  .sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0))
  .slice(0, 50);

module.exports = { items, latest: items[0] ? items[0].updated : null };
