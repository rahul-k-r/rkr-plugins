---
name: agy-story-start
description: Antigravity-invocable form of /sdlc:story-start — gate check before implementation: verify the design note, fetch the full AC, cut the correctly-named branch, and move the issue to In Progress.
---

# /agy-story-start

Read `commands/story-start.md` in full and follow its steps exactly, verbatim — this file
carries no separate instructions of its own. Arguments (`<STORY-KEY> [--worktree <path> |
--no-worktree] [--incognito] [--technical]`) are passed through identically to how
`commands/story-start.md` describes reading them from `$ARGUMENTS`.

Every path it references is relative to this same plugin root and resolves identically under
Antigravity — see `docs/antigravity-port-notes.md`. This command dispatches no subagents, so
there is nothing Antigravity-specific to adapt here. Its worktree handling
(`skills/worktree-mode/SKILL.md`) uses plain `git worktree` CLI commands, not a Claude-Code-
specific tool — portable as written. This is a **different** concern from Antigravity's own
subagent `Workspace` field (`"inherit"|"branch"|"share"`, see
`skills/gemini-model-effort/SKILL.md`), which governs an individual *subagent dispatch*'s
isolation, not the story branch the orchestrating session itself works from.
