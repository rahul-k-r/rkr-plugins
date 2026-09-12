---
name: review-run
description: Autonomous multi-PR review subsystem, parallel story-PR reviews with cross-ticket compatibility checks, and sprint-close gate. Callable as /sdlc:review-run.
---

# /sdlc:review-run

Autonomous multi-PR review subsystem: parallel story-PR reviews with cross-ticket compatibility checks, and the sprint-close gate verifying a sprint is safe to merge to main.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `agents/...`, `skills/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Subagent Dispatch**:
> Wherever `commands/review-run.md` dispatches agents (`reviewer`, `integrator`, `validator`, and optionally `coder` via `--fix`):
> - Call `invoke_subagent` with `TypeName: "self"` (or `"research"` for read-only agents).
> - Set `Role` to the agent name.
> - Set `Model` tier resolved from `skills/gemini-model-effort/SKILL.md` (`pro` for integrator; `flash` for reviewer; `flash_lite` for validator).
> - Set `Prompt` to the verbatim persona from `agents/<name>.md` (in the plugin directory) followed by the specific task/context.

Read `commands/review-run.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (such as `[<sprint-or-PRs>] [--fix] [--plain]`).

