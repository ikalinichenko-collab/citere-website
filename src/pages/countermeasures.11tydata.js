module.exports = {
  eleventyComputed: {
    figures: (data) => ({
      total: data.countermeasures.total,
      answered: data.countermeasures.answered,
      median: data.countermeasures.medianResponseDays
        ? `, median response time ${data.countermeasures.medianResponseDays} days`
        : ""
    }),
    // Four count tiles — nothing here is a rate, so no persona is needed. "taken &
    // sent" is the honest reframing of the old "taken" (every logged action was
    // carried out, none are drafts); markets and channels are the real reach. The
    // empty pipeline states (awaiting confirmation, drafts, re-measurements) are
    // not shown while they are all zero (Countermeasures Catalogue §0) — they
    // return as data arrives. Colours mirror the registry tiles.
    cmTiles: (data) => {
      const t = data.countermeasures.totals;
      return [
        { value: t.logged, label: "actions logged", colour: "var(--accent)" },
        { value: t.taken, label: "taken & sent", colour: "var(--ok)" },
        { value: t.marketsCovered, label: "markets covered", colour: "var(--mislead)" },
        { value: t.channels, label: "channels shared to" }
      ];
    },
    actionTypes: (data) =>
      data.countermeasures.types.filter((t) => t.count).sort((a, b) => b.count - a.count),
    dataset: (data) => ({
      name: "Citere countermeasures log",
      description:
        "Public log of reports to platforms and registrars, data shared with partners, and re-measurements, with dates and response status.",
      keywords: ["countermeasures log", "responsible disclosure", "AI chatbots", "disinformation"]
    })
  }
};
