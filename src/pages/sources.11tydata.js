module.exports = {
  eleventyComputed: {
    figures: (data) => ({
      domains: `${data.publishedSources.length} ${data.publishedSources.length === 1 ? "domain" : "domains"}`,
      version: data.publishedSources.version || data.site.watchlist_version,
      updated: data.publishedSources.updated || data.site.last_update
    }),
    networkList: (data) => [...new Set(data.publishedSources.map((s) => s.network))],
    // Count tiles only — nothing here is a rate, so no persona is needed. Domains
    // and social channels are counted together ("sources"); the confirmed/review
    // split and the citation reach are scoped to confirmed (blacklist) sources, so
    // the block reads top-to-bottom as one story. The demo feed does not attribute
    // repeat/critical/injection counts to confirmed sources (they land on the
    // candidate review queue), so those are deliberately not shown here.
    sourceTiles: (data) => {
      const all = [...data.publishedSources, ...(data.publishedPlatforms || [])];
      const confirmed = all.filter((s) => s.listStatus !== "candidate");
      const underReview = all.filter((s) => s.listStatus === "candidate");
      const assistants = new Set();
      for (const s of confirmed) for (const b of s.citedBy || []) assistants.add(b);
      return [
        { value: all.length, label: "sources tracked" },
        { value: `${confirmed.length} / ${underReview.length}`, label: "confirmed · under review", colour: "var(--mislead)" },
        { value: confirmed.reduce((n, s) => n + (s.citedCount || 0), 0), label: "citations of confirmed sources", colour: "var(--false)" },
        { value: assistants.size, label: "assistants cited them", colour: "var(--accent)" }
      ];
    },
    articleEvidence: (data) =>
      data.publishedSources.flatMap((s) => (s.article_evidence || []).map((a) => ({ ...a, domain: s.domain }))),
    dataset: (data) => ({
      name: "Citere domain watchlist",
      description:
        "Public subset of the domains attributed to Russian influence networks that Citere has recorded in AI chatbot citations.",
      keywords: ["domain watchlist", "STIX", "Russian influence operations", "AI chatbots"]
    })
  }
};
