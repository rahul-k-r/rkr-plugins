---
name: agy-help
description: Antigravity-invocable form of /sdlc:help — show the sdlc catalog: every command with purpose and usage, the story-run agents, the push gate hook, and setup requirements.
---

# /agy-help

Read `commands/help.md` in full and follow its steps exactly, verbatim — this file carries no
separate instructions of its own. The argument (`[name-or-keyword | setup | agents | help]`) is
passed through identically to how `commands/help.md` describes reading it from `$ARGUMENTS`.

**One real mismatch, not just a path/tool difference:** `commands/help.md`'s catalog lists every
command by its Claude Code name (`/sdlc:init`, `/sdlc:story-run`, etc.) — those are not the
names Antigravity actually invokes. When rendering the catalog under Antigravity, translate each
`/sdlc:<name>` reference to `/agy-<name>` before presenting it, and say so explicitly once at the
top of the output, so a reader isn't left trying an invocation that doesn't exist on this
harness. Everything else in the catalog (purpose, usage, flags, the agents list, the push-gate
hook, setup requirements) applies unchanged — see `docs/antigravity-port-notes.md` for the one
caveat worth surfacing under "setup requirements": the push-gate hook (`hooks/gate-git.js`) does
not currently enforce anything under Antigravity unless manually installed into the global hook
config.
