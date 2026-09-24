// Published exports. Like navigation, an entry appears only once the template
// that writes the file exists, so /data/ never advertises a missing download.
const fs = require("node:fs");
const path = require("node:path");
const { ROOT } = require("../_lib/markdown.cjs");

const built = (template) => fs.existsSync(path.join(ROOT, "src", template));

// Grouped by entity, which is how /data presents them (brief §4, "/data").
// Published: claim cards with the short debunk, run metadata, aggregated metric
// cells, the three registry exports, and the public countermeasure slice.
// Never published: prompt grid text, response text, P4 detail, judge prompts
// and rubric, countermeasure submission content and proof.
const ENTRIES = [
  {
    key: "claims-csv", entity: "claims", name: "Claims (CSV)", format: "CSV", header: "claim_id,slug,cluster_id,label,verdict,published_at,splice,bots_tested,answers,countries,repeated_fake,critical,sources_identified,countermeasures_taken,url",
    description: "One row per published Claim Report: the falsehood, the verdict, how the lie is spliced onto the truth, and the KPI strip.",
    url: "/claims.csv", template: "machine/claims-csv.njk"
  },
  {
    key: "claims-json", entity: "claims", name: "Claims (JSON)", format: "JSON",
    description: "The published Claim Report index. Full payloads are at /registry/{slug}.json.",
    url: "/claims.json", template: "machine/claims-json.njk"
  },
  {
    key: "registry-json", entity: "claims", name: "Claim registry (JSON, legacy)", format: "JSON",
    description: "The published Claim Report index in one file. Kept so existing links keep working.",
    url: "/registry.json", template: "machine/registry-json.njk"
  },
  {
    key: "runs-csv", entity: "runs", name: "Runs (CSV)", format: "CSV", header: "run_id,cluster_id,markets,collected_at,claims,models,personas,per_run,catalog_version,grid_version,judge_version,watchlist_version,judge_validation,claim_keys",
    description: "One row per run key frozen in a published Claim Report: scope, versions and the claims that used it.",
    url: "/runs.csv", template: "machine/runs-csv.njk"
  },
  {
    key: "runs-json", entity: "runs", name: "Runs (JSON)", format: "JSON",
    description: "The same published run keys as JSON.",
    url: "/runs.json", template: "machine/runs-json.njk"
  },
  {
    key: "registry-csv", entity: "cells", name: "Metric cells (CSV)", format: "CSV", header: "claim_key,slug,bot,persona,market,repeat,substantive,repeat_rate,contaminated,valid,contamination_rate,low_n",
    description: "Frozen per-cell figures from every published Claim Report: one row per assistant, claim, question type and market.",
    url: "/registry.csv", template: "machine/registry-csv.njk"
  },
  {
    key: "cells-json", entity: "cells", name: "Metric cells (JSON)", format: "JSON",
    description: "The same published cells as JSON.",
    url: "/cells.json", template: "machine/cells-json.njk"
  },
  {
    key: "sources-csv", entity: "registry", name: "Domains (CSV)", format: "CSV", header: "domain,slug,network,label,first_seen,citations,cited_in,cited_by,attribution,complaint_status,url",
    description: "One row per watchlisted domain, with its network and its published attribution.",
    url: "/sources.csv", template: "machine/sources-csv.njk"
  },
  {
    key: "citations-csv", entity: "registry", name: "Citations (CSV)", format: "CSV", header: "domain,network,category,chatbot,cited_count,critical_count,url",
    description: "One row per domain and assistant, from the published Sources Registry.",
    url: "/citations.csv", template: "machine/citations-csv.njk"
  },
  {
    key: "injection-csv", entity: "registry", name: "Source-to-answer lines (CSV)", format: "CSV", header: "domain,category,network,attributed_by,claim_id,cluster_id,claim_label,distributed_first_seen,reached_bots,reached_markets,cited_count,critical_count,claim_url",
    description: "One row per domain and claim where the domain published the falsehood and an assistant cited it while answering about that same falsehood.",
    url: "/injection-lines.csv", template: "machine/injection-lines-csv.njk"
  },
  {
    key: "sources-stix", entity: "registry", name: "Domains (STIX 2.1)", format: "STIX 2.1",
    description: "The same watchlist as a STIX 2.1 bundle, one indicator per domain, for CERT, MISP and OpenCTI.",
    url: "/sources.stix.json", template: "machine/sources-stix.njk"
  },
  {
    key: "countermeasures-csv", entity: "countermeasures", name: "Countermeasures (CSV)", format: "CSV", header: "date,type,target,claim_id,status,response_date,claim_url",
    description: "The public slice: date, type, target, market, claims and status. Never the submission or the proof.",
    url: "/countermeasures.csv", template: "machine/countermeasures-csv.njk"
  },
  {
    key: "countermeasures-json", entity: "countermeasures", name: "Countermeasures (JSON)", format: "JSON",
    description: "The same slice, with the follow-up date each action is waiting on.",
    url: "/countermeasures.json", template: "machine/countermeasures-json.njk"
  }
];

const ENTITIES = [
  { key: "claims", name: "Claims",
    blurb: "Every claim's public card: the falsehood, the real facts an assistant may state without repeating it, the short debunk with its sources, how the lie is built, and where it spread." },
  { key: "runs", name: "Runs",
    blurb: "Metadata for every data-collection run: cluster, country, language, date, the frozen versions and the shape of the prompt grid. No prompt text." },
  { key: "cells", name: "Metric cells",
    blurb: "The aggregated unit behind every figure on the site: one assistant, one claim, one question type, one market, one run, with counts and confidence bounds. Individual answers are not published, only this aggregate." },
  { key: "registry", name: "Sources registry",
    blurb: "Domains, their citations, and the source-to-answer lines where a domain both published a falsehood and was cited by an assistant answering about it." },
  { key: "countermeasures", name: "Countermeasures",
    blurb: "The public slice of the countermeasures log: date, type, target, market and status. Submission content and proof of submission are internal only." }
];

const live = ENTRIES.filter((e) => built(e.template)).map((e) => ({ ...e, shared: true }));

module.exports = {
  all: live,
  entities: ENTITIES.map((e) => ({ ...e, files: live.filter((f) => f.entity === e.key) }))
    .filter((e) => e.files.length),
  has: Object.fromEntries(ENTRIES.map((e) => [e.key, built(e.template)])),
  byKey: Object.fromEntries(live.map((e) => [e.key, e]))
};
