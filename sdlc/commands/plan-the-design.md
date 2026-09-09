---
description: "Run the full design-review protocol for a story as an interactive dialogue with the developer, producing a design note and posting cross-story obligations."
argument-hint: "<STORY-KEY> [--plain] (e.g. AGL-19)"
---

# /sdlc:plan-the-design $STORY_KEY

> **Anti-pattern — read this first.**
> Do NOT produce a finished design note in a single autonomous pass. The deliberation is the deliverable; the note is its byproduct. Never answer on the developer's behalf. Every design question requires the developer's own reasoning before a decision is recorded. If the developer hasn't spoken, you haven't finished the step.

## Output style (`--plain`)

`--plain` (anywhere in `$ARGUMENTS`) conducts **the entire deliberation — not just Phase 0.5 — per `skills/plain-language/STANDARD.md`** instead of the default engineer-level voice: Phase 1's scope framing, Phase 2's candidate issues, Phase 3's alternatives, stress-lens prompts, and decision summaries, Phase 4's boundaries, and the Phase 5 walkthrough of the draft are all phrased so a developer without deep engineering background can reason and decide. Phase 0.5's briefing is this standard's origin and happens in both modes. The design note itself, obligation comments (or their manual-tracking equivalent), and everything written to disk keep their fixed technical form either way — in plain mode, explain in chat what the draft says before asking for approval.

---

## Phase 0 — Silent research (do not print results yet)

Read all of the following in parallel. Do not present findings until Phase 1.

1. **Resolve the ticket.** Resolve the tracker per `skills/tracker-adapter/SKILL.md` (read `.sdlc/config.json`, or detect the registered MCP tool family). If a real tracker (`jira`|`linear`) resolved and `$STORY_KEY` looks like one of its keys, fetch it via the adapter's `get_issue` op. Extract: title, full acceptance criteria, story type, linked issues, current status.
2. **Read repo ground truth:**
   - `DECISIONS.md` and any ADRs in `docs/adr/` relevant to this story's domain.
   - Existing code, schemas, and packages touched by the story's scope (use the AC and package layout to target reads — do not scan the entire repo).
   - Design notes of dependency stories listed in the ticket's "Depends-on" or linked issues: `docs/design-notes/<DEP-KEY>.md`.
3. If no tracker resolved (`tracker: none`), or the resolved tracker's `get_issue` fetch is unavailable, ask the developer to paste the AC and wait for their response before continuing.

---

## Phase 0.5 — Plain-language briefing. **STOP for developer.**

Before the structured Q1-Q7 protocol starts, step back and narrate the story in plain language — an on-ramp, not a restatement of Phase 1's formal framing. Prose, not a table or checklist:

- **What this story is building**, in accessible terms — skip the AC-line-by-line reading, describe the actual thing.
- **The design issues likely to matter**, and *why* — what's genuinely up for debate here, in a sentence or two per issue, not yet the formal alternatives table.
- **The realistic alternatives at a glance**, with their rough pros and cons — enough to orient, not the full stress-lens treatment Phase 3 gives each one.

Then ask a single light question — this is an orientation check, not a decision lock:

> "Does this land? Anything you'd reframe before we go issue-by-issue?"

**STOP. Wait for the developer's response.** Fold anything they correct here into Phase 1's framing. This step is deliberately cheaper than Phase 1's structured Q1/Q2 — it exists so the developer isn't hit cold with the formal protocol before they have the shape of the story in mind.

---

## Phase 1 — Scope framing (Q1 + Q2). **STOP for developer.**

Present a concise framing (not a wall of text):

- **Proposed scope:** what this story delivers (packages, endpoints, schemas, behaviours) based on the AC and ground truth.
- **Proposed NOT-scope:** what is explicitly out, and the named adjacent owner of each excluded item. Flag any NOT-scope item that has no obvious owner.
- **Reconciliation findings:** what already exists that partially or fully satisfies an AC line, what remains to be built, and any contradictions between the AC and what's already landed. Write "N/A — greenfield" if there is nothing to reconcile.

Then ask the developer:

> "Does this scope framing match your understanding? Anything to add, narrow, or correct?"

**STOP. Wait for the developer's response.** Do not proceed until they confirm or correct.

---

## Phase 2 — Surface candidate issues (Q3 set). **STOP for developer.**

Based on the AC, ground truth, and the confirmed scope, identify 2–5 candidate design issues — the decisions that actually matter for this story. Present them as a numbered list of one-line questions (not answers). For example:

> 1. How should X fail when Y is unavailable?
> 2. Should Z live in package A or package B?
> 3. What canonical form does W take?

Then ask the developer:

> "These are the design questions I see. Which of these matter? Any I'm missing? Which should we take first?"

**STOP. Wait for the developer's response.** They may reorder, add, drop, or reframe issues. Accept their prioritization.

---

## Phase 3 — Walk each issue interactively (Q3 loop). **STOP between issues.**

Take the issues in the developer's chosen order. For **each** issue:

### Step A — Alternatives

Present the realistic alternatives you see (at least two). If you can only see one path, say so and ask the developer to name another — a decision with no alternatives considered is an assumption, not a decision.

> "Here are the alternatives I see for this issue: [table or list]. What's your thinking — which path and why?"

**STOP. Wait for the developer's reasoning.** Do not select an alternative on their behalf.

### Step B — Stress lenses

After the developer states their preferred path, apply the three stress lenses **as prompts to the developer**, not as answers:

1. **Failure direction:** "If this breaks, does it fail open or fail closed? Which is correct here and why?"
2. **Degenerate / edge case:** "What happens at [zero / nil / max / concurrent / malformed] — is that a designed feature or an unhandled hole?"
3. **Sole barrier vs. defence in depth:** "Is this the only thing preventing [the bad outcome]? Is a single layer acceptable, or do we need a second?"

Present all three, then **STOP. Wait for the developer to respond to each lens.** If a response is weak or hand-wavy, push back with a specific scenario. Do not accept "it'll be fine" — ask what specifically makes it fine.

### Step C — Lock the decision

Summarize the decision and the invariant it establishes in 2–3 sentences. Ask:

> "Is this the decision and invariant to record? Anything to sharpen?"

**STOP. Wait for confirmation.** Then move to the next issue.

Repeat Steps A–B–C for every issue in the set.

---

## Phase 4 — Boundaries (Q4–Q6). **STOP for developer.**

After all issues are deliberated, present:

- **Q4 — Cross-story obligations:** constraints this story pushes onto other tickets. For each, name the obligation and the target ticket.
- **Q5 — Decision graduation:** for each locked decision, propose where it lives (ADR / DECISIONS.md / stays in note). Do not over-graduate — most decisions stay in the note.
- **Q6 — External context:** any external constraints (upstream API behaviour, provider quirks, compliance requirements) that informed decisions. Fence them as context, not decisions.

Then ask:

> "Any obligations I'm missing? Do the graduation targets look right?"

**STOP. Wait for the developer's response.**

---

## Phase 5 — Draft the design note. **STOP for approval.**

Only now — after all issues are deliberated and boundaries confirmed — draft the design note using `skills/design-review/template.md` as the format. Fill every section from the deliberation above:

- §1 Scope from Phase 1 (confirmed).
- §2 Reconciliation from Phase 1 (confirmed).
- §3 Key Design Issues from Phase 3 (one sub-section per deliberated issue, including the developer's reasoning, not a sanitized summary).
- §4 Decisions & Open Items — locked decisions with graduation targets from Phase 4.
- §5 Cross-Story Obligations from Phase 4.
- §6 Reviewer Verification — checklist tied to AC lines (Q7).
- §7 Implementation Findings — leave empty (appended at PR time).

Present the full draft to the developer:

> "Here is the draft design note. Review it — I'll revise before writing the file."

**STOP. Wait for the developer's approval or revision requests.** Iterate until they approve.

---

## Phase 6 — Write and post

On approval:

1. **Write the design note** to `docs/design-notes/$STORY_KEY.md`. Under `.sdlc/config.json`'s `localDocs: true` (`skills/local-docs/SKILL.md`), this is also the note's *permanent* location — nothing later copies or commits it into a worktree.
2. **Post cross-story obligations.** For each obligation identified in Q4, post a traceability comment on the target ticket via the tracker-adapter's `add_comment` op (`skills/tracker-adapter/SKILL.md`), whichever tracker (`jira`|`linear`) resolved this session. Format: "Design note for $STORY_KEY establishes obligation: <obligation text>. See `docs/design-notes/$STORY_KEY.md` §5." **If `tracker: none` resolved (or the write fails)**, this command doesn't switch to a full incognito mode — it's an interactive session, not an autonomous run — so just print each obligation to the developer instead, and tell them plainly it needs to be tracked manually; never drop one silently.
3. **Report graduation backlog.** Print a summary of decisions needing graduation beyond the note:
   - Decisions → ADR (with proposed ADR title).
   - Decisions → DECISIONS.md (with proposed one-liner).

---

## Phase 7 — Stop.

Do not implement. Do not create branches. Do not write application code. The deliverable is: design note written, obligations posted (or printed for manual tracking), graduation backlog listed.
