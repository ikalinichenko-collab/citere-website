// The homepage blocks fill in as their data lands: the strip, metric cards,
// findings table, rankings, case study and markets grid each render only when
// the data behind them exists (CLAUDE.md 6, 11.6).
// Real homepage totals, summed from the published Claim Report feed (variant
// B-full: the app is the source of truth). claims/clusters/responses come from
// the index summaries; the distinct assistants and markets come from each
// report's frozen meta. Empty feed → zeros, and the cards below hide themselves.
function realTotals(data) {
  const index = (data.published && data.published.index) || [];
  const reports = (data.published && data.published.reports) || {};
  const sum = (field) => index.reduce((n, it) => n + (Number((it.strip || {})[field]) || 0), 0);
  const bots = new Set();
  const markets = new Set();
  for (const rep of Object.values(reports)) {
    const meta = (rep.payload && rep.payload.meta) || {};
    for (const b of meta.bots || []) bots.add(String(b));
    for (const m of meta.countries || []) markets.add(String(m));
  }
  return {
    claims: index.length,
    clusters: new Set(index.map((it) => String(it.clusterName))).size,
    responses: sum("answers"),
    critical: sum("critical"),
    // Fall back to the widest per-report count if the full reports are not loaded.
    bots: bots.size || index.reduce((m, it) => Math.max(m, Number((it.strip || {}).botsTested) || 0), 0),
    markets: markets.size || index.reduce((m, it) => Math.max(m, Number((it.strip || {}).countries) || 0), 0),
    personas: 4
  };
}

module.exports = {
  eleventyComputed: {
    figures: (data) => {
      const r = realTotals(data);
      return {
        claims: `${r.claims} documented false ${r.claims === 1 ? "claim" : "claims"}`,
        chatbots: r.bots,
        // Languages are not carried on the report feed yet; still from site config.
        languages: data.site.counters.languages,
        // External figure: it is in data/site.json with what it measures, so the
        // headline does not type a statistic (CLAUDE.md 11.1).
        budget: ((data.site.external_figures || {}).russia_propaganda_budget || {}).display || ""
      };
    },
    quoteFigures: (data) => data.benchmarks.headline || null,
    // The "Updated" stamp: the newest published-report date, not the static
    // site.json value. Falls back to site.last_update when the feed is empty.
    lastUpdate: (data) => {
      const newest = ((data.published && data.published.index) || [])
        .map((r) => r.publishedAt)
        .filter(Boolean)
        .sort()
        .pop();
      return newest ? String(newest).slice(0, 10) : data.site.last_update;
    },
    // "Latest findings" — the published Claim Reports, newest first, top 6. Same
    // feed and card as the Registry (report-cards.njk), so the homepage and the
    // Registry never disagree on the claim count. Empty feed → [] and the block
    // hides itself.
    latestReports: (data) => {
      const idx = ((data.published && data.published.index) || []).slice();
      idx.sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
      return idx.slice(0, 6);
    },
    // Metric cards from real published totals. Each appears only when it has a
    // number. Countermeasures stay hidden until the app exports that log — do not
    // mix an empty/demo log with real claim figures.
    metricCards: (data) => {
      const r = realTotals(data);
      const cards = [];
      if (r.claims) {
        cards.push({ value: r.claims, label: `false ${r.claims === 1 ? "claim" : "claims"} documented`,
          sub: `across ${r.clusters} ${r.clusters === 1 ? "topic" : "topics"}` });
      }
      if (r.responses) {
        cards.push({ value: r.responses, label: "answers recorded and checked",
          sub: `${r.bots} assistants · ${r.personas} ways of asking` });
      }
      const domains = (data.publishedSources && data.publishedSources.length) || 0;
      if (domains) {
        cards.push({ value: domains, label: domains === 1 ? "watchlisted domain" : "watchlisted domains",
          sub: "cited while answering about a published claim" });
      }
      return cards;
    },
    // Three summary facts, each one a question a reader arrives with: where is
    // it worst, which assistant is worst, and what kind of lie gets through.
    // Every card is one persona and one run, and says so (CM 5.1).
    rankingCards: (data) => {
      const lb = data.benchmarks.leaderboards || {};
      const run = `${data.benchmarks.marketName}, ${data.benchmarks.label}`;
      const cards = [];
      if ((lb.market_repeat || []).length) {
        cards.push({
          rows: lb.market_repeat, flag: true, idx: true, bar: true,
          title: "Countries where the claims get through",
          sub: "news question (P2)",
          note: "Share of answers that stated a false claim as fact. The same claims everywhere, asked in each country\u2019s own language.",
          more: data.navigation.has.countries ? "/countries/" : "/benchmarks/",
          moreLabel: "All countries"
        });
      }
      if ((lb.chatbot_repeat || []).length) {
        cards.push({
          rows: lb.chatbot_repeat.map((row) => ({ ...row, chatbot: row.key })), idx: true, bar: true,
          title: "Assistants that repeat it most often",
          sub: "news question (P2)",
          note: `Same questions, same day, put to every assistant. How often each one answered with the false claim — ${run}.`,
          more: data.navigation.has.chatbots ? "/platforms/" : "/benchmarks/",
          moreLabel: "All assistants"
        });
      }
      if ((lb.splice_repeat || []).length) {
        cards.push({
          rows: lb.splice_repeat.map((row) => ({ ...row, label: row.short || row.label })),
          idx: false, bar: true,
          title: "The kind of lie that works best",
          sub: "news question (P2)",
          note: `How the false claim is attached to the truth. An invention gets refuted; a real event with one fact changed gets repeated — ${run}.`,
          more: data.navigation.has.registry ? "/registry/" : "/methodology/",
          moreLabel: "Claims by type"
        });
      }
      return cards;
    },
    // Cluster is a field on a claim, used for filtering and for grouping in
    // Benchmarks. It is not navigation, so the homepage no longer offers it as
    // a section (CLAUDE_CODE_BRIEF §1 "Remove entirely").
    // The four market cards, straight from the country profiles.
    // Every market on the monitoring list, in the order data/countries.json
    // sets. A measured market shows what the run found and links to its page;
    // a scheduled one says so and links nowhere, because there is no page to
    // link to yet.
    // Market cards, from the published-report country feed (countriesReport): a
    // measured market shows its worst assistant's headline rate and links to its
    // page; a scheduled one (on the monitoring list, no published run) says so.
    monitoredMarkets: (data) => {
      const cr = data.countriesReport || {};
      const allBots = (cr.chatbots || []).slice(0, 6).map((b) => String(b.key));
      const measured = (cr.countries || []).map((c) => ({
        iso: String(c.key),
        name: String(c.name),
        rate: c.worst && c.worst.repeat_rate ? c.worst.repeat_rate.rate : null,
        ratePersona: c.persona,
        language: String(c.language || ""),
        scheduled: false,
        url: data.navigation.has.countries ? c.url : null,
        claims: (c.claims || []).length,
        answers: c.answers,
        queued: 0,
        botCount: (c.bots || []).length,
        bots: (c.bots || []).slice(0, 6).map((b) => String(b.key)),
      }));
      const scheduled = (cr.scheduled || []).map((s) => ({
        iso: String(s.iso),
        name: String(s.name),
        rate: null,
        ratePersona: null,
        language: String(s.language || ""),
        scheduled: true,
        url: null,
        claims: 0,
        answers: 0,
        queued: 0,
        botCount: allBots.length,
        bots: allBots,
      }));
      return [...measured, ...scheduled];
    },
    // The two counts the markets lead needs, so the sentence carries numbers
    // without a template typing one (CLAUDE.md 11.1).
    marketCounts: (data) => {
      const rows = data.monitoredMarkets || [];
      const measured = rows.filter((r) => !r.scheduled).length;
      return { total: rows.length, measured, queued: rows.length - measured };
    },
    trustCards: (data) => [
      { key: "trust-method", href: "/methodology/", label: "Methodology", on: data.navigation.has.methodology },
      { key: "trust-data", href: "/data/", label: "Data", on: data.navigation.has.data },
      { key: "trust-actions", href: "/countermeasures/", label: "Countermeasures", on: data.navigation.has.countermeasures },
      { key: "trust-corrections", href: "/about/#corrections", label: "Corrections", on: data.navigation.has.about }
    ].map((c) => (c.on ? c : { ...c, href: null }))
  }
};
