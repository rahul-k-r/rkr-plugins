# run-stats: data contract

The one source of truth for usage-stats collection and reporting across `story-run`, `design-run`, `review-run`, `review-fix`, and `/sdlc:show-stats`. Read this alongside `template.html` — the template is the fixed layout, this file is the fixed data shape that fills it. Extending stats collection later (a new field, a new command) starts here, not by improvising a new shape in a command file.

**Collection and publishing are two separate things.** `dispatches[]` is appended unconditionally by all three run commands — it never depends on `--show-stats`. That flag controls only whether the report is auto-published as an Artifact at the run's own hand-off. Without it, the same data still accumulates in the live state file and, at end-of-run, in the local snapshot — so `/sdlc:show-stats <KEY>` can render the identical report later, whether the run is still paused mid-flight or long finished. This split exists so forgetting the flag never loses data, only the auto-publish convenience.

## `dispatches[]`

Appended once per subagent dispatch, always, to the run's own working-state file (`story-state.json` for `story-run`/`design-run`, `review-state.json` for `review-run`). The orchestrating session is the one dispatching every subagent (via the Task/Agent tool) and receiving its model, wall-clock duration, token usage, and tool-call count directly in that dispatch's tool result — appending an entry is bookkeeping on data already in hand, not a new agent capability, and costs nothing extra to do every time.

```json
{
  "seq": 1,
  "phase": "DESIGN",
  "agent": "designer",
  "mode": "framing",
  "model": "opus",
  "model_version": "Opus 4.8",
  "attempt": 1,
  "duration_ms": 45210,
  "tokens": 12500,
  "tool_uses": 6,
  "outcome": "DRAFTED"
}
```

| Field | Always present? | Notes |
|---|---|---|
| `seq` | yes | 1-indexed, in dispatch order across the whole run |
| `phase` | yes | the state-machine phase active at dispatch time (`DESIGN`, `PLAN`, `IMPLEMENT`, …) |
| `agent` | yes | subagent_type dispatched (`designer`, `coder`, `pr-reviewer`, …) |
| `mode` | no | free-text context when one agent has more than one dispatch shape (e.g. designer's `framing` vs `drafting`) |
| `model` | yes | the color/grouping role for this dispatch — `opus`, `sonnet`, or `haiku` when it matches the command's own "Model tiering" table for that agent; `other` when the dispatch was given an explicit `model` override outside that set (e.g. to Fable) |
| `model_version` | yes | the **specific** model version actually running for this dispatch — e.g. `"Opus 4.8"`, `"Sonnet 5"`, `"Haiku 4.5"`, or whatever the override resolves to (e.g. `"Fable 5"`). See "Recording `model_version`" below — this is not something the dispatch's tool result returns, so record it at dispatch time from what the orchestrating session already knows. |
| `attempt` | no | retry/attempt number when the dispatch is part of a batch's retry loop; omit (implicitly 1) otherwise |
| `duration_ms` | yes | wall-clock duration of the dispatch, from the tool result |
| `tokens` | yes | token usage reported for the dispatch |
| `tool_uses` | yes | tool-call count reported for the dispatch |
| `outcome` | yes | the dispatch's own verdict/status field (`DRAFTED`, `PROCEED`, `APPROVE`, …) — whatever that agent's JSON contract already returns, copied as-is |

### Recording `model_version`

The Task/Agent tool's dispatch result does not itself report which concrete model snapshot ran — but the orchestrating session already knows this from its own environment context (the same place it knows its *own* running model), because that context names the current family (e.g. "Opus 4.8" and "Sonnet 5" are current as of this writing; that will drift over time as new snapshots ship). So: at the moment of each dispatch, record whatever version string the session's own context currently attributes to the requested tier (or, for an explicit override, whatever specific model was named in the override, however the environment identifies it — e.g. "Fable 5"). Do not hardcode a version string into this file or the template; it is read from context at dispatch time, every time, so it stays correct as the underlying models change.

Phase-level timing needs no new field: `phase_history[].started`/`.ended` (already in `story-state.json`) is the source for the phase timeline section and the design-phase-duration stat tile. `review-run`'s `review-state.json` gets the same `dispatches[]` array; it has no `phase_history` today; use whatever coarse phase markers Mode A/B already track (`review`, `integration`, `gate`) or, if none exist yet, timestamp the run's own start/end only.

## Model-tier color roles (fixed, do not reassign per run)

Validated against the dataviz skill's CVD/contrast checks (`node scripts/validate_palette.js` in the `dataviz` skill), drawn from its default categorical palette's first four slots (the subset validated for all-pairs comparison, not just sequential adjacency) — deliberately skipping that palette's green slot since this report also uses green for the unrelated `good` status color, and having a model-tier color and an outcome color share a hue would blur the two encodings.

| Role | Light | Dark |
|---|---|---|
| `opus` | `#e87ba4` (magenta) | `#d55181` |
| `sonnet` | `#2a78d6` (blue) | `#3987e5` |
| `haiku` | `#eda100` (yellow) | `#c98500` |
| `other` | `#1baf7a` (aqua) | `#199e70` |

`sonnet`'s blue doubles as the report's general UI accent (links, focus ring) — a deliberate choice, not an accident: sonnet is the plugin's default/most-common tier per every command's own "Model tiering" table, so the primary hue and the most-frequent category sharing a hue is a standard, readable dashboard convention. Magenta, yellow, and aqua all sit below 3:1 contrast on the light surface (documented in the dataviz skill's reference palette) — the template's relief rule for this is already satisfied structurally: every bar has a direct text label and every model tag in the dispatch table carries the model's specific version as text, never color alone.

**`other` is one shared bucket for every model outside the three known tiers, not a color-per-override-model.** When a dispatch's `model` override doesn't match any of `opus`/`sonnet`/`haiku` (e.g. a run rebalanced to Fable per a command's own "pass a `model` override on the Task dispatch" note), it gets the `other` role's color — re-validated (`aqua` was chosen and confirmed via the validator specifically against this report's existing blue/magenta/yellow trio, in both light and dark) rather than an arbitrary or hashed hue per distinct override model. This follows the dataviz skill's own rule directly: "past four [categorical slots], fold to 'Other'." Two different override models used in the same run both render as `other`-colored tags — they stay visually distinguishable via `model_version`'s text (e.g. "Fable 5" vs. some other name), never via color, exactly like `opus`/`sonnet`/`haiku` rows are distinguished from each other by more than hue alone. Do not invent a fifth categorical color for a second override model — that risks colliding with `critical`/`serious`/status hues the validator hasn't checked against, and the dataviz skill's own guidance is explicit that a chart shouldn't keep growing distinct hues past four.

## Status/outcome color roles (fixed hex, identical in light and dark — never themed)

| Role | Hex | Use for |
|---|---|---|
| `good` | `#0ca30c` | `PROCEED`, `APPROVE`, `DRAFTED`, `PASS`, `SPRINT_READY`, clean `--bypass` merges |
| `warning` | `#fab219` | `RETRY`, `PENDING`, `AWAITING_CI`, in-progress/incomplete states |
| `serious` | `#ec835a` | `REQUEST_CHANGES`, `REVISE`, `HOLD` |
| `critical` | `#d03b3b` | `ESCALATE`, `BLOCKED`, `FAILED`, red CI |

Never color-alone: every pill in the outcome banner carries its text label alongside the color, per the template's existing markup.

## Local snapshot file

Written once per run, **always** (regardless of `--show-stats`), into a dedicated **`_stats/` subfolder nested inside the same per-key/per-run-id working directory** everything else for this run already lives in (`docs/stories/<KEY>/_stats/` or `docs/stories/_reviews/<run-id>/_stats/`), not a separate top-level sibling.

**Nothing under these working directories is ever deleted, on any command, at any point — not `story-state.json`/`review-state.json`, not `context-pack.md`/`plan-summary.md`/`checkpoint.md`, not `_stats/`.** All of it is already local-only and gitignored via `docs/stories/.gitignore`, so there's no cleanup to do — deleting local-only files bought nothing and only cost `/sdlc:show-stats` its data source once a run finished. The one thing this means downstream: a *fully completed* run has to leave its state file at a phase that reads as "done," not just absent — see `PR_OPENED`/`CLOSED` (`story-run`) and `PUBLISHED` (`design-run`) in `session-start.js`'s `DONE` set, which is what stops a finished run from being announced as "in flight" forever in later sessions.

`_stats/` is still its own subfolder rather than loose files alongside the others, for one real reason: it's the one thing that **accumulates** across repeated runs for the same key, while `story-state.json`/`context-pack.md`/`plan-summary.md` are each overwritten fresh by the next run. Keeping the accumulating history visually and structurally separate from "whatever the most recent run left behind" is the whole value of the subfolder now.

**Path:**
- `story-run` / `design-run`: `docs/stories/<KEY>/_stats/<run_type>-<UTC timestamp, compact ISO-8601>.json`
- `review-run`: `docs/stories/_reviews/<run-id>/_stats/review-run-<UTC timestamp>.json`
- `review-fix` (standalone only): `docs/stories/_reviews/fix-<PR#>/_stats/review-fix-<UTC timestamp>.json` — when a run invokes the review-fix procedure inline (`review-run --fix`, `story-run --bypass`), its dispatches land in the invoking run's own state file and snapshot instead; one run, one stats report.

Examples: `docs/stories/AGL-42/_stats/story-run-20260720T143000Z.json`, `docs/stories/AGL-42/_stats/design-run-20260720T091500Z.json`.

- `run_type` is one of `story-run`, `design-run`, `review-run`, `review-fix`.
- Already covered by the existing blanket `docs/stories/.gitignore` (`*`) — **never staged, never committed, never pushed**, on all three commands, with no exception. This is a deliberate design choice (confirmed with the developer): stats are a local artifact, comparable across runs on the same machine, and shared between teammates via the published Artifact URL — not via git.
- Content: the full `dispatches[]` array, the run's `phase_history` (or review-run's coarse phase markers), and the computed totals shown in the report's stat tiles (wall clock, token/dispatch/agent/model breakdowns, retries/replans/escalation counts) — i.e. exactly the JSON that also lands in the report's raw-data appendix. One file per run; multiple runs for the same key (or the same review-run's re-runs) accumulate as separate files inside that same `_stats/` subfolder, which is what makes them comparable over time.

## Rendering a report

Three call sites render from this same contract: `story-run`/`design-run`/`review-run` themselves (only when `--show-stats` was passed, at their own hand-off) and `/sdlc:show-stats` (always, on demand — reading the **live** state file if a run is still in progress, `PAUSED`, or simply finished and left in place, otherwise the latest `_stats/` snapshot if the state file predates this feature). All three follow the identical procedure:

1. Load the `artifact-design` skill (required before any Artifact tool publish) and the `dataviz` skill (both bar charts follow its mark specs: thin tracks, rounded fill ends, direct labels, a legend for the model chart).
2. Read `agent-plugin/skills/run-stats/template.html` in full.
3. Fill every `{{TOKEN}}` and repeat every `<!-- BEGIN X -->…<!-- END X -->` row block from the source's `dispatches[]`/`phase_history`/`escalations[]` — do not add, remove, reorder, or restyle sections. Omit the escalations section entirely when `escalations[]` is empty. When rendering from a **live** state file whose phase isn't yet a terminal one (not `PR_OPENED`/`CLOSED`/`PUBLISHED`), set the outcome banner to a clearly partial label (e.g. "IN PROGRESS as of `<phase>`") — never present an unfinished run as complete.
4. Write the filled-in HTML to a scratch file — **outside `docs/stories/` entirely** (the harness's scratchpad directory, or any other throwaway temp path) — since the Artifact tool takes a file path, not inline content. This file is pure publish-time scratch: it is not the local snapshot, is never read back by anything, and there is no reason to keep it once the Artifact tool call returns.
5. Publish via the Artifact tool, pointing at that scratch file, using its `<style>` block and body content only (strip the outer `<!doctype>`/`<html>`/`<head>`/`<body>` — the tool supplies its own). Pick a stable favicon per command (e.g. 📊) and keep it stable across a story's repeated reports.
6. If the Artifact tool is unavailable in the running session, fall back to printing the stat tiles and both tables directly in chat. `story-run`/`design-run`/`review-run` still write the local JSON snapshot regardless; `/sdlc:show-stats` never writes one (it only reads).
