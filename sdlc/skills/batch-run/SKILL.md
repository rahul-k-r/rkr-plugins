---
name: batch-run
description: Orchestrate several stories as one batch — sequence them by real dependencies, run independent ones in parallel worktrees via story-run subagents, optionally post cross-ticket comments at the end. Callable as /sdlc:batch-run.
---

# /sdlc:batch-run

Reads every ticket in the batch, builds the dependency graph (contract, shared pattern, file overlap), schedules stories into lanes, and drives each through `/sdlc:story-run` — concurrently where the graph allows. Escalates to the human only for decisions a story subagent cannot make.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `agents/...`, `skills/...`, `docs/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Story dispatch**:
> - **Claude Code:** spawn each story with the `Agent` tool (`general-purpose`, no `model` override, `run_in_background: true`) as `commands/batch-run.md` step 5 describes.
> - **Codex / Antigravity (untested — nested dispatch and the tool names below are unverified; fall back to running stories inline if refused):**
> - **Codex:** use `multi_agent_v1__spawn_agent` per story (model/effort per `internal/codex-model-effort.md`) and `multi_agent_v1__wait_agent` to collect returns. If nested dispatch is refused, run the story inline and say so.
> - **Antigravity:** use `invoke_subagent` with `Role` = `story-run` for each story; resolve `Model` through `internal/gemini-model-effort/SKILL.md`. If nested dispatch is refused, run inline.
> - No harness hook renders `batch-handoff.md` outside Claude Code: write it by hand from `batch-state.json` at the same points. Ignore `EnterWorktree`; manage worktrees with git.

Read `commands/batch-run.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (e.g. `<KEY> <KEY>... [--parallel N] [--comment] [--no-gate batch] [--bypass] [--turbo] [--effort <tier>] [--plain]`).
