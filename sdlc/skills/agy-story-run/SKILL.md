---
name: agy-story-run
description: Antigravity-invocable form of /sdlc:story-run — autonomous full-lifecycle story execution, design, plan, implement batch-by-batch, final review, and open the PR, escalating to the human only where judgment genuinely requires it.
---

# /agy-story-run

Read `commands/story-run.md` in full and follow its steps exactly, verbatim, **except**:

1. Every "dispatch `<agent>`" — translate per `docs/antigravity-port-notes.md`'s **"How to
   translate a Task dispatch"** section (`invoke_subagent`, persona injected into `Prompt`, model
   from `skills/gemini-model-effort/SKILL.md`). Applies to every `designer`, `architect`,
   `panelist`, `coder`, `intake`, `planner`, `reviewer`, `validator` dispatch throughout —
   including the `reviewer` (PR-mode) dispatch(es) in the `--bypass` tail's AUTO_REVIEW/AUTO_FIX
   steps, and the inline `design-run`/`review-run`/`review-fix` procedures this file invokes for
   the DESIGN phase and the `--bypass` tail; those follow `agy-design-run`/`agy-review-run`/
   `agy-review-fix`'s own translations, not a re-derivation here.
2. **Effort/model resolution** — use `skills/gemini-model-effort/SKILL.md` in place of
   `skills/model-effort/SKILL.md`. Its own "Model tiering" table translates as:

   | This file says | Use instead |
   |---|---|
   | `designer` = opus | `pro` |
   | `architect` = opus | `pro` |
   | `panelist` = opus | `pro` |
   | `coder` = opus | `pro` |
   | `intake` = sonnet | `flash` |
   | `planner` = sonnet | `flash` |
   | `reviewer` = sonnet (also the `--bypass` tail's PR-mode dispatch) | `flash` |
   | `validator` = haiku | `flash_lite` |

   For any other effort tier, read `skills/gemini-model-effort/SKILL.md`'s table directly.
3. **`EnterWorktree` mentions are inapplicable** — Antigravity has no such tool; ignore those
   sentences rather than looking for an equivalent (see the notes doc).
4. **`--show-stats`'s Artifact-publish step is unavailable, not ported** — still collect and
   snapshot locally per `docs/antigravity-port-notes.md` (including at the end of the `--bypass`
   tail, where this file writes the snapshot once for the whole lifecycle); skip the publish step
   and say so.

Everything else — phase sequencing, checkpoints/resume, escalation rules, `--bypass`'s
auto-review/merge/close tail, `--incognito`/no-ticket handling, worktree/branch setup via plain
`git worktree` CLI commands — applies completely unchanged; every path it references resolves
identically under Antigravity (shared `agents/`/`skills/` folders, no redirect needed).
