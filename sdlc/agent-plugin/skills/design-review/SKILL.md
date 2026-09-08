---
name: design-review
description: Structured design-review protocol (Q1-Q7) for producing or critiquing a story's design note. Loaded by /sdlc:plan-the-design, /sdlc:design-review, and the design-run/story-run design phase.
---

# Skill: design-review

Run a structured design-review conversation for a story, then produce a
design note using the canonical template (`./template.md`). The goal is
**probing, not form-filling** — the template is the output format, but the
value comes from the deliberation that precedes it.

Calibration: trivial stories will answer many questions with "N/A" or a
single sentence. That is correct. Do not inflate a simple story into a
complex review. The core value is in §3 (Key Design Issues) — spend time
there proportional to the actual design risk.

---

## Protocol

### Framing (Q1–Q2)

**Q1 — Scope / NOT / Adjacent owner**

Establish the boundary of the story:

- What does this story deliver? (packages, endpoints, schemas, behaviours)
- What is explicitly NOT in scope?
- Who is the adjacent owner of the things that are not in scope?

Push back if "not in scope" items have no named owner — unowned scope is
unplanned scope.

**Q2 — Reconciliation vs. ground truth**

Compare the ticket's acceptance criteria against the current state of the
codebase:

- What already exists that partially or fully satisfies an AC line?
- What remains to be built?
- Are there contradictions between the AC and what's already landed?

Skip if greenfield with no prior code to reconcile against.

---

### Key Design Issues (Q3 loop — the core)

**Q3 — Surface and probe the 2–5 decisions that matter**

This is iterative. For each issue identified:

**(a) Alternatives + pros/cons**

Surface the realistic alternatives. Ask the developer to articulate why the
chosen path wins. If only one alternative is presented, probe for at least
one more — a decision with no alternatives considered is an assumption, not
a decision.

**(b) Stress lenses**

Apply three lenses to each decision:

1. **Failure direction** — Does this fail open or fail closed? Which is
   correct for this context? If the developer hasn't considered failure
   mode, surface it.

2. **Degenerate / edge case** — What happens at zero, one, max, nil,
   concurrent, or malformed input? Is the edge case a designed feature
   (handled deliberately) or an unhandled hole?

3. **Sole barrier vs. defence in depth** — Is this decision the only thing
   preventing a bad outcome? If so, is that acceptable, or should there be
   a second layer?

**(c) Deliberation → decision + invariant**

Drive toward a crisp decision statement. Then name the invariant the
decision establishes or inherits. Name invariants by what they enforce,
never by prospective names (e.g. "Every ledger event carries a non-empty
tenant ID" not "tenant-id-invariant").

If the invariant is auditor-critical or interop-critical, mark it as a
**frozen contract** — changeable only via versioned migration.

---

### Boundaries (Q4–Q6)

**Q4 — Obligations to other stories**

Identify constraints this story pushes onto other tickets. Each obligation
must result in a traceability comment posted on the target ticket. Confirm
the developer will post these before the design note is considered resolved.

**Q5 — Decision graduation**

For each locked decision, determine where it lives:

- **ADR** (`docs/adr/`) — cross-cutting, affects multiple stories or teams
- **DECISIONS.md** — single-line locked decisions, project-scoped
- **Stays in note** — story-local, no broader impact

Do not over-graduate. Most decisions stay in the note.

**Q6 — External context fenced as context-not-decision**

If the review surfaced external constraints (upstream API behaviour,
provider quirks, compliance requirements), record them as context that
informed decisions — not as decisions themselves. Fence clearly: "We
observed X, therefore we decided Y" — X is context, Y is the decision.

---

### Close (Q7)

**Q7 — Reviewer verification + confirm obligations posted**

- Build the §6 reviewer-verification checklist tied to the acceptance
  criteria.
- Confirm that all §5 cross-story obligations have traceability comments
  posted (or will be posted before the design note is marked resolved).

---

## Output

Produce the design note as `docs/design-notes/<STORY-KEY>.md` using
`./template.md` as the format. The note is a living document — it will be
updated during implementation and at PR time (§7 Implementation Findings).

## Anti-patterns

- **Form-filling**: Populating every template field mechanically without
  genuine deliberation. If the answer is obvious, say so in one line — but
  the question must still be asked.
- **Decision without alternatives**: A choice with no considered
  alternatives is an assumption. Surface at least one alternative.
- **Unnamed invariants**: Every decision should name what it guarantees.
  If you can't name the invariant, the decision may not be concrete enough.
- **Unposted obligations**: Cross-story obligations that exist only in the
  design note and never reach the target ticket are invisible constraints.
