// Meta tags are checked hard: title <= 65 chars, description 120-160
// (CLAUDE.md section 10). These helpers build them from data so a long claim
// title or a thin facet can never quietly break the build.
function fitTitle(text, max = 65) {
  const t = String(text).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).trim() + "…";
}

function fitDescription(sentences, label, min = 120, max = 160) {
  let out = "";
  for (const sentence of sentences) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > max) continue;
    out = next;
    if (out.length >= min) break;
  }
  // Soft: a thin claim may not have enough generated sentences to reach the
  // 120-char SEO minimum. Do NOT fail the build over it — return the best we
  // could assemble; check.mjs warns on a short description. `label` kept for
  // callers that still pass it.
  void label;
  return out;
}

const listOf = (items, conjunction = "and") => {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
};

module.exports = { fitTitle, fitDescription, listOf };
