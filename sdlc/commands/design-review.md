---
description: "Critique and deepen an existing design note by running the Q1–Q7 protocol against it. Does not create a new note."
argument-hint: "<STORY-KEY> [--technical] (e.g. AGL-19)"
---

# /sdlc:design-review $STORY_KEY

## Output style (`--technical`)

`--technical` (anywhere in `$ARGUMENTS`) keeps the critique in the engineer-level voice. Without it (the default), the findings report — gaps, challenges, suggestions, and what each means for the story — follows `agent-plugin/skills/plain-language/STANDARD.md`; cited sections, invariants, and file references stay verbatim either way.

**Worktree & local docs.** Check `docs/stories/$STORY_KEY/story-state.json` (if present — absent means this story never went through `/sdlc:story-start`/`/sdlc:story-run`, so there's nothing but the session's own root to check) for `worktree` and `local_docs`, per `agent-plugin/skills/worktree-mode/SKILL.md` and `agent-plugin/skills/local-docs/SKILL.md`. Step 1 opens the note at its resolved location: the session's own root under `local_docs: true`, `worktree` (when set) otherwise — a review invoked from inside the story's own worktree mid-implementation still needs this to find the right copy.

## Steps

1. **Read the existing design note.** Open `docs/design-notes/$STORY_KEY.md` at its resolved location (above). If it does not exist, refuse and suggest running `/sdlc:plan-the-design $STORY_KEY` instead.

2. **Read supporting context.** In parallel:
   - The ticket, via the tracker-adapter's `get_issue` op (`agent-plugin/skills/tracker-adapter/SKILL.md`) — whichever tracker (`jira`|`linear`) resolved this session — for AC, linked issues, status. If `tracker: none` resolved, there's nothing to fetch: proceed on the design note and the docs read below alone, same as the note's own "if available" framing already implies.
   - `DECISIONS.md` and relevant ADRs in `docs/adr/`.
   - Design notes of any stories listed in the note's Depends-on / Related fields.
   - Code and schemas referenced by the note's §1 Scope.

3. **Run the protocol as critique.** Walk `agent-plugin/skills/design-review/SKILL.md` Q1–Q7 against the existing note, not from scratch. For each section:
   - Is the content substantive or stub/template boilerplate?
   - Q1: Is scope concrete? Is "NOT" actually bounded with a named adjacent owner?
   - Q2: Does reconciliation reflect current ground truth, or is it stale?
   - Q3: Per issue — were alternatives genuinely considered? Do stress lenses surface anything the author missed? Are invariants named by what they enforce?
   - Q4: Are all obligations posted on target tickets?
   - Q5: Are graduation targets appropriate (not over- or under-graduated)?
   - Q6: Is external context fenced as context, not smuggled in as decisions?
   - Q7: Does the verification checklist map to AC lines?

4. **Report findings.** Output a structured critique:
   - **Gaps**: sections that are stub, missing, or superficial.
   - **Challenges**: specific decisions or invariants to probe deeper.
   - **Suggestions**: concrete improvements with rationale.

5. **Do not modify the note.** This command reviews — the author updates. If the author asks to apply changes, they should re-run `/sdlc:plan-the-design` or edit directly.
