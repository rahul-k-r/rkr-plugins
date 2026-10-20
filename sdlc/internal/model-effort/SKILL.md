---
name: model-effort
description: Resolves which model, retry model, thinking effort, and advisor posture each subagent dispatches with (very-low/low/medium/high/extra-high), per repo config or a per-run override. Every command that dispatches a subagent via the Task tool points here instead of relying on the agent file's own static frontmatter model.
---

# Skill: model-effort

Every agent file's frontmatter `model:` field is its **High-tier default** — the plugin's original, unmodified tiering. This skill lets that be stepped down (cheaper, faster, lower-stakes runs) or up (maximum quality, cost no object) per repo, or per run, without touching the agent files themselves. A tier sets four things per dispatch: the **model**, the **retry model** (`coder` only — a cheaper first attempt that escalates on failure), the **thinking effort** (Claude Code's `low|medium|high|xhigh|max`), and the **advisor posture**.

> **Naming.** "Tier" is this plugin's `very-low … extra-high` setting (`--effort`, `.sdlc/config.json`'s `effort`). "Thinking effort" is Claude Code's own per-agent reasoning level. They are different axes; a tier chooses both.

## Resolution

1. **`--effort <tier>` on the invoking command**, if passed — wins outright for this run.
2. **Else `.sdlc/config.json`'s `effort` field** (`"very-low"|"low"|"medium"|"high"|"extra-high"`).
3. **Else `"high"`** — the plugin's original behavior, unchanged. This is the default for any repo that hasn't set `effort` at all, so every existing config keeps working with zero migration.

Resolved once per run, recorded in `story-state.json`'s `effort` field, and read back (not re-resolved) on `--resume` — a repo's config could change between sessions, but a run stays consistent with what it started as, same as `write_mode`/`branch_model`. Passing `--effort` again at resume is harmless (it just reasserts the same value unless you deliberately want to change it, which is allowed — unlike `write_mode`, there's no correctness reason to forbid changing a run's effort tier mid-flight).

## Using it

Every Task dispatch, for every agent, passes:

- an explicit **`model`** looked up from the *Models* table below for the resolved tier — this **overrides** the agent file's own frontmatter default, it doesn't edit it;
- the **`effort`** parameter from the *Thinking effort* table, **unless** the cell is `inherit` (then omit it and the session/agent default applies);
- the **advisor line** from the *Advisor* section, appended to the dispatch prompt, for the agents it lists.

**The retry ladder (`coder`).** The first attempt at a batch uses the table's `coder` model; every **retry** of that batch (RETRY verdict, 5g), every FINAL_REVIEW fix dispatch, and every `review-fix` coder dispatch uses the `coder (retry)` model and the retry thinking effort instead. A cheap first attempt costs one extra cycle when it fails; it never changes what the validator and reviewer accept.

Claude Code rules this relies on: the Agent tool's `effort` parameter overrides the agent's frontmatter `effort`, which overrides the session level, and `CLAUDE_CODE_EFFORT_LEVEL` (an environment variable) overrides all three — if it is set, thinking effort is flattened to that value and only the model axis tiers. A model that doesn't support a level runs at the highest supported level at or below it. The per-dispatch parameter needs Claude Code 2.1.292+ and applies to non-fork subagents only.

## Models

Organized by each agent's High-tier (frontmatter) default — the stable reference point. **High always equals the agent file's frontmatter `model`** (enforced by `test/model-effort.test.js`).

| Agent | Very Low | Low | Medium | High (default) | Extra High |
|---|---|---|---|---|---|
| `coder` | sonnet | sonnet | **sonnet** | opus | **fable** |
| `coder (retry)` | sonnet | **opus** | **opus** | opus | fable |
| `architect` | sonnet | sonnet | opus | opus | **fable** |
| `designer` | sonnet | sonnet | **opus** | opus | opus |
| `panelist` | sonnet | sonnet | sonnet | opus | opus |
| `verifier` | sonnet | sonnet | sonnet | opus | opus |
| `moderator` | sonnet | sonnet | sonnet | opus | opus |
| `cartographer` | sonnet | sonnet | sonnet | opus | opus |
| `flow-tracer` | sonnet | sonnet | sonnet | opus | opus |
| `integrator` | sonnet | sonnet | sonnet | opus | opus |
| `reviewer` | haiku | sonnet | sonnet | sonnet | **opus** |
| `planner` | haiku | sonnet | sonnet | sonnet | **opus** |
| `intake` | haiku | sonnet | sonnet | sonnet | sonnet |
| `surveyor` | haiku | sonnet | sonnet | sonnet | sonnet |
| `validator` | haiku | haiku | haiku | haiku | haiku |
| `publisher` | haiku | haiku | haiku | haiku | haiku |

(`coder (retry)` is not an agent — it is the model for retries of `coder`; its High cell is the same as `coder`'s.)

**The rule in words**, for anyone extending this table later (a new agent, a new tier):

- **Very Low** — a uniform one-tier cascade: opus→sonnet, sonnet→haiku, haiku stays. No exceptions; no retry escalation (nothing cheaper to start from).
- **Low** — opus→sonnet, with `coder` escalating to opus on retry. Sonnet and haiku untouched.
- **Medium** — "think hard up front, build cheap, escalate on failure": `designer` and `architect` run on opus (the design is the highest-leverage work and its review loops dominate run time), `coder` starts on sonnet and escalates to opus on retry. Other opus roles step down to sonnet. Sonnet and haiku untouched.
- **High** — the shipped defaults. No change from the agent files' own frontmatter.
- **Extra High** — `coder`/`architect` step up to fable. `reviewer` and `planner` step up from sonnet to opus — the two sonnet roles where a stronger model most changes the actual outcome. `intake`, `surveyor` hold at sonnet even here.
- **`validator`, `publisher` never move, at any tier** — mechanical, no judgment surface for a bigger model.

## Thinking effort

Claude Code's per-agent reasoning level, passed as the Agent tool's `effort` parameter. `inherit` = omit the parameter (the session/agent default applies — this is what keeps High byte-for-byte unchanged).

| Agent | Very Low | Low | Medium | High (default) | Extra High |
|---|---|---|---|---|---|
| `coder` | low | low | medium | inherit | xhigh |
| `coder (retry)` | medium | medium | high | inherit | xhigh |
| `architect` | medium | medium | high | inherit | xhigh |
| `designer` | medium | medium | high | inherit | xhigh |
| `planner`, `reviewer` | low | medium | medium | inherit | high |
| `panelist`, `verifier`, `moderator`, `cartographer`, `flow-tracer`, `integrator` | low | low | medium | inherit | high |
| `intake`, `surveyor` | low | low | low | inherit | inherit |
| `validator`, `publisher` | low | low | low | low | low |

`validator`/`publisher` also carry `effort: low` in their own frontmatter, so they are cheap even when dispatched by a command that doesn't consult this table.

## Advisor (optional, user-level)

Claude Code's [advisor tool](https://code.claude.com/docs/en/advisor) lets a cheaper executor consult a stronger model at decision points. It is **session-wide** (`/advisor <fable|opus|sonnet|off>`, the `advisorModel` setting, or `--advisor`); subagents inherit it subject to a pairing check against their own model, and a plugin cannot set it or scope it per agent. It needs the Anthropic API (not Bedrock/Vertex/Foundry) and feature-flag fetching, and is experimental. With it off, nothing below has any effect — the retry ladder is the fallback.

**Recommended `advisorModel` by tier** — set it yourself; the plugin only recommends:

| Very Low | Low | Medium | High | Extra High |
|---|---|---|---|---|
| off | opus | opus | off | off |

**Advisor line** the orchestrator appends to the dispatch prompt (the advisor decides when to call; this steers *which* moments, and caps the cost — each consult re-reads the whole transcript uncached at the advisor's rates):

| Agent | Tiers | Line |
|---|---|---|
| `coder` | Low, Medium | "If an advisor is available, consult it before committing to an approach for this batch, after a test fails twice, and before returning DONE — at most 3 times." |
| `architect` | Low | "If an advisor is available, consult it once before your verdict, on the weakest finding or the closest approval call." |
| `planner` | Low, Medium | "If an advisor is available, consult it once before finalizing the batch decomposition." |
| `reviewer` | Low, Medium | "If an advisor is available, consult it once before declaring a large diff clean." |

Never appended, and stated in the agent files for `validator` and `publisher`: **"Do not consult the advisor."** They inherit the session advisor like every subagent, and a mechanical agent must not spend Opus tokens on it. `designer`, `intake`, `surveyor`, `panelist` and the other opus roles get no advisor line (single-pass judgment or extraction — the docs' own poor fit).

## Which commands this applies to

Any command that dispatches a subagent via the Task tool: `story-run`, `design-run` (also reached inline by `story-run`'s DESIGN phase), `review-run`, `review-fix` (and the `--bypass` tail's inline `review-fix` procedure), `product-design-review`, and `batch-run`'s story subagents (which apply it for their own dispatches). Each should accept `--effort <tier>` alongside its other flags, resolve per the order above at its own Step 0 (next to tracker/write-mode resolution), and record `effort` in whatever state file it maintains. Each dispatch's recorded `dispatches[]` entry carries the `thinking_effort` it ran with (`internal/run-stats/schema.md`).

Commands with no subagent dispatch (`init`, `commit`, `adr`, `build-check`, `story-pr`, `story-check`, `close-story`, `sprint-pr`, `show-stats`) have nothing to resolve — this skill doesn't apply to them.
