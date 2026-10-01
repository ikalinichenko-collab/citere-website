const MONTHS = require("../_lib/labels.cjs").MONTHS;
const published = require("../_data/published.js");
const displayDate = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
};

module.exports = {
  eleventyComputed: {
    // Driven by the published Claim Report feed, not the demo seed: the count is
    // the number of published reports, and "updated" is the newest publish date.
    figures: () => {
      const idx = published.index;
      const newest = idx
        .map((r) => r.publishedAt)
        .filter(Boolean)
        .sort()
        .pop();
      return {
        claims: `${idx.length} ${idx.length === 1 ? "claim" : "claims"}`,
        updated: newest ? displayDate(newest) : "—"
      };
    },
    // The index now lists the published Claim Reports the app has frozen for the
    // site. Empty-safe: no feed → publishedReports is [] and the page shows its
    // empty state.
    publishedReports: () => published.index,
    // Count tiles only — nothing here is a rate, so nothing needs a persona. The
    // lead tiles are the findings a reader cares about, not the catalogue size:
    // how many answers repeated a lie, how many times we acted, how severe it got.
    publishedTiles: () => {
      const idx = published.index;
      const sum = (field) => idx.reduce((n, r) => n + ((r.strip && r.strip[field]) || 0), 0);
      return [
        { value: sum("repeatedFake"), label: "answers repeated a false claim", colour: "var(--mislead)" },
        { value: sum("countermeasuresTaken"), label: "countermeasures taken", colour: "var(--ok)" },
        { value: sum("critical"), label: "critical incidents", colour: "var(--false)" },
        { value: sum("sourcesIdentified"), label: "sources identified", colour: "var(--accent)" },
        { value: sum("answers"), label: "answers examined" }
      ];
    },
    dataset: () => ({
      name: "Citere claim registry",
      description:
        "Documented false claims about Ukraine found in public AI chatbot answers, with per-cell metrics, countermeasures and re-measurements.",
      keywords: ["disinformation", "AI chatbots", "Ukraine", "fact-checking", "Russian influence operations"],
      // Countries covered by the published reports, read from their frozen payloads.
      spatialCoverage:
        [...new Set(
          Object.values(published.reports).flatMap((r) => ((r.payload && r.payload.meta && r.payload.meta.countries) || []))
        )].map((c) => String(c).toUpperCase()).join(", ") || undefined
    })
  }
};
