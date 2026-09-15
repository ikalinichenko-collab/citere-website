const { md: markdown } = require("./src/_lib/markdown.cjs");
const ui = require("./src/_data/ui.js");
const {
  VERDICTS, BEHAVIOURS, STATUSES, ACTION_TYPES, NETWORKS, NETWORK_NAMES, NETWORK_CLASS,
  CHATBOTS, PERSONAS, MONTHS, SPLICES
} = require("./src/_lib/labels.cjs");

// Comment strip + whitespace collapse only. Deliberately conservative: nothing
// that can change selector meaning.
function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ CNAME: "CNAME" });
  // Real vendor logo files, when they have been dropped in. The directory may
  // be empty: bot-mark.njk falls back to the monogram tile.
  eleventyConfig.addPassthroughCopy({ "src/assets/logos": "assets/logos" });
  eleventyConfig.setUseGitIgnore(false);
  eleventyConfig.ignores.add("**/node_modules/**");
  // design-mockup/ is the approved reference. It is never built or deployed.
  eleventyConfig.ignores.add("design-mockup/**");

  // The stylesheet is the only asset with a build step, and that step is
  // minification. The source is design-mockup/styles.css, ported as-is.
  eleventyConfig.addTemplateFormats("css");
  eleventyConfig.addExtension("css", {
    outputFileExtension: "css",
    compile: (inputContent) => () => minifyCss(inputContent)
  });

  // Does a file exist under src/? Used by bot-mark.njk to decide between a
  // real vendor mark and the monogram tile, so an empty src/assets/logos/ is
  // a supported state rather than a broken build.
  const SRC = require("node:path").join(__dirname, "src");
  const existsCache = new Map();
  eleventyConfig.addFilter("fileExists", (relative) => {
    const rel = String(relative || "").replace(/^\/+/, "");
    if (!rel) return false;
    if (!existsCache.has(rel)) {
      existsCache.set(rel, require("node:fs").existsSync(require("node:path").join(SRC, rel)));
    }
    return existsCache.get(rel);
  });

  // Interface strings. Unknown keys throw: a typo must not ship as blank
  // chrome. A missing Ukrainian key falls back to English (CLAUDE.md 2).
  eleventyConfig.addFilter("t", function (key, ...args) {
    const lang = (this.ctx && this.ctx.lang) || "en";
    let value = (ui[lang] || ui.en)[key];
    if (value === undefined) value = ui.en[key];
    if (value === undefined) throw new Error(`ui: unknown string key "${key}"`);
    for (const arg of args) value = value.replace("%s", String(arg));
    return value;
  });

  // Mount-point aware sibling URL: /about/ in English, /uk/about/ in Ukrainian.
  eleventyConfig.addFilter("loc", (path, lang) =>
    lang && lang !== "en" ? `/${lang}${path}` : path
  );

  // ---- dates -------------------------------------------------------------
  eleventyConfig.addFilter("displayDate", (value) => {
    if (!value) return "";
    const [y, m, d] = String(value).slice(0, 10).split("-");
    if (!y || !m || !d) return String(value);
    return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
  });
  // The mockup's compact form in table cells: "24 Oct".
  eleventyConfig.addFilter("shortDate", (value) => {
    if (!value) return "";
    const [, m, d] = String(value).slice(0, 10).split("-");
    if (!m || !d) return String(value);
    return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
  });
  eleventyConfig.addFilter("isoDate", (value) => String(value || "").slice(0, 10));
  eleventyConfig.addFilter("year", (value) => String(value || "").slice(0, 4));
  eleventyConfig.addFilter("monthLabel", (value) => {
    const [y, m] = String(value || "").split("-");
    return m ? `${MONTHS[Number(m) - 1]}` : String(value);
  });

  // ---- watchlisted domains: printed, never linked, never live ------------
  eleventyConfig.addFilter("defang", (domain) => String(domain || "").replace(/\./g, "[.]"));
  eleventyConfig.addFilter("domainSlug", (domain) => String(domain || "").replace(/\./g, "-"));

  // ---- labels ------------------------------------------------------------
  eleventyConfig.addFilter("verdictLabel", (v) => VERDICTS[v] || String(v || "").toUpperCase());
  eleventyConfig.addFilter("verdictClass", (v) =>
    ({ false: "b-f", misleading: "b-m", unsupported: "b-u" })[v] || "b-u"
  );
  eleventyConfig.addFilter("behaviourLabel", (v) => BEHAVIOURS[v] || String(v || "").toUpperCase());
  eleventyConfig.addFilter("statusLabel", (v) => STATUSES[v] || v);
  eleventyConfig.addFilter("actionTypeLabel", (v) => ACTION_TYPES[v] || v);
  eleventyConfig.addFilter("networkLabel", (v) => NETWORKS[v] || v);
  eleventyConfig.addFilter("networkName", (v) => NETWORK_NAMES[v] || v);
  eleventyConfig.addFilter("networkCount", function (net) {
    const list = (this.ctx && this.ctx.sources) || [];
    return list.filter((s) => s.network === net).length;
  });
  eleventyConfig.addFilter("networkClass", (v) => NETWORK_CLASS[v] || "");
  eleventyConfig.addFilter("personaLabel", (v) => PERSONAS[v] || "");

  const bot = (key) => CHATBOTS[key] || { name: key, code: String(key || "??").slice(0, 2).toUpperCase(), cls: "", company: "" };
  eleventyConfig.addFilter("botName", (v) => bot(v).name);
  eleventyConfig.addFilter("botCode", (v) => bot(v).code);
  eleventyConfig.addFilter("botClass", (v) => bot(v).cls);
  eleventyConfig.addFilter("botCompany", (v) => bot(v).company);

  const displayNames = new Map();
  const nameOf = (type, value) => {
    if (!displayNames.has(type)) {
      try { displayNames.set(type, new Intl.DisplayNames(["en"], { type })); }
      catch { displayNames.set(type, null); }
    }
    const formatter = displayNames.get(type);
    const raw = type === "region" ? String(value).toUpperCase() : String(value);
    try { return (formatter && formatter.of(raw)) || raw; } catch { return raw; }
  };
  eleventyConfig.addFilter("countryName", (v) => nameOf("region", v));
  eleventyConfig.addFilter("languageName", (v) => nameOf("language", v));
  eleventyConfig.addFilter("flag", (code) =>
    String(code || "").toUpperCase().replace(/[A-Z]/g, (c) =>
      String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)
    )
  );

  // ---- numbers -----------------------------------------------------------
  // Strip template indentation from the output. A run of newline + spaces
  // becomes a single newline, which is still whitespace and still renders as
  // one space, so nothing moves on the page - it just stops shipping the
  // indentation. Worth ~10% on a dense table page, which is what keeps the
  // claim report inside the 60 KB budget in CLAUDE.md 2.
  eleventyConfig.addTransform("trimIndent", function (content) {
    if (!(this.page.outputPath || "").endsWith(".html")) return content;
    if (/<pre[\s>]/i.test(content)) return content;
    return content.replace(/\n[ \t]+/g, "\n");
  });

  eleventyConfig.addFilter("spliceLabel", (v) => SPLICES[String(v)] || v);
  eleventyConfig.addFilter("rate", (v) => (v === null || v === undefined ? "n/a" : `${Math.round(v * 1000) / 10}%`));
  // Wilson 95% interval as [lo, hi] (z = 1.96), or null when n = 0. Pairs with
  // the ciLabel filter for display. The published Claim Report renders its
  // rate cells with this, matching the app's in-preview arithmetic.
  eleventyConfig.addFilter("wilson", (k, n) => {
    const K = Number(k), N = Number(n);
    if (!N) return null;
    const z = 1.96, p = K / N, d = 1 + (z * z) / N;
    const c = (p + (z * z) / (2 * N)) / d;
    const h = (z / d) * Math.sqrt((p * (1 - p)) / N + (z * z) / (4 * N * N));
    return [c - h, c + h];
  });
  eleventyConfig.addFilter("pctOf", (k, n) => {
    const N = Number(n);
    return N ? `${Math.round((Number(k) / N) * 1000) / 10}%` : "n/a";
  });
  // A Wilson interval as the reference builds print it: "29-48", whole points.
  eleventyConfig.addFilter("ciLabel", (ci) =>
    Array.isArray(ci) ? `${Math.round(ci[0] * 100)}\u2013${Math.round(ci[1] * 100)}` : "");
  eleventyConfig.addFilter("pp", (v) => {
    if (v === null || v === undefined) return "n/a";
    const n = Math.round(v * 1000) / 10;
    return `${n > 0 ? "+" : n < 0 ? "\u2212" : ""}${Math.abs(n)}pp`;
  });
  // Bar width relative to the largest value in the same leaderboard.
  eleventyConfig.addFilter("barWidth", (value, max) => {
    const m = Number(max);
    if (!m) return 0;
    return Math.max(2, Math.round((Number(value) / m) * 100));
  });
  eleventyConfig.addFilter("sumField", (rows, field) =>
    (rows || []).reduce((total, row) => total + (Number(row[field]) || 0), 0)
  );
  eleventyConfig.addFilter("maxField", (rows, field) =>
    (rows || []).reduce((best, row) => Math.max(best, Number(row[field]) || 0), 0)
  );

  // ---- collections -------------------------------------------------------
  eleventyConfig.addFilter("min", (arr) => Math.min(...(arr || []).map(Number)));
  eleventyConfig.addFilter("abs", (v) => Math.abs(Number(v)));
  eleventyConfig.addFilter("take", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("plural", (count, one, many) => (Number(count) === 1 ? one : many));
  eleventyConfig.addFilter("unique", (arr) => [...new Set([].concat(arr || []))]);
  eleventyConfig.addFilter("whereEq", (arr, key, value) =>
    (arr || []).filter((item) => {
      const held = item[key];
      return Array.isArray(held) ? held.includes(value) : held === value;
    })
  );

  // ---- prose -------------------------------------------------------------
  eleventyConfig.addFilter("md", (text) => markdown.render(String(text || "")).trim());
  eleventyConfig.addFilter("mdInline", (text) => markdown.renderInline(String(text || "")).trim());
  // Prose in content/ carries no numbers; where a sentence needs one it writes
  // {{ name }} and the template supplies the value from data/ (CLAUDE.md 11.1).
  // Unknown names are left untouched, so a {{TODO}} marker survives to check.mjs.
  eleventyConfig.addFilter("fill", (text, values) =>
    String(text || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(values || {}, key) ? String(values[key]) : match
    )
  );

  // Root-relative links written inside content/ Markdown never pass through the
  // url filter, so they would 404 under a path prefix. Applied only to
  // content-derived HTML, so links already built with | url are untouched.
  const prefix = (process.env.PATH_PREFIX || "/").replace(/\/+$/, "");
  eleventyConfig.addFilter("prefixLinks", (html) =>
    prefix
      ? String(html || "").replace(/(href|src)="\/(?!\/)/g, `$1="${prefix}/`)
      : String(html || "")
  );

  // Watchlisted domains must be printed defanged wherever they appear, prose
  // included (CLAUDE.md 5.3). Content is written with the plain domain; this
  // rewrites it on the way out so no page can leak a live one.
  const watchlist = (() => {
    try {
      const file = require("node:fs").readFileSync(require("node:path").join(__dirname, "data/sources.json"), "utf8");
      return (JSON.parse(file).domains || []).map((d) => d.domain).sort((a, b) => b.length - a.length);
    } catch { return []; }
  })();
  const watchlistRe = watchlist.length
    ? new RegExp(`(?<![\\w[.])(${watchlist.map((d) => d.replace(/\./g, "\\.")).join("|")})(?![\\w.])`, "g")
    : null;
  eleventyConfig.addFilter("defangCopy", (html) =>
    watchlistRe ? String(html || "").replace(watchlistRe, (m) => m.replace(/\./g, "[.]")) : String(html || "")
  );

  // ---- structured data ---------------------------------------------------
  // Strips nulls, empties and unresolved {{TODO}} values so JSON-LD never
  // describes something the page does not actually state (CLAUDE.md 7).
  eleventyConfig.addFilter("compact", function compact(value) {
    if (Array.isArray(value)) {
      const out = value.map(compact).filter((v) => v !== undefined);
      return out.length ? out : undefined;
    }
    if (value && typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        const cleaned = compact(v);
        if (cleaned !== undefined) out[k] = cleaned;
      }
      return Object.keys(out).length ? out : undefined;
    }
    if (value === null || value === undefined) return undefined;
    if (typeof value === "string") {
      const t = value.trim();
      return t === "" || t.includes("{{TODO}}") ? undefined : value;
    }
    return value;
  });
  eleventyConfig.addFilter("isReal", (v) => {
    if (v === null || v === undefined) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim() !== "" && !v.includes("{{TODO}}");
    return true;
  });
  eleventyConfig.addFilter("jsonld", (value) =>
    JSON.stringify(value, null, 0).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
  );
  eleventyConfig.addFilter("xmlEscape", (value) =>
    String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  );
  // RFC 822 for RSS and RFC 3339 for JSON Feed, both built from the ISO date.
  eleventyConfig.addFilter("rfc822", (v) => {
    const d = new Date(`${String(v).slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? "" : d.toUTCString();
  });
  eleventyConfig.addFilter("rfc3339", (v) => {
    const d = new Date(`${String(v).slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  });
  // Deterministic STIX ids: the same domain yields the same indicator id on
  // every build, so consumers can diff bundles between releases.
  eleventyConfig.addFilter("stixId", (domain) => {
    const hash = require("node:crypto").createHash("sha256").update(String(domain)).digest("hex");
    const uuid = [hash.slice(0,8), hash.slice(8,12), "5"+hash.slice(13,16),
      ((parseInt(hash.slice(16,17),16)&0x3)|0x8).toString(16)+hash.slice(17,20), hash.slice(20,32)].join("-");
    return `indicator--${uuid}`;
  });

  eleventyConfig.addFilter("csvCell", (value) => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk", "md", "css"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    // Where the built site is mounted. GitHub Pages serves this repo from
    // /citere-site/; the custom domain serves it from /. Canonical URLs and
    // JSON-LD always point at site.url and ignore this.
    pathPrefix: process.env.PATH_PREFIX || "/"
  };
};
