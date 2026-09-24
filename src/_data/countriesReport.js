// Country / market analytics, derived strictly from the PUBLISHED Claim Report
// feed — the same coherence rule as benchmarks.js: a market figure can only
// include a claim that has a published report. Sources: each report's frozen
// per-cell figures (bot × persona × market: repeat/substantive/contaminated/
// valid/dodge), its evidence log (per-market CRITICAL/HIGH tiers) and its
// sources.byBot. Country metadata (name, language, partners, scheduled) comes
// from the static data/countries.json. Rates form inside one persona, one
// market (CM §5.1); two markets differ only when their Wilson intervals do not
// overlap.
const published = require("./published.js");
const countriesData = require("./countries.js");
const { CHATBOTS } = require("../_lib/labels.cjs");

const MODEL_LABEL = {
  "gpt-web": "ChatGPT", "gemini-web": "Gemini", "claude-web": "Claude",
  "perplexity-web": "Perplexity", "google-ai": "Google AI Overviews", "grok-web": "Grok",
  "copilot-web": "Copilot", "deepseek-web": "DeepSeek"
};
const MODEL_ORDER = Object.keys(MODEL_LABEL);
const modelLabel = (m) => MODEL_LABEL[m] || String(m || "");
const PLATFORM_SLUG = {
  "gpt-web": "chatgpt", "gemini-web": "gemini", "claude-web": "claude",
  "perplexity-web": "perplexity", "grok-web": "grok", "copilot-web": "copilot",
  "deepseek-web": "deepseek", "google-ai": "google-ai"
};
const pslug = (m) => PLATFORM_SLUG[m] || String(m || "");
// Platform pages that exist for the known product set (plus google-ai, which has
// no CHATBOTS row yet). Kept off the demo profiles.js path.
const PLATFORMS = new Set([...Object.keys(CHATBOTS), "google-ai"]);
const pcodeOf = (p) => String(p || "").split("_")[0];
const HEADLINE = "P2";

function wilson(k, n) {
  if (!n) return null;
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z / d) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [c - h, c + h];
}
const rateCell = (k, n) => (n
  ? { rate: k / n, n, ci: wilson(k, n), low_n: n < 20 }
  : { rate: null, n: 0, ci: null, low_n: true });
const significant = (a, b) => !!(a && b && a.ci && b.ci && (a.ci[0] > b.ci[1] || b.ci[0] > a.ci[1]));
const sum = (list, f) => list.reduce((s, c) => s + (Number(c[f]) || 0), 0);

// ── Flatten published reports into per-market cells + a critical-by-market map ─
const reports = Object.values(published.reports || {});
const cells = [];
const criticalByMarket = new Map();
for (const rep of reports) {
  const p = rep.payload || {};
  for (const c of (p.resultsByBot && p.resultsByBot.cells) || []) {
    cells.push({
      claimKey: rep.claimKey, label: rep.label, slug: rep.slug, splice: rep.splice || null,
      market: c.market || "", bot: c.model, pcode: pcodeOf(c.persona),
      repeat: c.repeat || 0, substantive: c.substantive || 0, valid: c.valid || 0,
      contaminated: c.contaminated || 0, dodge: c.dodge || 0,
    });
  }
  for (const e of p.evidence || []) {
    if (e.tier === "CRITICAL" && e.market) criticalByMarket.set(e.market, (criticalByMarket.get(e.market) || 0) + 1);
  }
}

// Pool a filtered cell set into the three rates the templates read.
function pool(list) {
  const rr = rateCell(sum(list, "repeat"), sum(list, "substantive"));
  const cr = rateCell(sum(list, "contaminated"), sum(list, "valid"));
  const dr = rateCell(sum(list, "dodge"), sum(list, "valid"));
  return { repeat_rate: rr, contamination_rate: cr, dodge_rate: dr, n: sum(list, "valid"), counts: { dodge: sum(list, "dodge") } };
}

const marketKeys = [...new Set(cells.map((c) => c.market).filter(Boolean))];
const meta = (mkt) => countriesData[String(mkt).toLowerCase()] || {};
const marketDate = (mkt) => {
  const dates = reports.filter((r) => ((r.payload && r.payload.meta && r.payload.meta.countries) || []).includes(mkt)).map((r) => r.publishedAt).filter(Boolean).sort();
  return dates[dates.length - 1] || "";
};

// ── Per-market country profiles ─────────────────────────────────────────────
const countries = marketKeys.map((mkt) => {
  const iso = String(mkt).toLowerCase();
  const m = meta(mkt);
  const mCells = cells.filter((c) => c.market === mkt);
  const botKeys = [...new Set(mCells.map((c) => c.bot))].sort((a, b) => MODEL_ORDER.indexOf(a) - MODEL_ORDER.indexOf(b));
  const bots = botKeys.map((bot) => {
    const head = pool(mCells.filter((c) => c.bot === bot && c.pcode === HEADLINE));
    return { key: pslug(bot), model: bot, name: modelLabel(bot), url: PLATFORMS.has(pslug(bot)) ? `/platforms/${pslug(bot)}/` : null, ...head };
  }).sort((a, b) => (b.repeat_rate.rate || 0) - (a.repeat_rate.rate || 0));
  const claimSlugs = [...new Set(mCells.map((c) => c.slug))];
  const claims = claimSlugs.map((slug) => published.index.find((r) => r.slug === slug)).filter(Boolean);
  const collected_at = marketDate(mkt);
  return {
    key: iso, market: mkt, name: m.name || mkt, url: `/countries/${iso}/`,
    language: m.language || "", partners: m.partners || [], note: m.note_en || "",
    run: { key: mkt, collected_at }, persona: HEADLINE,
    confirmed: bots.filter((b) => b.repeat_rate.ci && b.repeat_rate.ci[0] > 0 && !b.repeat_rate.low_n).length,
    critical: criticalByMarket.get(mkt) || 0,
    answers: pool(mCells.filter((c) => c.pcode === HEADLINE)).n,
    repeatRate: pool(mCells.filter((c) => c.pcode === HEADLINE)).repeat_rate.rate || 0,
    n: pool(mCells.filter((c) => c.pcode === HEADLINE)).n,
    bots, worst: bots[0] || null, claims,
  };
}).sort((a, b) => b.confirmed - a.confirmed || (b.worst && b.worst.repeat_rate.rate || 0) - (a.worst && a.worst.repeat_rate.rate || 0));

const botUniverse = [...new Set(cells.map((c) => c.bot))].sort((a, b) => MODEL_ORDER.indexOf(a) - MODEL_ORDER.indexOf(b));
const chatbots = botUniverse.map((bot) => ({ key: pslug(bot), model: bot, name: modelLabel(bot) }));

// bot × market matrix at the headline persona (for the index heatmap table).
const matrix = {
  persona: HEADLINE,
  rows: botUniverse.map((bot) => ({
    chatbot: pslug(bot), name: modelLabel(bot),
    cells: countries.map((country) => {
      const b = country.bots.find((x) => x.model === bot);
      return b ? { repeat_rate: b.repeat_rate } : { repeat_rate: rateCell(0, 0) };
    }),
  })),
};

// Same assistant, different market: the largest significant gap per bot.
const perBot = [];
for (const bot of botUniverse) {
  const inMarkets = countries
    .map((country) => ({ country, b: country.bots.find((x) => x.model === bot) }))
    .filter((x) => x.b && x.b.repeat_rate.rate !== null);
  let best = null;
  for (const hi of inMarkets) for (const lo of inMarkets) {
    if (hi === lo || hi.b.repeat_rate.rate <= lo.b.repeat_rate.rate) continue;
    if (!significant(hi.b.repeat_rate, lo.b.repeat_rate)) continue;
    const ratio = lo.b.repeat_rate.rate ? hi.b.repeat_rate.rate / lo.b.repeat_rate.rate : null;
    const diff = hi.b.repeat_rate.rate - lo.b.repeat_rate.rate;
    const cand = {
      bot: { key: pslug(bot), name: modelLabel(bot) },
      high: { name: hi.country.name, headline: { repeat_rate: hi.b.repeat_rate } },
      low: { name: lo.country.name, headline: { repeat_rate: lo.b.repeat_rate } },
      ratio, diff,
    };
    if (!best || diff > best.diff) best = cand;
  }
  if (best) perBot.push(best);
}
perBot.sort((a, b) => b.diff - a.diff);
const headlineGap = perBot[0] || null;

// Two markets sharing a language and not a country.
const langPairs = [];
for (const a of countries) for (const b of countries) {
  if (a.market >= b.market || !a.language || a.language !== b.language) continue;
  const rows = botUniverse.map((bot) => {
    const x = (a.bots.find((z) => z.model === bot) || {}).repeat_rate || rateCell(0, 0);
    const y = (b.bots.find((z) => z.model === bot) || {}).repeat_rate || rateCell(0, 0);
    return { bot: { name: modelLabel(bot) }, a: x, b: y, significant: significant(x, y) };
  });
  langPairs.push({ a, b, rows, differing: rows.filter((r) => r.significant).length });
}

// Where assistants go silent: the largest significant P4 refusal gap.
let silence = null;
for (const bot of botUniverse) {
  const inM = countries.map((country) => ({ country, dr: pool(cells.filter((c) => c.market === country.market && c.bot === bot && c.pcode === "P4")).dodge_rate }));
  for (const hi of inM) for (const lo of inM) {
    if (hi === lo || (hi.dr.rate || 0) <= (lo.dr.rate || 0)) continue;
    if (!significant(hi.dr, lo.dr)) continue;
    const diff = hi.dr.rate - lo.dr.rate;
    if (!silence || diff > silence.diff) silence = { bot: { name: modelLabel(bot) }, high: { name: hi.country.name }, low: { name: lo.country.name }, x: { dodge_rate: hi.dr }, y: { dodge_rate: lo.dr }, diff };
  }
}

// Grain-of-truth split per market (splice A/B/C vs D), headline persona.
const GRAIN = new Set(["A", "B", "C"]);
const grain = countries.map((country) => {
  const l = cells.filter((c) => c.market === country.market && c.pcode === HEADLINE && c.splice);
  const g = pool(l.filter((c) => GRAIN.has(c.splice)));
  const f = pool(l.filter((c) => !GRAIN.has(c.splice)));
  return { country, grain: g.repeat_rate, fabrication: f.repeat_rate, significant: significant(g.repeat_rate, f.repeat_rate) };
}).filter((r) => r.grain.n || r.fabrication.n);

// Markets on the monitoring list that no published report covers yet.
const scheduled = Object.entries(countriesData)
  .filter(([iso, m]) => m && m.status === "scheduled" && !marketKeys.some((k) => String(k).toLowerCase() === iso))
  .map(([iso, m]) => ({ iso, name: m.name || iso, language: m.language || "" }));

// Local mirrors: published sources cited in exactly one market (from the feed).
const localMirrors = [];
for (const rep of reports) {
  for (const r of (rep.payload && rep.payload.sources && rep.payload.sources.rows) || []) {
    const markets = [...new Set((r.byMarket || []).map((x) => x.market).filter(Boolean))];
    if (markets.length === 1 && (r.citedCount || 0) > 0) localMirrors.push({ domain: r.domain, market: markets[0] });
  }
}

module.exports = {
  countries, chatbots, matrix, persona: HEADLINE, scheduled,
  headlineGap, perBot, langPairs, silence, grain, localMirrors,
  criticalTotal: countries.reduce((n, c) => n + c.critical, 0),
};
