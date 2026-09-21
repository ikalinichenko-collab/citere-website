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
    // number. The watchlisted-domains and reports-sent cards return in Wave 2,
    // once the app exports the sources registry and the countermeasures log —
    // hidden now rather than showing demo figures next to the real ones.
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
    monitoredMarkets: (data) => {
      // Values reach eleventyComputed proxy-wrapped for dependency tracking, so
      // the map is walked by key and every value is coerced before use.
      const measured = new Map();
      for (const c of data.profiles.countries) measured.set(String(c.key), c);
      // The figure a reader actually wants on a market card, from the board
      // that already computed it inside one persona and one run.
      const rates = new Map();
      const board = (data.benchmarks.leaderboards || {}).market_repeat || [];
      for (let i = 0; i < board.length; i += 1) {
        rates.set(String(board[i].key), { rate: board[i].value, persona: String(board[i].persona) });
      }
      return Object.keys(data.countries).map((key) => {
        const iso = String(key);
        const meta = data.countries[iso];
        const m = measured.get(iso);
        const measuredRate = rates.get(iso) || null;
        return {
          iso,
          name: String(meta.name),
          rate: measuredRate && measuredRate.rate,
          ratePersona: measuredRate && measuredRate.persona,
          language: String(meta.language),
          scheduled: !m,
          url: m && data.navigation.has.countries ? m.url : null,
          claims: m ? m.claims.length : 0,
          answers: m ? m.answers : 0,
          // A queued market has no measurement to show, so the card carries the
          // two things that are true about it: how many claims a run would put
          // to how many assistants.
          queued: data.runs.latest ? data.runs.latest.claims_count : 0,
          botCount: (data.metrics.dimensions.chatbots || []).length,
          bots: m ? m.bots.slice(0, 6).map((b) => b.key) : (data.metrics.dimensions.chatbots || [])
        };
      });
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
