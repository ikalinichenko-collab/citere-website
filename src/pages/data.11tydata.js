module.exports = {
  eleventyComputed: {
    // The citation string carries the release version, so it comes from data.
    figures: (data) => ({
      year: String(data.site.last_update).slice(0, 4),
      version: data.site.watchlist_version
    }),
    // A real record of each entity, so the page shows the schema rather than
    // describing it. Taken from the same objects the exports are written from.
    samples: (data) => ({
      claims: data.claims[0] ? data.claims[0].raw : null,
      runs: data.runs.all[0] || null,
      cells: data.metrics.cells[0] || null,
      registry: (() => {
        const s = data.publishedSources.find((x) => x.citedCount) || data.publishedSources[0];
        return s ? {
          domain: s.domain, category: s.category, network: s.network, language: s.language,
          attributed_by: (s.attribution || []).map((a) => a.org),
          cited_total: s.citedCount, critical_count: s.criticalCount,
          claims_distributed: s.claimsDistributed.map((c) => c.id),
          claims_reached: s.claimsReached.map((c) => c.id),
          claims_injection: s.claimsInjection.map((c) => c.id),
          cited_by_bot: s.byBot, cited_by_market: s.byMarket, cited_by_persona: s.byPersona
        } : null;
      })(),
      countermeasures: (() => {
        const a = data.countermeasures.actions[0];
        return a ? {
          id: a.id, date: a.date, type: a.type, kind: a.kind, subtype: a.subtype,
          target: a.target, market: a.market, claim_ids: a.claims, status: a.status,
          taken: a.taken, response_date: a.response_date, follow_up_due: a.follow_up_due
        } : null;
      })()
    })
  }
};
