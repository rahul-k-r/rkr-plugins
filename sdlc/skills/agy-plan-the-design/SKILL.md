---
name: agy-plan-the-design
description: Antigravity-invocable form of /sdlc:plan-the-design — run the full design-review protocol for a story as an interactive dialogue with the developer, producing a design note and posting cross-story obligations.
---

# /agy-plan-the-design

Read `commands/plan-the-design.md` in full and follow its steps exactly, verbatim — this file
carries no separate instructions of its own. The argument (`<STORY-KEY> [--technical]`) is
passed through identically to how `commands/plan-the-design.md` describes reading it from
`$ARGUMENTS`.

Every path it references is relative to this same plugin root and resolves identically under
Antigravity — see `docs/antigravity-port-notes.md`. This command dispatches no subagents (it's
an interactive dialogue run by the orchestrating session itself), so there is nothing
Antigravity-specific to adapt here.
