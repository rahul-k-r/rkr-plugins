---
name: review-fix
description: Apply review findings to a PR you authored, triage fixable vs. needs-judgment, fix the fixable, verify with a fresh review pass, and escalate the rest. Callable as /sdlc:review-fix.
---

# /sdlc:review-fix

Apply review findings to a PR you authored: triage fixable vs. needs-your-judgment, fix the fixable batch-by-batch, verify with a fresh review pass, and escalate the rest.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `agents/...`, `skills/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Subagent Dispatch**:
> Wherever `commands/review-fix.md` dispatches agents (`coder`, `validator`, `reviewer`):
> - Call `invoke_subagent` with `TypeName: "self"` (or `"research"` for read-only agents).
> - Set `Role` to the agent name.
> - Set `Model` tier resolved from `skills/gemini-model-effort/SKILL.md` (`pro` for coder; `flash` for reviewer; `flash_lite` for validator).
> - Set `Prompt` to the verbatim persona from `agents/<name>.md` (in the plugin directory) followed by the specific task/context.

Read `commands/review-fix.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (such as `[<PR-URL>] [--effort <tier>] [--plain]`).

