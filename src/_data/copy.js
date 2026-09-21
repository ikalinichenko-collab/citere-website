// Human-written prose from content/en/. Never contains numbers: where a
// sentence needs one it writes {{ name }} and the template fills it from data/.
// The Ukrainian tree arrives with the mirror at build step 9.
const { loadDir } = require("../_lib/markdown.cjs");

module.exports = {
  en: {
    ...loadDir("content/en"),
    claims: loadDir("content/en/claims"),
    reports: loadDir("content/en/reports")
  },
  // Ukrainian prose. loadDir returns {} for any tree that does not exist yet, so
  // a page with no uk/{pageKey}.md falls back to English (pages.11tydata.js)
  // under the translation notice (src/src.11tydata.js).
  uk: {
    ...loadDir("content/uk"),
    claims: loadDir("content/uk/claims"),
    reports: loadDir("content/uk/reports")
  }
};
