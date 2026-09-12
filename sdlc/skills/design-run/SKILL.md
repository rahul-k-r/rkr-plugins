---
name: design-run
description: Autonomous multi-expert design deliberation — frame design issues, argue through a lens panel, synthesize decisions, draft and adversarially review the design note. Callable as /sdlc:design-run.
---

# /sdlc:design-run

Autonomous multi-expert design deliberation: frame candidate design issues, argue each through a multi-perspective lens panel, synthesize decisions, draft the note, and adversarially review it before publishing.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `agents/...`, `skills/...`, `docs/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Subagent Dispatch**:
> Wherever `commands/design-run.md` says to dispatch an agent (`designer`, `panelist`, `architect`):
> - Call `invoke_subagent` with `TypeName: "self"` (or `"research"` for read-only agents).
> - Set `Role` to the agent name (e.g. `Role: "designer"`).
> - Set `Model` tier resolved from `skills/gemini-model-effort/SKILL.md` (e.g. `"pro"` at High effort).
> - Set `Prompt` to the **verbatim persona from `agents/<name>.md`** (in the plugin directory) followed by the specific task/context.
> - Ignore `EnterWorktree` mentions (manage worktrees via standard git commands).
> **Telemetry & Stats**: Collect `dispatches[]` and write local state snapshots. If `--show-stats` is requested, render the HTML report to the Antigravity Artifacts directory.

Read `commands/design-run.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (such as `[<KEY>] [--effort <tier>] [--plain]`).

