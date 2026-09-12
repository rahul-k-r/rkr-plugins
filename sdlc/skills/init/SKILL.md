---
name: init
description: Bootstrap a repository for the sdlc workflow. Idempotent — safe to run repeatedly. Callable as /sdlc:init.
---

# /sdlc:init

Bootstrap a repository for the `sdlc` workflow: configure tracker, branch model, documentation directories, and quality gates. Idempotent — safe to run repeatedly.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `skills/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Tool Translation**: Use `run_command` for git checks, `write_to_file` and `view_file` for creating config and documentation scaffolding.

Read `commands/init.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (such as `[--plain]`).
Files are created in the target repository root.

