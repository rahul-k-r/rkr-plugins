---
name: agy-install-hooks
description: Manually install sdlc's Antigravity hooks (branch protection, per-agent tracker-tool scoping) into the user's global hook config. Required step — Antigravity does not auto-wire a plugin's own hooks.json.
---

# /agy-install-hooks

⚠️ **Read this in full before running it, and print the same warning to the developer before
writing anything.** Antigravity does not auto-wire a plugin's own `hooks.json` (confirmed
empirically — see `docs/antigravity-port-notes.md`), so `hooks-antigravity/gate-git.js` and
`guard-agent-tools.js` do **nothing at all** until manually merged into the user's *global*,
per-machine hook config. Even installed, this cannot guarantee what Claude Code's equivalent
hooks guarantee automatically:

- **Agent-scoping relies on the dispatching prompt setting `Role` correctly.** Unlike Claude
  Code's platform-set `agent_type` field, `Role` is just a string the invoking session chooses —
  if it's wrong or missing for one of the six tracker-touching agents, `guard-agent-tools.js`
  fails **open** for that call (allows it, ungoverned), not closed. See that file's own header.
- **Several payload field names this hook reads were never directly confirmed** — best-effort,
  documented in each hook's own header comment.
- **This is a per-machine install**, not a per-repo one — installing it once covers every repo
  this plugin runs against on this machine, but a fresh machine/environment needs the same step
  repeated.

**Do not claim, to yourself or the developer, that installing this makes Antigravity dispatches
as safe as Claude Code's.** It's meaningfully weaker, disclosed on purpose — say so plainly.

## Steps

1. **Locate the plugin's own hook files.** Resolve the absolute path to this plugin's
   `hooks-antigravity/` directory in the current install (however this session knows where the
   plugin's own files live — the same way it resolved `agents/`/`skills/` to read this file at
   all). Confirm both `gate-git.js` and `guard-agent-tools.js` exist there.

2. **Read `hooks-antigravity/hooks.json`** (the source config, shipped with the plugin — relative
   `"command"` values like `"node gate-git.js"`) and **rewrite its two `command` fields to
   absolute paths** pointing at the files located in Step 1, e.g.
   `"node C:/actual/path/hooks-antigravity/gate-git.js"`. This is required, not cosmetic: once
   merged into the global config, the working directory Antigravity runs a hook command from is
   no longer guaranteed to be this plugin's own folder, so a relative path silently breaks.

3. **Read the user's global hook config** (Windows: `%USERPROFILE%\.gemini\config\hooks.json`;
   confirm the real path for the current OS/install rather than assuming). If it doesn't exist,
   treat it as `{}`. If it exists, parse it — **do not discard any existing top-level key** (a
   real example from testing: an unrelated `auto-permissions-mode` entry already present in this
   file must survive the merge untouched).

4. **Merge**: set the `"sdlc"` top-level key (see step 2's rewritten content) into the parsed
   global config. If a `"sdlc"` key already exists (a previous install, possibly from an older
   plugin version), overwrite it — this key is fully owned by this plugin, safe to replace
   wholesale; **every other key in the file must be preserved exactly as read.**

5. **Show the developer the full diff** — before and after, or at minimum the exact `"sdlc"`
   block being written and confirmation that no other key changed — and **wait for explicit
   confirmation before writing.** This edits a file outside the plugin's own directory, on the
   developer's real machine config; never write it silently.

6. **Write the merged file** back to the global config path, then print the warning from the top
   of this file again as a closing reminder, plus: "Restart Antigravity (or start a new session)
   for the hook to take effect" — hook config is very likely read once at startup, not
   hot-reloaded (unconfirmed either way; safest to say so and let a restart happen anyway).

## Uninstalling

Not automated — this command only ever adds/replaces the `"sdlc"` key. To remove it, open the
global hook config directly and delete that key (or ask this session to do so, describing it as
exactly that: read the file, remove one top-level key, show the diff, confirm, write).
