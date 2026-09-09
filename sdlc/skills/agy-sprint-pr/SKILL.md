---
name: agy-sprint-pr
description: Antigravity-invocable form of /sdlc:sprint-pr — open the end-of-week sprint→main PR, the reviewed, approval-required merge that lands a whole sprint onto main.
---

# /agy-sprint-pr

Read `commands/sprint-pr.md` in full and follow its steps exactly, verbatim — this file carries
no separate instructions of its own. Arguments (`[sprint-id] [--technical]`) are passed through
identically to how `commands/sprint-pr.md` describes reading them from `$ARGUMENTS`. Only
meaningful for a repo configured `branchModel: sprint` — `commands/sprint-pr.md`'s own
`direct`-model no-op behavior applies unchanged.

Every path it references is relative to this same plugin root and resolves identically under
Antigravity — see `docs/antigravity-port-notes.md`. This command dispatches no subagents, so
there is nothing Antigravity-specific to adapt here.
