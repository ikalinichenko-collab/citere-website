// Per-assistant and per-market profiles: filtered and arranged views of the
// metrics store, never arithmetic on a page (brief §2 "Metrics store").
//
// Every figure here names one persona and one market. A bot's headline number
// is its worst market at P2, with that market printed next to it - there is no
// figure for "this bot overall", because pooling markets is not permitted
// (Calculation Methodology §5.1).
const platforms = require("./platforms.js");
const countriesData = require("./countries.js");
const claims = require("./claims.js");
const countermeasures = require("./countermeasures.js");
const metrics = require("./metrics.js");
const runs = require("./runs.js");
const { CHATBOTS, COUNTERMEASURE_LADDER } = require("../_lib/labels.cjs");
const drift = require("./drift.js");
const sources = require("./sources.js");

const HEADLINE = "P2"; // the news-style question, where contamination peaks

// Live pages use platformsReport / countriesReport (published feed). This module
// is the seed-metrics path; when that store is hidden, export empties so Eleventy
// can still load the file without crashing on missing run/market rows.
if ((metrics.raw && metrics.raw.demo === true) || !(metrics.cells || []).length) {
  module.exports = {
    chatbots: [],
    countries: [],
    matrix: { persona: HEADLINE, chatbots: [], markets: [], rows: [] },
    persona: HEADLINE,
    scheduled: [],
    headlineGap: null,
    perBot: [],
    langPairs: [],
    silence: null,
    grain: [],
    localMirrors: [],
    criticalTotal: 0
  };
} else {

const personas = metrics.dimensions.personas || [];
const marketKeys = runs.markets;

const marketMeta = (market) => {
  const run = runs.current[market];
  const country = countriesData[run.country] || {};
  return { market, run, country: run.country, language: run.language, name: country.name || run.country };
};

function botMarkets(key) {
  return marketKeys.map((market) => {
    const info = marketMeta(market);
    const where = { chatbot: key, run: info.run.key, is_live: false };
    const rows = personas.map((persona) => ({
      persona,
      ...metrics.poolOf({ ...where, persona })
    }));
    return { ...info, personas: rows, headline: rows.find((r) => r.persona === HEADLINE) };
  });
}

const chatbots = Object.entries(platforms).map(([key, meta]) => {
  const markets = botMarkets(key);
  const ranked = markets
    .filter((m) => m.headline && m.headline.repeat_rate && !m.headline.repeat_rate.low_n)
    .sort((a, b) => b.headline.repeat_rate.rate - a.headline.repeat_rate.rate);
  const worst = ranked[0] || null;
  const repeatedClaims = claims.filter((c) =>
    c.cells.some((cell) => cell.chatbot === key && cell.counts.repeat > 0));
  // A trend needs two comparable runs in one market (CM §6.1).
  const trend = marketKeys.flatMap((market) => {
    const list = (runs.byMarket[market] || [])
      .filter((r) => r.comparable_with.length)
      .sort((a, b) => a.collected_at.localeCompare(b.collected_at));
    if (list.length < 2) return [];
    const points = list.map((run) => ({
      run, ...metrics.poolOf({ chatbot: key, run: run.key, persona: HEADLINE, is_live: false })
    }));
    return [{
      market, points,
      change: metrics.compare(points[0], points[points.length - 1])
    }];
  });
  // Countries Index Business Logic §7: two markets differ only when their
  // intervals do not overlap. Anything else is directional and is not claimed.
  const gaps = [];
  for (const a of markets) {
    for (const b of markets) {
      if (a === b || !a.headline || !b.headline) continue;
      if (a.headline.repeat_rate.rate <= b.headline.repeat_rate.rate) continue;
      if (!metrics.significant(a.headline.repeat_rate, b.headline.repeat_rate)) continue;
      gaps.push({ high: a, low: b,
        ratio: b.headline.repeat_rate.rate ? a.headline.repeat_rate.rate / b.headline.repeat_rate.rate : null,
        diff: a.headline.repeat_rate.rate - b.headline.repeat_rate.rate });
    }
  }
  gaps.sort((x, y) => y.diff - x.diff);

  // The domains this assistant cited, from the registry rather than recomputed.
  const cited = sources
    .map((s) => ({ source: s, cited: s.byBot[key] || 0 }))
    .filter((r) => r.cited)
    .sort((a, b) => b.cited - a.cited);

  // The log names whoever we wrote to: sometimes the product, sometimes the
  // company that makes it. Match the whole name, not a substring - "Google
  // Search Console" is an infrastructure channel, not this assistant, and
  // attributing that report to a bot profile would be wrong.
  const names = new Set([meta.name, meta.company, (CHATBOTS[key] || {}).name].filter(Boolean));
  const platformActions = countermeasures.actions.filter((e) =>
    e.target && names.has(e.target.replace(/\s*\(.*\)$/, "").trim()));
  const ladder = COUNTERMEASURE_LADDER.map((rung) => {
    const done = platformActions.filter((a) => a.taken && a.kind === "action" && rung.types.includes(a.type));
    const drafted = platformActions.filter((a) => !a.taken && a.kind === "action" && rung.types.includes(a.type));
    return { ...rung, done, drafted, all: [...done, ...drafted],
             state: done.length ? "done" : "available" };
  });

  return {
    key,
    name: meta.name || (CHATBOTS[key] || {}).name || key,
    company: meta.company,
    url: `/platforms/${key}/`,
    gaps,
    biggestGap: gaps[0] || null,
    cited,
    ladder,
    platformActions,
    // An external figure, not ours: how much of this assistant's cited-domain
    // set turns over month to month, which is the noise floor a trend sits on.
    drift: drift.byKey[key] || null,
    modelVersions: meta.model_versions || [],
    persona: HEADLINE,
    markets,
    worst,
    repeatedClaims,
    claimsRepeated: repeatedClaims.length,
    // The countermeasures log names the company we wrote to.
    countermeasures: platformActions,
    trend
  };
}).sort((a, b) => {
  const x = a.worst && a.worst.headline.repeat_rate.rate;
  const y = b.worst && b.worst.headline.repeat_rate.rate;
  return (y === undefined || y === null ? -1 : y) - (x === undefined || x === null ? -1 : x);
});

const countries = marketKeys.map((market) => {
  const info = marketMeta(market);
  const meta = countriesData[info.country] || {};
  const bots = chatbots.map((bot) => {
    const row = bot.markets.find((m) => m.market === market);
    return { key: bot.key, name: bot.name, url: bot.url, ...row.headline };
  }).sort((a, b) => (b.repeat_rate.rate || 0) - (a.repeat_rate.rate || 0));
  return {
    key: info.country,
    market,
    name: meta.name || info.country,
    url: `/countries/${info.country}/`,
    language: info.language,
    partners: meta.partners || [],
    note: meta.note_en,
    run: info.run,
    persona: HEADLINE,
    // The number of bots whose interval excludes zero here: a count, not a
    // score for the country (Countries Index Business Logic §2).
    confirmed: bots.filter((b) => b.repeat_rate.ci && b.repeat_rate.ci[0] > 0 && !b.repeat_rate.low_n).length,
    critical: metrics.poolOf({ run: info.run.key, is_live: false }).tiers.critical,
    answers: metrics.poolOf({ run: info.run.key, is_live: false }).n,
    bots,
    worst: bots[0] || null,
    claims: claims.filter((c) => c.markets.includes(market))
  };
}).sort((a, b) => b.confirmed - a.confirmed || (b.worst.repeat_rate.rate || 0) - (a.worst.repeat_rate.rate || 0));

// bot x market grid at one persona, for the countries index heatmap.
const matrix = {
  persona: HEADLINE,
  chatbots: chatbots.map((c) => c.key),
  markets: countries.map((c) => c.market),
  rows: chatbots.map((bot) => ({
    chatbot: bot.key,
    name: bot.name,
    cells: countries.map((country) => bot.markets.find((m) => m.market === country.market).headline)
  }))
};

// Countries Index Business Logic: the page's own findings, each rendered only
// if the comparison clears significance. An empty result is stated, never
// filled in with something weaker.
const allGaps = chatbots.flatMap((bot) => bot.gaps.map((g) => ({ bot, ...g })));
allGaps.sort((a, b) => b.diff - a.diff);
const headlineGap = allGaps[0] || null;

// §1 "Same chatbot, different country": the largest gap for each of the top
// three assistants that have one at all.
const seenBots = new Set();
const perBot = allGaps.filter((g) => {
  if (seenBots.has(g.bot.key)) return false;
  seenBots.add(g.bot.key);
  return true;
}).slice(0, 3);

// §11 "Language matters more than the border": two markets sharing a language
// and not a country.
const langPairs = [];
for (const a of countries) {
  for (const b of countries) {
    if (a.market >= b.market || a.language !== b.language) continue;
    langPairs.push({ a, b, rows: chatbots.map((bot) => {
      const x = bot.markets.find((m) => m.market === a.market).headline;
      const y = bot.markets.find((m) => m.market === b.market).headline;
      return { bot, a: x.repeat_rate, b: y.repeat_rate, significant: metrics.significant(x.repeat_rate, y.repeat_rate) };
    }) });
  }
}
for (const pair of langPairs) pair.differing = pair.rows.filter((r) => r.significant).length;

// §4 "Where chatbots go silent": the largest significant difference in refusal
// rate on the generation persona.
let silence = null;
for (const bot of chatbots) {
  for (const a of bot.markets) {
    for (const b of bot.markets) {
      if (a === b) continue;
      const x = metrics.poolOf({ chatbot: bot.key, run: a.run.key, persona: "P4", is_live: false });
      const y = metrics.poolOf({ chatbot: bot.key, run: b.run.key, persona: "P4", is_live: false });
      if (!metrics.significant(x.dodge_rate, y.dodge_rate)) continue;
      if (x.dodge_rate.rate <= y.dodge_rate.rate) continue;
      const diff = x.dodge_rate.rate - y.dodge_rate.rate;
      if (!silence || diff > silence.diff) silence = { bot, high: a, low: b, x, y, diff };
    }
  }
}

// §10 "Fabrications don't travel": the grain-of-truth split per market.
const grain = countries.map((country) => ({
  country,
  ...(metrics.grainDifferential({ run: country.run.key, persona: HEADLINE, is_live: false }) || {})
})).filter((row) => row.grain && row.fabrication);

// Markets on the monitoring list that no run has covered. They have no page:
// there would be nothing on it.
const scheduled = Object.entries(countriesData)
  .filter(([iso, meta]) => meta.status === "scheduled" && !marketKeys.some((m) => m.startsWith(`${iso}-`)))
  .map(([iso, meta]) => ({ iso, name: meta.name, language: meta.language }));

module.exports = {
  chatbots, countries, matrix, persona: HEADLINE, scheduled,
  headlineGap, perBot, langPairs, silence, grain,
  localMirrors: sources.filter((s) => s.markets.length === 1 && s.citedCount),
  criticalTotal: countries.reduce((n, c) => n + c.critical, 0)
};

} // end seed-metrics branch
