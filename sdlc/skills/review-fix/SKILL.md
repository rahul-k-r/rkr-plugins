---
name: review-fix
description: Apply review findings to a PR you authored, triage fixable vs. needs-judgment, fix the fixable, verify with a fresh review pass, and escalate the rest. Callable as /sdlc:review-fix.
---

# /sdlc:review-fix

Apply review findings to a PR you authored: triage fixable vs. needs-your-judgment, fix the fixable batch-by-batch, verify with a fresh review pass, and escalate the rest.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `agents/...`, `skills/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Subagent Dispatch**:
> Wherever `commands/review-fix.md` dispatches agents (`coder`, `validator`, `reviewer`):
> - **Codex:** resolve `model` and `reasoning_effort` through `internal/codex-model-effort.md`, then use `multi_agent_v1__spawn_agent`.
> - **Antigravity:** resolve `Model` through `internal/gemini-model-effort/SKILL.md`, then use `invoke_subagent` with the agent name as `Role`.
> - **Claude Code:** when this adapter is selected directly, follow the source command's `Task` dispatch.
> - Pass the verbatim persona from `agents/<name>.md` plus task context.

Read `commands/review-fix.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (such as `[<PR-URL>] [--effort <tier>] [--plain]`).
