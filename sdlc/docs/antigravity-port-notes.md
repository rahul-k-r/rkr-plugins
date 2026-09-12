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
plugin install can do on its own.

**Decided (2026-09-08): option 1 — ship the hook logic, as a documented manual-install step.**
`hooks-antigravity/gate-git.js` and `guard-agent-tools.js` carry the same policy as their Claude
Code originals; `skills/agy-install-hooks/SKILL.md` merges them into the user's global config,
with explicit confirmation before writing (it edits a file outside the plugin's own directory)
and a loud, standing warning that this **cannot guarantee the same safety Claude Code gets
automatically** — real enforcement, but weaker and with real disclosed gaps (see both hook
files' own headers): agent identity depends on the dispatching prompt setting `Role` correctly
rather than a platform-set field, and several payload field names were never directly confirmed.
Re-running the merge is needed whenever the plugin's hook logic changes; a future Antigravity
release that starts auto-wiring plugin hooks would make this manual step (and its gaps)
unnecessary — worth periodically re-testing with the original minimal harness before assuming
that's happened.

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

## How to translate a Task dispatch (the rule every `agy-*` command wrapper points to)

The 5 subagent-dispatching commands (`design-run`, `product-design-review`, `review-fix`,
`review-run`, `story-run`) each say "dispatch `<agent>` via the Task tool" many times throughout
a long file — adapting every call site individually in each file would duplicate content this
whole port has otherwise avoided. Instead, every `agy-*` wrapper for these 5 states this rule
once and trusts the invoking session to apply it consistently wherever the underlying
`commands/*.md` says "dispatch":

> Wherever the file says "dispatch `<agent>` [in some mode]", do this instead of using a Task
> tool (which doesn't exist here): call `invoke_subagent` with one `Subagents` entry —
> `TypeName: "self"` (or `"research"` if the agent's job is strictly read-only — check
> `agents/<agent>.md`'s own tool description), `Role`: a short 2-5 word title for the job,
> `Model`: the tier-resolved key from `skills/gemini-model-effort/SKILL.md`'s table for that
> agent and the run's resolved effort tier, `Prompt`: the **full verbatim content of
> `agents/<agent>.md`**, followed by the specific per-dispatch task/context the original file
> describes passing, `Workspace: "inherit"` unless the file says otherwise. Everything else about
> the step — what the dispatch is for, how its output is used, escalation/revise-budget rules —
> applies completely unchanged.
>
> **One exception to the free-text `Role`:** for the four tracker-touching agents — `intake`,
> `surveyor`, `verifier`, `publisher` — set `Role` to **exactly the agent's own name**, lowercase,
> nothing else appended (e.g. `Role: "publisher"`, not `Role: "Tracker Write Executor"`).
> `hooks-antigravity/guard-agent-tools.js` (see below) has no way to identify which agent is
> calling a tool other than matching this field verbatim — a descriptive title would make its
> scoping silently inert for that dispatch. Every other agent keeps a free-text `Role`, since
> nothing keys off it.

Two things every one of these 5 files also does that need a stated, not silently-applied,
translation:

- **`EnterWorktree` doesn't exist under Antigravity.** Every mention of "this session never calls
  `EnterWorktree`" is Claude-Code-specific trivia about a tool that isn't present here — treat it
  as inapplicable, not as an instruction to find an equivalent. Antigravity's own per-subagent
  `Workspace` field (`"inherit"|"branch"|"share"`) is the closest analog, already covered above.
- **The `--show-stats` Artifact-publish step is unconfirmed, not ported.** Every one of these
  files says to "publish it via the Artifact tool" (loading Claude's own built-in
  `artifact-design`/`dataviz` skills first) for the rendered HTML usage report. **No equivalent
  has been confirmed to exist under Antigravity** — not tested, not found in docs. Until it is,
  treat `--show-stats`'s auto-publish behavior as unavailable: still collect `dispatches[]` and
  still write the local JSON snapshot exactly as described (nothing about that depends on the
  Artifact tool), but skip the publish step and tell the developer the rendered-report feature
  isn't available on this harness yet, rather than silently failing or guessing at a substitute.
