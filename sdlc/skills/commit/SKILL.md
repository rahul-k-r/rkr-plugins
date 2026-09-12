---
name: commit
description: Create atomic, convention-following commits from the working tree. Local only — never pushes. Callable as /sdlc:commit.
---

# /sdlc:commit

Create atomic, convention-following commits from the working tree. Local only — never pushes automatically.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `skills/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Tool Translation**: Use `run_command` for all git staging, status, and commit operations.

Read `commands/commit.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (`[STORY-KEY] [message]`).

