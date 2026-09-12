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

## Plugin-bundled `hooks.json` does not auto-fire at runtime (Validation vs. Runtime)

Tested end-to-end across all surfaces:

- **Validation layer (`agy plugin validate <plugin-dir>`)**: Antigravity's CLI checks the plugin root for a `hooks.json` file. When present and conforming to schema, it outputs `✔ hooks: 1 processed`. When missing, it outputs `- hooks: skipped (not found)`. This is why `sdlc/hooks.json` exists at the plugin root as the canonical Antigravity hook definition.
- **Runtime layer (IDE & `agy` CLI)**: **Neither the Antigravity IDE nor the `agy` CLI mounts plugin-bundled `hooks.json` at runtime.** Confirmed empirically across multiple real tool calls and verified in `audit.jsonl`: only the machine-level config (`~/.gemini/config/hooks.json`) is consulted by the hook dispatcher. A hook declared only inside `~/.gemini/config/plugins/sdlc/hooks.json` never fires.

### How this is reconciled: Canonical Manifest + Automated Global Registration

Because plugin hooks do not auto-mount at runtime, they must be registered into `~/.gemini/config/hooks.json`. To prevent drift and eliminate duplication:

1. **Single Canonical Manifest (`sdlc/hooks.json`)**:
   `sdlc/hooks.json` at the plugin root defines the hooks (`gate-git.js` on `run_command`, `guard-agent-tools.js` on `.*`) with clean relative paths. This satisfies `agy plugin validate` and acts as the single source of truth for Antigravity hooks. (The Claude Code manifest remains isolated at `sdlc/hooks/hooks.json`).
2. **Automated Dynamic Parameterization**:
   All three automated installers (`bin/cli.js`, `install.ps1`, `install.sh`) as well as the interactive `/sdlc:install-hooks` command do **not** hardcode hook JSON. Instead, they parse `sdlc/hooks.json`, dynamically rewrite the relative script paths into absolute paths targeting `~/.gemini/config/plugins/sdlc/hooks-antigravity/*.js`, and merge the resulting `"sdlc"` block into the user's `~/.gemini/config/hooks.json`.
3. **Drift-Free Updates**:
   Any additions or adjustments to matchers, timeouts, or hook events in `sdlc/hooks.json` automatically propagate to `~/.gemini/config/hooks.json` whenever an installer or `update` command runs.

## `agents/*.md` does not power `invoke_subagent` dispatch

Tested end-to-end with real reproduced errors, not inferred:

- A plugin's `agents/*.md` files register names into a **different namespace** — top-level,
  primary-session personas, selectable via `agy --agent <name>` or the IDE's persona picker. This
  is confirmed real and useful on its own (`agy plugin validate` reports `agents: 1 processed`
  for a plugin carrying one), but it is **not** what `invoke_subagent` consults.
- `invoke_subagent`'s `TypeName` only accepts `"self"`, `"research"`, or a type registered at
  runtime via `define_subagent` in the *same session*. Calling it with `TypeName: "designer"`
  (matching `agents/designer.md`) fails:
  ```
  Encountered error in tool execution: subagent "designer" not found or not allowed to be invoked
  ```
  Trying to register it dynamically instead (`define_subagent(name="designer")`) *also* fails —
  differently, revealing the name is reserved by the top-level-persona registration but still
  unusable for subagent dispatch:
  ```
  Encountered error in tool execution: agent "designer" already exists, please use a different name
  ```

**Practical consequence: no `TypeName` can reference `agents/<name>.md` by name for a
dispatched subagent, ever — for one dispatch or a hundred.** The confirmed, working pattern
instead: `TypeName: "self"` (full inherited toolset) or `TypeName: "research"` (read-only), with
the target agent's entire persona — its full `agents/<name>.md` content — **injected directly
into the `Prompt` field**, concatenated with the specific per-dispatch task. `sdlc/agents/*.md`
stays the single source of truth for that content (an Antigravity-side dispatch reads the file
and includes it verbatim in `Prompt`, rather than a second copy existing anywhere) — it's the
*reference mechanism* that differs from Claude Code, not the content.

### This also closes off "Option 2" above, not just narrows it

The hooks section above offered "rely on each subagent's own `tools`/`disallowedTools`
frontmatter for scoping" as a fallback if hook-based enforcement stays unavailable. **That
fallback doesn't exist either, for the same underlying reason**: `invoke_subagent`'s confirmed
schema (`TypeName`, `Role`, `Model`, `Prompt`, `Workspace`) has no per-dispatch tool-allowlist
field at all — only the binary `"self"` (everything) / `"research"` (read-only) choice built
into `TypeName` itself. Claude Code's fine-grained per-agent `tools:`/`disallowedTools:`
frontmatter has no Antigravity dispatch-time equivalent to fall back to.

**Net effect, combined with the hooks finding above:** as of 2026-09-08, an Antigravity-dispatched
subagent gets either full tool inheritance or a fixed read-only set — nothing in between, and no
hook currently intercepts what it does with that access unless the global config is manually
edited. The elaborate per-role, per-operation scoping `guard-agent-tools.js` gives Claude Code
(built specifically to avoid hardcoding MCP server names — see `skills/tracker-adapter/SKILL.md`)
has no current Antigravity equivalent. This is a real, load-bearing gap to be upfront about, not
something to paper over with a weaker-but-still-real substitute — there currently isn't one.

## Skill naming and invocations (No `agy-` prefix)

Skills exposed by the plugin are placed directly in `skills/<command-name>/SKILL.md` (e.g. `skills/story-run/SKILL.md`).
Under Antigravity, they are namespaced as `sdlc:<command-name>` and invoked as:
- `/sdlc:story-run` (canonical namespaced command)
- `/story-run` (unqualified command)

Claude Code continues to discover slash commands via `commands/*.md` (`commands/story-run.md`), ensuring full backward compatibility for Claude Code without breaking or duplicating logic.

## Hook Payloads (Confirmed Empirically)

Hook payloads passed to stdin on `PreToolUse` events contain:
```json
{
  "conversationId": "...",
  "stepIdx": 540,
  "modelName": "...",
  "workspacePaths": ["c:/path/to/workspace"],
  "transcriptPath": "...",
  "artifactDirectoryPath": "...",
  "toolCall": {
    "name": "run_command",
    "args": {
      "CommandLine": "git status",
      "Cwd": "c:\\path\\to\\workspace",
      "WaitMsBeforeAsync": 5000
    }
  }
}
```
Hooks parse `payload.toolCall.args.CommandLine` for command strings and `payload.toolCall.args.Cwd` for working directories. Tool names are `payload.toolCall.name` (`run_command`, `view_file`, `write_to_file`, `replace_file_content`, `grep_search`, `find_by_name`, `list_dir`, `ask_question`, `call_mcp_tool`).

## How to translate a Task dispatch (the rule skill wrappers point to)

The 5 subagent-dispatching commands (`design-run`, `product-design-review`, `review-fix`,
`review-run`, `story-run`) each say "dispatch `<agent>` via the Task tool" many times throughout
a long file — adapting every call site individually in each file would duplicate content this
whole port has otherwise avoided. Instead, every wrapper for these 5 states this rule
once and trusts the invoking session to apply it consistently wherever the underlying
`commands/*.md` says "dispatch":

> Wherever the file says "dispatch `<agent>` [in some mode]", do this instead of using a Task
> tool (which doesn't exist here): call `invoke_subagent` with one `Subagents` entry —
> `TypeName: "self"` (or `"research"` if the agent's job is strictly read-only — check
> `agents/<agent>.md`'s own tool description), `Role`: the exact agent name (e.g. `Role: "designer"`),
> `Model`: the tier-resolved key from `skills/gemini-model-effort/SKILL.md`'s table for that
> agent and the run's resolved effort tier, `Prompt`: the **full verbatim content of
> `agents/<agent>.md`** (resolved from the plugin root), followed by the specific per-dispatch task/context the original file
> describes passing, `Workspace: "inherit"` unless the file says otherwise. Everything else about
> the step — what the dispatch is for, how its output is used, escalation/revise-budget rules —
> applies completely unchanged.

Two things every one of these 5 files also does:

- **`EnterWorktree` doesn't exist under Antigravity.** Every mention of "this session never calls
  `EnterWorktree`" is Claude-Code-specific trivia about a tool that isn't present here — treat it
  as inapplicable, not as an instruction to find an equivalent. Antigravity's own per-subagent
  `Workspace` field (`"inherit"|"branch"|"share"`) is the closest analog, already covered above.
- **The `--show-stats` Artifact report.** Antigravity natively supports Artifacts (`<artifactDirectoryPath>`)
  and rich HTML widgets via `generative_ui`. Under `--show-stats`, render `skills/run-stats/template.html`
  filled with data and output it to the artifact directory.
