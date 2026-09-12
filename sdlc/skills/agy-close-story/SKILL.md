---
name: agy-close-story
description: Antigravity-invocable form of /sdlc:close-story — verify-before-done: confirm merge, CI, AC coverage, post completion record, transition to Done, report unblocked tickets.
---

# /agy-close-story

Read `commands/close-story.md` in full and follow its steps exactly, verbatim — this file
carries no separate instructions of its own. The argument (`<STORY-KEY> [--plain]`) is
passed through identically to how `commands/close-story.md` describes reading it from
`$ARGUMENTS`.

Every path it references is relative to this same plugin root and resolves identically under
Antigravity — see `docs/antigravity-port-notes.md`. This command dispatches no subagents, so
there is nothing Antigravity-specific to adapt here. Its tracker-adapter and write-mode
resolution (`skills/tracker-adapter/SKILL.md`) apply unchanged — MCP tool naming differences
(see `docs/antigravity-port-notes.md`) matter only to a hook or agent enforcing tool scope, not
to a plain read/write op resolved and called directly by the orchestrating session itself.
