// Language-neutral path for every page: /uk/about/ and /about/ share /about/.
module.exports = {
  eleventyComputed: {
    // CLAUDE.md 2: a page with no translated prose renders the English
    // original with the correct lang and a one-line notice.
    translationMissing: (data) => {
      const lang = data.lang || "en";
      if (lang === "en") return false;
      // Per prose page: translated when copy[lang][pageKey] exists. Non-prose
      // (generated) pages have no pageKey and carry no notice.
      const key = data.docName || data.pageKey;
      if (!key) return false;
      return !(data.copy && data.copy[lang] && data.copy[lang][key]);
    },
    basePath: (data) => {
      const url = (data.page && data.page.url) || "/";
      if (url === "/uk/") return "/";
      return url.startsWith("/uk/") ? url.slice(3) : url;
    }
  }
};
