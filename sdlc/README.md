# SDLC Plugin (`sdlc`)

> **Autonomous, verified, and tracker-agnostic software development lifecycle plugin for Claude Code and Google Antigravity.**

The `sdlc` plugin implements a disciplined, verify-before-done software development process for AI pair programmers. It automates design review, story planning, batch-by-batch test-driven coding, multi-perspective adversarial reviews, and PR creation — escalating to the human only where judgment genuinely requires it.

---

## Core Philosophy & Design

1. **Verify Before Done**:
   - Commits are atomic and local.
   - Pushes and PRs are hard-blocked by hooks until all batch tests pass and a final adversarial review approves.
2. **Tracker Agnostic**:
   - Works seamlessly with **Linear**, **Jira**, or **No Tracker** (`tracker: none`).
   - Supports `--incognito` mode for contributing to external repositories without polluting their issue tracker (redirects writes to a local `docs/stories/<KEY>/provenance.md` file).
3. **Branch Model Flexibility**:
   - **Direct Model**: Story branches (`feat/<key>-slug`) target `main` directly.
   - **Sprint Model**: Story branches target `sprint/<sprint-id>`, consolidated via `/sdlc:sprint-pr` at sprint close.
4. **Worktree Isolation**:
   - Stories can execute inside their own `git worktree`, allowing multiple stories to run in parallel without dirtying your main working tree.
5. **Dual-Harness Architecture**:
   - One unified codebase works identically in **Claude Code** and **Google Antigravity**.
   - Model effort is mapped automatically (`opus/sonnet/haiku` in Claude &harr; `pro/flash/flash_lite` in Antigravity).

---

## Installation & Updates

### Claude Code

```bash
# Add marketplace & install
claude plugin marketplace add rahul-k-r/rkr-claude-plugins
claude plugin install sdlc@rkr-claude-plugins
```

### Antigravity (AGY)

#### Cross-Platform (`npx` — Recommended)
```bash
# Install plugin & configure safety hooks
npx github:rahul-k-r/rkr-claude-plugins install

# Update to latest version
npx github:rahul-k-r/rkr-claude-plugins update

# Uninstall plugin & remove hooks
npx github:rahul-k-r/rkr-claude-plugins uninstall
```

#### OS Shell Scripts
- **Windows (PowerShell)**: `irm https://raw.githubusercontent.com/rahul-k-r/rkr-claude-plugins/main/install.ps1 | iex`
- **macOS / Linux (Bash)**: `curl -fsSL https://raw.githubusercontent.com/rahul-k-r/rkr-claude-plugins/main/install.sh | bash`

---

## Command Catalog

All commands are callable as `/sdlc:<command>`:

### 1. Story Lifecycle
- **`/sdlc:story-run [<KEY>] [flags]`**:
  Autonomous end-to-end execution: checks/creates design note, resolves worktree, generates context pack and plan, implements batch-by-batch with coder/reviewer/validator subagents, runs final review, and opens the PR.
  - Flags: `--bypass` (continue through auto-review, merge, and close), `--worktree <path>`, `--no-worktree`, `--effort <tier>`, `--plain`, `--show-stats`, `--resume`.
- **`/sdlc:story-start <KEY> [flags]`**:
  Gate check before manual implementation: verifies design note, fetches acceptance criteria, cuts the branch/worktree, and transitions the tracker to *In Progress*.
- **`/sdlc:story-pr [<KEY>] [flags]`**:
  Commits staged work, pushes the story branch, and opens the PR against the resolved base branch.
- **`/sdlc:story-check [<KEY>] [flags]`**:
  Verifies a story or PR against the Definition of Done (DoD) checklist with per-item PASS/GAP verdicts.
- **`/sdlc:close-story <KEY> [flags]`**:
  Post-merge completion: confirms merge and CI, posts completion record to tracker, transitions issue to *Done*, and reports unblocked dependency tickets.

### 2. Design & Architecture
- **`/sdlc:design-run [<KEY>] [flags]`**:
  Autonomous multi-expert design deliberation: frames candidate design issues, debates each through a multi-perspective lens panel, synthesizes decisions, drafts `docs/design-notes/<KEY>.md`, and adversarially reviews it.
- **`/sdlc:plan-the-design <KEY> [flags]`**:
  Interactive Q1–Q7 design dialogue between the agent and developer, scaffolding the design note and recording cross-story obligations.
- **`/sdlc:design-review <KEY> [flags]`**:
  Critiques an existing design note against the Q1–Q7 protocol without modifying it.
- **`/sdlc:adr [short-title]`**:
  Scaffolds a new Architecture Decision Record in `docs/adr/ADR-NNNN-title.md` when a choice crosses the ADR threshold.
- **`/sdlc:product-design-review [options]`**:
  Autonomous product-level design audit: builds product profile, sweeps user flows, debates architectural decisions across lenses, and publishes audit reports.

### 3. Review & Quality Gates
- **`/sdlc:review-run [<PRs-or-sprint>] [flags]`**:
  Autonomous multi-PR review subsystem: performs parallel story PR reviews with cross-ticket compatibility checks and sprint-close validation.
- **`/sdlc:review-fix [<PR-URL>] [flags]`**:
  Triages review comments on your PR into fixable vs. needs-judgment, fixes the fixable in batches, re-reviews, and pushes fixes.
- **`/sdlc:build-check [flags]`**:
  Runs the repository's full local quality gate (build, lint, typecheck, unit tests) and reports PASS/FAIL per step.
- **`/sdlc:commit [KEY] [message]`**:
  Creates convention-following, atomic git commits locally (never pushes).
- **`/sdlc:show-stats [<KEY>]`**:
  Renders model telemetry, duration, and token usage statistics from a story or review run into an interactive HTML report.

### 4. Setup & Management
- **`/sdlc:init`**:
  Bootstraps a repository for the `sdlc` workflow (creates `.sdlc/config.json`, documentation folders, templates). Idempotent.
- **`/sdlc:help [command-name]`**:
  Displays full documentation and usage for any command.
- **`/sdlc:install-hooks`**:
  *(Antigravity)* Installs the safety hooks into `~/.gemini/config/hooks.json`.

---

## Configuration (`.sdlc/config.json`)

Running `/sdlc:init` generates a `.sdlc/config.json` at your repository root:

```json
{
  "tracker": "linear",
  "trackerProjectKey": "AGL",
  "branchModel": "direct",
  "effort": "high",
  "localDocs": false,
  "releaseCommitPaths": [
    "package.json",
    "package-lock.json",
    "CHANGELOG.md"
  ]
}
```

- **`tracker`**: `"linear"` | `"jira"` | `"none"`
- **`branchModel`**: `"direct"` (feature &rarr; `main`) | `"sprint"` (feature &rarr; `sprint/*` &rarr; `main`)
- **`effort`**: `"low"` | `"medium"` | `"high"` | `"extra-high"`
- **`localDocs`**: `true` to keep design notes and ADRs local (uncommitted), `false` to commit them.
- **`worktreeSetup`**: Optional list of `{ "dir": "...", "command": "..." }` commands to bootstrap new git worktrees (e.g. `npm ci`).

---

## Safety Hooks

The plugin ships with two active guardrails:
1. **`gate-git.js`**:
   - Prevents accidental direct commits to protected branches (`main`, `master`, `sprint/*`).
   - Blocks force-pushes to shared branches.
   - Hard-blocks `git push` and `gh pr create` during automated story runs until all validation checks and final reviews pass (`phase: READY_FOR_PR`).
2. **`guard-agent-tools.js`**:
   - Restricts tracker-touching subagents (`intake`, `surveyor`, `verifier`, `publisher`) to strictly safe operations and allowed built-in inspection tools.

---

## Usage in Antigravity vs. Claude Code

| Platform | Invocation | How It Works |
|---|---|---|
| **Antigravity (AGY)** | `/sdlc:<command>` | Dispatched through native skills in `skills/<name>/SKILL.md` using `invoke_subagent`. |
| **Claude Code** | `/sdlc:<command>` | Dispatched through command definitions in `commands/<name>.md` using `Task`. |

Both platforms use the same flags, same agent personas, same state files (`docs/stories/<KEY>/story-state.json`), and same review gates.

