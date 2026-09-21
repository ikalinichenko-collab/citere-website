// Shared by every page in src/pages/. A page declares pageKey; its H1, lead and
// prose come from content/en/{pageKey}.md so no sentence lives in a template.
const { home, crumb, t } = require("../_lib/crumbs.cjs");

// The page's prose in the served language, falling back to the English original
// when there is no translation for this pageKey.
const pickDoc = (data) => {
  const key = data.docName || data.pageKey;
  const lang = data.lang || "en";
  const localized = lang !== "en" && data.copy[lang] && data.copy[lang][key];
  return localized || data.copy.en[key];
};

module.exports = {
  eleventyComputed: {
    doc: (data) => pickDoc(data),
    h1: (data) => {
      const doc = pickDoc(data);
      return (doc && doc.data && doc.data.h1) || data.h1;
    },
    breadcrumbTrail: (data) =>
      data.crumbKey
        ? [home(data.lang), crumb(data.lang, data.crumbKey, String(data.basePath))]
        : [home(data.lang)]
  }
};
