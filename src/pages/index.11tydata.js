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
          sub: `${c.clusters} ${c.clusters === 1 ? "cluster" : "clusters"}` });
      }
      if (b.responses || c.responses) {
        cards.push({ value: b.responses || c.responses, label: "chatbot answers analysed",
          sub: `${c.chatbots} assistants · ${c.personas} personas` });
      }
      if (c.domains) {
        cards.push({ value: c.domains, label: "watchlisted domains cited",
          sub: `watchlist ${data.site.watchlist_version}` });
      }
      if (c.countermeasures_sent) {
        cards.push({ value: c.countermeasures_sent, label: "reports sent to platforms",
          sub: `${c.countermeasures_answered} answered · ${c.countermeasures_actioned} actioned` });
      }
      return cards;
    },
    rankingCards: (data) => {
      const lb = data.benchmarks.leaderboards || {};
      const cards = [];
      if ((lb.chatbot_repeat || []).length) {
        cards.push({ rows: lb.chatbot_repeat, title: "Chatbots by repeat-rate", sub: "P2 · topical news",
          idx: true, bar: true, more: data.navigation.has.chatbots ? "/platforms/" : "/benchmarks/",
          moreLabel: "All chatbots" });
      }
      if ((lb.most_repeated_claims || []).length) {
        cards.push({ rows: lb.most_repeated_claims, title: "Most-repeated claims", sub: "all runs, all personas pooled",
          idx: true, bar: false, more: "/registry/", moreLabel: "Full registry" });
      }
      if ((lb.biggest_change || []).length) {
        cards.push({ rows: lb.biggest_change, title: "Before / after", sub: "P2 · after we reported",
          idx: false, bar: false, more: "/methodology/", moreLabel: "How we measure change" });
      }
      const contamination = (data.benchmarks.contamination_by_persona || []).map((r) => ({
        key: r.persona, label: `${r.persona} · ${{ P1: "verification", P2: "topical news", P3: "leading question", P4: "hostile request" }[r.persona]}`,
        value: r.rate, persona: r.persona
      }));
      if (contamination.length) {
        const max = contamination.reduce((m, r) => Math.max(m, r.value), 0);
        cards.push({
          rows: contamination.map((r) => ({ ...r, width: Math.max(2, Math.round((r.value / max) * 100)) })),
          title: "Where contamination enters", sub: "by question type",
          idx: true, bar: true, more: "/methodology/", moreLabel: "Why this matters"
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
      return Object.keys(data.countries).map((key) => {
        const iso = String(key);
        const meta = data.countries[iso];
        const m = measured.get(iso);
        return {
          iso,
          name: String(meta.name),
          language: String(meta.language),
          scheduled: !m,
          url: m && data.navigation.has.countries ? m.url : null,
          claims: m ? m.claims.length : 0,
          answers: m ? m.answers : 0,
          bots: m ? m.bots.slice(0, 6).map((b) => b.key) : []
        };
      });
    },
    trustCards: (data) => [
      { key: "trust-method", href: "/methodology/", label: "Methodology", on: data.navigation.has.methodology },
      { key: "trust-data", href: "/data/", label: "Data", on: data.navigation.has.data },
      { key: "trust-actions", href: "/countermeasures/", label: "Countermeasures", on: data.navigation.has.countermeasures },
      { key: "trust-corrections", href: "/about/#corrections", label: "Corrections", on: data.navigation.has.about }
    ].map((c) => (c.on ? c : { ...c, href: null }))
  }
};
