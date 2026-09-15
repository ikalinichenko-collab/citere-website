// Published Claim Reports handed to the site by the app's exporter. One page per
// report per language, at /registry/{slug}/ — the same Registry URL space the
// demo claim pages live in (our slugs differ, so no output collides). The
// paginated data is published.entries (built in src/_data/published.js).
const { home, crumb } = require("../_lib/crumbs.cjs");
const { fitTitle, fitDescription, listOf } = require("../_lib/meta.cjs");
const { MONTHS } = require("../_lib/labels.cjs");

// The app's web-model slugs → display names for the brief prose.
const MODEL_LABEL = {
  "gpt-web": "ChatGPT", "gemini-web": "Gemini", "claude-web": "Claude",
  "perplexity-web": "Perplexity", "grok-web": "Grok", "google-ai": "Google AI",
  "copilot-web": "Copilot", "deepseek-web": "DeepSeek"
};
const modelLabel = (m) => MODEL_LABEL[m] || String(m || "").replace(/-web$/, "").replace(/^\w/, (c) => c.toUpperCase());
const briefDate = (iso) => {
  const [y, mo, d] = String(iso || "").slice(0, 10).split("-");
  return y && mo && d ? `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}` : String(iso || "");
};

// The three-paragraph "brief" under the title (Claim Report Spec). Generated from
// the frozen payload — nothing recomputed. Any paragraph with no data is "" and
// the template drops it.
function buildBrief(report) {
  const p = report.payload || {};
  const cc = p.claimCard || {};
  const s = p.strip || {};
  const o = p.origin || {};
  const sources = p.sources || {};
  const bots = p.botBehaviour || [];

  const truth = cc.grainOfTruth || (p.whyFalse && p.whyFalse.realEvent) || "";

  const pushed = [];
  if (o.firstSeen || o.network) {
    pushed.push(`First seen${o.firstSeen ? ` ${briefDate(o.firstSeen)}` : ""}${o.network ? ` on the ${o.network}` : ""}.`);
  }
  const dist = sources.distributedCount || 0;
  if (dist) {
    pushed.push(`Carried by ${dist} ${dist === 1 ? "site" : "sites"} on our watchlist${sources.injectionCount ? ", later cited by an assistant answering about it" : ""}.`);
  }
  const attributed = [...new Set((sources.rows || []).map((r) => r.attributedBy).filter(Boolean))];
  if (attributed.length) pushed.push(`Attributed by ${listOf(attributed)}.`);

  const stated = bots.filter((b) => (b.criticalCited || 0) > 0).map((b) => modelLabel(b.model));
  const memory = bots.filter((b) => (b.repeats || 0) > 0 && (b.criticalCited || 0) === 0).map((b) => modelLabel(b.model));
  const asst = [];
  if (stated.length) asst.push(`${listOf(stated)} stated this as fact and cited a source that had carried it in the same answer.`);
  if (memory.length) asst.push(`${listOf(memory)} repeated it too, with no source attached.`);
  const countries = `${s.countries || 0} ${(s.countries || 0) === 1 ? "country" : "countries"}`;
  if (s.answers) {
    asst.push(s.repeatedFake
      ? `In all, ${s.repeatedFake} of ${s.answers} answers across ${countries} stated it as fact.`
      : `None of ${s.answers} answers across ${countries} stated it as fact.`);
  }

  return { truth, pushed: pushed.join(" "), assistants: asst.join(" ") };
}

// A crawler-safe count sentence for the meta description, built from the strip.
function descFor(report) {
  const s = report.strip || {};
  const p = report.payload || {};
  const bots = (p.meta && p.meta.bots) || [];
  return fitDescription(
    [
      `Verdict FALSE. Of ${s.answers || 0} AI-assistant answers across ${s.countries || 0} markets, ${s.repeatedFake || 0} repeated this claim and ${s.critical || 0} cited a listed source.`,
      "See the evidence, the domains cited and the countermeasures.",
      "Full per-bot results and the claim card.",
      bots.length ? `Tested on ${listOf(bots)}.` : ""
    ].filter(Boolean),
    `report ${report.slug}`
  );
}

// Wilson 95% interval — the same presentation math the rate grid uses, kept in
// JS so the pairwise non-overlap test below stays readable (no source number is
// recomputed; RR itself comes straight from the frozen payload cells).
function wilson(k, n) {
  if (!n) return null;
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z / d) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [c - h, c + h];
}

// Report Spec §2.7 — Market comparison, P2 Topical only. One row per bot, its
// Repeat Rate in each market, and which market pairs differ significantly (their
// Wilson intervals do not overlap). null when fewer than two markets carry P2,
// so the template shows the empty state (never a one-market "comparison").
function marketComparison(report) {
  const cells = (((report.payload || {}).resultsByBot || {}).cells) || [];
  const p2 = cells.filter((c) => c.persona === "P2_topical");
  const markets = [...new Set(p2.map((c) => c.market || "—"))];
  if (markets.length < 2) return null;
  const bots = [...new Set(p2.map((c) => c.model))];
  const rows = bots.map((model) => {
    const stats = markets.map((m) => {
      const c = p2.find((x) => x.model === model && (x.market || "—") === m);
      const k = (c && c.repeat) || 0, n = (c && c.substantive) || 0;
      return { pct: n ? k / n : null, n, lowN: n < 20, ci: wilson(k, n) };
    });
    const sig = [];
    for (let i = 0; i < stats.length; i += 1) {
      for (let j = i + 1; j < stats.length; j += 1) {
        const a = stats[i].ci, b = stats[j].ci;
        if (a && b && (a[0] > b[1] || b[0] > a[1])) sig.push(`${markets[i]} vs ${markets[j]}`);
      }
    }
    return { model, stats, sig };
  });
  return { markets, rows };
}

module.exports = {
  eleventyComputed: {
    marketComparison: (data) => marketComparison(data.entry.report),
    lang: (data) => data.entry.lang,
    report: (data) => data.entry.report,
    brief: (data) => buildBrief(data.entry.report),
    p: (data) => data.entry.report.payload || {},
    analyst: (data) => data.entry.report.analyst || {},
    title: (data) => fitTitle(`“${data.entry.report.label}” — Citere`),
    description: (data) => descFor(data.entry.report),
    articleHeadline: (data) =>
      (data.entry.report.analyst && data.entry.report.analyst.headline) || data.entry.report.label,
    articlePublished: (data) => String(data.entry.report.publishedAt || "").slice(0, 10),
    articleModified: (data) => String(data.entry.report.publishedAt || "").slice(0, 10),
    breadcrumbTrail: (data) => [
      home(data.entry.lang),
      crumb(data.entry.lang, "crumb.registry", "/registry/"),
      { title: String(data.entry.report.claimKey || data.entry.report.slug), url: String(data.entry.url) }
    ]
  }
};
