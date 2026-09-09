---
name: agy-story-pr
description: Antigravity-invocable form of /sdlc:story-pr — commit, push the story branch, and open the story PR against the resolved base branch, the step that triggers CI.
---

# /agy-story-pr

Read `commands/story-pr.md` in full and follow its steps exactly, verbatim — this file carries
no separate instructions of its own. Arguments (`[STORY-KEY] [--review] [--fix] [--technical]`)
are passed through identically to how `commands/story-pr.md` describes reading them from
`$ARGUMENTS`.

Every path it references is relative to this same plugin root and resolves identically under
Antigravity — see `docs/antigravity-port-notes.md`. This command dispatches no subagents, so
there is nothing Antigravity-specific to adapt here. **Note:** `commands/story-pr.md` may invoke
`gate-git.js`'s push-timing enforcement indirectly (via the story's phase gate) — per
`docs/antigravity-port-notes.md`, that hook does not currently fire under Antigravity unless
manually installed into the global hook config; treat its gate as advisory only until that's
resolved.
