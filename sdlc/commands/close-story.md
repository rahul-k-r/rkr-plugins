---
description: "Verify-before-done: confirm merge, CI, AC coverage, post completion record, transition to Done, report unblocked tickets."
argument-hint: "<STORY-KEY> [--technical] (e.g. AGL-19)"
---

# /sdlc:close-story

Close out a completed story: verify it meets the Definition of Done, post the completion record, transition it to Done, and report any tickets now unblocked. A story is only **Done** after its work is **merged into the base branch with CI green** and the completion record is posted — Done follows verification, never self-assertion.

> **Base branch:** read `branchModel` from `.sdlc/config.json`. Under `branchModel: sprint`, stories merge into the active sprint branch (self-approval allowed once CI is green) — that's the Done boundary; teammate review is enforced later at the sprint→main merge (`/sdlc:sprint-pr`). Under `branchModel: direct`, stories merge straight into `main`, self-approved, once CI is green — that is the Done boundary, and there is no second gate in this model.

Arguments arrive as `$ARGUMENTS`: `$1` is the story key — a real tracker key, or a local key when the story has no tracker (`tracker: none`, or an `--incognito` run). If none is given, ask. Reference a real tracker key only in its live form — translate any legacy ticket IDs first. A local key is used opaquely, as-is.

**Write-mode.** Resolve per `skills/tracker-adapter/SKILL.md`: a local key, or `tracker: none`, means `write_mode: incognito` — every write below (the completion record, the Done transition, the design-note pointer) redirects to `docs/stories/<KEY>/provenance.md` instead of the tracker. The same applies if this story was run under `--incognito` (check `docs/stories/<KEY>/story-state.json` for `write_mode`/`local_key` if present). Reads (fetching the issue) still happen normally whenever a real tracker key exists.

## Output style (`--technical`)

`--technical` (anywhere in `$ARGUMENTS`) keeps chat output in the engineer-level voice. Without it (the default), everything explained to the developer — why closing is or isn't allowed, what a gap means, and the unblocked-tickets report — follows `skills/plain-language/STANDARD.md`. The completion record — posted to the tracker, or appended to `provenance.md` under incognito — keeps its exact template and verbatim evidence in both modes.

## Steps

1. **Fetch the story.** **Real tracker key:** read the full acceptance criteria via the tracker-adapter's `get_issue` op and confirm the issue is not already Done. **Local key / `tracker: none`:** read `local_ac` from `docs/stories/<key>/story-state.json` if present, or ask the developer directly per the adapter's manual-fallback rule; there's no status field to check.

2. **Verify the DoD — reuse a fresh `/sdlc:story-check`, or run it now.** Closing requires the full audit (every AC met, local gate green, required CI checks green, coverage, decisions recorded). Don't re-derive it by hand:
   - **Reuse** a prior story-check result *only if all guards hold*: it was for **this** ticket, produced earlier in **this same conversation**, its verdict was **READY**, **and nothing has changed since** — no new commits, the PR head SHA unchanged, the same CI run. If any guard fails, the cached verdict is stale — don't trust it.
   - **Otherwise run** the story-check author-mode audit now.
   - If the verdict — reused or fresh — **isn't READY, stop, report the gaps, and do not transition.**

3. **Confirm the PR is merged and capture the evidence — always fresh.** story-check only checks the PR is *mergeable*; closing requires it *merged*, so verify this independently every time. Locate the PR for the story's branch (`gh pr view` / `gh pr list --head <branch>`):
   - **No PR, or not yet merged:** **stop — do not transition to Done.** Report the exact missing step (open the PR / wait for green CI / merge). Never fabricate CI results to close a story.
   - **Merged with required checks green:** capture the run URL, per-job conclusions, the feature commit SHA, the PR number/URL, and the merge commit SHA for the completion record. If a check is red, record it with the verbatim error and decide explicitly (fix now vs. linked follow-up) — never paper over a failure.

4. **Check design note §7.** Read `docs/design-notes/$1.md` §7 (Implementation Findings). If it is empty or still contains the template placeholder, warn: "§7 not filled — append implementation findings or confirm no material deviations."

5. **Gather the change set.** `git diff --name-only` against the merge base to list created/edited/deleted files.

6. **Post the completion record**, filled with the real evidence gathered above. **`write_mode: normal`:** post it via the tracker-adapter's `add_comment` op. **`write_mode: incognito`:** append the same content as a new dated `COMPLETION_RECORD` entry to `docs/stories/<KEY>/provenance.md` instead (create the file with a one-line header if it doesn't exist yet) — never call a tracker write tool in this mode, regardless of what's registered.

   ```
   ## <KEY> Completion Record

   ### 1. Resolution Summary
   <what the story delivered, 2–4 sentences; note any pre-existing work it built on>

   ### 2. Delivered Files
   | File | Action | Detail |
   | ---- | ------ | ------ |
   | ...  | Created / Edited / Deleted | ... |

   ### 3. AC Evidence
   - [ AC line ] → [ evidence: test/code/config path ]
   ...
   (One line per acceptance criterion. Deferred AC lines point to their follow-up story key instead of evidence.)

   ### 4. Tests Performed  (verifiable — do NOT narrate from memory)
   Local quality gate:
   - <verify command> — PASS / FAIL  (<n> tests where applicable)
   ...

   CI run on PR #<n>:
   - Run URL: <link to the actual run>
   - <check name>: PASS / FAIL (<duration>)
   ...
   (State the REAL outcome, including any failures with the verbatim error.)

   ### 5. Git Trail
   - Feature commit: <sha>  (branch <branch>)
   - PR: #<n> — <url>  (base <base_branch>)
   - Merge commit: <sha>

   ### 6. Follow-ups (if any)
   <deferred items, each with a linked follow-up story key>

   **Design note:** docs/design-notes/<KEY>.md
   ```

7. **Update the tracker.**
   - **Transition the ticket to Done.** `write_mode: normal`: via the tracker-adapter's `transition_status` op. If the transition fails, report the error and current status — don't retry silently. (Jira note: the transition tool's inline `comment` parameter requires Atlassian Document Format — Markdown fails with *"Operation value must be an Atlassian Document"*; the completion record is already posted separately, so transition without an inline comment. Linear transitions via a plain field update — no such quirk.) `write_mode: incognito`: skip the tracker call entirely and record "would have transitioned `<key>` to Done" in `provenance.md` instead.
   - **Update the design-note pointer.** **Jira, `write_mode: normal`:** update the "Design Note" custom field (the adapter's `update_field` op) to point to the main-branch URL of the design note (post-merge path, not the feature-branch path). **Linear:** no custom-field equivalent — post a comment (`add_comment`) carrying the note's path instead. **`write_mode: incognito` (either tracker, or none):** skip — the design note's location is already recorded in the completion record just appended to `provenance.md`.

8. **Report unblocked tickets — real tracker only, `write_mode: normal`.** Search the project's current-sprint/cycle tickets whose description lists "Depends on: [this key]" via the tracker-adapter's `search` op. Report any now unblocked and ready to start. Skip this step entirely under `write_mode: incognito` or for a local key — there is either nothing to search, or nothing this run should be touching beyond its own ticket.

## Notes

- **Refuse to mark Done on assertion.** Every claim in the completion record must be backed by a verifiable artifact (merge SHA, CI run URL, test file path). "I checked and it's fine" is not evidence.
- **Partial work — never flip to Done.** Either reopen (back to In Progress, finish the remaining AC) or descope+split (trim AC to what's done, move the rest into a new linked story).
- "It passed locally" is not closure. The PR's CI run is the artifact others verify against.
