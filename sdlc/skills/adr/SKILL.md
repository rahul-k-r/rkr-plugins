---
name: adr
description: Scaffold an Architecture Decision Record in docs/adr/ when a decision crosses the ADR threshold. Callable as /sdlc:adr or /adr.
---

# /sdlc:adr

Scaffold an Architecture Decision Record in `docs/adr/` with the right number and sections when a decision crosses the ADR threshold.

> **Path Resolution**: Resolve all referenced paths relative to the plugin directory (two levels above this `SKILL.md`).

Read `commands/adr.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (such as `[short title]`).
All commits and file operations apply to the current target repository.
