// Shared loader for everything under content/: front matter + Markdown, split by H2.
// Numbers never live here - prose only (CLAUDE.md section 3).
const fs = require("node:fs");
const path = require("node:path");
const matter = require("gray-matter");
const MarkdownIt = require("markdown-it");

// HTML is allowed: content/ is repo-authored, and the mockup's prose carries
// .kicker and .callout elements that must survive verbatim.
const md = new MarkdownIt({ html: true, linkify: false, typographer: false });

// Honour "## Heading {#id}" when rendering full documents. markdown-it has no
// attribute support, so a heading carrying an explicit id would otherwise print
// the literal "{#id}" as text and produce no anchor — which quietly breaks every
// in-page link that targets it (e.g. /data/#cite, /about/#contact). loadDoc
// already parses the marker for its section map; this does the same for doc.html.
md.core.ruler.push("heading_ids", (state) => {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].type !== "heading_open") continue;
    const inline = tokens[i + 1];
    if (!inline || inline.type !== "inline") continue;
    const marker = inline.content.match(/\s*\{#([a-z0-9-]+)\}\s*$/);
    if (!marker) continue;
    tokens[i].attrSet("id", marker[1]);
    inline.content = inline.content.replace(/\s*\{#[a-z0-9-]+\}\s*$/, "");
    const children = inline.children || [];
    for (let j = children.length - 1; j >= 0; j--) {
      if (children[j].type === "text" && /\{#[a-z0-9-]+\}\s*$/.test(children[j].content)) {
        children[j].content = children[j].content.replace(/\s*\{#[a-z0-9-]+\}\s*$/, "");
        break;
      }
    }
  }
});
const ROOT = path.join(__dirname, "..", "..");

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// A heading may carry an explicit id: "## Key findings {#key-findings}".
// Translations use the same id, so templates address a section by one key in
// every language. Without one, the id is slugified from the title, and a title
// that slugifies to nothing (any non-Latin script) falls back to its position.
function loadDoc(file) {
  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  const parts = content.split(/^##[ \t]+/m);
  const intro = parts.shift() || "";
  const sections = {};
  const order = [];
  for (const [index, part] of parts.entries()) {
    const nl = part.indexOf("\n");
    let title = (nl === -1 ? part : part.slice(0, nl)).trim();
    const body = nl === -1 ? "" : part.slice(nl + 1);
    const explicit = title.match(/\s*\{#([a-z0-9-]+)\}$/);
    if (explicit) title = title.slice(0, explicit.index).trim();
    const id = explicit ? explicit[1] : slugify(title) || `section-${index + 1}`;
    sections[id] = { id, title, html: md.render(body).trim(), text: body.trim() };
    order.push(id);
  }
  return {
    data,
    intro: md.render(intro).trim(),
    introText: intro.trim(),
    html: md.render(content).trim(),
    sections,
    order
  };
}

function loadDir(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return {};
  const out = {};
  for (const file of fs.readdirSync(full).filter((f) => f.endsWith(".md"))) {
    out[file.replace(/\.md$/, "")] = loadDoc(path.join(full, file));
  }
  return out;
}

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

module.exports = { md, slugify, loadDoc, loadDir, readJson, exists, ROOT };
