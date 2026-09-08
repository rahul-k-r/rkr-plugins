---
name: product-design-review
description: Schemas, severity rubric, archetype defaults, and shared rules for the product-level design audit pipeline. Loaded by /sdlc:product-design-review and its agents' dispatch prompts.
---

# product-design-review — shared contracts

Everything here is normative for the pipeline. The command file owns the
process; this file owns the shapes and the rubric.

## Product Profile checklist

Resolved **before the flow sweep** (it shapes the flow inventory, lens
weighting, and partitions). For every dimension the rule is the same:
**decipher from the documents first; ask the human only for what the
documents don't answer.** Each dimension gets a status:

- `DECIPHERED` — answered from the docs, **with citation** (spec §/TDD §).
- `STATED_NO_RATIONALE` — the choice is named but never justified anywhere.
  Not a blocker — but it auto-emits a `QUESTION`/`RISK` finding ("chosen, but
  is it the right choice?") that the technology/feasibility lenses then argue.
- `AMBIGUOUS` — documents conflict or imply two answers → human question.
- `ABSENT` — not addressed anywhere → human question.

**Common dimensions (all archetypes):**

| # | Dimension | What must be answered |
|---|---|---|
| P1 | Project type | archetype (engine / agentic-app / platform) + one-line what-it-is |
| P2 | Programming language(s) | per layer, **and the stated rationale** — fitness is then lens-judged |
| P3 | Frameworks & major libraries | web/API/data frameworks; build toolchain |
| P4 | UI surfaces | does it have UI? which surfaces (web/mobile/console/CLI/none)? |
| P5 | Stakeholders & users | every persona/role; who buys vs. who uses vs. who operates |
| P6 | Authentication & authorization | mechanism (IdP, tokens, session model), role model, tenant isolation approach |
| P7 | Data stores & data classification | stores, what's sensitive, where it lives |
| P8 | Deployment target & topology | cloud/on-prem, regions, single/multi-tenant |
| P9 | External dependencies | third-party services/APIs the design assumes |
| P10 | Compliance/regulatory context | standards the product must satisfy (if any) |

**Archetype-specific additions:**

- `agentic-app` — **P11** agent development framework/SDK (LangChain, AutoGen,
  Claude Agent SDK, bespoke loop…) + rationale; **P12** model
  provider/inference plane + fallback strategy; **P13** agent guardrails
  (action boundaries, human gates, provenance of AI outputs).
- `engine` — **P11** consumption model (library / service / CLI) + API
  stability contract; **P12** performance envelope (stated throughput/latency
  targets).
- `platform` — **P11** tenancy model + isolation guarantees; **P12** extension
  surface (plugin/SDK contracts for consumers); **P13** versioning/upgrade
  policy toward consumers.

The completed profile is written to `product-profile.md` (with per-dimension
status + citations) and echoed in `findings.json` as `profile`. Unresolved
dimensions (`AMBIGUOUS`/`ABSENT`) are put to the human at the **profile gate**
— the pipeline's one early interactive moment — and P1/P2/P4/P5/P6 **must** be
resolved before the sweep proceeds (the rest may carry as open QUESTIONs).
Every `STATED_NO_RATIONALE` on P2/P3/P11 becomes a finding for the
architecture/technology + implementation-feasibility lenses: recorded choice,
absent justification — argue fitness, don't assume it.

**Write-back rule — answers must land in the design authority documents.**
Every human answer to an `AMBIGUOUS`/`ABSENT` dimension auto-drafts a
`doc-change` manifest entry at the moment it is given (deferred to the bulk
PUBLISH gate like all outward writes — agents never edit the TDD/ADRs
mid-run). Routing: descriptive facts (stakeholders, UI surfaces, auth
mechanism, deployment) → **TDD amendment** into the section that should have
held them; smaller locked choices → **`DECISIONS.md` entry**; anything
crossing the ADR threshold (hard-to-reverse, cross-cutting — e.g. the agent
framework, the language) → **ADR scaffold**. The same applies to session
verdicts that resolve a `STATED_NO_RATIONALE` fitness finding: the accepted
rationale (or the decided replacement) is written back, so the docs never
again fail to answer why. An answer that exists only in audit artifacts is
treated as a pipeline bug.

## Implementation-aware review (default, not a mode)

A product review usually runs **mid-implementation** — some stories Done, some
in flight, most unbuilt. This is the normal case, not an edge case (`--resume`
is unrelated: it resumes an interrupted pipeline run). Ticket status is
first-class input everywhere — **when a tracker is configured** (see below
for `tracker: none`):

- **Surveyors** record each story's status; **the matrix carries it**; the
  cartographer marks every flow `built: NONE | PARTIAL | FULL` from its
  constituent stories.
- **Built reality is evidence.** For flows marked PARTIAL/FULL, the tracer and
  verifier may consult the actual repo code as an additional source (bounded
  spot-checks, P1/P2 flows). Where the docs say X and the merged code does Y,
  that is a finding of class **`DESIGN_CODE_DRIFT`** — cite both the doc § and
  the file:line. Which side is wrong is a human call (the docket asks).
- **Every finding carries `built_impact`**: `UNBUILT` (pure design change) ·
  `IN_FLIGHT` (touches In-Progress/Review stories — owner should see it now) ·
  `BUILT` (touches Done stories — accepting the remedy means rework).
- **Remedy routing rule:** findings with `built_impact: BUILT` are remedied as
  a **new rework/follow-up ticket** (linked to the Done story) — never an
  `AC-add` or edit to a closed story; completion records are immutable
  history. `IN_FLIGHT` findings may use `AC-add`/`comment` but the docket
  flags them URGENT-ish (cheaper to catch before the PR merges).
- Severity is unchanged by build status — it measures how wrong the design is,
  not how expensive the fix is. The **docket badge** (`rework` / `in-flight` /
  `unbuilt`) carries the cost signal to the human instead.

**Under `tracker: none`**, there is no ticket status to carry — every finding's
`built_impact` stays `UNBUILT` by default (nothing to mark In Flight or Done
against), and the matrix's ticket-side columns are absent by construction, not
a failure. Remedies route to `new-ticket`-typed manifest entries the same way,
just with nowhere real to publish them until a tracker exists — see the
Publish manifest schema below for how that half of a `tracker: none` run's
manifest is handled at PUBLISH.

## Severity rubric

| Severity | Meaning | Session default |
|---|---|---|
| **BLOCKER** | Implementing the current design produces a wrong, unsafe, or unshippable product — tenancy/data-boundary hole, an unrecoverable user dead-end on a core path, contradictory contracts two teams would build against. | Must be decided; cannot DEFER. |
| **GAP** | A required flow/behavior/requirement is undesigned or untracked — the matrix or a trace shows the hole. Ship risk if unaddressed, but the fix is additive. | Decide; DEFER needs a reason. |
| **RISK** | Designed, but a defensible expert case says it fails under load/scale/misuse/evolution — a judgment call, often `NEEDS_HUMAN_DEBATE`. | Decide or consciously accept. |
| **IMPROVEMENT** | Better is available; current is workable. | Batch-decidable. |
| **QUESTION** | The docs are ambiguous; the audit needs a human answer to classify. | Answer inline; may reclassify. |

**Maturity scoring** (when the repo config names an `eval_framework` with a
maturity-scale checklist): the moderator scores each affected domain
0 Absent · 1 Identified · 2 Decided · 3 Designed · 4 Validated, and a
CRITICAL-flagged domain scoring ≤2 lifts the related finding at least to GAP.
Cite domain and score in the finding ("Domain 7 Security & Tenant Isolation,
scored 1, CRITICAL"). This turns severity arguments into rubric lookups.

## Archetype defaults

| | `agentic-app` | `engine` | `platform` |
|---|---|---|---|
| **Flow taxonomy** | Persona journeys (signup→value, core loop, recovery); agent loops (perceive→act→observe, tool paths, degradation); lifecycle (onboarding, expiry, deletion) | Ingestion→processing→output pipelines; each public API contract end-to-end; error/backpressure propagation; integration seams | Tenant/consumer onboarding; API surface per consumer type; isolation under load; upgrade/migration paths |
| **Default partitions** | PM, ENG, UX, CROSS | ENG, PM, CROSS | ENG, PM, CROSS (+UX if it has a console) |
| **Lens emphasis** | UX/ease-of-use, product/stakeholder-value always in rotation | performance/scale, implementation-feasibility weighted up | security/data-boundary, architecture/technology weighted up |

The full product lens set lives in `agent-plugin/agents/panelist.md` (story-level three +
product-level five). The moderator assigns 3 lenses per paneled issue.

## Finding schema (`findings.json`)

```json
{"run_id": "...", "generated": "<iso>",
 "profile": [{"dim": "P1", "status": "...", "answer": "...", "citation": "...", "source": "docs|human"}],
 "issues": [{
  "id": "PDR-<n>", "title": "...", "class": "MISSING_FLOW|INCOMPLETE_ERROR_PATH|UNDEFINED_STATE|UX_DISCONTINUITY|CONTRACT_MISMATCH|ORPHAN_STEP|MATRIX_ORPHAN|DELIBERATED_RISK|DESIGN_CODE_DRIFT",
  "severity": "BLOCKER|GAP|RISK|IMPROVEMENT|QUESTION",
  "partition": "PM|ENG|UX|CROSS", "built_impact": "UNBUILT|IN_FLIGHT|BUILT",
  "evidence": [{"quote": "<verbatim>", "ref": "<doc § / ticket key>"}],
  "affected": {"tickets": [], "components": [], "flows": [], "personas": []},
  "panel": {"paneled": false, "lenses": [], "outcome": "CONSENSUS|NEEDS_HUMAN_DEBATE|NOT_PANELED", "positions": [], "dissents": []},
  "verifier": {"verdict": "CONFIRMED|PARTIAL|WRONG_TARGET", "searched": []},
  "maturity": {"domain": "<framework domain or null>", "score": null, "critical": false},
  "remedy": {"type": "new-ticket|AC-add|TDD-amend|ADR|decision|spec-fix", "draft": "<ready-to-apply body>"},
  "verdict": {"status": "PENDING|ACCEPTED|MODIFIED|REJECTED|DEFERRED", "by": null, "at": null, "note": null}
}], "appendix_refuted": [{"id": "...", "refuted_by": "<citation>"}]}
```

`findings.json` with all verdicts resolved is the **contract for a future
fully-autonomous implementation run**: its precondition is "audit complete,
no unresolved BLOCKER/GAP."

## Publish manifest schema

```json
{"entries": [{"id": "M-<n>", "from_issue": "PDR-<n>",
  "op": "create-ticket|update-ac|comment|link|doc-change",
  "target": "<ticket key | file path | null for create>",
  "content": {"...": "exactly what publisher/orchestrator applies"},
  "approved": false}]}
```

The `create-ticket`/`update-ac`/`comment`/`link` ops map 1:1 onto the
tracker-adapter's `create_issue`/`update_field`/`add_comment`/`create_link`
ops (`agent-plugin/skills/tracker-adapter/SKILL.md`) and are executed by `publisher`
against whichever tracker resolved for the repo (Jira or Linear — see that
file for the exact tool mapping, including the `link`→comment fallback on
Linear). `doc-change` entries (TDD amendments, DECISIONS entries, ADR
scaffolds) are applied by the orchestrator and committed, regardless of
tracker. **Under `tracker: none`**, the four ticket-facing op types have
nowhere to publish to — `publisher` isn't dispatched at all, and the manifest
review at the gate is scoped to `doc-change` entries only; the corresponding
findings' remedies stay recorded in `findings.json` as drafted-but-unpublished,
ready to apply the moment a tracker is configured. Every created ticket
carries the label `pdr-<run-id>`.

## run-state.json (working state, untracked)

```json
{"run_id": "...", "depth": "standard", "archetype": "...",
 "phase": "INVENTORY|PROFILE_GATE|FLOW_SWEEP|DELIBERATE|VERIFY_SYNTH|SESSIONS|PUBLISH|DONE",
 "dispatches": {"done": [], "pending": [], "failed": []},
 "budgets": {"max_dispatches": 110, "used": 0},
 "sessions": {"<partition>": {"status": "NOT_STARTED|IN_PROGRESS|COMPLETE",
   "docket_progress": "12/17", "sittings": []}},
 "publish": {"gate": "PENDING|APPROVED", "manifest_path": null, "results": null}}
```

## Run directory

```
docs/product-design-review/<run-id>/
  corpus/<slice>.md          surveyor digests
  product-profile.md         cartographer — Product Profile checklist (P1–P13, citations)
  traceability-matrix.md     cartographer — orphans highlighted
  flow-inventory.md          cartographer — ranked flows + variants
  flows/<flow-id>.md         tracer traces (optional prose alongside JSON)
  findings.json              machine-readable findings (schema above)
  review-report.md            durable report (template in this skill)
  decision-docket.md         session working document
  session-minutes.md         verdicts + rationale, appended per sitting
  publish-manifest.json      assembled at the publish gate
  run-state.json           working state (untracked)
```

Committed at publish: report, matrix, minutes, manifest results. The rest is
working material; keep or clean per repo preference.
