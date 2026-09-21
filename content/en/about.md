---
h1: About Citere
lead: >
  Citere is a Ukrainian technology company countering Russian information aggression online and
  inside AI models. Our AI-driven system regularly tests whether leading assistants spread fakes and
  disinformation that harm Ukraine, identifies the networks behind them, and works to get them removed.
---

## What we do

People increasingly get news and answers from AI models instead of search. Russia exploits this: its networks flood the internet with material that AI models pick up and repeat to users. Citere's system regularly tests leading AI models in Ukraine's partner countries, detects Russian fakes and disinformation that harm Ukraine, identifies the networks that spread them, and takes measures to remove them — escalating cases to AI platforms, sharing data with fact-checkers and partners, publishing reports and updating the narrative catalog.

Our operating cycle is **Detect → Attribute → Remediate**. The focus is narrow on purpose: Russian fakes and disinformation that harm Ukraine's national security and interests, and Ukrainian businesses, organizations and public institutions. Every case, dataset and report is built around that, not around generic "narrative attacks".

We work only through the public consumer interfaces of AI assistants — the same product ordinary users get, not privileged API access — because that is the surface where the harm actually reaches people. We do not run influence operations of our own, we do not lobby, and we do not optimise anyone's presence in AI answers.

## The problem — nobody was watching the models

Russia now targets not only people but AI models. Networks such as Pravda / Portal Kombat, Doppelganger, Matryoshka and Storm-1516 mass-publish material that ends up in search results and training data, and from there in chatbot answers. To the user, an assistant's answer looks neutral and authoritative — they cannot see the Russian source or the seeded narrative behind it.

The most dangerous content is not outright fakes but falsehoods with a **grain of truth**: a real fact with a fabrication built on top. Models repeat such claims noticeably more often. And contamination happens on ordinary questions — no malicious prompt is needed to get propaganda into an answer; asking about the news is enough.

Social media and Telegram are monitored. Model answers were not. **Now they are.**

## How it works

Every model answer is assessed on two independent layers, and only their intersection counts as critical.

- **Layer A — what the model said.** An LLM judge assigns each answer one of four categories: *REPEAT* (repeated the falsehood as fact), *REFUTE* (refuted it), *U_context* (answered the request but marked where the truth ends), *DODGE* (evaded). We classify behaviour relative to a known false narrative, not the general accuracy of the answer.
- **Layer B — what it cited.** We record whether the answer cited a watchlisted domain that had spread this specific fake.
- **The A×B matrix.** The most severe tier is *CRITICAL*: the model both repeated the narrative and cited a watchlisted source.

Each narrative is tested with four personas, from neutral to malicious, and results are never averaged across them. Every claim records the real fact it is built on, so a model's honest caveats are not counted as repetition. All shares carry Wilson 95% confidence intervals, and samples under 20 are flagged as small.

## What a partner gets

An evidence-based picture of what leading AI models say about a topic, and a path to fixing it:

- **Visibility** — which models, in which markets and languages, repeat the narrative.
- **Priority** — the A×B matrix separates the few truly critical cases from dozens of merely suspicious ones.
- **Attribution** — which sources and networks are behind the narrative.
- **Evidence** — a report with the exact wording, sources, tables and method limitations, ready to hand to platforms and regulators.
- **Action** — escalation to platforms, data sharing with fact-checkers and partners, and re-measurement.

## Company details

| | |
|---|---|
| Brand | Citere |
| Legal entity | SITERA LLC (ТОВ «СІТЕРА») |
| Country of registration | Ukraine |
| Headquarters | Kharkiv, Ukraine |
| Founded | 2026 |
| Team size | 10+ |
| Legal regime | Diia.City resident since May 2026 |
| Website | citere.ai |
| Contact | vitaly@citere.ai |

## Independence and funding

We are self-funded and have no contractual relationship with any of the AI platforms we test. We share findings with Ukrainian state institutions and with European fact-checking and research organisations free of charge, and we do so independently of any commercial discussion.

## Corrections policy {#corrections}

If we get something wrong, we fix the page, date the change, and list it in that page's changelog. Corrections are never made silently. If a correction changes a verdict, we say so at the top of the page and notify anyone we sent the original finding to.

## Contact {#contact}

- **research@citere.ai** — researchers, data requests, collaboration
- **platforms@citere.ai** — trust & safety teams responding to a report
- **press@citere.ai** — media enquiries
- **corrections@citere.ai** — report an error on this site

A <span class="mono">security.txt</span> is published at the site root for vulnerability reports.
