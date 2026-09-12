---
name: agy-story-check
description: Antigravity-invocable form of /sdlc:story-check — verify a story against the Definition of Done, a per-item PASS/GAP checklist and a verdict. Auto-detects reviewer mode for a teammate's PR.
---

# /agy-story-check

Read `commands/story-check.md` in full and follow its steps exactly, verbatim — this file
carries no separate instructions of its own. Arguments (`[STORY-KEY] [--plain]`) are passed
through identically to how `commands/story-check.md` describes reading them from `$ARGUMENTS`.

Every path it references is relative to this same plugin root and resolves identically under
Antigravity — see `docs/antigravity-port-notes.md`. This command dispatches no subagents, so
there is nothing Antigravity-specific to adapt here.
