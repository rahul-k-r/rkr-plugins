---
name: agy-build-check
description: Antigravity-invocable form of /sdlc:build-check — run the repo's full local quality gate (build, static analysis, tests, lint) and report real PASS/FAIL per step.
---

# /agy-build-check

Read `commands/build-check.md` in full and follow its steps exactly, verbatim — this file
carries no separate instructions of its own.

Every path it references is relative to this same plugin root and resolves identically under
Antigravity — see `docs/antigravity-port-notes.md`. This command dispatches no subagents, so
there is nothing Antigravity-specific to adapt here.
