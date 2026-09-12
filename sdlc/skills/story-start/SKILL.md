---
name: story-start
description: Gate check before implementation — verify design note, fetch AC, cut correctly-named branch, move issue to In Progress. Callable as /sdlc:story-start.
---

# /sdlc:story-start

Gate check before implementation: verify the design note, fetch full AC, cut the correctly-named branch (feat|fix|chore/<key-lower>-slug), and move the issue to In Progress.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `skills/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Tool Translation**: Use `run_command` for git operations and `call_mcp_tool` for tracker updates.

Read `commands/story-start.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (`<STORY-KEY> [--worktree <path> | --no-worktree] [--incognito] [--plain]`).

