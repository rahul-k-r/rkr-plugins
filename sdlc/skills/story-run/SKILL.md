---
name: story-run
description: Autonomous full-lifecycle story execution — design, plan, implement batch-by-batch, final review, and open PR. Callable as /sdlc:story-run.
---

# /sdlc:story-run

Runs the full story lifecycle autonomously: design note (if none exists), story setup, implementation plan, batch-by-batch coding with review and validation, story-level final review, and the PR to the base branch. Escalates to the human only where judgment genuinely requires it.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `agents/...`, `skills/...`, `docs/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Subagent Dispatch**:
> Wherever `commands/story-run.md` dispatches an agent (`designer`, `architect`, `panelist`, `coder`, `intake`, `planner`, `reviewer`, `validator`):
> - **Codex:** resolve `model` and `reasoning_effort` through `internal/codex-model-effort.md`, then use `multi_agent_v1__spawn_agent`; use `multi_agent_v1__wait_agent` for parallel work.
> - **Antigravity:** resolve `Model` through `internal/gemini-model-effort/SKILL.md`, then use `invoke_subagent` with the agent name as `Role`.
> - **Claude Code:** when this adapter is selected directly, follow the source command's `Task` dispatch.
> - Pass the verbatim persona from `agents/<name>.md` plus task context. Ignore `EnterWorktree`; manage worktrees with git.
> **Telemetry & Stats**: Collect `dispatches[]` into `story-state.json`. If `--show-stats` is passed, render `internal/run-stats/template.html` and write it to the host's available local artifact/report location.

Read `commands/story-run.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (e.g. `[<KEY>] [--base <branch>] [--worktree <path> | --no-worktree] [--effort <tier>] [--bypass] [--plain]`).
