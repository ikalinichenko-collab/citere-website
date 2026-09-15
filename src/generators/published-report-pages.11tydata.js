// Published Claim Reports handed to the site by the app's exporter. One page per
// report per language, at /registry/{slug}/ — the same Registry URL space the
// demo claim pages live in (our slugs differ, so no output collides). The
// paginated data is published.entries (built in src/_data/published.js).
const { home, crumb } = require("../_lib/crumbs.cjs");
const { fitTitle, fitDescription, listOf } = require("../_lib/meta.cjs");

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
