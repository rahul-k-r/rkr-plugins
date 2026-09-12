---
name: story-pr
description: Commit, push the story branch, and open the story PR against the resolved base branch. Callable as /sdlc:story-pr.
---

# /sdlc:story-pr

Commit, push the story branch, and open the story PR against the resolved base branch — the action that triggers CI.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `skills/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Tool Translation**: Use `run_command` for git push and `gh pr create`.

Read `commands/story-pr.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (`[STORY-KEY] [--review] [--fix] [--plain]`).

