---
name: agy-review-fix
description: Antigravity-invocable form of /sdlc:review-fix — apply review findings to a PR you authored, triage fixable vs. needs-your-judgment, fix the fixable, verify with a fresh review pass, escalate the rest.
---

# /agy-review-fix

Read `commands/review-fix.md` in full and follow its steps exactly, verbatim, **except**:

1. Every "dispatch `<agent>`" — translate per `docs/antigravity-port-notes.md`'s **"How to
   translate a Task dispatch"** section (`invoke_subagent`, persona injected into `Prompt`, model
   from `skills/gemini-model-effort/SKILL.md`). Applies to every `coder`, `validator`, `reviewer`
   (PR mode) dispatch throughout.
2. **Effort/model resolution** — use `skills/gemini-model-effort/SKILL.md` in place of
   `skills/model-effort/SKILL.md`. Its own "Model tiering" table translates as:

   | This file says | Use instead |
   |---|---|
   | `coder` = opus | `pro` |
   | `validator` = haiku | `flash_lite` |
   | `reviewer` = sonnet | `flash` |

   For any other effort tier, read `skills/gemini-model-effort/SKILL.md`'s table directly.
3. **`--show-stats`'s Artifact-publish step is unavailable, not ported** — still collect and
   snapshot locally per `docs/antigravity-port-notes.md`; skip the publish step and say so.

Everything else — triage, the fix loop, the convergence re-review, escalation of
needs-your-judgment findings — applies completely unchanged; every path it references resolves
identically under Antigravity (shared `agents/`/`skills/` folders, no redirect needed).
