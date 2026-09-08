---
description: "Render the fixed usage-stats report (per-agent model/timing/tokens, phase durations) for a story-run/design-run/review-run/review-fix — on demand, mid-run or after the fact, whether or not --show-stats was passed at invocation."
argument-hint: "[STORY-KEY | review run-id]"
---

# /sdlc:show-stats

The on-demand counterpart to `--show-stats`. That flag auto-publishes the report as part of a run's own hand-off; this command renders the exact same fixed report from whatever data already exists, whenever you ask for it — while a run is paused mid-flight, right after one finishes without having passed the flag, or long after, from a past run's saved snapshot. Collection itself (`dispatches[]`) is unconditional in `story-run`/`design-run`/`review-run` — it never depended on `--show-stats`, only publishing did — so there is nothing to "turn on in advance" here. Read-only aside from the report it publishes.

## Usage

```
/sdlc:show-stats <STORY-KEY>
/sdlc:show-stats <review-run-id>
```

- `$1` is a story key (`story-run`/`design-run`) or a `review-run`/`review-fix` run-id (sorted PR numbers, `sprint-<id>`, or `fix-<PR#>`). No argument → list every key/run-id with data available under `docs/stories/` and ask which one.
- Freshness is exactly as good as the source's last disk write, not truly live: `story-state.json`/`review-state.json` are persisted after every phase transition and batch, not continuously mid-dispatch — so calling this while `coder` is still mid-batch shows the run as of its last completed step, not the in-flight dispatch itself.

## Steps

1. **Resolve the source.** `docs/stories/<KEY>/story-state.json` (or `docs/stories/_reviews/<run-id>/review-state.json`) is never deleted, so it's always the record of that key's **most recent** run — whether that run is still in progress, `PAUSED`, or long finished (its `phase` tells you which: `PR_OPENED`/`CLOSED`/`PUBLISHED` are terminal, everything else is still open). Default to this file.
   - **Comparing against older runs, or the state file is simply absent** (predates this feature, or the key never ran): look in `docs/stories/<KEY>/_stats/` (or `docs/stories/_reviews/<run-id>/_stats/`) instead — one snapshot per run ever executed for this key, each written just before the *next* run would otherwise overwrite `story-state.json` out from under it. List them (run type + timestamp + outcome) if more than one exists, and default to the latest unless the user names an older one.
   - Neither exists → say so plainly; there is nothing to report.

2. **Render.** Load the `artifact-design` and `dataviz` skills, read `agent-plugin/skills/run-stats/template.html`, and fill it from the resolved source's `dispatches[]`/`phase_history` (or `review-run`'s coarse phase markers) exactly as `story-run`/`design-run`/`review-run` do at their own hand-off — see `agent-plugin/skills/run-stats/schema.md` for the field contract. Do not redesign the template; do not rewrite or duplicate the source file.
   - **Still open** (phase isn't `PR_OPENED`/`CLOSED`/`PUBLISHED`): set the outcome banner to a clearly partial state — e.g. "IN PROGRESS as of `<phase>`, last updated `<timestamp>`" — never present an unfinished run as complete.
   - **Terminal phase, or a `_stats/` snapshot:** render the run's real final outcome as recorded.

3. **Publish.** Write the filled-in HTML to a scratch file outside `docs/stories/` (the Artifact tool needs a file path, not inline content — this file is throwaway publish-time scratch, not the local snapshot), publish via the Artifact tool, and print the URL. This command never writes to `docs/stories/` itself — it only reads what `story-run`/`design-run`/`review-run` already wrote.

## Notes

- This command doesn't replace `--show-stats`; it removes the need to have remembered it. Pass `--show-stats` when you want the report auto-published as part of the run's own hand-off with no extra step; use this command any other time — mid-run, forgotten-flag, or long after, for comparison against a past run.
- Never transitions the tracker, never touches git, never dispatches a subagent — this is a read-and-render step only.
