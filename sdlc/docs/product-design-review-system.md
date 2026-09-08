# product-design-review — Multi-Agent Product-Level Design Review

**Date:** 2026-07-23 (original proposal, preserved as historical design record; adapted for the `sdlc` fork)
**A Traction Layer AI engineering-system proposal**
Author: Raghu (Shankaran Sitarama), with Claude · Draft v1.0 · 2026-07-23
Audience: Sukumar, Vignesh, Rahul — for review and input
Status: Designed; implementation built into the `sdlc` plugin, pending first pilot

---

## 1. What this is, in one paragraph

`/sdlc:product-design-review` is an autonomous multi-agent pipeline that reviews the design of an **entire product** — the functional spec/PRD, the technical design document, the decisions ledger and ADRs, and every ticket in the project (40+ stories) — top-down and cross-cutting, then brings its findings to the humans in structured, persona-partitioned review sessions, and finally writes the approved outcomes back to the tracker and the design docs through a single approval gate. It is the product-scale sibling of our existing per-story tools: `design-run` deliberates one story's design before it is built; `product-design-review` audits the whole design across stories. It is **project-archetype generic**: the same command audits a core engine (SKB, KPG), an agentic-AI application (InternalAuditAI), or a platform (AgentLane).

## 2. Why — and why it isn't "review each ticket"

Per-story design review is already covered (interactively by `plan-the-design`, autonomously by `design-run`). What no tool covers is the class of defect that **cannot be seen from inside any single ticket**:

- an end-to-end user journey that crosses five stories and is complete in none of them — with an error path nobody owns;
- a functional-spec requirement that no TDD section designs and no story implements (or a story that implements something no requirement asked for);
- two tickets that will be built against contradictory readings of the same contract;
- a degraded-mode or concurrency scenario each component handles "locally correctly" that still dead-ends the user globally.

These live **in the seams**. So the audit is deliberately *not* organized as "review the 40 tickets one by one." It is organized around three cross-cutting axes:

1. **Traceability** — a mechanical matrix `spec requirement ↔ TDD section ↔ epic ↔ story ↔ AC`. Empty cells are findings *by construction*: no LLM judgment needed to see that spec §6.3 has no ticket. Cheap, deterministic, and it catches an entire class of gap before any deliberation begins.
2. **Flows** — every end-to-end path (user journey, agent loop, pipeline, API contract) walked step-by-step with all its variants: happy, each error class, empty/zero/max, concurrent, degraded-dependency, abandonment/timeout. This is where missed and incomplete flows are found — and where "what does the user *see* when this fails?" is asked at every step.
3. **Lenses** — a panel of expert perspectives (architecture/technology, security/data-boundary, reliability/failure, performance/scale, UX/ease-of-use, product/stakeholder-value, operability, implementation-feasibility) that argue the *significant* issues, with the same evidence-and-red-lines discipline our `design-run` panels already use.

One further principle, learned from running these pipelines: **findings must survive an adversarial verifier before any human sees them.** At 40-ticket scale, the failure mode is a docket polluted with plausible-but-already-covered "gaps." One finding a reviewer disproves from memory poisons trust in the whole session. Every finding is therefore attacked by a dedicated refutation agent first; only survivors reach the docket, and refuted ones are kept in an appendix as evidence of diligence.

## 3. Pipeline

```
        ┌──────────── autonomous (no human) ────────────┐      ┌──── human ────┐
INVENTORY ▸profile gate◂ → FLOW SWEEP → DELIBERATE → VERIFY+SYNTHESIZE ⇒ SESSIONS ⇒ PUBLISH (gated)
   (A)                           (B)          (C)             (D)              (E)         (F)
```

**A · Inventory.** One `surveyor` agent per epic ingests that slice (stories, ACs, matching spec/TDD sections) in parallel — nobody ever holds the whole product in one context; the audit works on faithful digests. A `cartographer` merges everything into the **traceability matrix** (orphans flagged mechanically) and the **flow inventory** — the canonical list of flows to walk, ranked P1/P2/P3, each with its variant list, shaped by the project archetype. Where the repo has no tracker configured at all (`tracker: none`), there are no tickets to slice — the surveyors slice by spec/TDD section instead, and the matrix's ticket-side columns stay empty by construction; the audit still runs off the spec, TDD, decisions ledger, and ADRs.

**A′ · Product Profile & profile gate.** Before any flow is walked, the cartographer also resolves a fixed **Product Profile checklist** — project type; programming language(s) *with their stated rationale*; frameworks (for agentic apps: the agent development framework — LangChain, AutoGen, Claude Agent SDK, bespoke — plus model provider and guardrails); UI surfaces; stakeholders and users; authentication/authorization; data stores and classification; deployment topology; external dependencies; compliance context. The rule for every dimension: **decipher it from the TDD/spec first, with a citation — and ask the human design reviewer only for what the documents don't answer** (the pipeline's one early interactive moment). A technology choice that is stated but never justified isn't silently accepted either: it auto-becomes a finding ("chosen, but is it the right choice?") that the architecture/technology and implementation-feasibility lenses then argue on evidence. The resolved profile shapes everything downstream — no UI means no UX partition; the persona list seeds the journey inventory; the auth mechanism gets its flows traced like any other. And answers don't evaporate into audit artifacts: every human-supplied answer auto-drafts a TDD amendment, `DECISIONS.md` entry, or ADR scaffold (routed by weight), approved with everything else at the publish gate — the design documents absorb what the review resolved. The tracker itself is a separate, repo-level configuration surface — `.sdlc/config.json`'s `tracker`/`trackerProjectKey`, resolved once per repo per `agent-plugin/skills/tracker-adapter/SKILL.md`, not part of this block.

**B · Flow sweep.** One `flow-tracer` per flow, in parallel. Each reconstructs the step sequence from the documents, probes every seam (failure, empty, concurrent, abandonment…), and emits typed gap candidates: `MISSING_FLOW`, `INCOMPLETE_ERROR_PATH`, `UNDEFINED_STATE`, `UX_DISCONTINUITY`, `CONTRACT_MISMATCH`, `ORPHAN_STEP` — every one carrying verbatim evidence references so it can be retraced.

**C · Deliberate.** A `moderator` clusters candidates into root-cause issues and dispatches a **three-lens panel** on each significant one (the 3 most relevant lenses per issue — a tenancy hole gets security/reliability/architecture, not UX). Consensus rules are `design-run`'s, verbatim: convergent → record with all dissents preserved; split or red-lined → flagged `NEEDS_HUMAN_DEBATE` (at product level the human session *is* the escalation path — the run never stalls); conflicts with locked decisions → always to the humans.

**D · Verify + synthesize.** The `verifier` tries to kill every finding (CONFIRMED / REFUTED / PARTIAL / WRONG_TARGET, with citations). The moderator then assigns final severities, tags each issue with the **partition** that must decide it (PM / ENG / UX / CROSS), drafts a **ready-to-apply remedy** for every issue (new ticket, AC addition, TDD amendment, ADR, decision, or spec fix), and produces the three outputs: `review-report.md`, `decision-docket.md`, and machine-readable `findings.json`. Nothing outward has been written at this point.

**E · Sessions (the human part).** Persona-partitioned and independently resumable: PM, ENG, UX each work their docket partition in their own session(s), in severity order, one issue per turn — finding, evidence quotes, panel positions *including dissents*, verifier verdict, recommendation, draft remedy — and give a verdict: **ACCEPT / MODIFY / REJECT (reason recorded) / DEFER / INVESTIGATE** (which dispatches a targeted agent mid-session and returns the answer to the same item). IMPROVEMENT-grade items batch-decide. CROSS-cutting items require the combined session or sign-off from two partitions. Each session opens with a one-screen brief of what other partitions decided that touches your items. Verdicts mark intent only — **no tracker writes during sessions.**

**F · Publish (one bulk gate).** When all partitions are complete, the full manifest — every ticket to create, AC to append, comment to post, TDD amendment, DECISIONS entry, ADR scaffold — is presented as one reviewable list for one explicit approval. Then a mechanical `publisher` agent executes the tracker entries idempotently (through the tracker-adapter's ops, so it works the same against Jira or Linear — or does nothing on this half of the manifest at all under `tracker: none`), doc changes are applied and committed with the audit report and session minutes. Deferred and rejected items land in the report's residue section with rationale — nothing is silently dropped.

## 4. Agent roster and model tiering

Model tiering follows our measured convention (Opus where judgment is the product, Sonnet for high-volume faithful extraction and control, Haiku for mechanical execution) — validated by the INAI-19 story-run telemetry, where the review/control layer ran at one-third the compute of generation and every substantive Sonnet finding proved real.

| Agent | Model | Responsibility | New/reused |
|---|---|---|---|
| `surveyor` | Sonnet | Digest one epic-slice; traceability rows; quote-don't-paraphrase discipline | new |
| `cartographer` | Opus | Merge the matrix; derive + rank the flow inventory; flag orphans | new |
| `flow-tracer` | Opus (P1/P2), Sonnet (P3) | Walk one flow end-to-end with all variants; emit evidenced gap candidates | new |
| `panelist` | Opus | One lens per dispatch; verdicts on every alternative; explicit red lines | reused from design-run, lens set extended |
| `moderator` | Opus | Cluster → panel → consensus → severity → partitioned docket with draft remedies | new |
| `verifier` | Opus | Adversarial refutation of every finding before humans see it | new |
| `publisher` | Haiku | Execute the approved manifest in the tracker; idempotent; nothing beyond the manifest | new |

Everything else — state file + checkpoint/resume in any chat, single-JSON-block agent contracts with one re-dispatch on parse failure, budget caps enforced by the orchestrator (never by an agent), `--show-stats` telemetry — is inherited unchanged from the `story-run` conventions.

## 5. Genericity: one command, three project archetypes

Nothing project-specific lives in the pipeline. Each repo declares an `## product-design-review` block in its `CLAUDE.md`: the **archetype**, the input documents, optional lens/partition overrides, and optionally an **evaluation framework**. The tracker itself is a separate, repo-level configuration surface — `.sdlc/config.json`'s `tracker`/`trackerProjectKey`, resolved once per repo per `agent-plugin/skills/tracker-adapter/SKILL.md`, not part of this block. The archetype changes what a "flow" means and which lenses get weighted — not the pipeline:

| | `agentic-app` (e.g. InternalAuditAI) | `engine` (e.g. SKB, KPG) | `platform` (e.g. AgentLane) |
|---|---|---|---|
| Flow taxonomy | Persona journeys; agent loops (perceive→act→observe, tool paths, degradation); lifecycle flows | Ingestion→processing→output pipelines; every public API contract; error/backpressure propagation; integration seams | Tenant/consumer onboarding; API surface per consumer type; isolation under load; upgrade/migration |
| Default partitions | PM, ENG, UX, CROSS | ENG, PM, CROSS | ENG, PM, CROSS (+UX if consoled) |
| Lens emphasis | UX and stakeholder-value always in rotation | performance/scale, implementation-feasibility up-weighted | security/data-boundary, architecture up-weighted |

**Severity is anchored to a rubric, not adjectives.** BLOCKER (wrong/unsafe/unshippable as designed) · GAP (required behavior undesigned or untracked) · RISK (designed, but a defensible expert case says it fails) · IMPROVEMENT · QUESTION. When the repo configures an evaluation framework — e.g. the 12-domain maturity checklist from our own architecture co-work (0 Absent → 4 Validated, CRITICAL-flagged domains) — the moderator scores affected domains and cites them: a CRITICAL domain at maturity ≤2 lifts related findings to at least GAP. Severity debates become rubric lookups.

## 6. The InternalAuditAI pilot (worked sample)

INAI is the natural first run — an `agentic-app` with unusually complete inputs:

- **Spec:** the MVP PRD — ~37k words, 16 screen/journey specifications across three personas (Functional Head, Management Representative, Management).
- **TDD:** the Technical Product Architecture — Detailed Design (layers, services, data model, agent loop/tools/guardrails, background jobs, security), plus the per-epic repo TDDs.
- **Decisions:** `docs/DECISIONS.md` + ADRs. **Eval framework:** the co-work 12-domain checklist.
- **Tickets:** the full INAI project (~40+ stories across the epic tree).

Expected shape at `--depth standard`: ~10 surveyor slices, ~15–20 flows traced (FH audit-session journey with its termination/timeout/abandonment variants; document/record lifecycles; the agent turn loop's degradation paths; MR onboarding wizard; report share/lock flows…), ~8–12 paneled issues, ~70–100 agent dispatches, ~4–6M subagent tokens, a few hours of compute (wall-clock much less — the fan-outs parallelize). Session load: likely a 2–4 hour ENG partition and shorter PM/UX partitions, spreadable across sittings.

## 6a. Mid-implementation runs are the norm

The review will usually run when part of the product is already built (e.g. Sprint 1 Done). This is default behavior, not a mode — and not `--resume`, which merely resumes an interrupted pipeline run. Ticket status is first-class input: the matrix carries it, every flow is marked `built: NONE/PARTIAL/FULL`, and every finding carries a `built_impact` badge (`unbuilt` / `in-flight` / `rework`). Two consequences: **(1)** built reality becomes evidence — on built flows the tracers spot-check the merged code, and "the docs say X, the code does Y" is its own finding class (`DESIGN_CODE_DRIFT`), with the humans deciding which side is wrong; **(2)** remedies route by build status — a finding touching a Done story always becomes a linked rework ticket, never a retroactive AC edit on a closed story. Severity still measures design-wrongness; the badge carries the cost.

## 7. What this deliberately does *not* do

- **No design decisions by agents.** Panels argue; humans decide everything that reaches the docket. Dissents are recorded verbatim, never averaged away.
- **No tracker writes until the single publish gate.** Sessions record intent; one manifest, one approval, then mechanical idempotent execution.
- **No workflow transitions** — the audit never moves any ticket's status.
- **No implementation.** The follow-on ambition (fully autonomous implementation of the entire cleaned-up backlog) is explicitly out of scope here — but `findings.json` with all verdicts resolved is designed as that run's entry contract: its precondition becomes "audit complete, no unresolved BLOCKER/GAP."

## 8. Open questions for reviewers

1. **Partition membership for CROSS items** — currently: combined session or any two partitions sign off. Should CROSS-BLOCKERs require *all three*?
2. **Session cadence** — one audit before implementation freeze, or recurring (e.g., per release train) with delta-audits against the previous run's matrix?
3. **Lens set** — is the eight-lens product set right? Candidates for addition: compliance/regulatory (IATF for INAI), cost/commercial (Domain 12 of the co-work framework).
4. **Depth default** — is `standard` (~70–100 dispatches) the right default, or should first-ever audits of a project force `exhaustive`?
5. **Evidence bar** — findings currently require verbatim quotes + refs. Should we also require the verifier to have searched a *minimum* source set (spec + TDD + tickets + decisions) before CONFIRMED is allowed?
6. **Publish-partial** — the owner can publish with an incomplete partition (`--publish-partial`). Keep, or force full-partition completion always?

## Appendix: file map (implemented)

```
sdlc/
  commands/product-design-review.md                     pipeline command (phases, gates, budgets, resume)
  agent-plugin/agents/{surveyor,cartographer,flow-tracer,moderator,verifier,publisher}.md
  agent-plugin/agents/panelist.md                        extended with the product-level lens set
  agent-plugin/skills/product-design-review/SKILL.md                 schemas, severity rubric, archetype defaults
  agent-plugin/skills/product-design-review/session-protocol.md      the human-session script (binding)
  agent-plugin/skills/product-design-review/report-template.md       audit report structure
  commands/help.md                          catalog entries
```
