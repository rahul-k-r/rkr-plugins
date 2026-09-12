---
description: "Apply review findings to a PR you authored: triage each finding (fixable vs. needs-your-judgment), fix the fixable on the story branch, verify with a fresh review pass, and escalate the rest. The write-side counterpart that keeps review-run purely read-only."
argument-hint: "<PR#> [--budget N] [--review] [--effort <tier>] [--plain] [--show-stats]"
---

# /sdlc:review-fix

Consumes review findings against **one PR the current developer authored** and works through them: the orchestrator triages every finding into **FIX** (mechanical, in-scope, unambiguous) or **ESCALATE** (design-level, scope-expanding, or ambiguous — a human's call), a `coder` applies the fix-list on the PR's head branch, a `validator` runs the local quality gate, the fixes are pushed, and a **fresh `reviewer` pass (PR mode) confirms convergence** — looping within a small budget, then reporting `FIXED_CLEAN` or `ESCALATE` with the residual findings. Findings come from whoever reviewed: a `/sdlc:review-run` pass in the same session, or the reviews and unresolved threads already posted on the PR — including a human teammate's.

> **Where this sits:** this is the **write side** of the review subsystem, split out so `/sdlc:review-run` stays purely read-only — review-run's own agents (`reviewer`, `integrator`) never write; every code change lives here, behind this command's own gates. Callers: `review-run --fix` (Mode A) chains into this procedure per not-clean authored PR; `story-run --bypass` runs it inline when its auto-review comes back not clean (phase `AUTO_FIX`); standalone, it's "work through the reviewer's comments on my PR, escalate what needs me."

## Hard boundaries

- **Author-owned PRs only.** The PR's author must be the current developer (`gh api user` vs. `gh pr view --json author`). Anyone else's PR → report what *would* be triaged and stop; pushing autonomous commits to a teammate's branch is never this command's call.
- **Open, unmerged, story-branch PRs only.** Never a `sprint/*` or `main` head branch, never a merged/closed PR, never review-run's Mode B (the sprint-close gate rejects `--fix` outright — auto-committing to a sprint branch during the close gate is not a thing this plugin invites).
- **Cross-ticket findings always escalate.** Anything from the `integrator` (contract drift, cross-story obligations, merge order) is design-level by definition — never autofixed.
- **Never merges, never approves, never transitions the tracker.** It fixes and re-verifies; the human gates stay where they are.

## Usage

```
/sdlc:review-fix <PR#> [--budget N] [--review] [--effort <tier>] [--plain] [--show-stats]
```

- `<PR#>` — exactly one PR number. Required standalone (callers pass it programmatically).
- `--budget N` — fix-loop attempts before escalating (default `2`).
- `--review` — when collecting findings standalone (step 1), also run `/code-review <PR#>` (low/medium effort — same default `/sdlc:story-pr --review` and `/sdlc:review-run --review` use) alongside the PR's posted reviews/threads, merged into the same triage. **When invoked inline** (`review-run --fix`, `story-run --bypass`'s `AUTO_FIX`), this is **inherited from the caller, never re-asked** — if the caller ran with `--review`, this run's own convergence check (step 4e) also re-runs `/code-review` fresh, not just `reviewer`, regardless of where the original findings came from. `/code-review`'s own effort level is independent of this run's `--effort`/`skills/model-effort/SKILL.md` tier.
- `--effort <tier>` — override `.sdlc/config.json`'s `effort` for this run only, per `skills/model-effort/SKILL.md` (`very-low`/`low`/`medium`/`high`/`extra-high`). Omitted → the config's `effort`, or `high` if that's unset too. **When invoked inline (`review-run --fix`, `story-run --bypass`'s `AUTO_FIX` step), `effort` was already resolved by the caller — inherited as given, never re-resolved.**
- `--plain` — narrate everything reported in chat — the triage, the loop progress, the final verdict — per `skills/plain-language/STANDARD.md` instead of the default engineer-level voice; commits, the PR summary comment, and any tracker mirror keep their fixed technical form either way. When a run invokes this procedure inline, the run's mode cascades in as usual.
- `--show-stats` — auto-publish the usage report as an Artifact at the end. Collection and the local snapshot happen regardless (see **State & stats**).

No `--resume`: the loop is short and a re-review must be fresh anyway (the diff changes under it) — if a session dies mid-loop, just re-run the command; commits already made stand, uncommitted work is discarded (`git reset --hard HEAD`, `-C <worktree>` when one's in play) as unverified.

## Steps

0. **Preflight.** `gh` authenticated; project config resolved from the target repo's `CLAUDE.md` (verify commands, mandatory rules, required CI check names). **Resolve `effort`** per `skills/model-effort/SKILL.md`: when invoked inline (`review-run --fix`, `story-run --bypass`'s `AUTO_FIX` step), it's already resolved by the caller — inherit it as given, never re-resolve. Standalone: `--effort <tier>` if passed, else `.sdlc/config.json`'s `effort`, else `high`. Every subagent dispatch below (`coder`, `validator`, `reviewer`) passes an explicit `model` looked up from that skill's table for this tier — not restated at each dispatch below. **Resolve `review`** (whether a `/code-review` pass is in play): invoked inline, inherit the caller's `--review` state, never re-ask; standalone, it's whether `--review` was passed to this command directly. `gh pr view --json number,title,author,baseRefName,headRefName,state,mergedAt` — enforce the **Hard boundaries** above. Working tree must be clean (dirty → stop and say why; never stash someone's work). Record the currently checked-out branch to restore at the end when this run had to switch.

1. **Collect findings.**
   - *Invoked by a run* (`review-run --fix`, `story-run --bypass`): the caller passes its reviewer's structured findings directly — use those, don't re-fetch. If the caller's own `--review` was set, its set already includes `code-review`-sourced findings alongside `reviewer`'s.
   - *Standalone*: fetch the PR's reviews (latest review per reviewer) and unresolved review threads via `gh api`; each comment becomes a finding with its file/line anchor and the reviewer's words quoted verbatim. **With `--review`**, also run `/code-review <PR#>` at low/medium effort and merge its findings into the same set, tagged `source: code-review` for the audit trail. Nothing actionable → report "nothing to fix" and stop.

2. **Resolve story context.** Derive the story key from the PR title/branch. Resolve the design note (`docs/design-notes/<KEY>.md` — at the session's own root if the state file's `local_docs` is `true`, `worktree` otherwise once that's resolved below), locked decisions, and any `docs/stories/<KEY>/` artifacts (context pack, plan). Record `context: full` (design note + artifacts resolve), `partial` (design note only), or `none`. **Also check `docs/stories/<KEY>/story-state.json` for a recorded `worktree`** (per `skills/worktree-mode/SKILL.md`) — this command never creates or targets one itself (no `--worktree`/`--no-worktree` flags here; it operates on a PR/branch that already exists, not something it's setting up). If the state file exists and `worktree` is non-null, record it and use it from Step 4 on: every git operation targets it via `-C`/`cd`-qualified commands, and the coder dispatch is told it's the working root. If no state file exists, or `worktree` is `null`, operate directly in the current checkout exactly as before.

3. **Triage — by the orchestrator, not a dispatch.** With the findings, the PR diff, the story AC, and whatever context resolved all in hand, give every finding exactly one of:
   - **FIX** — mechanical or correctness-level, inside the story's existing scope, with one obvious remediation a reviewer would not need to debate.
   - **ESCALATE** — requires a design decision, deviates from the design note or a locked decision, expands scope, or is ambiguous about intent.

   **Strictness scales with context:** at `full`, you can judge design conformance of a proposed fix; at `partial`/`none`, only mechanically obvious findings (lint-class, clear bugs with local fixes, missing test the AC names) qualify as FIX — you can't verify a fix conforms to design artifacts you don't have. All-ESCALATE → report the triage and stop; nothing here is autofixable.

4. **Fix loop** (up to `--budget` attempts):
   a. If Step 2 recorded a `worktree`, the story branch is already checked out there — verify (`git -C <worktree> branch --show-current`) it matches the PR's `headRefName`, fetching/switching if not (`git -C <worktree> fetch origin && git -C <worktree> switch <headRefName>`); every git operation below targets `worktree` via `-C`. Otherwise, check out the PR's head branch in the current checkout as before (`gh pr checkout` — one PR, sequential; review-run's no-parallel-checkout rule is about parallel stages, which this never is).
   b. Dispatch `coder` with the FIX list only — the finding text, anchors, and your remediation notes, told its working root explicitly (`worktree` when set, else the current checkout). One atomic commit per finding, staging only files it touched, never `docs/stories/`, never scope beyond the finding. A coder `DESIGN_CONFLICT` moves that finding to ESCALATE, not to a retry.
   c. Dispatch `validator` with the resolved verify commands (run against `worktree` when set). FAIL → hand the failures back to the coder within the same attempt once; still failing → the attempt is spent. Any step at `FAIL_ENV` → ESCALATE immediately, attempt not spent — the worktree's environment is broken (dependencies never installed, per `skills/worktree-mode/SKILL.md`'s *Recognizing the symptom*), which the coder can't fix by editing source.
   d. Push (`git push`, `-C <worktree>` when set). The branch is a story branch, so the gate hook allows this at `PR_OPENED` (standalone) or `AUTO_FIX` (inside a `--bypass` tail).
   e. Dispatch `reviewer` in **PR mode**, fresh, against the updated PR — full pass, not a delta check (works from the PR diff via `gh`, so it needs no worktree qualifier). **When `review` is set** (this run's own `--review`, or inherited from the caller), also run `/code-review <PR#>` fresh in the same step, at the same low/medium effort as step 1 — the convergence check has to re-verify everything the original findings could have come from, not just the half `reviewer` covers.
      - **Clean** — `reviewer` returns `APPROVE` with no BLOCKING/MAJOR, **and** (when `review` is set) `/code-review` surfaces nothing new at that effort → verdict `FIXED_CLEAN`, exit loop.
      - **Findings remain** (from either pass) → merge them and re-triage (step 3), tagged by source as before. New FIX items and budget left → next attempt. Otherwise → verdict `ESCALATE` with the residuals.

5. **Report.** Post one PR comment as the audit trail: findings fixed (with commit SHAs), findings escalated (with the triage reasoning), verdict, attempts used. In chat: the same, led by the verdict; escalated items framed as the decisions the developer now owns. Restore the original branch if step 4a switched it in the current checkout (nothing to restore when operating in a recorded `worktree` — the session's own branch was never touched). Write the stats snapshot (and publish the Artifact if `--show-stats`).

## When the human is asked

Never mid-run — this command stops rather than asks. Invoking it (or passing `--fix` to review-run, or `--bypass` to story-run) *is* the consent to commit and push fixes to your own PR; there is no per-fix confirmation. Everything it couldn't safely fix comes back as the escalation report.

## State & stats

Working state and stats live in `docs/stories/_reviews/fix-<PR#>/` (untracked, covered by `docs/stories/.gitignore`; never deleted after the run, same as review-run). Append a `dispatches[]` entry after every subagent dispatch per `skills/run-stats/schema.md` (`run_type: review-fix`); snapshot to `_stats/review-fix-<UTC timestamp>.json` at the end, always. When a run invokes this procedure inline, dispatches are recorded in **the run's own state file** instead — one run, one stats report.

## Model tiering

The table below is the `high`-tier default — what every agent's own frontmatter already declares, and what a repo with no `effort` configured runs at. For every other tier (`very-low`/`low`/`medium`/`extra-high`), see `skills/model-effort/SKILL.md`'s table — this run resolves `effort` once at Step 0 (or inherits it from the caller when invoked inline) and passes an explicit `model` override on every dispatch below looked up from there, superseding the agent file's own default without editing it.

| Agent | Model (`high`) | Why |
|-------|-------|-----|
| `coder` | `opus` | (reused) The actual fixes — same bar as story-run batches. |
| `validator` | `haiku` | (reused) Mechanical gate. |
| `reviewer` | `sonnet` | (reused, PR mode) The convergence re-review — same tier as review-run's per-PR pass. |

Triage (step 3) is the orchestrating session's own judgment — no dispatch, no tier.

## Notes

- **The read/write split is the point.** If a future change tempts you to give review-run's agents write access "just this once," the answer is a change to this command instead.
- Never force-pushes; fix commits append to the branch history the reviewers already saw.
- Every subagent ends with a single JSON block; unparseable → re-dispatch once, then treat that stage as failed and escalate — never guess.
- Dispatch names: `coder`, `validator`, `reviewer` (plugin-qualified `sdlc:<name>` on collision).
- **`/code-review` (under `review`) is a Claude Code skill, not one of this plugin's own subagents.** Invoked via the Skill tool (steps 1 and 4e), not the Task tool — it's read-only here (findings only, nothing applied), and its own internal effort/model choices are independent of `skills/model-effort/SKILL.md`'s `effort` tier, which only governs this plugin's own agents.
- **No `--worktree`/`--no-worktree` flags here** — this command never creates or targets a worktree itself, since it always operates on a PR/branch that already exists. It only looks one up (Step 2) from the story's own `story-state.json` and, when present, works inside it.
- See `skills/model-effort/SKILL.md` for the full model-tier table and resolution, and `skills/worktree-mode/SKILL.md` for the full worktree resolution/fallback/recovery logic — this file only describes how review-fix *uses* each.
