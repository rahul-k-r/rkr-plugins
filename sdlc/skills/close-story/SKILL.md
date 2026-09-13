---
name: close-story
description: Verify-before-done — confirm merge, CI, AC coverage, post completion record, transition to Done, report unblocked tickets. Callable as /sdlc:close-story.
---

# /sdlc:close-story

Verify-before-done: confirm merge, CI, AC coverage, post completion record, transition to Done, and report unblocked tickets.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `skills/...`, `docs/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Tool Translation**: Use `run_command` for git checks, `view_file` for inspecting local artifacts, and `call_mcp_tool` for tracker operations.

Read `commands/close-story.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (such as `<STORY-KEY> [--plain]`).

