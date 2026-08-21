---
description: "Scaffold an Architecture Decision Record in docs/adr/ when a decision crosses the ADR threshold."
argument-hint: "[short title]"
---

# /sdlc:adr

Scaffold an Architecture Decision Record in `docs/adr/` with the right number and sections. Use this when a decision crosses the ADR threshold; for a small locked choice, a one-line entry in `DECISIONS.md` is enough instead.

An ADR is **reviewed via PR approval** — that *is* the review step, so the decision lands visibly rather than silently.

If no title is given as `$ARGUMENTS`, ask what the decision is.

## When to write an ADR (the threshold)

Write an ADR when the decision meets **any** of these:
- is hard to reverse later, or
- affects more than one component, or affects another person's work, or
- picks among real alternatives (you considered B and C and chose A), or
- introduces a new core dependency or a new data format / wire contract, or
- sets a pattern others will copy.

Otherwise, add a one-line entry to `DECISIONS.md` — don't scaffold an ADR. When in doubt and it touches someone else's work, write the ADR.

## Steps

1. **Find the next number.** List `docs/adr/ADR-*.md`, take the highest `NNNN`, increment, and zero-pad to 4 digits. If `docs/adr/` doesn't exist yet, create it and start at `0001`.

2. **Create the file** `docs/adr/ADR-NNNN-kebab-title.md` from this template:

   ```markdown
   # ADR-NNNN: <Title>

   - **Status:** Proposed
   - **Date:** <YYYY-MM-DD>
   - **Story:** <KEY> (if tied to a story)
   - **Deciders:** <names>

   ## Context
   <The forces at play: the problem, constraints, and why a decision is needed now. State the alternatives considered (B, C) so the choice is legible.>

   ## Decision
   <The choice made, in active voice: "We will ...". Be specific enough that someone can build to it.>

   ## Consequences
   <What becomes easier and what becomes harder. Follow-on work, risks, and what this locks in or rules out.>
   ```

3. **Fill in what you know** from the session and ask the user for the rest (deciders, alternatives) — don't invent rationale.

4. **Leave Status as `Proposed`.** It moves to `Accepted` when the PR carrying it is approved, and to `Superseded` later if another ADR replaces it (note the superseding ADR number).

5. **Remind** the user to include the ADR in the story's PR so it's reviewed as part of the review gate.

## Notes

- Significant/cross-cutting decisions → ADR here. Small locked choices → one-liner in `DECISIONS.md`.
- Status lifecycle: `Proposed → Accepted → Superseded`. Never delete a superseded ADR — mark it and link forward, so the decision history stays intact.
- Run from the repo root; no machine-specific paths.
