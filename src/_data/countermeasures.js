// The countermeasures log: one row per action, across every claim and market.
//
// Normative: docs/citere-spec/Citere_Countermeasures_Catalogue.md. Twelve types
// (§2.1-2.12), one lifecycle for all of them (§1), the ladder in §4, and the
// agent boundary in §0 - a draft is visibly not an action taken.
//
// Rows still arrive in the pre-restructure vocabulary, so each is normalised
// here. Rows already speaking the catalogue's vocabulary pass through
// untouched, which is what happens once the exporter is updated.
const { readJson } = require("../_lib/markdown.cjs");
const {
  COUNTERMEASURE_TYPES, COUNTERMEASURE_STATUSES, COUNTERMEASURE_LADDER,
  COUNTERMEASURE_PRIVATE_FIELDS, REMEASUREMENT, LEGACY_TYPE, LEGACY_SUBTYPE, LEGACY_STATUS
} = require("../_lib/labels.cjs");

const raw = readJson("data/countermeasures.json") || {};
const TODAY = new Date().toISOString().slice(0, 10);

function normalise(action, index) {
  const type = COUNTERMEASURE_TYPES[action.type] ? action.type : LEGACY_TYPE[action.type] || null;
  const status = COUNTERMEASURE_STATUSES[action.status] ? action.status : LEGACY_STATUS[action.status] || null;
  const meta = COUNTERMEASURE_STATUSES[status] || {};
  const typeMeta = COUNTERMEASURE_TYPES[type] || {};
  const subtype = action.subtype || LEGACY_SUBTYPE[action.type] || null;

  // Catalogue §2.1 "Track": a re-measurement is the follow-up on a disclosure,
  // not an action of its own. It keeps the catalogue type so the enum stays
  // exactly twelve, and carries a kind so the Claim Report and the Countries
  // index can still show their "re-measurement" column - and so it never
  // counts towards "countermeasures taken", which would double-count our own
  // re-runs as things we did to someone.
  const isRemeasurement = action.kind === "remeasurement" ||
    action.subtype === "remeasurement" || action.type === "remeasured";
  const kind = isRemeasurement ? "remeasurement" : "action";
  const followUp = action.follow_up_due || (isRemeasurement ? action.date : null);
  const scheduled = kind === "remeasurement" && !meta.taken && followUp > TODAY;

  const row = {
    id: action.id || `CM-${String(index + 1).padStart(4, "0")}`,
    date: action.date || null,
    type,
    kind,
    subtype,
    // What a table groups by: a re-measurement gets its own column rather than
    // inflating the disclosure count.
    displayType: kind === "remeasurement" ? REMEASUREMENT.key : type,
    typeLabel: kind === "remeasurement" ? REMEASUREMENT.label : typeMeta.label || action.type,
    typeClass: kind === "remeasurement" ? REMEASUREMENT.cls : typeMeta.cls || "",
    subtypeLabel: (typeMeta.subtypes || {})[subtype] || null,
    target: action.target || null,
    // ④ Disclosure: the bot product it is about (drone model id, e.g. "grok-web").
    // Null for every other type. The per-bot platform ladder groups disclosures by it.
    bot: action.bot || null,
    market: action.market || null,
    claims: action.claim_ids || (action.claim_id ? [action.claim_id] : []),
    status,
    statusLabel: scheduled ? "Scheduled" : meta.label || action.status,
    statusClass: scheduled ? "st-scheduled" : meta.cls || "",
    // Catalogue §0: nothing leaves Citere without a human click, so a draft is
    // never counted as an action taken. Re-measurements are our own re-runs.
    taken: meta.taken === true && kind === "action",
    awaitingConfirmation: status === "pending_confirmation",
    scheduled,
    response_date: action.response_date || null,
    follow_up_due: followUp,
    evidence_package_id: action.evidence_package_id || null,
    url: action.url || "",
    // Public detail from the Escalation Actions forms: ① social posts, ⑤ the
    // complained-about source and grounds. Not submission content — safe to show.
    links: Array.isArray(action.links) ? action.links : null,
    domain: action.domain || null,
    basis: action.basis || null,
    // Default true: a row is public unless the export says otherwise.
    public: action.public !== false,
    legacy: { type: action.type, status: action.status }
  };
  // Catalogue §1 / brief §4: submission content and proof are internal only.
  for (const field of COUNTERMEASURE_PRIVATE_FIELDS) delete row[field];
  return row;
}

const all = (raw.actions || [])
  .map(normalise)
  .sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : (a.date || "") > (b.date || "") ? -1 : 0));

// The public log. Everything the site renders comes from here.
const actions = all.filter((a) => a.public);
const count = (fn) => actions.filter(fn).length;

const byType = {};
for (const a of actions) (byType[a.displayType] ||= []).push(a);

const typeRows = Object.entries(COUNTERMEASURE_TYPES).map(([key, meta]) => ({
  key, ...meta, count: (byType[key] || []).length
}));
// The derived column both page specs ask for (Claim Report §Countermeasures,
// Countries Index Business Logic §12).
typeRows.push({ ...REMEASUREMENT, count: (byType[REMEASUREMENT.key] || []).length });

module.exports = {
  actions,
  byType,
  types: typeRows,
  ladder: COUNTERMEASURE_LADDER.map((rung) => ({
    ...rung,
    actions: actions.filter((a) => a.kind === "action" && rung.types.includes(a.type)),
    reached: actions.some((a) => a.taken && rung.types.includes(a.type))
  })),
  statuses: Object.entries(COUNTERMEASURE_STATUSES).map(([key, meta]) => ({
    key, ...meta, count: count((a) => a.status === key)
  })),
  remeasurements: actions.filter((a) => a.kind === "remeasurement"),
  targets: [...new Set(actions.map((a) => a.target).filter(Boolean))].sort(),
  markets: [...new Set(actions.map((a) => a.market).filter(Boolean))].sort(),
  totals: {
    logged: actions.length,
    taken: count((a) => a.taken),
    drafted: count((a) => a.status === "drafted" && a.kind === "action"),
    awaitingConfirmation: count((a) => a.awaitingConfirmation),
    remeasurements: count((a) => a.kind === "remeasurement"),
    scheduled: count((a) => a.scheduled),
    answered: count((a) => Boolean(a.response_date)),
    targets: new Set(actions.map((a) => a.target).filter(Boolean)).size,
    withheld: all.length - actions.length
  },
  // Kept for the current page copy until /countermeasures is rebuilt at step 4.
  total: actions.length,
  answered: raw.answered,
  medianResponseDays: raw.median_response_days
};
