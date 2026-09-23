// Per-assistant analytics, live from the PUBLISHED Claim Report feed — the
// bot-first mirror of countriesReport.js (itself the live analog of
// profiles.countries). This REPLACES the demo profiles.chatbots for the Chatbot
// benchmark table (now on /benchmarks/) and the per-bot /platforms/{bot}/ pages.
//
// A bot figure can only include a claim that has a published report; a rate
// forms inside one persona, one market (CM §5.1); two markets differ only when
// their Wilson intervals do not overlap. The published feed carries no
// countermeasure log yet, so every bot's ladder is empty and its countermeasure
// count is zero (shown as "nothing sent yet"). Retrieval ("cited anything") is
// not in the per-cell feed, so the "Searching, and what it found" section is
// suppressed (hasRetrieval:false) until the feed carries it.
const published = require("./published.js");
const countriesData = require("./countries.js");
const sources = require("./publishedSources.js");
const drift = require("./drift.js");
const { share, significant } = require("../_lib/metrics.cjs");
const { CHATBOTS, COUNTERMEASURE_LADDER } = require("../_lib/labels.cjs");

const HEADLINE = "P2"; // the news-style question, where contamination peaks
const PERSONA_ORDER = ["P1", "P2", "P3", "P4"];

// App model token → display name / site profile slug (same maps as
// countriesReport.js / publishedSources.js — one taxonomy across the live pages).
const MODEL_LABEL = {
  "gpt-web": "ChatGPT", "gemini-web": "Gemini", "claude-web": "Claude",
  "perplexity-web": "Perplexity", "google-ai": "Google AI Overviews", "grok-web": "Grok",
  "copilot-web": "Copilot", "deepseek-web": "DeepSeek",
};
const MODEL_ORDER = Object.keys(MODEL_LABEL);
const PLATFORM_SLUG = {
  "gpt-web": "chatgpt", "gemini-web": "gemini", "claude-web": "claude",
  "perplexity-web": "perplexity", "grok-web": "grok", "copilot-web": "copilot",
  "deepseek-web": "deepseek", "google-ai": "google-ai",
};
const pslug = (m) => PLATFORM_SLUG[m] || String(m || "");
const modelLabel = (m) => MODEL_LABEL[m] || String(m || "");
const pcodeOf = (p) => String(p || "").split("_")[0];

// Company, keyed by the site slug. CHATBOTS covers the eight named products;
// google-ai (Google AI Overviews) is a distinct surface with no CHATBOTS row.
const COMPANY = {
  ...Object.fromEntries(Object.entries(CHATBOTS).map(([k, v]) => [k, v.company])),
  "google-ai": "Google",
};

// Market code (uppercase, e.g. "DE") → country metadata. The feed uses "UK";
// data/countries.json keys it "gb".
const ISO_ALIAS = { UK: "gb" };
const isoOf = (mkt) => ISO_ALIAS[String(mkt)] || String(mkt).toLowerCase();

// ── Flatten every published report into per bot × market × persona cells ──────
const reports = Object.values(published.reports || {});
const cells = [];
for (const rep of reports) {
  const p = rep.payload || {};
  for (const c of (p.resultsByBot && p.resultsByBot.cells) || []) {
    if (!c.market) continue; // a cell with no market cannot join a market table
    cells.push({
      slug: rep.slug, market: String(c.market), bot: c.model, pcode: pcodeOf(c.persona),
      repeat: c.repeat || 0, uContext: c.uContext || 0, refute: c.refute || 0, dodge: c.dodge || 0,
      substantive: c.substantive || 0, valid: c.valid || 0, contaminated: c.contaminated || 0,
    });
  }
}

// Pool a filtered cell set into the rate shapes the templates read. share()
// (metrics.cjs) sets low_n from the denominator, so repeat_rate.low_n reflects
// the substantive count, exactly as the demo store did.
function pool(list) {
  const S = (f) => list.reduce((s, c) => s + (c[f] || 0), 0);
  const substantive = S("substantive"), valid = S("valid");
  const repeat = S("repeat"), uContext = S("uContext"), refute = S("refute"), dodge = S("dodge");
  const contaminated = S("contaminated");
  return {
    n: valid, substantive, contaminated,
    counts: { repeat, u_context: uContext, refute, dodge },
    repeat_rate: share(repeat, substantive),
    contamination_rate: share(contaminated, valid),
    dodge_rate: share(dodge, valid),
    verdict_shares: {
      repeat: share(repeat, valid), u_context: share(uContext, valid),
      refute: share(refute, valid), dodge: share(dodge, valid),
    },
  };
}

const marketKeys = [...new Set(cells.map((c) => c.market))];
const marketMeta = (mkt) => countriesData[isoOf(mkt)] || {};
const marketDate = (mkt) => {
  const dates = reports
    .filter((r) => ((r.payload && r.payload.meta && r.payload.meta.countries) || []).includes(mkt))
    .map((r) => r.publishedAt).filter(Boolean).sort();
  const latest = dates[dates.length - 1] || "";
  // The date filters expect a plain YYYY-MM-DD; the feed carries a full ISO stamp.
  return typeof latest === "string" && latest.length >= 10 ? latest.slice(0, 10) : latest;
};
function marketInfo(mkt) {
  const m = marketMeta(mkt);
  return {
    market: mkt,
    name: m.name || mkt,
    language: m.language || (mkt === "UK" ? "en" : ""),
    run: { key: mkt, collected_at: marketDate(mkt), country: isoOf(mkt) },
  };
}

// The markets one bot appears in, each with its per-persona rows and the P2
// headline pool. Markets the bot never answered in are dropped.
function botMarkets(botModel) {
  return marketKeys
    .map((mkt) => {
      const mCells = cells.filter((c) => c.market === mkt && c.bot === botModel);
      if (!mCells.length) return null;
      const pcodes = PERSONA_ORDER.filter((pc) => mCells.some((c) => c.pcode === pc));
      const personas = pcodes.map((pc) => ({ persona: pc, ...pool(mCells.filter((c) => c.pcode === pc)) }));
      return { ...marketInfo(mkt), personas, headline: personas.find((r) => r.persona === HEADLINE) || null };
    })
    .filter(Boolean);
}

const botUniverse = [...new Set(cells.map((c) => c.bot))].sort(
  (a, b) => MODEL_ORDER.indexOf(a) - MODEL_ORDER.indexOf(b),
);

const chatbots = botUniverse
  .map((botModel) => {
    const key = pslug(botModel);
    const markets = botMarkets(botModel);

    // The headline is the worst market at P2 — the market with the highest repeat
    // rate. Early data: low_n cells are shown (and flagged low_n in the cell), not
    // filtered out, so a thin rate still surfaces. worst is null only when no P2
    // cell has a defined rate at all (no substantive answers anywhere).
    const ranked = markets
      .filter((m) => m.headline && m.headline.repeat_rate && m.headline.repeat_rate.rate !== null)
      .sort(
        (a, b) =>
          b.headline.repeat_rate.rate - a.headline.repeat_rate.rate ||
          b.headline.repeat_rate.n - a.headline.repeat_rate.n ||
          a.name.localeCompare(b.name),
      );
    const worst = ranked[0] || null;

    // Market pairs whose intervals do not overlap at P2 — the only comparisons
    // the profile calls real. Empty while every cell is below low_n.
    const gaps = [];
    for (const a of markets) {
      for (const b of markets) {
        if (a === b || !a.headline || !b.headline) continue;
        if (a.headline.repeat_rate.rate <= b.headline.repeat_rate.rate) continue;
        if (!significant(a.headline.repeat_rate, b.headline.repeat_rate)) continue;
        gaps.push({
          high: a, low: b,
          ratio: b.headline.repeat_rate.rate ? a.headline.repeat_rate.rate / b.headline.repeat_rate.rate : null,
          diff: a.headline.repeat_rate.rate - b.headline.repeat_rate.rate,
        });
      }
    }
    gaps.sort((x, y) => y.diff - x.diff);

    // Documented claims this assistant stated as fact in at least one answer.
    const repSlugs = [...new Set(cells.filter((c) => c.bot === botModel && c.repeat > 0).map((c) => c.slug))];
    const repeatedClaims = repSlugs
      .map((slug) => published.index.find((r) => r.slug === slug))
      .filter(Boolean)
      .map((r) => ({ url: `/registry/${r.slug}/`, title_en: r.label, verdict: r.verdict, cluster: r.clusterName }));

    // Listed domains this assistant cited, from the published Sources Registry.
    const cited = sources
      .map((s) => ({ source: { defanged: s.defanged, network: s.network, criticalCount: s.criticalCount }, cited: s.byBot[key] || 0 }))
      .filter((r) => r.cited)
      .sort((a, b) => b.cited - a.cited);

    // No countermeasure log in the feed yet: every rung is available, nothing taken.
    const ladder = COUNTERMEASURE_LADDER.map((rung) => ({ ...rung, done: [], drafted: [], all: [], state: "available" }));

    return {
      key, model: botModel,
      name: modelLabel(botModel),
      company: COMPANY[key] || "",
      url: `/platforms/${key}/`,
      persona: HEADLINE,
      markets, worst,
      // Flat headline figures for the page <meta> description (platform-pages.11tydata.js).
      repeatRate: worst ? worst.headline.repeat_rate.rate : 0,
      contaminationRate: worst ? worst.headline.contamination_rate.rate : 0,
      claimsRepeated: repeatedClaims.length,
      repeatedClaims,
      gaps, biggestGap: gaps[0] || null,
      cited, ladder,
      platformActions: [], countermeasures: [], trend: [],
      hasRetrieval: false,
      drift: drift.byKey[key] || null,
    };
  })
  .sort((a, b) => {
    // Worst market at P2 first; while every cell is below low_n (early data,
    // nothing ranked), fall back to the count of claims the bot repeated so the
    // one real signal still orders the table.
    const x = a.worst && a.worst.headline.repeat_rate.rate;
    const y = b.worst && b.worst.headline.repeat_rate.rate;
    const rx = x === undefined || x === null ? -1 : x;
    const ry = y === undefined || y === null ? -1 : y;
    return ry - rx || b.claimsRepeated - a.claimsRepeated || a.key.localeCompare(b.key);
  });

module.exports = { chatbots, persona: HEADLINE };
