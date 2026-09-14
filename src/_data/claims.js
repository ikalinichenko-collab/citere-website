// Claim records joined to their prose and to the metrics store. data/ holds
// every number, content/ holds every sentence; this is the only place the two
// meet (CLAUDE.md §3).
//
// Individual answers are not published - only the aggregate cell
// (Citere_Data_Demo, brief §4 "/data"). So a claim's figures are read from the
// store, and its actions from the countermeasures log, rather than from copies
// kept inside the claim card.
const fs = require("node:fs");
const path = require("node:path");
const { ROOT } = require("../_lib/markdown.cjs");
const metrics = require("./metrics.js");
const { normaliseDomain } = require("../_lib/metrics.cjs");
const { CHATBOTS, SPLICES, SPLICE_LEDE, NETWORK_NAMES, COUNTERMEASURE_LADDER } = require("../_lib/labels.cjs");
const runs = require("./runs.js");
const countermeasures = require("./countermeasures.js");

const dir = path.join(ROOT, "data/claims");
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];

// The registry status chip, derived from what the countermeasures log records.
function claimStatus(actions) {
  if (actions.some((a) => a.kind === "remeasurement" && a.status === "closed")) {
    return { label: "Re-measured", cls: "ok" };
  }
  const disclosures = actions.filter((a) => a.type === "disclosure" && a.kind === "action");
  if (disclosures.some((a) => a.taken && !a.response_date && a.status !== "declined")) {
    return { label: "Awaiting response", cls: "wait" };
  }
  if (disclosures.some((a) => a.taken)) return { label: "Disclosed", cls: "" };
  if (actions.some((a) => a.type === "public" && a.taken)) return { label: "Published", cls: "" };
  if (actions.length) return { label: "Drafted", cls: "" };
  return null;
}

const claims = files
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
  .map((claim) => {
    const proseFile = path.join(ROOT, "content/en/claims", `${claim.id}.md`);
    const cells = metrics.select({ claim: claim.id });
    const grid = cells.filter((c) => !c.is_live);
    const all = metrics.pool(grid);
    const actions = countermeasures.actions.filter((a) => a.claims.includes(claim.id));
    const claimRuns = [...new Set(grid.map((c) => c.run))].sort();
    const personas = metrics.dimensions.personas || [];
    const bots = [...new Set(grid.map((c) => c.chatbot))].sort();

    // Claim Report Spec, Layer 3: Repeat Rate bot x persona, one table per
    // market. A single claim gives 4 variations x 3 repeats per cell, so every
    // cell here is below n = 20 and renders greyed - that is the honest
    // picture at claim level; significance is tested where cells pool across
    // the cluster (CM §5.6).
    // One table per market, on that market's current run. The earlier run of a
    // market appears under cleansing, not twice.
    const currentRuns = claimRuns.filter((key) => runs.currentKeys.includes(key));
    const tables = currentRuns.map((run) => ({
      run: runs.byKey[run],
      rows: bots.map((chatbot) => ({
        chatbot,
        cells: personas.map((persona) => {
          const cell = grid.find((c) => c.run === run && c.chatbot === chatbot && c.persona === persona);
          return { persona, cell: cell || null };
        })
      }))
    }));

    // Where it was repeated: one row per market, on that market's current run.
    // Counts pool across assistants, which is allowed; the rate beside them is
    // one persona, one market, one run, which is the only shape a rate has
    // (CM §5.1).
    const marketSummary = currentRuns.map((key) => {
      const run = runs.byKey[key];
      const inRun = metrics.pool(grid.filter((c) => c.run === key));
      const p2 = metrics.poolOf({ claim: claim.id, run: key, persona: "P2", is_live: false });
      return {
        market: run.market, country: run.country, language: run.language, run,
        n: inRun.n, repeat: inRun.counts.repeat, critical: inRun.tiers.critical,
        contaminated: inRun.contaminated, rate: p2.repeat_rate, persona: "P2"
      };
    }).sort((a, b) => b.repeat - a.repeat || a.market.localeCompare(b.market));

    // CM §7: observed change after escalation, in the markets where a second
    // comparable run exists. Never "effect of escalation".
    const cleansing = [];
    for (const market of [...new Set(grid.map((c) => c.market))].sort()) {
      const inMarket = claimRuns
        .map((key) => runs.byKey[key])
        .filter((r) => r && r.market === market)
        .sort((a, b) => a.collected_at.localeCompare(b.collected_at));
      if (inMarket.length < 2) continue;
      const [before, after] = [inMarket[0], inMarket[inMarket.length - 1]];
      if (!before.comparable_with.includes(after.key)) continue;
      cleansing.push({
        market, before, after, persona: "P2", bots,
        rows: bots.map((chatbot) => {
          const b = metrics.poolOf({ claim: claim.id, chatbot, persona: "P2", run: before.key, is_live: false });
          const a = metrics.poolOf({ claim: claim.id, chatbot, persona: "P2", run: after.key, is_live: false });
          return { chatbot, before: b.repeat_rate, after: a.repeat_rate, change: metrics.compare(b, a) };
        })
      });
    }

    // Layer 3 "Evidence": every CRITICAL and a sample of HIGH is the public
    // variant (the spec caps HIGH at ten; six keeps the page inside its budget).
    // public variant shows. Anything generated from the claim card rather than
    // recorded is flagged so the page can say so beside it.
    const allIncidents = metrics.incidents.filter((i) => i.claim === claim.id);
    const criticalIncidents = allIncidents.filter((i) => i.tier === "critical");
    const highIncidents = allIncidents.filter((i) => i.tier === "high");
    // Every CRITICAL is shown; HIGH fills up to seventeen blocks in total and
    // never more than five (the spec caps HIGH at ten, and the page has a
    // 100 KB budget it now spends on the per-market table as well).
    const highShown = Math.max(0, Math.min(5, 17 - criticalIncidents.length));
    const incidents = [...criticalIncidents, ...highIncidents.slice(0, highShown)];

    // ---------------------------------------------------------- Layer 2
    // One block per bot, worst first: critical incidents, then repeats. Counts
    // only in this layer, never rates (Claim Report Spec, Layer 2).
    const botBlocks = bots.map((key) => {
      const own = grid.filter((c) => c.chatbot === key);
      const pooled = metrics.pool(own);
      const byPersona = personas
        .map((persona) => ({ persona, repeat: own.filter((c) => c.persona === persona)
          .reduce((n, c) => n + c.counts.repeat, 0) }))
        .sort((a, b) => b.repeat - a.repeat);
      const byMarket = [...new Set(own.map((c) => c.market))]
        .map((market) => ({ market, repeat: own.filter((c) => c.market === market)
          .reduce((n, c) => n + c.counts.repeat, 0) }))
        .sort((a, b) => b.repeat - a.repeat);
      const listed = pooled.listedDomains.filter((d) => d.repeat > 0);
      return {
        key,
        name: (CHATBOTS[key] || {}).name || key,
        n: pooled.n,
        repeat: pooled.counts.repeat,
        critical: pooled.tiers.critical,
        high: pooled.tiers.high,
        dodge: pooled.counts.dodge,
        dominantPersona: byPersona[0] && byPersona[0].repeat ? byPersona[0].persona : null,
        worstMarket: byMarket[0] && byMarket[0].repeat ? byMarket[0] : null,
        // One market carrying most of the repeats is worth naming.
        marketConcentrated: byMarket[0] && pooled.counts.repeat
          ? byMarket[0].repeat / pooled.counts.repeat > 0.6 : false,
        listedWhileRepeating: listed,
        tone: pooled.counts.repeat ? "bad" : "ok"
      };
    }).sort((a, b) => b.critical - a.critical || b.repeat - a.repeat || a.name.localeCompare(b.name));

    // The domains this claim reached, against the ones its card records as
    // having carried it (Sources Registry §6: the intersection is the
    // source-to-answer line).
    const distributed = (claim.surface_objects || [])
      .filter((o) => o.type === "outlet" || o.type === "clone")
      .map((o) => ({ ...o, domain: normaliseDomain(o.object) }));
    const distributedSet = new Set(distributed.map((d) => d.domain));
    const reached = all.listedDomains;
    const reachedSet = new Set(reached.map((d) => d.domain));
    const sourcesIdentified = {
      traced: distributed.map((d) => ({
        ...d,
        ...(reached.find((r) => r.domain === d.domain) || { cited: 0, repeat: 0, critical: 0 }),
        injection: reachedSet.has(d.domain)
      })),
      found: reached.filter((d) => !distributedSet.has(d.domain)),
      injection: distributed.filter((d) => reachedSet.has(d.domain)).length
    };

    // The dated chain the claim travelled, ending where a chatbot answer is.
    const chain = [...distributed]
      .filter((d) => d.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((d) => ({ ...d, injection: reachedSet.has(d.domain) }));

    // Layer 3 "Live formulations vs constructed grid": the same claim asked the
    // way people actually ask, against the designed prompts, in the one market
    // where both exist. A check on our own method, never pooled with the grid.
    const liveRuns = [...new Set(cells.filter((c) => c.is_live).map((c) => c.run))];
    const liveComparison = liveRuns.map((run) => ({
      run: runs.byKey[run],
      rows: bots.map((chatbot) => {
        const live = metrics.poolOf({ claim: claim.id, chatbot, run, is_live: true });
        const gridSide = metrics.poolOf({ claim: claim.id, chatbot, run, persona: "P2", is_live: false });
        return { chatbot, live: live.repeat_rate, grid: gridSide.repeat_rate,
                 agree: metrics.compare(gridSide, live) };
      })
    }));

    // Layer 3 "Limitations": generated from the run, not written by hand.
    const lowCells = grid.filter((c) => c.repeat_rate.low_n).length;
    const limitations = grid.length ? {
      lowCells,
      cells: grid.length,
      quarantined: grid.reduce((n, c) => n + c.quarantined, 0),
      unresolved: grid.reduce((n, c) => n + c.unresolved, 0),
      needsReview: grid.reduce((n, c) => n + c.review.needs_human_review, 0),
      reviewed: grid.reduce((n, c) => n + c.review.human_labelled, 0),
      repeats: (claimRuns.map((k) => runs.byKey[k]).find(Boolean) || {}).repeats || null,
      judge: (claimRuns.map((k) => runs.byKey[k]).find(Boolean) || {}).judge_validation || null,
      unstable: grid.reduce((n, c) => n + (c.unstable_pairs || 0), 0),
      stability: (() => {
        const values = grid.map((c) => c.stability).filter((v) => typeof v === "number");
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      })(),
      window: [grid.map((c) => c.first_seen).sort()[0],
               grid.map((c) => c.last_seen).sort().pop()],
      live: cells.filter((c) => c.is_live).reduce((n, c) => n + c.n, 0),
      missing: claimRuns.map((k) => runs.byKey[k]).filter(Boolean)
        .reduce((n, r) => n + (r.reconciliation.missing || 0), 0)
    } : null;

    // The escalation ladder for this claim (Countermeasures Catalogue §4).
    // A rung is done when something on it has been taken, available when its
    // prerequisites are met, locked when they are not - and a locked rung says
    // which prerequisite is missing rather than just greying out.
    const takenOn = (types) => actions.filter((a) => a.taken && a.kind === "action" && types.includes(a.type));
    const draftedOn = (types) => actions.filter((a) => !a.taken && a.kind === "action" && types.includes(a.type));
    const remeasurements = actions.filter((a) => a.kind === "remeasurement");
    const remeasured = remeasurements.filter((a) => a.status === "closed");
    // CM §7 / catalogue §2.12: the terminal rung needs a disclosure, a public
    // record, and a re-measurement that found no significant improvement.
    const noRemediation = cleansing.some((block) =>
      block.rows.some((r) => r.change && !r.change.significant));
    const ladder = COUNTERMEASURE_LADDER.map((rung) => {
      const done = takenOn(rung.types);
      const drafted = draftedOn(rung.types);
      let state = done.length ? "done" : "available";
      let reason = null;
      if (rung.key === "terminal") {
        const missing = [];
        if (!takenOn(["disclosure"]).length) missing.push("no disclosure to the platform on record");
        if (!takenOn(["public"]).length) missing.push("no public report on record");
        if (!remeasured.length) missing.push("no re-measurement has run yet");
        else if (!noRemediation) missing.push("the re-measurement has not yet shown an absence of remediation");
        if (!done.length && missing.length) { state = "locked"; reason = missing.join("; "); }
      } else if (!done.length && !drafted.length) {
        state = "available";
        reason = "nothing of this kind has been done on this claim yet";
      }
      return { ...rung, state, done, drafted, all: [...done, ...drafted], reason,
               label: rung.label,
               types: rung.types };
    });
    const rungsReached = ladder.filter((r) => r.state === "done").length;

    // ---------------------------------------------------------- Layer 1
    // The headline is the finding, not the topic (Claim Report Spec, Layer 1).
    // Analyst-written where the prose supplies one; otherwise built from what
    // the run found, so it always names what happened.
    const listOf = (items, join = "and") => items.length < 2
      ? (items[0] || "")
      : `${items.slice(0, -1).join(", ")} ${join} ${items[items.length - 1]}`;
    const withCritical = botBlocks.filter((b) => b.critical);
    const fromMemory = botBlocks.filter((b) => b.repeat && !b.critical);
    const clean = botBlocks.filter((b) => !b.repeat);
    const networks = [...new Set(sourcesIdentified.traced
      .filter((d) => d.injection).map((d) => d.domain))];

    let headline = null;
    if (grid.length) {
      headline = withCritical.length
        ? `${listOf(withCritical.map((b) => b.name))} stated this as fact and cited ` +
          `${networks.length ? "a source that had carried it" : "a listed source"} in the same answer`
        : fromMemory.length
          ? `${listOf(fromMemory.map((b) => b.name))} stated this as fact, with no source behind it`
          : "No assistant stated this as fact in any market we tested";
    }

    // Four sentences, fixed order. The first two describe the claim, the last
    // two what the assistants did with it.
    const lede = grid.length ? [
      `The claim ${SPLICE_LEDE[claim.splice] || "distorts a real event."}`,
      `We put it to ${bots.length} assistants in ${[...new Set(grid.map((c) => c.market))].length} markets, ` +
        `four ways each, three times over: ${all.n} answers.`,
      withCritical.length
        ? `${listOf(withCritical.map((b) => b.name))} repeated it and cited a listed source in the same answer.`
        : "No assistant both repeated it and cited a listed source.",
      fromMemory.length
        ? `${listOf(fromMemory.map((b) => b.name))} repeated it with no source attached` +
          (clean.length ? `; ${listOf(clean.map((b) => b.name))} did not repeat it at all.` : ".")
        : clean.length ? `${listOf(clean.map((b) => b.name))} did not repeat it at all.` : ""
    ].filter(Boolean) : [];

    // The brief under the headline: three things a reader wants before any
    // table — what is actually true, how the claim was pushed, and what the
    // assistants did with it. Every sentence is built from the record.
    const fmt = (iso) => {
      const d = new Date(`${iso}T00:00:00Z`);
      return `${d.getUTCDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    };
    const originParts = [];
    if (claim.origin && claim.origin.first_seen) {
      originParts.push(`First seen ${fmt(claim.origin.first_seen)}` +
        (claim.origin.network ? ` on the ${NETWORK_NAMES[claim.origin.network] || claim.origin.network} network` : "") +
        (distributed.length
          ? `, then carried by ${distributed.length} ${distributed.length === 1 ? "site" : "sites"} on our watchlist` : "") + ".");
    }
    if (sourcesIdentified.injection) {
      originParts.push(`${sourcesIdentified.injection === distributed.length && distributed.length > 1 ? "All" : sourcesIdentified.injection} of ` +
        `${sourcesIdentified.injection === distributed.length && distributed.length > 1 ? "them" : "those sites"} ` +
        `${sourcesIdentified.injection === 1 ? "was" : "were"} later cited by an assistant answering about it.`);
    }
    if (claim.origin && (claim.origin.attribution || []).length) {
      originParts.push(`Attributed by ${listOf(claim.origin.attribution.map((a) => a.org))}.`);
    }
    const marketCount = [...new Set(grid.map((c) => c.market))].length;
    const assistantParts = grid.length ? [
      headline ? `${headline}.` : "",
      fromMemory.length && withCritical.length
        ? `${listOf(fromMemory.map((b) => b.name))} repeated it too, with no source attached.` : "",
      clean.length ? `${listOf(clean.map((b) => b.name))} did not repeat it.` : "",
      `In all, ${all.counts.repeat} of ${all.n} answers across ${marketCount} ${marketCount === 1 ? "country" : "countries"} stated it as fact.`
    ].filter(Boolean) : ["Catalogued, and not yet put to an assistant. The measurement sections appear once it is included in a run."];
    const brief = {
      truth: claim.canonical_debunk || null,
      origin: originParts.join(" ") || null,
      assistants: assistantParts.join(" ")
    };

    return {
      ...claim,
      raw: claim,
      url: `/registry/${claim.slug}/`,
      titles: { en: claim.title_en, uk: claim.title_uk || claim.title_en },
      hasProse: fs.existsSync(proseFile),
      tested: grid.length > 0,
      // `status` is the derived countermeasure chip; the card's own lifecycle
      // field keeps its name under status_field so both survive.
      status_field: claim.status || null,
      cells: grid,
      incidents,
      liveComparison,
      limitations,
      incidentCounts: { critical: criticalIncidents.length, high: highIncidents.length,
                        shown: incidents.length, total: allIncidents.length },
      hasSyntheticText: incidents.some((i) => i.synthetic),
      botBlocks,
      sourcesIdentified,
      chain,
      splice_label: SPLICES[claim.splice] || null,
      splice_lede: SPLICE_LEDE[claim.splice] || null,
      headline,
      lede,
      tables,
      marketSummary,
      brief,
      cleansing,
      liveCells: cells.filter((c) => c.is_live),
      pooled: all,
      runs: claimRuns.map((key) => runs.byKey[key]).filter(Boolean),
      markets: [...new Set(grid.map((c) => c.market))].sort(),
      chatbots: [...new Set(grid.map((c) => c.chatbot))].sort(),
      repeatedBy: [...new Set(grid.filter((c) => c.counts.repeat > 0).map((c) => c.chatbot))].sort(),
      botsTested: new Set(grid.map((c) => c.chatbot)).size,
      citedDomains: all.listedDomains.map((d) => d.domain),
      langLabel: (claim.languages || []).map((l) => l.toUpperCase()).join(" "),
      counts: {
        observations: all.n,
        repeated: all.counts.repeat,
        critical: all.tiers.critical,
        contaminated: all.contaminated,
        actions: actions.filter((a) => a.taken).length,
        responses: actions.filter((a) => a.response_date).length
      },
      countermeasures: actions,
      ladder,
      rungsReached,
      remeasurements,
      escalationUrl: `/registry/${claim.slug}/escalation/`,
      remeasuredOn: actions
        .filter((a) => a.kind === "remeasurement" && a.status === "closed")
        .map((a) => a.date).sort().pop() || null,
      status: claimStatus(actions)
    };
  });

claims.sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0));

module.exports = claims;
