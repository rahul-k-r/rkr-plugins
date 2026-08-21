---
description: "Show the sdlc catalog: every command with purpose and usage, the story-run agents, the push gate hook, and setup requirements."
argument-hint: "[name-or-keyword | setup | agents | help]"
---

# /sdlc:help

List this plugin's commands, agents, and machinery with their purpose and usage, so nobody has to memorize them. Read-only: it prints the catalog and never runs another command.

Arguments arrive as `$ARGUMENTS`:

- **No argument** — print the full grouped catalog below.
- **A command name** (e.g. `story-pr`) — print just that entry, expanded: purpose, usage, flags, and when to reach for it (read its file for the detail).
- **A keyword** (e.g. `pr`, `tracker`, `design`) — print the entries whose name or purpose matches.
- **`setup`** — print only the Setup requirements section.
- **`agents`** — print only the story-run agent roster.
- **`help`** — print only these argument forms; don't render the catalog.

## Steps

1. If the argument is `setup`, `agents`, or `help`, print only that section and stop.
2. Emit the catalog below, filtered by the argument if one was given.
3. **Stay current:** glob this plugin's `commands/*.md` and `agents/*.md`. Any file not in the catalog below — read its H1 and opening paragraph and append it under "Other" so new commands are never hidden; omit catalogued entries whose file is gone. The files are the source of truth.
4. End with the offer line; render the Modes & flags table only if asked (or when a single command was requested).

## Catalog

**Plain language by default:** the commands that explain, deliberate, or gate — `story-run`, `design-run`, `review-run`, `review-fix`, `plan-the-design`, `design-review`, `story-start`, `story-pr`, `story-check`, `sprint-pr`, `close-story` — accept `--technical`. Without it, their chat-facing explanations follow the plain-language standard (`skills/plain-language/STANDARD.md`) so less technical users can drive the workflow; the flag keeps the engineer-level voice. Artifacts (commits, PRs, tracker comments, design notes) are identical in both modes. The mechanical commands (`adr`, `build-check`, `commit`, `help`, `init`, `show-stats`) don't take the flag — standalone they keep their normal voice, and inside a run they inherit the run's mode.

### Design — decide before you build

| Command | Use it to | Usage |
|---------|-----------|-------|
| **/sdlc:init** | Bootstrap a repo for this workflow: `docs/design-notes/`, `docs/adr/`, template, process pointer, and `.sdlc/config.json` (tracker + branch model). Idempotent. | `/sdlc:init` |
| **/sdlc:plan-the-design** | Deliberate a story's design interactively (the developer reasons, the note records) and write `docs/design-notes/<KEY>.md`. | `/sdlc:plan-the-design <KEY>` |
| **/sdlc:design-review** | Critique and deepen an existing design note against the Q1–Q7 protocol — reviews, never modifies. | `/sdlc:design-review <KEY>` |
| **/sdlc:adr** | Scaffold an Architecture Decision Record when a decision crosses the ADR threshold (smaller locked choices → `DECISIONS.md`). | `/sdlc:adr [title]` |
| **/sdlc:design-run** | Design a story autonomously: designer frames the issues, a three-lens expert panel deliberates the high-stakes ones, architect adversarially reviews, one human gate on the finished note. Interactive `plan-the-design` notes always win. | `/sdlc:design-run <KEY>` |

### Story lifecycle — pick up, build, ship, close (roughly in order)

| Command | Use it to | Usage |
|---------|-----------|-------|
| **/sdlc:story-start** | Pick up a story: design-note gate, full AC read, branch cut from the sprint branch (or `main`, under `branchModel: direct`), issue → In Progress. | `/sdlc:story-start <KEY>` |
| **/sdlc:commit** | Create atomic, convention-following commits. Local only — never pushes. | `/sdlc:commit [KEY] [message]` |
| **/sdlc:build-check** | Run the repo's full local quality gate with real PASS/FAIL per step. | `/sdlc:build-check` |
| **/sdlc:story-pr** | Push the branch and open the story PR against the base branch — the step that triggers CI. | `/sdlc:story-pr [KEY] [--review] [--fix]` |
| **/sdlc:story-check** | Verify a story against the Definition of Done — PASS/GAP checklist + verdict. Auto-detects reviewer mode on a teammate's PR. | `/sdlc:story-check [KEY]` |
| **/sdlc:close-story** | Close a verified story: confirm merged + CI green, post the completion record, transition to Done, report unblocked tickets. | `/sdlc:close-story <KEY>` |

### Autonomous — multi-agent runs

| Command | Use it to | Usage |
|---------|-----------|-------|
| **/sdlc:story-run** | Run the whole story autonomously: design (via the design-run procedure, only if no note exists), setup with assignment guard, plan, batch-by-batch implement/review/validate, story-level final review, discovered-work triage, push + PR — escalating to you only where judgment is genuinely yours. Pausable at any point (checkpoints resume in any chat). Stops at the open PR by default; with `--bypass`, continues through auto-review (auto-fixing mechanically fixable findings via `review-fix`), merge, and close on a clean run. With `--incognito` (or whenever no tracker is configured), tracker writes redirect to a local provenance file and the run stops before pushing — you push and open the PR yourself when ready; incompatible with `--bypass`. | `/sdlc:story-run <KEY> [flags]` |
| **/sdlc:review-run** | Review many PRs in parallel (DoD + correctness + design conformance per PR, then a cross-ticket integration pass), or run the sprint-close gate (`branchModel: sprint` only — under `branchModel: direct` there's no sprint boundary, and this mode reports not applicable): verify every story, audit the aggregate diff, render SPRINT_READY/HOLD, optionally open the sprint→main PR. Never merges, never self-approves — read-only against code; `--fix` chains into `review-fix` for your own PRs. | `/sdlc:review-run <PR#...> [--fix] \| --sprint [id]` |
| **/sdlc:review-fix** | Work through review findings on a PR you authored — from a review-run pass or the reviews/threads already on the PR (a teammate's included): triage fixable vs. needs-your-judgment, fix, push, re-verify with a fresh review, escalate the rest. The write side of the review subsystem. | `/sdlc:review-fix <PR#> [--budget N]` |
| **/sdlc:product-design-review** | Audit the whole product's design top-down: traceability matrix over spec+TDD+all tickets, every end-to-end flow swept for gaps, lens panels on the significant issues, adversarial verification — then persona-partitioned human review sessions (PM/ENG/UX/CROSS) and one bulk-gated publish back to the tracker/docs. Archetype-generic (engine / agentic-app / platform). | `/sdlc:product-design-review [--depth ...] [--session <partition>] [--publish]` |

### Reporting

| Command | Use it to | Usage |
|---------|-----------|-------|
| **/sdlc:show-stats** | Render the fixed usage-stats report (per-agent model/timing/tokens, phase durations) for a `story-run`/`design-run`/`review-run` — on demand, mid-run or after, whether or not `--show-stats` was passed. Read-only aside from publishing the report. | `/sdlc:show-stats [KEY \| run-id]` |

### Sprint boundary — the reviewed merge to main (`branchModel: sprint` only)

Not applicable under `branchModel: direct` — story PRs merge straight to `main`, self-approved, with no sprint boundary to close.

| Command | Use it to | Usage |
|---------|-----------|-------|
| **/sdlc:sprint-pr** | Open the end-of-week sprint→main PR — the approval-required, teammate-reviewed merge (no self-approval). | `/sdlc:sprint-pr [sprint-id]` |

### Meta

| Command | Use it to | Usage |
|---------|-----------|-------|
| **/sdlc:help** | This command — the catalog, agents, hook, and setup. | `/sdlc:help [name \| setup \| agents]` |

## Setup requirements

- **Tracker: auto-detected or configured per repo.** `/sdlc:init` resolves and persists `.sdlc/config.json` — `tracker: jira|linear|none` — either auto-detected from which MCP tool family is registered this session, or asked outright when detection is ambiguous or absent. **`none` is a real, fully-supported mode, not a degraded one:** every command still works, reads fall back to whatever's pasted or discussed in chat, and writes redirect to a local `docs/stories/<key>/provenance.md` file (the same place `--incognito` redirects writes to on a repo that does have a tracker). The full resolution logic, the tracker-agnostic op table, and the write-mode split live in `skills/tracker-adapter/SKILL.md` — every command that touches a ticket goes through it rather than hard-coding a tracker's tool names.
  - **`tracker: jira`** — register **one** of: this marketplace's `traction-atlassian` plugin (bundles sooperset/mcp-atlassian; tools surface plugin-prefixed as `mcp__plugin_traction-atlassian_atlassian__*`), the official server as `atlassian` (`claude mcp add --transport sse --scope user atlassian https://mcp.atlassian.com/v1/sse`), or the self-hosted server as `atlassian-tractionlayer`. The agents' allowlists support all three; user scope makes it per-machine.
  - **`tracker: linear`** — register a Linear MCP server in this session.
- **Branch model: also configured per repo.** `.sdlc/config.json`'s `branchModel: sprint|direct` — `sprint` is the original team workflow (sprint branches, teammate-approved sprint→main merge); `direct` merges story PRs straight to `main`, self-approved, with no sprint boundary. `/sdlc:init` asks and persists this alongside the tracker choice.
- **Node.js on PATH** — powers the push/PR gate hook.
- **`gh` authenticated** — PR commands stop and ask for `gh auth login` otherwise.
- **Target repo's `CLAUDE.md`** should document: tracker project key (Jira project key, or Linear team prefix — read directly off issue keys, nothing to ask separately), branch/commit conventions, verify (build/test/lint) commands, required CI check names, and any tracker custom-field IDs. Commands fall back to stack defaults and ask when these are missing.
- **`/sdlc:init`** once per repo scaffolds the design-note/ADR directories and resolves `tracker`/`branchModel` into `.sdlc/config.json`.

## Hooks (always on, workflow repos only)

The plugin ships four Node hooks, active only in repos using this workflow (detected by `docs/stories/` or `docs/design-notes/` at the repo root — other repos are untouched; the permission-mode notice is scoped by command instead — it only reacts to this plugin's run commands):

- **`gate-git.js`** (PreToolUse on Bash) — blocks `git push`/`gh pr create` on a story-run-managed branch until its final review passed (`READY_FOR_PR` or later; `AUTO_FIX`, the `--bypass` tail's review-fix loop, also pushes legally); blocks `git commit` directly on `main`/`master`/`sprint/*` (merge-resolution commits during an in-progress merge are allowed — reconciling `main` into a sprint branch is legitimate); blocks force-pushes to those protected branches.
- **`validate-state.js`** (PostToolUse on Edit/Write) — validates any written `story-state.json` (parseable, legal phase, key fields) so audit-trail corruption is caught the moment it happens.
- **`session-start.js`** (SessionStart) — announces paused or in-flight story-runs in the repo, with the `--resume` command to continue them.
- **`permission-mode-notice.js`** (UserPromptSubmit) — when `story-run`/`design-run`/`review-run` is invoked without an auto-approving permission mode, tells the user the run will pause for approval on every edit/command and how to switch (Shift+Tab to `auto` mode, or `--permission-mode auto`; any of `auto`/`acceptEdits`/`dontAsk`/`bypassPermissions` silences it). Purely informational; never blocks.

If a gate denies unexpectedly, the story's state regressed — investigate via `docs/stories/<KEY>/story-state.json`; don't work around it. Hooks are plain scripts run by the harness (no model, no tokens); only their output text enters the session.

## story-run agents (printed on `agents`)

| Agent | Model | Role |
|-------|-------|------|
| `designer` | opus | Frames, deliberates, and drafts the design note autonomously when none exists (interactive notes always win). |
| `architect` | opus | Principal-architect adversarial review of the design issues, note, and implementation plan. |
| `panelist` | opus | One lens on the design panel (reliability/failure, security/data-boundary, simplicity/operability) — argues high-stakes issues with evidence and red lines. |
| `pr-reviewer` | sonnet | (review-run) Reviews one story PR end-to-end from the diff — DoD, correctness, design conformance — without checking it out. |
| `integrator` | opus | (review-run) Audits the seams between PRs or a sprint's aggregate diff: contract drift, unmet obligations, merge order, integration gaps. |
| `intake` | sonnet | Assembles the read-only context pack; blocks on broken decision/ADR references. |
| `planner` | sonnet | Decomposes the story into batched, testable subtasks. |
| `coder` | opus | Implements one batch; atomic commits; never pushes; never expands scope. |
| `reviewer` | sonnet | Reviews diffs blind to the coder's reasoning; design conformance first. |
| `validator` | haiku | Runs the verify commands mechanically; fixes nothing. |
| `assessor` | sonnet | Verdicts each batch: PROCEED / RETRY / REPLAN / ESCALATE. |
| `surveyor` | sonnet | (product-design-review) Digests one epic-slice of the product corpus; emits traceability rows. |
| `cartographer` | opus | (product-design-review) Merges the traceability matrix; derives the ranked flow inventory; flags orphans mechanically. |
| `flow-tracer` | opus | (product-design-review) Walks one end-to-end flow with every error/corner variant; emits evidenced gap candidates. |
| `moderator` | opus | (product-design-review) Clusters findings, runs the lens panels and consensus rules, ranks severity, assembles the partitioned Decision Docket. |
| `verifier` | opus | (product-design-review) Adversarially refutes findings against the real docs/tickets before humans see them. |
| `publisher` | haiku | (product-design-review) Executes the human-approved publish manifest in the tracker — idempotent, mechanical, nothing beyond the manifest. |
| `scribe` | haiku | Posts batch progress, escalations, and review notes to the tracker (or the local provenance file, under incognito). |

After the catalog, end with the offer line (don't pre-expand it):

> Several commands have extra **modes & flags** (e.g. `/sdlc:story-pr --review`, story-run's gating flags, story-check's reviewer mode). Ask, or run `/sdlc:help <name>` for one command.

Only if asked (or a single command was requested) render:

### Modes & flags *(on request)*

| Command | Mode / flag | What it does |
|---------|-------------|--------------|
| **runs + plan/review/PR/lifecycle commands** | `--technical` | Keep chat output in the engineer-level voice (default: plain-language standard, `skills/plain-language/STANDARD.md`); durable artifacts are identical either way. The runs persist the mode in their state file so `--resume` keeps it, and it cascades into every procedure a run executes inline (design-run phase, the whole `--bypass` tail, `--close`'s sprint-pr). |
| **story-run** | `--base <branch>` | Sprint/base branch to cut from and PR into; auto-detected, asked if ambiguous, under `branchModel: sprint`. Under `branchModel: direct`, defaults to `main` — no detection needed. |
| **story-run** | `--max-retries N` / `--max-replans N` | Budgets before automatic escalation (default 4 / 2 — up to 5 attempts per batch). |
| **story-run** | `--incognito` | Force local-only write mode regardless of the configured tracker: reads still happen normally, but every write (comments, status transitions, discovered-work tickets) redirects to `docs/stories/<KEY>/provenance.md`, and the run stops once its final review passes rather than auto-pushing — pushing/opening the PR becomes your explicit, manual action. Also the automatic behavior whenever `tracker: none` resolves, no flag needed. **Incompatible with `--bypass`.** |
| **story-run** | `--bypass` | After the PR opens, keep going: auto-review it, auto-fix a not-clean review where findings are mechanically fixable (`review-fix` procedure, budget 2 — design-level findings still stop the run), and on a clean pass, wait for CI, merge (sprint branches under `branchModel: sprint` — never self-approves onto `main` there; under `branchModel: direct`, `main` is the expected base and self-merge is allowed), and auto-close — a full, uninterrupted lifecycle. Existing escalation points (locked decisions, budget exhaustion, discovered-work triage) are untouched. Rejected outright together with `--incognito`. |
| **story-run / design-run** | `--gate <phase,...>` / `--no-gate <phase,...>` | Toggle human gates against defaults: `design` on, `plan` off (architect signs off), `replans` off. Replaces the retired `--approve-plan`/`--approve-replans`. |
| **story-run / design-run** | `--resume` | Continue a paused/dead run from its state file + checkpoint, in any chat. |
| **story-run / design-run / review-run** | `--show-stats` | Auto-publish the fixed-format usage report as a claude.ai Artifact when the run ends. Collection (and the local JSON snapshot under the run's own `docs/stories/<KEY>/_stats/`, never committed to git) happens regardless of this flag — it only gates auto-publishing; `/sdlc:show-stats` renders the same report on demand, flag or no flag. |
| **review-run** | `--sprint [id]` | Sprint-close gate mode instead of PR-batch mode. `branchModel: sprint` only — reports not applicable under `branchModel: direct`. |
| **review-run** | `--depth spot\|full` | Sprint-mode per-story verification depth (default spot). |
| **review-run** | `--fix` | Mode A only (rejected with `--sprint`): after the batch report, run the `review-fix` procedure on each not-clean PR you authored — teammates' PRs and cross-ticket findings stay report-only. |
| **review-run** | `--post` | Post GitHub reviews without the per-batch confirmation. |
| **review-run** | `--close` | On SPRINT_READY, open the sprint→main PR (never merges). `branchModel: sprint` only. |
| **review-fix** | `--budget N` | Fix-loop attempts before escalating (default 2). |
| **story-pr** | `--review` / `--fix` | Pre-PR self-review of the diff; `--fix` applies high-confidence findings (needs `--review`). |
| **story-check** | author / reviewer *(auto)* | Your PR (or none) → read-only DoD check; a teammate's → DoD + correctness pass + offer to post a GitHub review. |
| **story-check** | reviewer posting: summary / inline / both | On confirm, the review posts as one review-level body (default), line-anchored inline comments via the review-comments API, or both. |
| **story-pr / story-check / close-story** | base → `main` | Under `branchModel: sprint`, merging without a sprint branch still triggers branch protection: teammate approval required at story level. Under `branchModel: direct`, `main` is the expected base and self-approval is standard — no second human required. |
| **sprint-pr** | `[sprint-id]` | Target a specific sprint branch; omitted → highest `sprint/*` on origin. `branchModel: sprint` repos only. |
| **commit** | `[KEY] [message]` | Key omitted → derived from the branch name; message omitted → inferred from the staged diff. |
| **adr** | `[title]` | Scaffold with the given title; omitted → asks what the decision is. |
| **help** | `[name \| keyword \| setup \| agents \| help]` | Filter to one command, matching entries, or just the setup/agent sections. |

## Notes

- Lists only this plugin's commands. Claude Code built-ins (`/help`, `/review`, `/code-review`) and repo-local or personal commands are out of scope.
- Read-only and side-effect-free: it describes commands, it does not invoke them.
