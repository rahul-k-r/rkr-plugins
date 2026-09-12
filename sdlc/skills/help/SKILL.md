---
name: help
description: Show the sdlc catalog — every command with purpose and usage, story-run agents, hooks, and setup requirements. Callable as /sdlc:help.
---

# /sdlc:help

Show the `sdlc` catalog: every command with purpose and usage, story-run agents, hook protection, and repository setup requirements.

> **Path Resolution**: Resolve all referenced plugin paths relative to the plugin directory (two levels above this `SKILL.md`).

Read `commands/help.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (`[name-or-keyword | setup | agents | help]`).
Commands are invoked as `/sdlc:<name>` (e.g. `/sdlc:story-run`, `/sdlc:init`).

