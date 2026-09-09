---
name: model-effort
description: Resolves which model tier each subagent dispatches at (very-low/low/medium/high/extra-high), per repo config or a per-run override. Every command that dispatches a subagent via the Task tool points here instead of relying on the agent file's own static frontmatter model.
---

# Skill: model-effort

Every agent file's frontmatter `model:` field is its **High-tier default** — the plugin's original, unmodified tiering. This skill lets that be stepped down (cheaper, faster, lower-stakes runs) or up (maximum quality, cost no object) per repo, or per run, without touching the agent files themselves.

## Resolution

1. **`--effort <tier>` on the invoking command**, if passed — wins outright for this run.
2. **Else `.sdlc/config.json`'s `effort` field** (`"very-low"|"low"|"medium"|"high"|"extra-high"`).
3. **Else `"high"`** — the plugin's original behavior, unchanged. This is the default for any repo that hasn't set `effort` at all, so every existing config keeps working with zero migration.

Resolved once per run, recorded in `story-state.json`'s `effort` field, and read back (not re-resolved) on `--resume` — a repo's config could change between sessions, but a run stays consistent with what it started as, same as `write_mode`/`branch_model`. Passing `--effort` again at resume is harmless (it just reasserts the same value unless you deliberately want to change it, which is allowed — unlike `write_mode`, there's no correctness reason to forbid changing a run's effort tier mid-flight).

## Using it

Every Task dispatch, for every agent, passes an explicit `model` argument looked up from the table below for the resolved tier — this **overrides** the agent file's own frontmatter default, it doesn't edit it. A command that dispatches `coder` under `effort: medium` passes `model: opus` on that specific Task call; the same command under `effort: low` passes `model: sonnet` instead. The agent file itself never changes.

## The table

Organized by each agent's High-tier (frontmatter) default — the stable reference point.

| Agent | High (default) | Very Low | Low | Medium | Extra High |
|---|---|---|---|---|---|
| `coder` | opus | sonnet | sonnet | **opus** | **fable** |
| `architect` | opus | sonnet | sonnet | **opus** | **fable** |
| `designer` | opus | sonnet | sonnet | sonnet | opus |
| `panelist` | opus | sonnet | sonnet | sonnet | opus |
| `verifier` | opus | sonnet | sonnet | sonnet | opus |
| `moderator` | opus | sonnet | sonnet | sonnet | opus |
| `cartographer` | opus | sonnet | sonnet | sonnet | opus |
| `flow-tracer` | opus | sonnet | sonnet | sonnet | opus |
| `integrator` | opus | sonnet | sonnet | sonnet | opus |
| `reviewer` | sonnet | haiku | sonnet | sonnet | **opus** |
| `planner` | sonnet | haiku | sonnet | sonnet | **opus** |
| `intake` | sonnet | haiku | sonnet | sonnet | sonnet |
| `surveyor` | sonnet | haiku | sonnet | sonnet | sonnet |
| `validator` | haiku | haiku | haiku | haiku | haiku |
| `publisher` | haiku | haiku | haiku | haiku | haiku |

Batch/final-review verdicts and provenance posting are the orchestrating session's own work (see `story-run.md` 5d and `skills/tracker-adapter/SKILL.md` → Provenance records) — no dispatch, so no row here.

**The rule in words**, for anyone extending this table later (a new agent, a new tier):

- **Very Low** — a uniform one-tier cascade: opus→sonnet, sonnet→haiku, haiku stays. No exceptions.
- **Low** — opus→sonnet only. Sonnet and haiku untouched.
- **Medium** — opus→sonnet, **except `coder` and `architect`**, which stay opus — they're the two roles every agent file's own rationale singles out as highest-risk (the actual code generation, and the adversarial gate that must out-judge both the plan and the design). Sonnet and haiku untouched.
- **High** — the shipped defaults. No change from the agent files' own frontmatter.
- **Extra High** — `coder`/`architect` step up to fable (the two highest-stakes roles get the best model available). `reviewer` and `planner` step up from sonnet to opus — the two sonnet roles where a stronger model most changes the actual outcome (the thing that actually catches bugs in a diff, and decomposition quality that cascades into everything downstream) rather than just thoroughness/fidelity work. `intake`, `surveyor` hold at sonnet even here — their jobs lean on completeness and accurate extraction more than judgment calls a bigger model changes.
- **`validator`, `publisher` never move, at any tier.** They're mechanical — run commands and classify pass/fail, execute an already-approved manifest. There's no judgment surface for a bigger model to improve.

## Which commands this applies to

Any command that dispatches a subagent via the Task tool: `story-run`, `design-run` (also reached inline by `story-run`'s DESIGN phase), `review-run`, `review-fix` (and the `--bypass` tail's inline `review-fix` procedure), `product-design-review`. Each should accept `--effort <tier>` alongside its other flags, resolve per the order above at its own Step 0 (next to tracker/write-mode resolution), and record `effort` in whatever state file it maintains.

Commands with no subagent dispatch (`init`, `commit`, `adr`, `build-check`, `story-pr`, `story-check`, `close-story`, `sprint-pr`, `show-stats`) have nothing to resolve — this skill doesn't apply to them.

