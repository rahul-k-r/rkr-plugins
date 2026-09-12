---
name: agy-story-pr
description: Antigravity-invocable form of /sdlc:story-pr — commit, push the story branch, and open the story PR against the resolved base branch, the step that triggers CI.
---

# /agy-story-pr

Read `commands/story-pr.md` in full and follow its steps exactly, verbatim — this file carries
no separate instructions of its own. Arguments (`[STORY-KEY] [--review] [--fix] [--plain]`)
are passed through identically to how `commands/story-pr.md` describes reading them from
`$ARGUMENTS`.

Every path it references is relative to this same plugin root and resolves identically under
Antigravity — see `docs/antigravity-port-notes.md`. This command dispatches no subagents, so
there is nothing Antigravity-specific to adapt here. **Note:** `commands/story-pr.md` may invoke
`gate-git.js`'s push-timing enforcement indirectly (via the story's phase gate) — that's
`hooks-antigravity/gate-git.js` here, and it enforces nothing until `/agy-install-hooks` has been
run (and even then, with the disclosed gaps documented there — not the same guarantee as Claude
Code's). If it hasn't been run, treat the phase gate as advisory only.
