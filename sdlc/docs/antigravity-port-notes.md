# Antigravity port — confirmed platform facts

Working notes for porting `sdlc`'s subagent pipeline and hook-enforced guarantees to the
Antigravity harness. Everything below was verified empirically (real transcripts, real
`agy plugin validate` runs, real `audit.jsonl` entries) — not inferred from docs — on 2026-09-08.
Re-verify before relying on any of it if Antigravity's plugin/hook system has since changed.

## MCP tool-call naming

Two different shapes depending on how the MCP server is loaded:

- **Lazy-loaded** (the default for a multi-tool server, e.g. Linear) — **confirmed against real
  raw `transcript.jsonl` entries**, not just a summary. Every call goes through one fixed tool,
  `call_mcp_tool`, with the actual server/operation identified in its *args*, not its name:
  ```json
  {"name":"call_mcp_tool","args":{"ServerName":"\"linear-mcp-server\"","ToolName":"\"get_workspace\"","Arguments":"{}"}}
  ```
  A hook or agent-scoping check for this shape must match on `tool_name === "call_mcp_tool"` and
  then read `tool_input.args.ServerName` / `tool_input.args.ToolName` — there is no per-operation
  tool name to regex against the way Claude Code's `mcp__server__tool` allows.
- **Eager-loaded** — tool names are distinguishable, as `mcp_<server>_<tool>` (single underscore,
  not Claude Code's double-underscore convention). **Corroborated, not directly observed**: no
  real eager-loaded `tool_calls` entry was found in any accessible transcript; this rests on the
  docstring of a real, functioning permission-evaluator (`_parse_mcp_tool_name` in a separate
  `auto-permissions-mode` project) that has to get this right to work — a strong signal, but
  confirm against a real transcript before treating it as settled the way the lazy-load shape is.

`mcp(<server>/<tool>)` (e.g. `mcp(linear-mcp-server/get_workspace)`) is **permission-grant syntax
only** — what a user/policy writes to approve a tool, never the runtime tool-call name itself.
Don't confuse the two when reading Antigravity's permission-related config or docs.

## Plugin-bundled `hooks.json` does not auto-fire

Tested end-to-end, both surfaces:

- **`agy plugin validate <plugin-dir>`** recognizes and validates a plugin's own `hooks.json`
  (`✔ hooks: 1 processed`) — so it's a real, checked component, not silently ignored by tooling.
- **Neither the Antigravity IDE nor the `agy` CLI actually mounts it at runtime.** A minimal test
  plugin (`PreToolUse` hook matching `run_command`, logging every invocation to a file) never
  fired in either surface across multiple real tool calls — confirmed by the absence of its log
  file, and independently confirmed via `audit.jsonl`, which recorded the `ALLOW` decision for a
  test command as coming from the **global** hook evaluator (`~/.gemini/config/hooks.json`), with
  no trace of the plugin hook ever being consulted. A workspace-level `.agents/hooks.json` was
  also tried as a fallback and also did not fire — **only the global, per-machine config file is
  ever consulted**, regardless of where else a `hooks.json` is declared.

### What this means for `gate-git.js` / `guard-agent-tools.js`

Claude Code plugin hooks are wired automatically on install — this is the whole premise both of
those hooks are built on (ship the enforcement logic in the plugin, every install gets it for
free, no separate setup step). **That premise does not hold for Antigravity as of 2026-09-08.**
An Antigravity port of either hook cannot be "just ship `hooks.json` in the plugin bundle" —
it would only ever take effect if the user manually copies/merges that config into their own
`~/.gemini/config/hooks.json`, a real, undocumented-by-us-so-far setup step, not something a
plugin install can do on its own. Options, not yet decided:

1. **Ship the hook logic in the plugin anyway, as a documented manual-install step** — an
   `install-hooks` command/script that merges the plugin's hook config into the user's global
   file (with the user's confirmation, since it's editing a file outside the plugin's own
   directory). Real enforcement, but onboarding friction, and re-running the merge is needed
   whenever the plugin's hook logic changes.
2. **Drop hook-based enforcement for the Antigravity port entirely**, relying only on each
   subagent's own `tools`/`disallowedTools` frontmatter for scoping (weaker than Claude Code's
   guarantee — a hook can catch things frontmatter-level scoping can't, e.g. the six
   tracker-touching agents that need full inheritance because MCP server names aren't knowable
   in advance — see `skills/tracker-adapter/SKILL.md`).
3. **Wait and revisit** if Antigravity's plugin system starts auto-wiring plugin hooks in a
   future release — worth periodically re-testing with the same minimal harness before assuming
   this is still true.

No decision made yet — this file exists so the investigation itself isn't lost, and so whichever
option gets picked later has the actual evidence behind it, not a re-guess.
