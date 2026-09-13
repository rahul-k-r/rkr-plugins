---
name: build-check
description: Run the repo's full local quality gate (build, static analysis, tests, lint) and report real PASS/FAIL per step. Callable as /sdlc:build-check or /build-check.
---

# /sdlc:build-check

Run the repository's full local quality gate (build, static analysis, tests, lint) and report real PASS/FAIL per step.

> **Path Resolution**: Resolve all referenced plugin paths relative to the plugin directory (two levels above this `SKILL.md`).
> **Tool Translation**: Use `run_command` for running checks, and `view_file` for inspecting configuration and test logs.

Read `commands/build-check.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (such as `[--plain]`).
Checks run against the target repository in the current working directory or story worktree.
