---
name: story-check
description: Verify a story against Definition of Done — per-item PASS/GAP checklist and verdict. Auto-detects reviewer mode for teammate PRs. Callable as /sdlc:story-check.
---

# /sdlc:story-check

Verify a story against the Definition of Done: produce a per-item PASS/GAP checklist and a final verdict. Auto-detects reviewer mode for a teammate's PR.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `skills/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Tool Translation**: Use `run_command` for git checks and tests, `view_file` for inspecting files.

Read `commands/story-check.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (`[STORY-KEY] [--plain]`).

