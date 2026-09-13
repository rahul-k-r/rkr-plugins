---
description: "Autonomous product-level design audit: build the traceability matrix from spec+TDD+all tickets, sweep every end-to-end flow for gaps, deliberate significant issues through lens panels, verify findings adversarially — then persona-partitioned human review sessions and one bulk-gated publish back to the tracker and the docs."
argument-hint: "[--depth quick|standard|exhaustive] [--effort <tier>] [--session pm|eng|ux|cross|all] [--publish] [--resume]"
---

# /sdlc:product-design-review

Where `design-run` deliberates one story's design, **product-design-review deliberates the
whole product**: the functional spec/PRD, the TDD/architecture, the decisions
ledger and ADRs, and every ticket in the project — reviewed top-down as one
system. It is **project-archetype generic**: a core engine (deterministic
processing, API consumers), an agentic-AI application (personas, agent loops,
tools), or a platform (tenants, consumer APIs) — the archetype shapes what a
"flow" is and which lenses argue, not the pipeline.

The organizing principle: **design gaps live in the seams, not inside
tickets.** A missed error flow is rarely inside a story — it's in a journey
that crosses five stories which no ticket owns, or a spec requirement no
story traces to. So the audit is organized around three cross-cutting axes:
**traceability** (requirement ↔ design ↔ ticket — orphans are mechanically
detectable), **flows** (end-to-end paths walked with every error/corner
variant), and **lenses** (expert perspectives arguing the significant issues).
Findings must survive an adversarial verifier before any human sees them —
at 40-ticket scale, one refutable "gap" in the docket poisons the session.

```
INVENTORY → FLOW SWEEP → DELIBERATE → VERIFY+SYNTHESIZE ⇒ SESSIONS (human) ⇒ PUBLISH (gated)
```

## Usage

```
/sdlc:product-design-review [--depth quick|standard|exhaustive] [--effort <tier>] [--resume]
/sdlc:product-design-review --session pm|eng|ux|cross|all     # run a review session
/sdlc:product-design-review --publish                          # bulk publish gate + execute
```

- `--depth` (default `standard`): `quick` = matrix + P1 flows only, no panels
  below BLOCKER; `standard` = all P1/P2 flows + variants, panels on
  BLOCKER/GAP-grade issues; `exhaustive` = every flow × every variant, full
  panel width, second verify pass.
- `--effort <tier>` — override `.sdlc/config.json`'s `effort` for this
  run only, per `internal/model-effort/SKILL.md` (`very-low`/`low`/`medium`/
  `high`/`extra-high`). Omitted → the config's `effort`, or `high` if
  that's unset too. Only meaningful on the initial autonomous-phase
  invocation — resolved once at Preflight (Step 0) and read back on
  `--resume`/`--session`/`--publish`, never re-resolved.
- `--session <partition>` — open (or resume) that partition's review session.
  Each partition is independently resumable in its own chat by its own human.
- `--publish` — only valid when session state permits (Step 8).
- `--resume` — continue the autonomous phases from `run-state.json`, any chat.

## Project config (generic — this is the only per-repo surface)

Read from the target repo's `CLAUDE.md`, section `## product-design-review`:

```markdown
## product-design-review
archetype: agentic-app | engine | platform
inputs:
  spec: docs/FunctionalSpec.md            # PRD/FSD file(s); Confluence IDs also accepted
  tdd: docs/design/tdd-*.md               # TDD / architecture doc(s)
  decisions: docs/DECISIONS.md
  adrs: docs/adr/
  eval_framework: docs/eval-framework.md  # optional maturity-scale checklist
lenses: <optional override of the product lens set>
partitions: <optional; default PM,ENG,UX,CROSS — an engine repo may collapse to ENG,CROSS>
```

**Tracker project/team scope.** The ticket tree's project (Jira) or team
(Linear) scope comes from `.sdlc/config.json`'s `trackerProjectKey` when set
(Jira: project key; Linear: team key) — falling back to asking once if it
isn't. See `internal/tracker-adapter/SKILL.md` for the full resolution logic;
`tracker: none` means there is no ticket tree at all (see Step 0 below).

Missing spec is not fatal: the audit runs with requirements sourced from the
architecture doc + epic descriptions, and emits *"no independent functional
spec"* as its own finding (the matrix cannot catch design-contradicts-spec
without one). Missing archetype: ask once, then record it into `CLAUDE.md`.

## Steps — autonomous phases (A–D)

0. **Preflight.** Resolve the tracker per `internal/tracker-adapter/SKILL.md`
   (`.sdlc/config.json`, or detect the registered MCP family and ask); config
   resolved and inputs exist; `docs/product-design-review/<run-id>/` created
   (`run-id` = date + short slug); `run-state.json` initialized (untracked
   working state, story-run rules). **Resolve `effort`** per
   `internal/model-effort/SKILL.md`: `--effort <tier>` if passed, else
   `.sdlc/config.json`'s `effort`, else `high` — recorded in
   `run-state.json` and read back (not re-resolved) on `--resume`. Every
   `surveyor`/`cartographer`/`flow-tracer`/`moderator`/`verifier`/`publisher`/
   `panelist` dispatch across every phase below passes an explicit `model`
   argument looked up from that skill's table for this tier — not restated
   at each dispatch. When a tracker is configured, search it
   for every ticket in the product's project/team scope via the adapter's
   `search` op (Jira: one JQL sweep; Linear: `list_issues` filtered by
   team) — this listing, not per-agent refetching, defines the slices.
   **Under `tracker: none`, skip this fetch entirely** — there is no ticket
   tree to inventory. This is not a blocker: the audit proceeds off the spec,
   TDD, design notes, and ADRs alone; the traceability matrix's ticket-side
   columns stay empty by construction (an absence the matrix already knows
   how to represent, not a failure mode), and slices are drawn from the spec/
   TDD's own sections instead of epics.

1. **A · INVENTORY.** Dispatch one `surveyor` per epic/slice **in parallel**
   (unsliced strays form a final slice; under `tracker: none`, slices are
   drawn from spec/TDD sections instead of epics). Then dispatch
   `cartographer` to merge three artifacts: `product-profile.md` (the Product
   Profile checklist — project type, languages + rationale, frameworks incl.
   agent framework for agentic apps, UI surfaces, stakeholders/users,
   authn/z, data, deployment, dependencies, compliance — each dimension
   deciphered from the docs with a citation or honestly marked unresolved;
   see the skill), then `traceability-matrix.md` with the mechanical orphan
   lists, and `flow-inventory.md` with P1/P2/P3-ranked flows and their
   variants, shaped by archetype **and profile** (no UI → no UX partition;
   personas come from P5). Matrix orphans become finding candidates directly
   — no LLM judgment needed for "spec §6.3 has no ticket." **Ticket status is
   first-class input** (mid-implementation runs are the norm): the matrix
   carries each story's status, flows are marked `built: NONE|PARTIAL|FULL`,
   findings carry `built_impact`, and remedies route by it — a finding
   touching a Done story becomes a linked rework ticket, never a retroactive
   AC edit. (`--resume` is unrelated: it resumes an interrupted pipeline run.)

1b. **PROFILE GATE** (the pipeline's one early interactive moment). Present
   the profile: DECIPHERED dimensions as a table with citations for
   confirmation-at-a-glance, then each `AMBIGUOUS`/`ABSENT` dimension as a
   direct question to the human. P1/P2/P4/P5/P6 (type, language, UI,
   stakeholders, auth) **must** be resolved before proceeding; other
   dimensions may carry forward as open QUESTION findings. Human answers are
   recorded into the profile with `source: human` and into the state file —
   and **each answer auto-drafts a `doc-change` manifest entry** (TDD
   amendment / DECISIONS entry / ADR scaffold per the skill's write-back
   rule), queued for the bulk PUBLISH gate so the design docs absorb what the
   gate resolved.
   Every `STATED_NO_RATIONALE` on a technology dimension auto-emits a finding
   ("<choice> is stated but never justified — is it the right choice?") for
   the technology/feasibility lenses in Phase C. If the human is not present
   (fully unattended run), park at this gate exactly like a session gate —
   never guess the unresolved dimensions.

2. **B · FLOW SWEEP.** Dispatch one `flow-tracer` per flow, parallel, batched
   ≤4 concurrent: P1/P2 at `standard` (P3 too at `exhaustive`; P1 only at
   `quick`). Secondary (P3) tracer dispatches may run on sonnet. Each returns
   gap candidates with evidence refs and severity guesses.

3. **C · DELIBERATE.** Dispatch `moderator` (pass 1): cluster candidates +
   orphans into issues, select panel issues, choose each issue's **3 most
   relevant lenses** from the product lens set (see `panelist`). Dispatch the
   `panelist` trios per paneled issue — panels for *different issues* run in
   parallel; panelists never see each other's output. Consensus rules are
   design-run's verbatim, with one product-level difference: **splits and
   red-lines don't pause the run — they become `NEEDS_HUMAN_DEBATE` docket
   entries.** The session is the escalation path. Locked-decision conflicts
   are always `NEEDS_HUMAN_DEBATE`.

4. **D · VERIFY + SYNTHESIZE.** Dispatch `verifier` over every surviving
   finding (batches of 8–12; `exhaustive` adds a second independent pass for
   BLOCKER/GAP). REFUTED → report appendix. PARTIAL/WRONG_TARGET → moderator
   restates. Then `moderator` (pass 2): final severities (citing the
   `eval_framework` domains and maturity scores when configured), partition
   tags, a **draft remedy on every issue** (a human should be able to say
   ACCEPT and have it mean something exact), and the outputs:
   `review-report.md` (per skill template), `decision-docket.md` (per session
   protocol), `findings.json` (machine-readable; the seam a future
   implementation run consumes). Announce: docket stats per partition, and
   how to start sessions. **The autonomous run ends here — nothing outward
   has been written.**

## Steps — human phases

5. **SESSIONS** (`--session <partition>`). Follow
   `skills/product-design-review/session-protocol.md` exactly. In brief: open with a
   cross-partition brief (what other partitions decided that touches your
   items), then walk the partition's docket in severity order, one issue per
   turn — finding, evidence quotes, panel positions with dissents, verifier
   verdict, recommendation, draft remedy — and record the verdict:
   `ACCEPT | MODIFY <how> | REJECT <why> | DEFER | INVESTIGATE`.
   INVESTIGATE dispatches a targeted agent mid-session and returns the answer
   to the same docket item. IMPROVEMENT-grade items may be batch-decided.
   Verdicts mark intent only (`ACCEPTED-pending-publish`) — **no tracker
   writes during sessions.** CROSS items require the combined session or
   recorded sign-off from two partitions. All state per-partition in
   `run-state.json`; `session-minutes.md` appends per sitting.

6. **PUBLISH** (`--publish`). Valid when every partition reports complete (or
   the owner explicitly passes `--publish-partial`). Assemble the **manifest**
   from all ACCEPT/MODIFY verdicts: every ticket to create, AC to append,
   comment to post, link to make, plus doc-side changes (TDD amendments,
   DECISIONS entries, ADR scaffolds — including every entry auto-drafted from
   profile-gate and session answers: what the review resolved, the docs must
   now state). Present the full manifest as one list —
   **this is the single outward gate** — and on explicit approval: dispatch
   `publisher` for the tracker entries (routed through the adapter's ops —
   `create_issue`/`update_field`/`add_comment`/`create_link`; idempotent,
   reports per-entry; under `tracker: none` there is nothing for this half of
   the manifest to do, so only doc-side entries remain), apply doc-side
   changes, commit `review-report.md` + matrix + minutes + manifest results
   (`docs: product design audit <run-id>`), and print the residue: DEFERs,
   REJECTs with reasons, and the graduation backlog.

## Pausing, checkpoints, resume

Story-run's machinery, applied to `run-state.json`: every phase transition
and every batch of dispatch results is persisted before proceeding; any pause
offers save-and-exit; nothing needed to continue may exist only in the chat
transcript. Autonomous phases resume mid-fan-out (completed dispatches are
never re-run). Sessions resume mid-docket, per partition, in any chat.

## Model tiering

The table below is the `high`-tier default — what every agent's own frontmatter already declares, and what a repo with no `effort` configured runs at. For every other tier (`very-low`/`low`/`medium`/`extra-high`), see `internal/model-effort/SKILL.md`'s table — this run resolves `effort` once at Preflight (Step 0) and passes an explicit `model` override on every dispatch below looked up from there, superseding the agent file's own default without editing it.

| Agent | Model | Why |
|-------|-------|-----|
| `surveyor` | sonnet | Faithful extraction at fan-out scale — volume work. |
| `cartographer` | opus | The merge everyone downstream navigates by. |
| `flow-tracer` | opus (P1/P2) / sonnet (P3) | Gap-finding is the audit's core judgment. |
| `panelist` | opus | Real dissent requires real judgment (design-run precedent). |
| `moderator` | opus | Clustering, consensus, severity, docket — the synthesis spine. |
| `verifier` | opus | Refutation must out-think the finder it audits. |
| `publisher` | haiku | Mechanical execution of pre-approved content. |

Budget guardrails (defaults; overridable in config): `max_dispatches` 40/110/220
by depth, ≤4 concurrent per fan-out, per-dispatch timeout 15 min. At standard
depth on a ~40-ticket project expect roughly 70–100 dispatches / 4–6M subagent
tokens; wall-clock a fraction of compute thanks to the parallel fan-outs.

## Notes

- **Writes:** autonomous phases write only under `docs/product-design-review/<run-id>/`.
  Sessions write state + minutes. Only PUBLISH (behind the bulk gate) touches
  the tracker or the docs — and never transitions any ticket's workflow status.
- Complements, never replaces: `design-run` deliberates one story before it's
  built; `product-design-review` audits the whole design across stories. Findings that need
  per-story deliberation should become tickets that later get `design-run`.
- Dispatch names: `surveyor`, `cartographer`, `flow-tracer`, `panelist`,
  `moderator`, `verifier`, `publisher` (plugin-qualified on collision).
- Every subagent ends with a single JSON block; unparseable → re-dispatch once,
  then park the item with a note in the report (never silently drop it).
- `--show-stats` telemetry: identical conventions to story-run
  (`/sdlc:show-stats` works on audit runs).
