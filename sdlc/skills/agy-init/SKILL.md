---
name: agy-init
description: Antigravity-invocable form of /sdlc:init — bootstrap a repo for the sdlc workflow. Idempotent — safe to run repeatedly.
---

# /agy-init

Read `commands/init.md` in full and follow its numbered steps exactly, verbatim — this file
carries no separate instructions of its own; it exists only so Antigravity's own skill-discovery
can find and invoke it, since Antigravity has no equivalent of Claude Code's `commands/` folder
convention.

Every path `commands/init.md` references (`skills/design-review/template.md`,
`skills/tracker-adapter/SKILL.md`, etc.) is relative to this same plugin root and resolves
identically regardless of which harness is reading it — both discover `agents/`/`skills/` at the
same location, with no redirect needed (see `docs/antigravity-port-notes.md` for why, and what
*doesn't* port this cleanly).

This command dispatches no subagents, so there is nothing Antigravity-specific to adapt — every
step in `commands/init.md` applies completely unchanged.
