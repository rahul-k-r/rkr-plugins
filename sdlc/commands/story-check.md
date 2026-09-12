---
description: "Verify a story against the Definition of Done — per-item PASS/GAP checklist and a verdict. Auto-detects reviewer mode for a teammate's PR."
argument-hint: "[STORY-KEY] [--plain]"
---

# /sdlc:story-check

Verify a story against the Definition of Done — a readiness check producing a per-item PASS/GAP checklist and a verdict. Use it before merging a story into the base branch and closing it. This is the verification step that `/sdlc:close-story` assumes has passed — Done follows verification, never self-assertion.

**Two modes, auto-detected by PR authorship (step 1):**

- **Author mode** (the PR is yours, or no PR exists yet) — DoD readiness check, strictly read-only (never transitions the tracker, comments, or commits).
- **Reviewer mode** (the PR is someone else's) — the same DoD checklist **plus** a correctness pass via Claude's built-in `/review`, then an offer to post a GitHub review.

> **Base branch:** read `branchModel` from `.sdlc/config.json`. Under `branchModel: sprint`, the story PR targets the active sprint branch `sprint/<id>` and may be self-approved/merged once CI is green — a *teammate* approving review is **not** required at the story level (that gate is the sprint→main merge). Story readiness = AC met + CI green. Compute diffs against the sprint branch as the merge base. Under `branchModel: direct`, the story PR targets `main` directly and the same rule applies — self-approval once CI is green, no second-reviewer gate — compute diffs against `main` as the merge base.

Arguments arrive as `$ARGUMENTS`: `$1` is the story key — a real tracker key, or a local key when the story has no tracker; if absent, ask which story to check. Reference a real tracker key only in its live form — translate any legacy ticket IDs first. A local key is used opaquely, as-is.

## Output style (`--plain`)

`--plain` (anywhere in `$ARGUMENTS`) narrates the checklist — what each PASS/GAP means, why the verdict is what it is, and what to do next — per `internal/plain-language/STANDARD.md` instead of the default engineer-level voice. The checklist/verdict block itself keeps its exact format and verbatim evidence in both modes, and any GitHub review posted in reviewer mode stays in its fixed technical form.

## Steps

0. **Resolve project config** from the target repo's `CLAUDE.md`: verify commands, required CI check names, mandatory conventions, and any tracker custom-field notes (e.g. a Jira story-points field ID). Also resolve `branchModel` from `.sdlc/config.json` — it decides the merge base used throughout.

1. **Identify the ticket and the mode.** Find the PR for the branch (`gh pr list --head <branch>` / `gh pr view`) and compare its author to the current user (`gh api user --jq .login`).
   - **PR author == you, or no PR yet → author mode.** Proceed read-only. Also check `docs/stories/<KEY>/story-state.json` for a `worktree` field (per `internal/worktree-mode/SKILL.md`) — the file may not exist (this story never went through `/sdlc:story-start`'s worktree creation), in which case there's nothing to resolve. When it resolves to a path, every git inspection below (Steps 3 and 8) targets it via `git -C <worktree>` instead of the current checkout.
   - **PR author != you → reviewer mode.** Fetch the PR (`gh pr checkout <number>` in a clean worktree, or `gh pr diff`) so the checks run against their work, then follow the reviewer-mode addendum after the standard steps. (This is a separate, ad hoc worktree for fetching a teammate's PR — unrelated to the story's own `worktree` field, which won't exist locally for a story you didn't run yourself.)

2. **Read the full acceptance criteria.** **Real tracker key:** fetch the story via the tracker-adapter's `get_issue` op (`internal/tracker-adapter/SKILL.md`). Read the *complete* AC and design detail — partial reads cause premature closes. List each acceptance criterion explicitly. **Local key / `tracker: none`:** check `docs/stories/<key>/story-state.json` for a `local_ac` field (present when the story was run via `/sdlc:story-run` or `/sdlc:story-start` in no-ticket mode) and use it verbatim; if no state file exists either, ask the developer directly for the success criteria (per the adapter's manual-fallback rule) and record the answer for the rest of this check.

3. **Check each AC against the actual change.** For every criterion, inspect the diff (`git diff <base_branch>...HEAD` against the merge base — `<base_branch>` resolved in Step 0 from `branchModel`: `sprint/<id>` or `main`; `-C <worktree>` when set — plus reading the relevant files) and judge met / not met / unverifiable. Cite the file/line that satisfies each one. Don't assume — verify.

4. **Run the local quality gate — or reuse a fresh one.** If `/sdlc:story-pr` or `/sdlc:build-check` ran earlier in *this same conversation* and reported green, and **nothing has changed since** — no new commits, working tree unchanged — reuse those results (say so, and cite when they were produced). Otherwise run the gate fresh with real outcomes. If a linter isn't installed locally, mark it **"deferred to CI lint"** rather than GAP — a green CI lint check satisfies it.

5. **Confirm test coverage.** Verify new behavior is actually covered by tests (table-driven where the repo's conventions favor it), not just that the suite passes.

6. **Check CI — but only if a PR exists.** CI runs on the PR, so it won't have run before one is opened:
   - **No PR yet:** CI is **PENDING**, not a failure. The local gate is the pre-PR substitute. Cap the verdict at *ready to open the PR*.
   - **PR open:** confirm the repo's required checks are green. Capture the run URL and per-job conclusions. A red check is a GAP — record the verbatim error.

7. **Check decision records.** If the work made an architectural decision, confirm it's recorded: a `docs/adr/ADR-NNNN-*.md` for significant/cross-cutting choices (see `/sdlc:adr` for the threshold), or a one-line entry in `DECISIONS.md` for small locked choices. An undocumented decision that affects others is a GAP. **A decision already locked upstream by the ticket/design note is not an open architectural selection** — it does not require an ADR even if it introduces a new core dependency; a `DECISIONS.md` entry is sufficient. Reserve ADRs for choices *this story actually made* among real alternatives.

8. **Check the design note is committed and current.** If `docs/design-notes/<KEY>.md` exists (in `worktree` when set — that's where it was actually committed), confirm it has no uncommitted working-tree changes (`git status`, `-C <worktree>` when set) and that its committed content is part of the PR diff against the merge base — not sitting locally, unpushed. If the implementation deviated from the design, confirm §7 (Implementation Findings) is filled and not still the empty template placeholder. An uncommitted, unpushed, or stale note is a GAP.

9. **Check merge readiness.** Confirm a completion record is/will be posted (to the tracker, or `provenance.md` under incognito) and the story PR is mergeable with CI green, applying the `branchModel` rules from the note above.

## Reviewer mode (PR is not yours)

After running steps 2–9 against the fetched PR:

- **Run Claude's built-in `/review` on the PR**, steering it with a focus prompt: correctness bugs first (logic errors, edge cases, error handling, concurrency/races, nil/bounds), then reuse/simplification/efficiency; flag anything violating the repo's `CLAUDE.md`/`DECISIONS.md` mandatory rules. Surface its findings as-is alongside your DoD checklist, as `file:line` with severity.
- **Then offer to post a GitHub review.** Ask before posting (default: don't). On approval, submit via `gh pr review <number>` — verdict in the review **body** (`--comment` for notes, `--request-changes` if there are GAPs or correctness issues, `--approve` only when everything passes). Reviewer mode is the one case where this command may write to the PR — and only after you confirm.

  **Summary body vs. inline comments — different mechanisms:**
  - `gh pr review` posts **one review-level body**; `file:line` findings live as text in it, not anchored to the diff. Default, and enough for a verdict plus a short findings list.
  - **Line-anchored inline comments** require the review-comments API:

    ```
    gh api repos/{owner}/{repo}/pulls/<number>/comments \
      -f commit_id="<PR head SHA>" -f path="<file>" \
      -F start_line=<n> -f start_side=RIGHT -F line=<m> -f side=RIGHT \
      -f body="<finding>"
    ```

    Head SHA from `gh pr view <number> --json headRefOid -q .headRefOid`; anchored lines must be part of the PR diff. Drop `start_line`/`start_side` for a single-line anchor. Ask which the user wants (summary body, inline, or both); default to the summary body.

Author mode remains strictly read-only: no `/review`, no comments, no GitHub review.

## Output

Emit a checklist, then a verdict:

```
## <KEY> — DoD Check

Acceptance criteria:
- [PASS/GAP] <criterion> — <evidence: file:line or reason>
...

Definition of Done:
- [PASS/GAP]         Every AC met
- [PASS/GAP]         Local quality gate green     (lint = "deferred to CI" if not installed locally)
- [PASS/GAP/PENDING] CI checks green              (PENDING if no PR yet)
- [PASS/GAP]         New behavior covered by tests
- [PASS/GAP]         Decisions recorded (ADR / DECISIONS.md)
- [PASS/GAP]         Design note committed & current (§7 filled if applicable)
- [PASS/GAP]         Story PR mergeable, completion record postable

Verdict (the highest the evidence supports):
- READY TO OPEN PR     — local gate green, AC met, but no PR/CI yet
- READY TO MERGE/DONE  — PR open, CI green, completion record postable
- GAPS: <numbered list of what's missing>
```

If there are gaps, do **not** suggest closing. For partial work the options are reopen (finish the remaining AC) or descope+split (trim AC to what's done, move the rest to a new linked story) — never flip to Done with unmet AC or a red pipeline.

**In reviewer mode**, append the `/review` findings under the checklist and frame the verdict as a review recommendation (APPROVE / REQUEST CHANGES) instead of a Done call, then offer to post it.

## Notes

- **Author mode is read-only:** no transitions, comments, commits, or pushes. To close a verified story, use `/sdlc:close-story`.
- "It passed locally" is not closure — the PR's CI run is the artifact others verify against. Link the actual run; quote real SHAs and per-job conclusions.
