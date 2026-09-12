---
name: story-run
description: Autonomous full-lifecycle story execution — design, plan, implement batch-by-batch, final review, and open PR. Callable as /sdlc:story-run.
---

# /sdlc:story-run

Runs the full story lifecycle autonomously: design note (if none exists), story setup, implementation plan, batch-by-batch coding with review and validation, story-level final review, and the PR to the base branch. Escalates to the human only where judgment genuinely requires it.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `agents/...`, `skills/...`, `docs/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Subagent Dispatch**:
> Wherever `commands/story-run.md` dispatches an agent (`designer`, `architect`, `panelist`, `coder`, `intake`, `planner`, `reviewer`, `validator`):
> - Call `invoke_subagent` with `TypeName: "self"` (or `"research"` for read-only agents like `reviewer` / `validator`).
> - Set `Role` to the exact agent name (e.g. `Role: "coder"`).
> - Set `Model` tier resolved from `skills/gemini-model-effort/SKILL.md`:
>   - `designer`, `architect`, `panelist`, `coder` -> `"pro"` (at High effort)
>   - `intake`, `planner`, `reviewer` -> `"flash"`
>   - `validator` -> `"flash_lite"`
> - Set `Prompt` to the **verbatim persona from `agents/<name>.md`** (in the plugin directory) followed by the specific task/context.
> - Ignore `EnterWorktree` mentions (worktrees are isolated via standard git commands and paths).
> **Telemetry & Stats**: Collect `dispatches[]` into `story-state.json`. If `--show-stats` is passed, render `skills/run-stats/template.html` and write it to the Antigravity Artifacts directory.

Read `commands/story-run.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (e.g. `[<KEY>] [--base <branch>] [--worktree <path> | --no-worktree] [--effort <tier>] [--bypass] [--plain]`).

