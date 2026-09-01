---
name: tracker-adapter
description: Resolves which ticket tracker (Jira/Linear/none) and write-mode (normal/incognito) a repo uses, and maps abstract ticket operations onto concrete tool calls. Every command/agent that touches a ticket points here instead of hard-coding a tracker's tool names.
---

# Skill: tracker-adapter

Every `sdlc` command/agent that touches a ticket does so through this file — never by hard-coding a tracker's tool names. It defines how to **resolve** which tracker a repo uses, the **op table** (abstract operation → concrete tool calls, per tracker), and the **write-mode** split that `--incognito` and `tracker: none` both drive.

## Resolution

1. **Read `.sdlc/config.json`** at the repo root (created/updated by `/sdlc:init`): `{ "tracker": "jira"|"linear"|"none", "trackerProjectKey": "..." }`. If present, this wins — stop here.
2. **Else, detect which MCP tool family is registered this session:**
   - Jira: any of `mcp__atlassian__*`, `mcp__atlassian-tractionlayer__*`, `mcp__atlassian-idvibes__*`, `mcp__plugin_traction-atlassian_atlassian__*`.
   - Linear: `mcp__claude_ai_Linear__*` (or an equivalent `mcp__*linear*` server).
   - Exactly one family present → use it, and offer to persist the choice to `.sdlc/config.json` (don't write without asking — the developer may be trying it out, or working across repos with different trackers in one session).
   - Both present → ask which one this repo uses.
   - Neither present → `tracker: none`.
3. **`tracker: none` is a legitimate, fully-supported mode** — not an error state. No command that only reads or reports should ever be unusable for lack of a tracker. See **`tracker: none` / manual fallback** below.

## Registering a new Jira MCP server name

MCP server names are chosen per-project (whatever `.mcp.json`/`claude mcp add` calls it) — there is no way around enumerating them: Claude Code's subagent `tools:` frontmatter only supports a trailing wildcard after an *exact* server name (`mcp__atlassian-idvibes__*`), never a partial/glob match across server-name variants (confirmed against the platform, not inferred). So the first time a repo connects a Jira MCP server under a name not already known here, two places need the new name added — both enumerate exact tool names, not just the server prefix:

1. **This file** — add the new `mcp__<name>__*` family to the detection list above.
2. **Every agent file that touches Jira** (`agents/intake.md`, `agents/pr-reviewer.md`, `agents/surveyor.md`, `agents/verifier.md`, `agents/publisher.md`, `agents/scribe.md`) — add `mcp__<name>__<tool>` for each Jira tool suffix that agent already lists for `mcp__atlassian-tractionlayer__*` (same suffixes, new prefix — the underlying `mcp-atlassian` server exposes identical tool names regardless of what it's registered as).

Known variants so far: `atlassian` (generic/Anthropic-hosted), `atlassian-tractionlayer` (Traction Layer's `mcp-atlassian` instance), `atlassian-idvibes` (id-vibes' `mcp-atlassian` instance), `plugin_traction-atlassian_atlassian` (the `traction-atlassian` plugin's bundled server).

A repo can also have a real ticket *readable* (a GitHub issue, e.g.) with no Jira/Linear behind it. That's orthogonal to `tracker` — see **Reads vs. writes** below; a GitHub issue is a legitimate read source regardless of what `tracker` resolves to.

## Reads vs. writes, and write-mode

Every op below is either a **read** (`get_issue`, `search`, `get_current_user`) or a **write** (`add_comment`, `transition_status`, `assign`, `add_to_cycle`, `create_issue`, `update_field`, `create_link`). This split is what `--incognito` acts on:

- **`writeMode: normal`** (default when a tracker is configured and `--incognito` wasn't passed) — reads and writes both go to the resolved tracker.
- **`writeMode: incognito`** — reads still happen normally (tracker, or a GitHub issue, or whatever's available — incognito is about not *polluting* someone else's tracker, not about refusing to read it). Every write is redirected to the local provenance file instead (see **Local provenance file** below). Resolved as: `--incognito` flag on the invoking command → incognito; else `tracker: none` → incognito by default (nothing to write to anyway); else `normal`.

Commands that dispatch `scribe` or write to a ticket pass the resolved `writeMode` down explicitly — never re-derive it mid-run.

## Op table

| Op | Jira (any registration) | Linear | Notes |
|---|---|---|---|
| `get_issue(key)` | `jira_get_issue` / `getJiraIssue` | `get_issue` | Summary, description, AC (Jira: description or a custom field; Linear: description), status, comments, linked issues. |
| `search(query)` | `jira_search` / `searchJiraIssuesUsingJql` (JQL) | `list_issues` (filter params — no JQL equivalent; filter by team/state/query as needed) | Used for legacy-key resolution and discovered-work "does a ticket already cover this" checks. |
| `get_current_user()` | `jira_get_user_profile` / `atlassianUserInfo` | `get_user` (self) / `list_users` filtered to the session identity | Used only by the assignment-check step. If the tracker has no clean "who am I" call, ask once rather than guess. |
| `add_comment(key, text)` | `jira_add_comment` / `addCommentToJiraIssue` | `save_comment` (new comment, no id) | The provenance-posting op `scribe` uses. |
| `transition_status(key, target)` | `jira_transition_issue` / `jira_get_transitions` then transition; `editJiraIssue`/`jira_update_issue` for the status field | `list_issue_statuses` (resolve the target state's id) then `save_issue` (set `state`) | Linear has no separate "transition" call — it's a field update once you have the state id. |
| `assign(key, user)` | `jira_assign_issue` | `save_issue` (`assignee` field) | |
| `add_to_cycle(key)` | `jira_add_issues_to_sprint` | `save_issue` (`cycle` field) | Jira's "sprint" and Linear's "cycle" are the same concept under different names — always say "the active sprint/cycle" in developer-facing text, never assume the Jira term. |
| `create_issue(fields)` | `jira_create_issue` / `createJiraIssue` | `save_issue` (no id → creates) | Used by discovered-work triage and `product-design-review`'s publisher. |
| `update_field(key, field, value)` | `jira_update_issue` / `editJiraIssue` | `save_issue` (partial fields) | Includes the "Design Note" pointer field Jira repos may have configured — Linear has no custom-field equivalent; use a comment (`add_comment`) carrying the note's path instead. |
| `create_link(key, related_key, type)` | `jira_create_issue_link` / `createIssueLink` | **No direct equivalent found among the registered Linear tools.** Fall back to `add_comment(key, "Related: <related_key>")` — Linear auto-links a mentioned issue ID in comment/description text, so this still produces a real link in the UI. | Note the fallback explicitly in any output that reports this op — don't silently pretend it's the same as a first-class link. |

Exact tool schemas aren't fixed here — resolve the live tool via the session's available tools at call time (`ToolSearch` if needed) rather than assuming a parameter shape; the table above is which tool family and which concept, not a frozen signature.

## `tracker: none` / manual fallback

Generalizes the fallback `plan-the-design.md` already used for a missing Jira MCP to every command: **never hard-stop** a read because no tracker is configured.

- **Reading**: ask the developer to paste the task description / acceptance criteria directly (or point at the plan already discussed in this chat), and record it verbatim in the run's state (`story-state.json`'s local success-criteria field, or the context pack). Wait for their answer before continuing — don't guess at AC.
- **Writing**: there's nothing to write to — this is `writeMode: incognito` by definition (see above), so writes go to the local provenance file, same as an explicit `--incognito` run on a repo that *does* have a tracker.
- **Legacy-key / "does this already exist" resolution**: skip silently — there's no tracker to search.

## Local provenance file

`docs/stories/<key>/provenance.md` — created the first time any write is redirected there. Append-only, one entry per would-be write, same structured shape `scribe` posts to a real tracker (`PLAN_APPROVED`, `BATCH_COMPLETE`, `ESCALATION`, `REVIEW_NOTES`, `COMPLETION_RECORD` — timestamped, human-readable). Lives under `docs/stories/<key>/`, which is already untracked/gitignored convention (`story-run.md` Step 3 ensures `docs/stories/.gitignore` contains `*`) — confirm that's actually in place before relying on it; this is exactly what keeps your own working notes out of a diff you push to a repo you don't own.

## Key-format note

Jira and Linear identifiers are both `TEAM-123`-shaped, so branch names (`feat/<key-lower>-slug`), commit subjects (`<KEY>: ...`), and PR titles need no tracker-specific handling — the existing `<KEY>` templates work unchanged for either. What *is* tracker-specific is the "legacy ID → live key" resolution some commands do (a ticket renumbered/moved) — that's a `search()` call against whichever tracker is resolved, generically; there's no special-case logic beyond calling the right op.

A **local key** (no tracker at all — see `story-run.md`'s no-ticket mode) is just a slug with no lookup ever attempted against it. Treat it as opaque and never try to resolve it via `search()`.
