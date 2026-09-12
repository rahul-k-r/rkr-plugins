---
name: agy-design-review
description: Antigravity-invocable form of /sdlc:design-review — critique and deepen an existing design note by running the Q1–Q7 protocol against it. Does not create a new note.
---

# /agy-design-review

Read `commands/design-review.md` in full and follow its steps exactly, verbatim — this file
carries no separate instructions of its own. The argument (`<STORY-KEY> [--plain]`) is passed
through identically to how `commands/design-review.md` describes reading it from `$ARGUMENTS`.

Every path it references is relative to this same plugin root and resolves identically under
Antigravity — see `docs/antigravity-port-notes.md`. This command dispatches no subagents (it's
the orchestrating session running the critique protocol itself), so there is nothing
Antigravity-specific to adapt here.
