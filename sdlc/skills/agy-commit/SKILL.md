---
name: agy-commit
description: Antigravity-invocable form of /sdlc:commit — create atomic, convention-following commits from the working tree. Local only — never pushes.
---

# /agy-commit

Read `commands/commit.md` in full and follow its steps exactly, verbatim — this file carries no
separate instructions of its own. Arguments (`[STORY-KEY] [message]`) are passed through
identically to how `commands/commit.md` describes reading them from `$ARGUMENTS`.

Every path it references is relative to this same plugin root and resolves identically under
Antigravity — see `docs/antigravity-port-notes.md`. This command dispatches no subagents, so
there is nothing Antigravity-specific to adapt here.
