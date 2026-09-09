---
name: gemini-model-effort
description: Resolves which model tier each subagent dispatches at (very-low/low/medium/high/extra-high), for sdlc commands running under the Antigravity harness instead of Claude Code. A near-exact port of skills/model-effort/SKILL.md — same three-rung cascade, same per-role logic — because Antigravity's own invoke_subagent tool exposes exactly three abstract tiers (flash_lite/flash/pro), not literal model-version strings.
---

# Skill: gemini-model-effort

This is the Antigravity-side counterpart to `skills/model-effort/SKILL.md`. It exists because
Claude model names (`opus`/`sonnet`/`haiku`) mean nothing to an Antigravity-based orchestrator —
but the *shape* of the problem (resolve a tier once per run, look up a per-agent model from a
table, pass it as an explicit override at dispatch) is identical, and — confirmed by testing
against the real `invoke_subagent` tool, not inferred from docs — so is the *rung count*.
**Irrelevant to any Claude Code session** — nothing in `commands/`/`agents/` here points to this
file; it's read only by an Antigravity-based orchestrator running these same subagent roles.

## The dispatch mechanism (confirmed against the real tool, 2026-09-08)

Subagents are spawned via `invoke_subagent`, with this schema per entry in its `Subagents` array:

```json
{
  "Subagents": [
    {
      "TypeName": "research",     // "self", "research", or a custom type via define_subagent
      "Role": "Codebase Auditor", // 2-5 word job title
      "Model": "flash",           // "inherit" | "flash_lite" | "flash" | "pro"
      "Prompt": "...",
      "Workspace": "inherit"      // "inherit" | "branch" | "share"
    }
  ]
}
```

**`Model` is an abstract tier key, not a model-version string** — there is no way to request
`gemini-3.8-flash` vs. `gemini-3.7-flash` specifically, and no way to route a subagent to a
non-Gemini model (Claude, GPT-OSS) at all; those are only selectable for the top-level
orchestrating chat session itself, a separate concern from what its subagents run on. This is
good news for maintenance: the table below never needs a version bump when Google ships a new
model under an existing tier name — `"pro"` will simply start meaning whatever Google's current
Pro model is, automatically.

| Claude rung | Antigravity `Model` key |
|---|---|
| `opus` | `"pro"` |
| `sonnet` | `"flash"` |
| `haiku` | `"flash_lite"` |

Three rungs, exactly matching the Claude table's shape — so the table below is a near-literal
port, not a redesign.

## Resolution

Identical order to `skills/model-effort/SKILL.md`, reading the **same** `.sdlc/config.json`
`effort` field — not a separate one. A repo's `effort` value means the same thing regardless of
which harness is reading it; it isn't tracked or configured per harness.

1. **`--effort <tier>` on the invoking command**, if passed — wins outright for this run. This is
   the mechanism for the current Gemini-vs-Claude tier mismatch (see "Current recommendation"
   below) — pass it explicitly on an Antigravity invocation rather than repointing the repo's
   shared `effort` config, which Claude Code also depends on.
2. **Else `.sdlc/config.json`'s `effort` field.**
3. **Else `"high"`.**

Resolved once per run, recorded in the run's state file, read back (not re-resolved) on resume.

## Using it

Every subagent dispatch passes an explicit `Model` value looked up from the table below via
`invoke_subagent`. This overrides the agent file's own frontmatter `model:` default (a Claude
model name, meaningless here) — it doesn't edit the agent file, exactly as the Claude-side skill
does. `Model: "inherit"` is deliberately never used here — it would make a subagent's tier depend
on whatever the orchestrating session happens to be running as, defeating the point of a
per-role, per-effort-tier table.

**Before dispatching, check "Current recommendation" below** for whether `"pro"` is actually
worth invoking today — the table's tier boundaries are fixed on purpose (see why below), but
which tier is worth using right now is a separate, faster-moving call.

## The table

Organized by each agent's High-tier (default) rung — the stable reference point, same as the
Claude table. Cell values are the literal `Model` string to pass.

| Agent | High (default) | Very Low | Low | Medium | Extra High |
|---|---|---|---|---|---|
| `coder` | `pro` | `flash` | `flash` | **`pro`** | **`pro`** |
| `architect` | `pro` | `flash` | `flash` | **`pro`** | **`pro`** |
| `designer` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `panelist` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `verifier` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `moderator` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `cartographer` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `flow-tracer` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `integrator` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `assessor` | `flash` | `flash_lite` | `flash` | `flash` | **`pro`** |
| `reviewer` | `flash` | `flash_lite` | `flash` | `flash` | **`pro`** |
| `planner` | `flash` | `flash_lite` | `flash` | `flash` | **`pro`** |
| `intake` | `flash` | `flash_lite` | `flash` | `flash` | `flash` |
| `pr-reviewer` | `flash` | `flash_lite` | `flash` | `flash` | `flash` |
| `surveyor` | `flash` | `flash_lite` | `flash` | `flash` | `flash` |
| `validator` | `flash_lite` | `flash_lite` | `flash_lite` | `flash_lite` | `flash_lite` |
| `scribe` | `flash_lite` | `flash_lite` | `flash_lite` | `flash_lite` | `flash_lite` |
| `publisher` | `flash_lite` | `flash_lite` | `flash_lite` | `flash_lite` | `flash_lite` |

**The rule in words** — identical to the Claude table, only the tier names differ:

- **Very Low** — a uniform one-tier cascade: `pro`→`flash`, `flash`→`flash_lite`, `flash_lite`
  stays. No exceptions.
- **Low** — `pro`→`flash` only. `flash` and `flash_lite` untouched.
- **Medium** — `pro`→`flash`, **except `coder` and `architect`**, which stay `pro` — the two
  roles every agent file's own rationale singles out as highest-risk. `flash` and `flash_lite`
  untouched.
- **High** — the shipped defaults. No change from the mapping above.
- **Extra High** — `coder`/`architect` step up to... nowhere; `pro` is already the ceiling this
  API exposes, so they simply hold there (unlike the Claude table, which has `fable` above
  `opus` to step up into — no such fourth rung exists here). `assessor`, `reviewer`, `planner`
  step up from `flash` to `pro` — the three flash-default roles where a stronger model most
  changes the outcome. `intake`, `pr-reviewer`, `surveyor` hold at `flash` even here —
  completeness/extraction work a bigger model doesn't meaningfully improve.
- **`validator`, `scribe`, `publisher` never move, at any tier.** Mechanical roles — no judgment
  surface for a bigger model to improve.

## Current recommendation (dated — re-check before trusting)

**As of 2026-09-08:** Antigravity's own top-level model picker rates Gemini 3.8/3.7/3.6 Flash as
"Medium, Fast" and Gemini 3.1 Pro — currently what `"pro"` resolves to — as **"Low."** Google's
own product surfacing a Pro model rated below Flash. Independent benchmark aggregators separately
show the underlying Flash model outperforming the underlying Pro model on coding/agentic tasks
specifically. Consistent, not coincidental — but note this is about what `"pro"` *currently*
resolves to under the hood, not a property of the abstract tier itself.

**Practical guidance until this note is revised: pass `--effort low` explicitly on Antigravity
invocations**, rather than changing the repo's `.sdlc/config.json` `effort` value — that field is
shared with Claude Code, where no such downgrade is warranted, and repointing it repo-wide would
just trade one tracking burden for another. `Low` is the highest tier at which every single role,
including `coder`/`architect`, already resolves to `flash` (see the table above) — no per-cell
override needed, no asterisks to remember, just the one flag. `Medium` and above start reaching
for `"pro"` again for the two highest-stakes roles, which isn't worth it right now. This is a
per-invocation choice, not a table or config edit — the table above stays exactly as written, and
(unlike a version-pinned model table) it doesn't even need editing once this stops being true:
the moment Google ships a stronger model under the `"pro"` key, this note becomes stale on its
own and `--effort low` simply stops being necessary.

Re-verify before trusting this note: open Antigravity's model picker and check whether Gemini
Pro is still rated below Flash. That single signal is now sufficient — there's no need to track
specific model-version numbers or pricing pages the way a version-pinned table would require.

## A separate, different question: what runs the orchestrator itself

The table above governs subagents spawned via `invoke_subagent`, which only accepts the three
tier keys above. The **top-level chat session** doing the orchestrating (running the actual
`story-run`/`design-run`/etc. command logic) is a separate choice, made by whoever starts that
session — its picker additionally offers specific Gemini generations (3.8/3.7/3.6 Flash, 3.1
Pro), Claude Sonnet 4.6, Claude Opus 4.6, and GPT-OSS 120B. None of those non-tier-key options are
reachable for a *spawned subagent* — only for the session that spawns them. This file has nothing
to say about that choice; it's a human decision made when starting the session, not something a
command resolves.

## Which commands this applies to

Same set as the Claude-side skill: any command that dispatches a subagent —
`story-run`, `design-run`, `review-run`, `review-fix`, `product-design-review` — once ported to
an Antigravity-based host. Each should accept `--effort <tier>`, resolve per the order above, and
record `effort` in whatever state file it maintains.
