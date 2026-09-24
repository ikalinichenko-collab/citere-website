// Flattened metric cells from every published Claim Report — the machine-export
// shape for /cells.json. Seed metrics.json is not used here.
const published = require("./published.js");

const cells = [];
for (const rpt of Object.values(published.reports || {})) {
  const meta = (rpt.payload && rpt.payload.meta) || {};
  for (const c of (rpt.payload && rpt.payload.resultsByBot && rpt.payload.resultsByBot.cells) || []) {
    cells.push({
      claim_key: rpt.claimKey,
      slug: rpt.slug,
      cluster: rpt.clusterName,
      splice: rpt.splice,
      bot: c.model,
      persona: c.persona,
      market: c.market || "",
      repeat: c.repeat || 0,
      substantive: c.substantive || 0,
      contaminated: c.contaminated || 0,
      valid: c.valid || 0,
      dodge: c.dodge || 0,
      run_keys: meta.runKeys || []
    });
  }
}

module.exports = { cells, count: cells.length, low_n: 20 };
