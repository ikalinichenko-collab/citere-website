// The homepage blocks fill in as their data lands: the strip, metric cards,
// findings table, rankings, case study and markets grid each render only when
// the data behind them exists (CLAUDE.md 6, 11.6).
module.exports = {
  eleventyComputed: {
    figures: (data) => ({
      claims: `${data.site.counters.claims} documented false ${data.site.counters.claims === 1 ? "claim" : "claims"}`,
      chatbots: data.site.counters.chatbots,
      languages: data.site.counters.languages,
      // External figure: it is in data/site.json with what it measures, so the
      // headline does not type a statistic (CLAUDE.md 11.1).
      budget: ((data.site.external_figures || {}).russia_propaganda_budget || {}).display || ""
    }),
    quoteFigures: (data) => data.benchmarks.headline || null,
    // The four metric cards. A card appears only once its counter has a
    // source: domains and reports arrive with sources and countermeasures.
    metricCards: (data) => {
      const c = data.site.counters;
      const b = data.benchmarks;
      const cards = [];
      if (c.claims) {
        cards.push({ value: c.claims, label: `false ${c.claims === 1 ? "claim" : "claims"} documented`,
          sub: `across ${c.clusters} ${c.clusters === 1 ? "topic" : "topics"}` });
      }
      if (b.responses || c.responses) {
        cards.push({ value: b.responses || c.responses, label: "answers recorded and checked",
          sub: `${c.chatbots} assistants · ${c.personas} ways of asking` });
      }
      if (c.domains) {
        cards.push({ value: c.domains, label: "watchlisted sites the answers cited",
          sub: `watchlist ${data.site.watchlist_version}` });
      }
      if (c.countermeasures_sent) {
        cards.push({ value: c.countermeasures_sent, label: "reports sent to the platforms",
          sub: `${c.countermeasures_answered} answered · ${c.countermeasures_actioned} acted on` });
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
