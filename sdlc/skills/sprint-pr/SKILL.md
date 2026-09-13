---
name: sprint-pr
description: Open the end-of-week sprint-to-main PR, the reviewed, approval-required merge landing a whole sprint onto main. Callable as /sdlc:sprint-pr.
---

# /sdlc:sprint-pr

Open the end-of-week sprint→main PR, the reviewed, approval-required merge that lands an entire sprint onto main.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `skills/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Tool Translation**: Use `run_command` for git checks and `gh pr create`.

Read `commands/sprint-pr.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (`[sprint-id] [--plain]`). Only applicable for repos with `branchModel: sprint`.

