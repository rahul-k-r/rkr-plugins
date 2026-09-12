---
name: install-hooks
description: Install sdlc's Antigravity hooks (branch protection, per-agent tracker-tool scoping) into the user's global hook config. Callable as /sdlc:install-hooks.
---

# /sdlc:install-hooks

Install `sdlc`'s Antigravity hooks (branch protection via `gate-git.js` and per-agent tracker-tool scoping via `guard-agent-tools.js`) into the user's global hook config (`~/.gemini/config/hooks.json`).

> **Path Resolution**: Resolve all referenced plugin paths relative to the plugin directory (two levels above this `SKILL.md`).

## Steps

1. **Locate plugin hooks**: Resolve the absolute path to this plugin's `hooks-antigravity/` directory. Confirm `gate-git.js` and `guard-agent-tools.js` exist.
2. **Read `hooks-antigravity/hooks.json`**: Rewrite the command paths to absolute paths pointing at the files in Step 1 (e.g. `node <absolute-path>/hooks-antigravity/gate-git.js`).
3. **Read global config**: Read `%USERPROFILE%\.gemini\config\hooks.json` (or `~/.gemini/config/hooks.json`). Preserve all existing top-level keys.
4. **Merge**: Insert or update the `"sdlc"` top-level key.
5. **Show diff & confirm**: Display the diff to the developer before writing.
6. **Write**: Update the global hook configuration.

