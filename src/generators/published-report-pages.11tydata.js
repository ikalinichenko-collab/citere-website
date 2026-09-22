// Published Claim Reports handed to the site by the app's exporter. One page per
// report per language, at /registry/{slug}/ — the same Registry URL space the
// demo claim pages live in (our slugs differ, so no output collides). The
// paginated data is published.entries (built in src/_data/published.js).
//
// The layout matches docs/report-page-mockup_1.html (the approved report-page
// design) — the same structure the app renders in its preview
// (artifacts/citere/src/pages/disinfo/report-preview.tsx). The site is a pure
// renderer: everything here shapes the frozen payload into the fields the
// template draws; no finding is recomputed, only presented. Heavy derivations
// live here (site convention: figures are derived in src/_data / .11tydata.js,
// never in the template).
const { home, crumb } = require("../_lib/crumbs.cjs");
const { fitTitle, fitDescription, listOf } = require("../_lib/meta.cjs");
const { MONTHS } = require("../_lib/labels.cjs");

// The app's web-model slugs → display names and short monograms for the hero
// bars and bot cards. The site swaps in real logo marks via logos.json in the
// template; the monogram is the fallback. Unknown models fall back to the raw
// string / its initials.
const MODEL_LABEL = {
  "gpt-web": "ChatGPT", "gemini-web": "Gemini", "claude-web": "Claude",
  "perplexity-web": "Perplexity", "google-ai": "Google AI Overviews", "grok-web": "Grok",
  "copilot-web": "Copilot", "deepseek-web": "DeepSeek"
};
const MODEL_MARK = {
  "gpt-web": "C", "gemini-web": "Ge", "claude-web": "Cl",
  "perplexity-web": "PX", "google-ai": "G", "grok-web": "Gr",
  "copilot-web": "Co", "deepseek-web": "DS"
};
// The app's web-model ids → the site's logo/platform slugs (data/logos.json),
// so the report page reuses the real brand marks with a monogram fallback.
const MODEL_SLUG = {
  "gpt-web": "chatgpt", "gemini-web": "gemini", "claude-web": "claude",
  "perplexity-web": "perplexity", "grok-web": "grok", "google-ai": "google-ai",
  "copilot-web": "copilot", "deepseek-web": "deepseek"
};
const modelLabel = (m) => MODEL_LABEL[m] || String(m || "").replace(/-web$/, "").replace(/^\w/, (c) => c.toUpperCase());
const modelMark = (m) => MODEL_MARK[m] || (modelLabel(m).replace(/[^A-Za-z]/g, "").slice(0, 2) || "?");
const modelSlug = (m) => MODEL_SLUG[m] || String(m || "");

const briefDate = (iso) => {
  const [y, mo, d] = String(iso || "").slice(0, 10).split("-");
  return y && mo && d ? `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}` : String(iso || "");
};

// Effective prose for an overridable block: a non-empty analyst override wins
// over the computed text — the same rule as disinfo-core reportText(), so the
// site renders exactly what the app's editor wrote.
const ov = (analyst, key, computed) => {
  const o = analyst && analyst.overrides && analyst.overrides[key];
  return o != null && String(o).trim() ? o : (computed || "");
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

// The hero "finding" when the analyst has not written a headline — mirrors the
// finding seeded by report-assemble and the app preview's computeFinding: how
// many repeated + cited a listed source, which domains, which repeated from
// memory. Split into a bold lead sentence + the rest, as in the mockup.
function computeFinding(p) {
  const bb = p.botBehaviour || [];
  const repeated = bb.filter((b) => (b.repeats || 0) > 0);
  const s = p.strip || {};
  if (!repeated.length) return `No chatbot stated the fake as fact across ${s.answers || 0} answers.`;
  const crit = bb.filter((b) => (b.criticalCited || 0) > 0);
  const mem = bb.filter((b) => (b.repeats || 0) > 0 && (b.criticalCited || 0) === 0);
  const critDomains = [...new Set((p.evidence || [])
    .filter((e) => e.tier === "CRITICAL")
    .flatMap((e) => (e.sources || []).map((so) => so.domain)))];
  return [
    crit.length
      ? `${crit.length} chatbot${crit.length === 1 ? "" : "s"} repeated the fake and cited a listed source.`
      : `${repeated.length} of ${s.botsTested || 0} chatbots repeated the fake.`,
    crit.length ? `${crit.map((b) => modelLabel(b.model)).join(", ")} cited ${critDomains.length ? critDomains.join(", ") : "a listed source"}.` : "",
    mem.length ? `${mem.map((b) => modelLabel(b.model)).join(", ")} repeated it from memory — the fake is inside the models, not arriving through search.` : "",
  ].filter(Boolean).join(" ");
}

function splitFinding(text) {
  const m = String(text || "").match(/^(.*?[.!?])(\s+)([\s\S]+)$/);
  return m ? { lead: m[1], rest: m[3] } : { lead: text || "", rest: "" };
}

// Hero bars: bots worst-first by repeat rate; fill widths normalised to the top
// rate so the strongest bar nearly fills its track (the % label carries the
// exact figure).
function heroBots(p) {
  const bb = (p.botBehaviour || []).map((b) => ({ ...b, rate: b.answers ? b.repeats / b.answers : 0 }));
  bb.sort((x, y) => y.rate - x.rate);
  const maxRate = Math.max(0.0001, ...bb.map((b) => b.rate));
  return bb.map((b) => ({
    label: modelLabel(b.model),
    mark: modelMark(b.model),
    slug: modelSlug(b.model),
    rate: b.rate,
    pct: Math.round(b.rate * 100),
    repeats: b.repeats || 0,
    answers: b.answers || 0,
    criticalCited: b.criticalCited || 0,
    fillPct: (b.rate / maxRate) * 92,
    srcPct: ((b.answers ? (b.criticalCited || 0) / b.answers : 0) / maxRate) * 92,
  }));
}

// The one-line insight under the hero bars.
function heroInsight(p) {
  const s = p.strip || {};
  if (!s.answers) return "";
  const rr = Math.round((s.repeatedFake / s.answers) * 100);
  const top = heroBots(p)[0];
  const topLine = top && top.rate >= 0.5
    ? ` ${top.label} did so in ${top.rate >= 0.66 ? "two of every three" : "over half of"} answers.`
    : "";
  const critLine = s.critical
    ? ` ${s.critical} answer${s.critical === 1 ? "" : "s"} cited a listed source; the rest came from the models' own memory.`
    : " No answer cited a listed source — the fake came from the models' own memory.";
  return { count: `${s.repeatedFake} of ${s.answers} answers`, rest: ` repeated the fake — ${rr}%.${topLine}${critLine}` };
}

// "How the lie is built" — the splice taxonomy in plain language (A swap /
// B inference / C shift / D fabrication), matching report-assemble.
function spliceInfo(splice) {
  if (!splice) return { klass: "Built from a real event with one element altered", letter: null };
  const letter = ["A", "B", "C", "D"].find((L) => splice.includes(L));
  const KLASS = {
    A: "Built by swapping a real detail for a false one",
    B: "Built by adding a false conclusion to a real event",
    C: "Built by shifting a real detail out of place",
    D: "Built as an outright fabrication",
  };
  const DEF = {
    A: { phrase: "A real detail, swapped", def: "A real attribute is swapped for a false one — everything else checks out, which is what makes it land." },
    B: { phrase: "A true premise, a false conclusion", def: "The facts hold, but the conclusion drawn from them does not follow." },
    C: { phrase: "A real detail, shifted", def: "A real detail — a date, a place, a scale — is moved, so the story reads differently than it happened." },
    D: { phrase: "An outright fabrication", def: "There is no real event underneath; the claim is invented." },
  };
  if (!letter) return { klass: "Built from a real event with one element altered", letter: null };
  return { klass: KLASS[letter], letter, phrase: DEF[letter].phrase, def: DEF[letter].def };
}

// Bot cards for "What the chatbots did" — worst-first, with the analyst-effective
// "how" paragraph per bot.
function botCards(p, analyst) {
  return (p.botBehaviour || [])
    .slice()
    .sort((x, y) => (y.repeats || 0) - (x.repeats || 0))
    .map((b) => ({
      label: modelLabel(b.model),
      mark: modelMark(b.model),
      slug: modelSlug(b.model),
      repeats: b.repeats || 0,
      answers: b.answers || 0,
      criticalCited: b.criticalCited || 0,
      crit: (b.criticalCited || 0) > 0,
      how: ov(analyst, `botBehaviour.pattern.${b.model}`, b.pattern),
    }));
}

// A crawler-safe count sentence for the meta description, built from the strip.
function descFor(report) {
  const s = report.strip || {};
  const p = report.payload || {};
  const bots = (p.meta && p.meta.bots) || [];
  return fitDescription(
    [
      `Verdict ${String(report.verdict || "false").toUpperCase()}. Of ${s.answers || 0} AI-assistant answers across ${s.countries || 0} markets, ${s.repeatedFake || 0} repeated this claim and ${s.critical || 0} cited a listed source.`,
      "See the evidence, the domains cited and the countermeasures.",
      "Full per-bot results and the claim card.",
      bots.length ? `Tested on ${listOf(bots.map(modelLabel))}.` : ""
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

// The distribution chain nodes for "How it moved" — dated, injection-flagged.
function chainNodes(p) {
  const chain = (p.whyFalse && p.whyFalse.chain) || [];
  return chain.map((n, i) => ({
    node: n.node,
    injection: !!n.injection,
    date: n.date || (i === chain.length - 1 ? "Reached chatbots" : "Published"),
    isDomain: n.node && !/\s/.test(n.node) && n.node.includes("."),
    last: i === chain.length - 1,
  }));
}

// The truth block in the hero: the effective grain-of-truth / canonical debunk,
// plus up to three debunk-source names for attribution.
function truthBlock(p, analyst) {
  const cc = p.claimCard || {};
  const text = ov(analyst, "hero.truth", (p.whyFalse && p.whyFalse.realEvent) || cc.canonicalDebunk || "");
  const src = (cc.debunkSources || [])
    .slice(0, 3)
    .map((d) => d.name || (d.url ? d.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : ""))
    .filter(Boolean)
    .join(" · ");
  return { text, src };
}

module.exports = {
  eleventyComputed: {
    marketComparison: (data) => marketComparison(data.entry.report),
    lang: (data) => data.entry.lang,
    report: (data) => data.entry.report,
    brief: (data) => buildBrief(data.entry.report),
    p: (data) => data.entry.report.payload || {},
    analyst: (data) => data.entry.report.analyst || {},
    hidden: (data) => (data.entry.report.analyst && data.entry.report.analyst.hidden) || [],
    // Hero + narrative derivations (mockup-shaped, analyst-effective).
    finding: (data) => {
      const r = data.entry.report;
      return splitFinding((r.analyst && r.analyst.headline) || computeFinding(r.payload || {}));
    },
    heroBots: (data) => heroBots(data.entry.report.payload || {}),
    heroInsight: (data) => heroInsight(data.entry.report.payload || {}),
    splice: (data) => spliceInfo((data.entry.report.payload || {}).splice),
    truth: (data) => truthBlock(data.entry.report.payload || {}, data.entry.report.analyst || {}),
    botCards: (data) => botCards(data.entry.report.payload || {}, data.entry.report.analyst || {}),
    chainNodes: (data) => chainNodes(data.entry.report.payload || {}),
    personaCount: (data) => {
      const cells = (((data.entry.report.payload || {}).resultsByBot || {}).cells) || [];
      return new Set(cells.map((c) => c.persona).filter(Boolean)).size;
    },
    // Effective (override-aware) narrative text used across sections.
    whyFalseText: (data) => {
      const p = data.entry.report.payload || {};
      const a = data.entry.report.analyst || {};
      return {
        realEvent: ov(a, "whyFalse.realEvent", (p.whyFalse || {}).realEvent),
        whyItWorks: ov(a, "whyFalse.whyItWorks", (p.whyFalse || {}).whyItWorks),
      };
    },
    showsText: (data) => {
      const p = data.entry.report.payload || {};
      const a = data.entry.report.analyst || {};
      if (!p.whatThisShows) return null;
      return {
        injectionLine: ov(a, "whatThisShows.injectionLine", p.whatThisShows.injectionLine),
        failureModes: ov(a, "whatThisShows.failureModes", p.whatThisShows.failureModes),
      };
    },
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
