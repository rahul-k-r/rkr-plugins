---
name: review-run
description: Autonomous multi-PR review subsystem, parallel story-PR reviews with cross-ticket compatibility checks, and sprint-close gate. Callable as /sdlc:review-run.
---

# /sdlc:review-run

Autonomous multi-PR review subsystem: parallel story-PR reviews with cross-ticket compatibility checks, and the sprint-close gate verifying a sprint is safe to merge to main.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `agents/...`, `skills/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Subagent Dispatch**:
> Wherever `commands/review-run.md` dispatches agents (`reviewer`, `integrator`, `validator`, and optionally `coder` via `--fix`):
> - **Codex:** resolve `model` and `reasoning_effort` through `internal/codex-model-effort.md`, then use `multi_agent_v1__spawn_agent`.
> - **Antigravity:** resolve `Model` through `internal/gemini-model-effort/SKILL.md`, then use `invoke_subagent` with the agent name as `Role`.
> - **Claude Code:** when this adapter is selected directly, follow the source command's `Task` dispatch.
> - Pass the verbatim persona from `agents/<name>.md` plus task context.

Read `commands/review-run.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (such as `[<sprint-or-PRs>] [--fix] [--plain]`).
