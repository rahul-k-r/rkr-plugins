# Design-Review Process

This document describes the story lifecycle and where each SDLC skill fits
within it. It is **project-neutral** — the same process applies across every
repo you use this plugin in, whatever tracker (or none) that repo uses.

---

## Setup (one-time, per machine)

```bash
# In Claude Code — add the marketplace (once per machine):
/plugin marketplace add rkr-claude-plugins

# Install the plugin (user scope, so it's available in every repo):
/plugin install sdlc@rkr-claude-plugins
```

**Per new repo:** run `/sdlc:init` to bootstrap `docs/design-notes/`,
`docs/adr/`, the design-note template, and `.sdlc/config.json` (tracker +
branch model for that repo).

All commands are invoked as `/sdlc:<command>` (e.g.
`/sdlc:plan-the-design AGL-42`, or `/sdlc:plan-the-design` with no key in a
repo that has no tracker configured).

---

## Command Reference

| Command | When to run | Argument | Produces / gates |
|---------|-------------|----------|------------------|
| `plan-the-design` | Before implementation — the design gate | `<KEY>` (tracker key, local slug, or omitted) | Produces `docs/design-notes/<KEY>.md`; posts cross-story obligations to the tracker (or prints them for manual tracking when none is configured) |
| `design-review` | After a design note exists — second-opinion critique | `<KEY>` | Reports gaps, challenges, suggestions (does NOT create or modify the note) |
| `story-start` | After the design note resolves | `<KEY>` | Gate: refuses unless note exists and resolves; sets up feature branch |
| `close-story` | After PR is merged | `<KEY>` | Verifies AC coverage, posts completion record, transitions to Done (or appends the local provenance file, under incognito / no tracker) |
| `init` | Once per new repo | _(none)_ | Bootstraps `docs/design-notes/`, `docs/adr/`, template files, `.sdlc/config.json` |

---

## Lifecycle Overview

```
plan-the-design ──► design-review ──► story-start ──► implement ──► close-story
       │              (optional)            │                             │
       │                  │                 │                       verifies:
  produces:          critiques:         gate: refuses              merged PR,
  docs/design-notes/ the existing       unless design             completion
     <KEY>.md        note; reports      note resolves             record, Done
  + posts cross-     gaps/challenges
    story obligations
  + records the
    design note's
    location against
    the tracker issue
    (where supported)
```

### 1. Plan the Design (`plan-the-design`)

The design gate. Conducts the design review as an **interactive dialogue**
with the developer: reads the ticket (or, with no tracker, the plan already
discussed) and the codebase, surfaces scope and key design issues, walks
each issue through alternatives and stress lenses, captures the developer's
reasoning, and — only after full deliberation — produces the design note.
The output is:

- A design note written to `docs/design-notes/<KEY>.md`
- Cross-story obligations posted as traceability comments on target tickets
  (or printed for you to track manually, when no tracker is configured)
- A graduation backlog (decisions that need ADR or DECISIONS.md promotion)

The design note must resolve (all obligations posted, all key decisions
locked or explicitly deferred) before the story can start implementation.

### 2. Design Review (`design-review`)

An autonomous **critique** of an existing design note. Run this as a
second-opinion pass — e.g. when you revisit a note you wrote a while back,
or when a note needs freshening after the codebase has evolved. It does NOT
create or modify the note; it reports:

- **Gaps**: sections that are stub, missing, or superficial.
- **Challenges**: specific decisions or invariants to probe deeper.
- **Suggestions**: concrete improvements with rationale.

If the note does not exist, the command refuses and suggests running
`plan-the-design` instead.

### 3. Start Story (`story-start`)

Gate: refuses to proceed unless the design note for this story exists and
resolves (i.e., no unposted obligations, no unaddressed key issues). Once
the gate passes, the story transitions to "In Progress" (skipped for a
local key/no tracker) and implementation begins on a feature branch.

### 4. Implement

Standard development: write code, write tests, iterate. The design note
is a living document — if implementation reveals that a decision in §3 was
wrong or incomplete, update the note. Record material deviations in §7
(Implementation Findings) at PR time.

### 5. Close Story (`close-story`)

Verifies:

- The PR is merged (or all commits are on the target branch)
- Every acceptance-criteria line is met (or deferred to a linked follow-up)
- A completion record is posted — to the tracker ticket in normal write-mode,
  or appended to `docs/stories/<KEY>/provenance.md` under incognito / no
  tracker:
  - AC-to-evidence mapping
  - CI run link
  - Git trail (branch, PR, merge commit)
- The story transitions to Done (skipped where there's no tracker to
  transition)

---

## Design Note Lifecycle

The design note (`docs/design-notes/<KEY>.md`) is **living**:

1. **Created** during `plan-the-design` — captures scope, reconciliation,
   key design issues, decisions, obligations, and verification criteria.
2. **Updated** during implementation — if decisions change or new findings
   emerge, the note is updated in the same branch as the code.
3. **Finalized** at PR time — §7 (Implementation Findings) is appended,
   noting any material deviations from the original design.
4. **Archived** after merge — the note remains in `docs/design-notes/` as
   a historical record. It is not deleted.

---

## Principles

- **Probing, not form-filling.** The design review asks hard questions. A
  trivially simple story gets a short note with many "N/A" answers — that
  is correct. A complex story gets deep deliberation in §3. The template
  scales to the complexity of the work.

- **Gate, not ceremony.** The design gate exists to catch missing scope,
  unexamined failure modes, and invisible cross-story obligations before
  code is written. It is not a heavyweight approval process.

- **Living, not frozen.** The design note tracks ground truth. If the code
  changes, the note changes. The exception is frozen contracts (marked in
  the template) — those change only via versioned migration.

- **Project-neutral.** This process applies identically across every repo
  you use it in. Project-specific conventions (which tracker, branch model,
  branch naming) are configured per-repo via `.sdlc/config.json`, not
  hard-coded into the process.
