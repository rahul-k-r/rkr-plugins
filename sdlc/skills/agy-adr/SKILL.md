---
name: agy-adr
description: Antigravity-invocable form of /sdlc:adr — scaffold an Architecture Decision Record in docs/adr/ when a decision crosses the ADR threshold.
---

# /agy-adr

Read `commands/adr.md` in full and follow its steps exactly, verbatim — this file carries no
separate instructions of its own. The argument (`[short title]`) is passed through identically
to how `commands/adr.md` describes reading it from `$ARGUMENTS`.

Every path it references is relative to this same plugin root and resolves identically under
Antigravity — see `docs/antigravity-port-notes.md`. This command dispatches no subagents, so
there is nothing Antigravity-specific to adapt here.
