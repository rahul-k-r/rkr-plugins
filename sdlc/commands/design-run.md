---
description: "Autonomous multi-expert design deliberation: frame the design issues, argue each through a lens panel, synthesize decisions, draft and adversarially review the design note — escalating only genuinely major calls."
argument-hint: "<STORY-KEY> [--no-gate design] [--technical] [--show-stats] [--resume]"
---

# /sdlc:design-run

Produces a story's design note autonomously at deliberation quality, not just draft quality. The difference from a lone drafting agent: **the argument happens before the note is written.** A `designer` frames the design issues, a parallel **lens panel** argues each high-stakes issue from three expert perspectives, decisions are synthesized under explicit consensus rules, and only then is the note drafted — and adversarially reviewed by the `architect`. Human interaction is held to the genuinely major calls: panel splits on hard-to-reverse decisions, locked-decision conflicts, and one final gate on the finished note (on by default). This is also `story-run`'s DESIGN phase — invoked standalone, it lets you design next sprint's backlog ahead of implementation and review the notes async.

> **`/sdlc:plan-the-design` remains the interactive path and always wins:** an existing substantive design note is never redesigned over. design-run is its autonomous equivalent for when the developer isn't driving the deliberation themselves.

## Usage

```
/sdlc:design-run <STORY-KEY> [--no-gate design] [--technical] [--show-stats] [--resume]
```

- `$1` is the story key; if absent, ask. Live tracker keys only (`jira`|`linear`) — translate legacy IDs first. If `$1` doesn't resolve against the tracker, or no tracker is configured at all (`tracker: none`), or `$1` was omitted entirely, this is a **no-ticket run** — resolved exactly as `story-run`'s **`--incognito` and no-ticket runs** section describes (a local key, confirmed with the developer if inferred, and `local_ac` standing in for a fetched issue). See Step 0.
- `--no-gate design` — skip the final human gate on the finished note (inline escalations for major calls still always happen). Default: the gate is **on**.
- `--technical` — keep chat output in the engineer-level voice. **Without it (the default), everything said to the developer in chat — the framing summary, inline escalations, the Step 7 gate digest, the graduation backlog — follows `skills/plain-language/STANDARD.md`**; the note, ADRs, tracker comments (or provenance entries), and commits keep their fixed technical form either way. Recorded as `technical` in the state file at Step 0 init so `--resume` keeps the mode; passing the flag at resume overrides.
- `--show-stats` — auto-publish the fixed-format usage report (per-dispatch model/timing/tokens, phase durations) as a claude.ai Artifact at Step 7. Dispatch data is always collected and always snapshotted locally regardless of this flag — forgot to pass it? `/sdlc:show-stats <KEY>` renders the same report on demand, mid-run or after. Default: off (report still exists; it just isn't auto-published). See **Usage statistics** below.
- `--resume` — continue from `docs/stories/<KEY>/story-state.json` / `checkpoint.md`, in any chat.

## Steps

0. **Preflight.** **Resolve the tracker and write-mode** per `skills/tracker-adapter/SKILL.md`: read `.sdlc/config.json` (or detect the registered MCP tool family and ask, offering to persist the choice). design-run doesn't take `--incognito` itself — when dispatched by `story-run` as its DESIGN phase, the tracker and write-mode were already resolved upstream and are passed down; use them as given, never re-derive. **When run standalone, resolve exactly as `story-run`'s own Step 0 does**: `tracker: none` resolves `writeMode` to `incognito` automatically, otherwise `normal`; and resolve `$1` per the Usage note above — a real tracker key fetched normally, or a no-ticket run per `story-run`'s **`--incognito` and no-ticket runs** section. Also resolve project config from the repo's `CLAUDE.md` — including an optional **design lens override**: a `CLAUDE.md` "design lenses" list replaces the default panel below. Run the **assignment check** (typo guard) exactly as `story-run` Step 1 defines it — **only when a real tracker key resolved; skipped entirely for a local key**, same as `story-run`'s own version (there's nothing to assign against a key with no tracker behind it). Initialize `docs/stories/<KEY>/story-state.json` (phase `DESIGN`, plus `tracker`, `write_mode`, `local_key`) — untracked working state, same rules as story-run.

1. **Design-note precedence.** If `docs/design-notes/<KEY>.md` exists and passes the substantive checks (§1/§3/§5 filled), stop: the design is done — report that and point at `/sdlc:design-review` for critique. If it exists but is hollow, stop and tell the developer to finish or delete it — never silently redesign over a half-deliberated note.

2. **FRAME.** Dispatch `designer` in framing mode: scope / NOT-scope with owners, reconciliation against ground truth, and **2–5 candidate design issues** (questions, not answers) with realistic alternatives per issue — grounded in the full AC, `DECISIONS.md`, ADRs, dependency design notes, and the actual code. **Print the dispatch's `plain_language_summary` to chat first** — what's being built, the design issues at stake and why, the realistic alternatives at a glance — before presenting the formal issue list below it; this is an FYI for whoever's watching an autonomous run, not a gate, so no STOP here. Then dispatch `architect` to validate the *issue list itself*: a missed issue or a strawman alternative dies here, before anyone argues the wrong questions. REVISE cycles budget 2, then escalate.

3. **DELIBERATE** — per issue, adaptive depth:
   - **High-stakes issues** (ADR-threshold, hard-to-reverse, `DESIGN_SENSITIVE`, or touching a locked decision's neighborhood): dispatch the lens panel — **three `panelist` agents in parallel**, one per lens (repo override wins; defaults:)
     - *reliability/failure* — failure direction (open/closed), degenerate and concurrent cases, sole-barrier vs. defence in depth
     - *security/data-boundary* — tenancy, data classification, blast radius, trust boundaries
     - *simplicity/operability* — maintenance cost, observability, migration and rollback, "would a senior engineer call this overcomplicated"
     Each returns a preferred alternative with evidence, per-alternative risks, and **red lines** (what is unacceptable under its lens).
   - **Minor issues:** no panel — the designer decides with cited evidence; the architect's later review is the check.

4. **SYNTHESIZE.** Apply the consensus rules mechanically:
   - **Convergent** (panel agrees, no red line on the chosen alternative) → decide autonomously; the note records the rationale **and every dissent verbatim** — dissents are preserved, never erased.
   - **Split or red-lined on a high-stakes issue** → **escalate to the developer** with each panelist's position and a recommendation. Their decision is recorded (state + eventual note §3) and is final.
   - **Any conflict with `DECISIONS.md` or an Accepted ADR** → escalate, always — no panel majority overrides a locked decision.

5. **DRAFT.** Dispatch `designer` in drafting mode: the full note per `skills/design-review/template.md`, §3 carrying the deliberation (positions, dissents, decisions, invariants), ADR scaffolds for threshold decisions, §7 left empty.

6. **ADVERSARIAL REVIEW.** Dispatch `architect` with `DESIGN_REVIEW` (unchanged from story-run): ground-truth spot-checks, assumption audit, completeness, AC coverage. REVISE budget 2, then escalate; locked-decision findings always escalate.

7. **GATE + PUBLISH.** Unless `--no-gate design`: present the digest — decisions with rationale, dissents, anything escalated inline and how it was resolved — and proceed only on an explicit approve. Then: commit the note and ADR scaffolds (`<KEY>: add design note (design-run, architect-approved)`), post each §5 cross-story obligation as a traceability comment on its target ticket via the tracker-adapter's `add_comment` op (`skills/tracker-adapter/SKILL.md`) — under `writeMode: incognito` (including any `tracker: none` run), append the same content instead to `docs/stories/<KEY>/provenance.md`, per the adapter's local provenance file convention, and note plainly in the digest that these landed locally rather than on a real ticket — and print the graduation backlog (decisions → ADR / `DECISIONS.md`). Write the local stats snapshot now regardless of `--show-stats`, and if it was passed, also render and publish the Artifact (see **Usage statistics** below). Set `phase: PUBLISHED`, persist, and stop — run complete; the committed note and ADRs are the durable output, tracker comments (or the provenance file) and the note itself carry the provenance. **Nothing under `docs/stories/<KEY>/` is deleted** — `story-state.json` and `_stats/` are both already local-only and gitignored, so they're just left as a bonus local reference (`session-start.js` treats `PUBLISHED` as done, so it won't be announced as in-flight later).

## Usage statistics (`--show-stats`)

**Collection is unconditional — it never depends on this flag.** Append a `dispatches[]` entry to `story-state.json` after every subagent dispatch in Steps 2-6 (`designer`, `architect`, `panelist`) — model tier, the **specific model version** actually running (e.g. "Opus 4.8" — read from the orchestrating session's own environment context at dispatch time, not the tool result; see `skills/run-stats/schema.md`), wall-clock duration, tokens, and tool-call count. An explicit `model` override outside `opus`/`sonnet`/`haiku` records role `other` (one fixed color, never a new hue per override) with `model_version` carrying the specific name. Phase timing needs nothing new — `phase_history[].started`/`.ended` already covers it.

At Step 7: **always** write a local JSON snapshot to `docs/stories/<KEY>/_stats/design-run-<UTC timestamp>.json` — a subfolder nested inside the same directory everything else for this run already lives in — **never committed, never pushed**, same as every other file under `docs/stories/` (see the schema doc for exactly why and what it contains). Nothing under `docs/stories/<KEY>/` is ever deleted (see Step 7), so `/sdlc:show-stats <KEY>` works even when `--show-stats` wasn't passed — the live `story-state.json` itself is available for it to read, not just the `_stats/` snapshot.

**`--show-stats` controls only automatic publishing:** when passed, also render `skills/run-stats/template.html` (load the `artifact-design` and `dataviz` skills first, per the template's own instructions) filled in from the collected `dispatches[]` and `phase_history`, publish it via the Artifact tool, and print the URL in the Step 7 hand-off.

## Pausing, checkpoints, resume

Identical machinery to `story-run` (see its **Pausing and checkpoints** section): any pause offers save-and-exit; save writes `checkpoint.md` + the state `checkpoint` block; nothing needed to continue may exist only in the chat transcript. Because the state file is `story-state.json` at phase `DESIGN`, a paused design-run can be resumed by **either** `design-run --resume` *or* `story-run --resume` — the latter continues into implementation after the design completes. `--resume` on a `PUBLISHED` state (a run that already finished) reports that plainly and stops — nothing to resume.

## Model tiering

| Agent | Model | Why |
|-------|-------|-----|
| `designer` | `opus` | Framing and synthesis — the run's spine. |
| `panelist` | `opus` | Real dissent requires real judgment; ~3 dispatches × 2–3 high-stakes issues is the deliberate cost of design quality. |
| `architect` | `opus` | Adversarial review of the issue list and the finished note. |

## Notes

- Never writes application code, never cuts branches (standalone mode), never transitions the tracker. Outward-facing writes: the committed note/ADRs, the obligation comments (or provenance entries under `writeMode: incognito`), nothing else.
- Dispatch names: `designer`, `panelist`, `architect` (plugin-qualified `sdlc:<name>` on collision).
- Every subagent ends with a single JSON block; unparseable → re-dispatch once, then escalate.
