---
name: agy-review-run
description: Antigravity-invocable form of /sdlc:review-run — autonomous multi-PR review subsystem, parallel story-PR reviews with cross-ticket compatibility checks, and the sprint-close gate that verifies a sprint is safe to merge to main.
---

# /agy-review-run

Read `commands/review-run.md` in full and follow its steps exactly, verbatim, **except**:

1. Every "dispatch `<agent>`" — translate per `docs/antigravity-port-notes.md`'s **"How to
   translate a Task dispatch"** section (`invoke_subagent`, persona injected into `Prompt`, model
   from `skills/gemini-model-effort/SKILL.md`). Applies to every `reviewer` (PR mode), `integrator`,
   `validator` dispatch throughout — and, via `--fix` chaining into the inline review-fix
   procedure, `coder`, per `agy-review-fix`'s own translation (not re-derived here).
2. **Effort/model resolution** — use `skills/gemini-model-effort/SKILL.md` in place of
   `skills/model-effort/SKILL.md`. Its own "Model tiering" table translates as:

   | This file says | Use instead |
   |---|---|
   | `reviewer` (PR mode) = sonnet (override to opus for high-stakes/`--depth full`) | `flash` (override to `pro`) |
   | `integrator` = opus | `pro` |
   | `validator` = haiku | `flash_lite` |

   For any other effort tier, read `skills/gemini-model-effort/SKILL.md`'s table directly.
3. **`--show-stats`'s Artifact-publish step is unavailable, not ported** — still collect and
   snapshot locally per `docs/antigravity-port-notes.md`; skip the publish step and say so.

Everything else — per-PR review fan-out, cross-ticket compatibility checks, the sprint-close
gate, `--fix`/`--post`/`--close` handling — applies completely unchanged; every path it
references resolves identically under Antigravity (shared `agents/`/`skills/` folders, no
redirect needed).
