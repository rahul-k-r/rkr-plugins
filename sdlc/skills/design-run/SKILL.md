---
name: design-run
description: Autonomous multi-expert design deliberation — frame design issues, argue through a lens panel, synthesize decisions, draft and adversarially review the design note. Callable as /sdlc:design-run.
---

# /sdlc:design-run

Autonomous multi-expert design deliberation: frame candidate design issues, argue each through a multi-perspective lens panel, synthesize decisions, draft the note, and adversarially review it before publishing.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `agents/...`, `skills/...`, `docs/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Subagent Dispatch**:
> Wherever `commands/design-run.md` says to dispatch an agent (`designer`, `panelist`, `architect`):
> - **Codex:** resolve `model` and `reasoning_effort` through `internal/codex-model-effort.md`, then use `multi_agent_v1__spawn_agent`.
> - **Antigravity:** resolve `Model` through `internal/gemini-model-effort/SKILL.md`, then use `invoke_subagent` with the agent name as `Role`.
> - **Claude Code:** when this adapter is selected directly, follow the source command's `Task` dispatch.
> - Pass the verbatim persona from `agents/<name>.md` plus task context. Ignore `EnterWorktree`; manage worktrees with git.
> **Telemetry & Stats**: Collect `dispatches[]` and write local state snapshots. If `--show-stats` is requested, render the HTML report to the host's available local artifact/report location.

Read `commands/design-run.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (such as `[<KEY>] [--effort <tier>] [--plain]`).
