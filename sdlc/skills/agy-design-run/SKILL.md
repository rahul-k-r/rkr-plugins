---
name: agy-design-run
description: Antigravity-invocable form of /sdlc:design-run — autonomous multi-expert design deliberation, frame the design issues, argue each through a lens panel, synthesize decisions, draft and adversarially review the design note.
---

# /agy-design-run

Read `commands/design-run.md` in full and follow its steps exactly, verbatim, **except**:

1. Every "dispatch `<agent>`" — translate per `docs/antigravity-port-notes.md`'s **"How to
   translate a Task dispatch"** section (`invoke_subagent`, persona injected into `Prompt`, model
   from `skills/gemini-model-effort/SKILL.md`). Applies to every `designer`, `panelist`, and
   `architect` dispatch in Steps 2, 3, 5, 6.
2. **Effort/model resolution** — wherever the file says to resolve `effort` per
   `skills/model-effort/SKILL.md` and look up a `model` from its table, use
   `skills/gemini-model-effort/SKILL.md` and its table instead. The file's own "Model tiering"
   section (`designer`/`panelist`/`architect`, all `opus` at `High`) translates to: all three at
   `pro` at `High` — they're all in `gemini-model-effort`'s judgment-heavy bucket. For any other
   tier, read that table directly rather than re-deriving it here.
3. **`EnterWorktree` mentions are inapplicable** — Antigravity has no such tool; ignore those
   sentences rather than looking for an equivalent (see the notes doc).
4. **`--show-stats`'s Artifact-publish step is unavailable, not ported** — still collect
   `dispatches[]` and write the local JSON snapshot exactly as described; skip the publish step
   and say so, per the notes doc.

Everything else — the FRAME/DELIBERATE/SYNTHESIZE/DRAFT/ADVERSARIAL REVIEW/GATE+PUBLISH sequence,
consensus rules, escalation triggers, tracker-adapter and worktree-mode resolution, the local
provenance-file fallback — applies completely unchanged; every path it references resolves
identically under Antigravity (shared `agents/`/`skills/` folders, no redirect needed).
