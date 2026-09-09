---
name: agy-show-stats
description: Antigravity-invocable form of /sdlc:show-stats — render the fixed usage-stats report (per-agent model/timing/tokens, phase durations) for a story-run/design-run/review-run/review-fix, on demand.
---

# /agy-show-stats

Read `commands/show-stats.md` in full and follow its steps exactly, verbatim — this file carries
no separate instructions of its own. The argument (`[STORY-KEY | review run-id]`) is passed
through identically to how `commands/show-stats.md` describes reading it from `$ARGUMENTS`.

Every path it references (`skills/run-stats/schema.md`, `skills/run-stats/template.html`) is
relative to this same plugin root and resolves identically under Antigravity — see
`docs/antigravity-port-notes.md`. This command dispatches no subagents, so there is nothing
Antigravity-specific to adapt here. Model/role labels in a rendered report reflect whichever
harness actually ran the underlying dispatches (Claude model names, or Antigravity's
`pro`/`flash`/`flash_lite` tier keys per `skills/gemini-model-effort/SKILL.md`) — the template
itself doesn't assume one or the other.
