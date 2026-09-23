// Pre-restructure URLs that must keep resolving. Every entry renders a stub at
// `from` pointing at `to` (CLAUDE.md §4: a URL change requires a redirect).
module.exports = [
  { from: "/escalations/", to: "/countermeasures/" },
  { from: "/uk/escalations/", to: "/uk/countermeasures/" },
  // The Chatbot benchmark leaderboard moved onto /benchmarks/; per-bot pages stay
  // at /platforms/{bot}/. The index is now a redirect.
  { from: "/platforms/", to: "/benchmarks/" },
  { from: "/uk/platforms/", to: "/uk/benchmarks/" }
];
