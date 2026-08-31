---
description: "Autonomous multi-PR review subsystem: parallel story-PR reviews with cross-ticket compatibility checks, and the sprint-close gate that verifies a sprint is safe to merge to main."
argument-hint: "<PR# ...> [--fix] [--review] [--effort <tier>] | --sprint [id] [--depth spot|full] [--effort <tier>] [--post] [--close] [--technical] [--show-stats] [--resume]"
---

# /sdlc:review-run

Runs reviews at a scope `story-run` can't see: **many PRs at once, and the seams between them.** Orchestrated from this live session (the session is the orchestrator, same as `story-run`), it dispatches one `pr-reviewer` per PR **in parallel**, then a single `integrator` pass over the whole set for cross-ticket compatibility — contract drift between PRs, unmet cross-story obligations, merge-order constraints from Depends-on chains. In `branchModel: sprint` repos it becomes the **sprint-close gate**: it verifies every story that rode the sprint branch, audits the aggregate `main...sprint/<id>` diff as one integration surface, runs the full local quality gate on the sprint head, and renders a `SPRINT_READY`/`HOLD` verdict — optionally opening the sprint→main PR on your explicit say-so. It **never merges anything and never transitions the tracker**: under `branchModel: sprint`, merge approval on `main` belongs to a human teammate by org rule, and closing stories stays with `/sdlc:close-story`. `branchModel: direct` repos have no sprint boundary at all — Mode B doesn't apply there; see that mode below.

> **Where this sits:** per-story PRs are reviewed as they open (Mode A — replaces running `/sdlc:story-check` reviewer-mode N times by hand); in a `sprint`-model repo, at week's end, Mode B is the safety gate in front of `/sdlc:sprint-pr`'s merge. `review-run --sprint` and `sprint-pr` compose: review-run verifies, sprint-pr (or `--close` here) opens the reviewed PR, a teammate approves, a human merges. `branchModel: direct` repos skip Mode B entirely — Mode A is the whole review story there, and merges go straight to `main` via `/sdlc:story-pr`/`/sdlc:close-story`.

## Modes

**Mode A — PR batch review:** `/sdlc:review-run 27 28 29`
Parallel independent reviews of each PR (DoD + correctness + design conformance), then one integration pass across the set. Reports per-PR verdicts and cross-findings; posts GitHub reviews only with `--post` or your one-time batch confirmation. Tracker-and-branch-model agnostic — useful solo on a `direct` repo with no tracker at all, and unchanged on a team `sprint` repo.

**Mode B — sprint-close gate:** `/sdlc:review-run --sprint [id]`
**Only meaningful under `branchModel: sprint`** — everything needed to answer "is this sprint safe to land on main?": story inventory vs. the tracker, per-story verification at `--depth`, aggregate integration audit, local quality gate, sync check against main, and a consolidated verdict. `--close` additionally opens the sprint→main PR when the verdict is `SPRINT_READY`. Under `branchModel: direct`, this mode has nothing to gate — see **Mode B under `branchModel: direct`** below.

## Usage

```
/sdlc:review-run <PR# ...> [--fix] [--review] [--effort <tier>] [--post] [--technical] [--show-stats] [--resume]
/sdlc:review-run --sprint [id] [--depth spot|full] [--effort <tier>] [--post] [--close] [--technical] [--show-stats] [--resume]
```

Arguments arrive as `$ARGUMENTS`. Examples:

```
/sdlc:review-run 27 28 29
/sdlc:review-run 27 28 29 --post
/sdlc:review-run 27 28 29 --effort low
/sdlc:review-run 27 28 29 --review --fix
/sdlc:review-run --sprint 2
/sdlc:review-run --sprint 2 --depth full --close
```

- `<PR# ...>` — one or more story-PR numbers (Mode A). At least one required when `--sprint` is absent.
- `--sprint [id]` — sprint-close gate (Mode B), `branchModel: sprint` only. Id omitted → highest-numbered `sprint/*` on origin; ambiguous → ask. On a `branchModel: direct` repo, this flag stops the run immediately with a plain explanation instead of running the gate — see **Mode B under `branchModel: direct`**.
- `--depth spot|full` — Mode B per-story verification depth (default `spot`): *spot* re-verifies each merged story's completion record and samples its AC evidence; *full* re-runs a complete `pr-reviewer` pass on every merged story PR. Use `full` for high-stakes sprints or when spot checks surface smells.
- `--effort <tier>` — override `.sdlc/config.json`'s `effort` for this run only, per `skills/model-effort/SKILL.md` (`very-low`/`low`/`medium`/`high`/`extra-high`). Omitted → the config's `effort`, or `high` if that's unset too. Applies to either mode — every `pr-reviewer`/`integrator` dispatch below passes an explicit `model` looked up from that skill's table for the resolved tier.
- `--post` — post GitHub reviews/comments without the batch confirmation. Without it, findings are reported in chat first and posted only on your one-time go-ahead **per batch** (never a question per PR).
- `--review` — **Mode A only.** Alongside each PR's `pr-reviewer` pass, also run `/code-review <PR#>` (low/medium effort — high-confidence findings only, same default `/sdlc:story-pr --review` uses) as a second, complementary pass: general correctness/reuse/simplification/efficiency issues, distinct from `pr-reviewer`'s DoD/design-conformance focus. Findings from both merge into the same per-PR set — same severities, same reporting, the same `--post` gate, and (with `--fix`) the same triage; each is just tagged with its source for the audit trail. Runs **sequentially** across the batch, one PR at a time (`/code-review` is invoked inline via the Skill tool, not a parallel Task dispatch like `pr-reviewer`) — adds wall-clock time roughly proportional to the batch size. `/code-review`'s own effort level is independent of this run's `--effort`/`skills/model-effort/SKILL.md` tier — that skill makes its own model choices internally. Default: off. See step 2a.
- `--fix` — **Mode A only.** After the batch report (step 6), chain into the `/sdlc:review-fix` procedure for each not-clean PR **the current developer authored**: triage findings, fix the fixable, push, re-verify — see that command for the full contract (budgets, escalation, hard boundaries). Teammates' PRs and integrator cross-findings are never autofixed — they stay report-only. With `--review` also set, review-fix's own convergence check (its step 4e) also re-runs `/code-review` fresh, not just `pr-reviewer` — passed through, not re-asked. **With `--sprint`, reject the flag with a one-line reason** (auto-committing to a sprint branch during the close gate is not a thing this plugin invites) and run Mode B normally. Review-run itself stays read-only either way: its own agents never write; every code change happens inside the review-fix procedure, behind its gates.
- `--close` — Mode B only: on `SPRINT_READY`, open the sprint→main PR per `/sdlc:sprint-pr` (template body + this run's gate report). Without it, Mode B stops at the verdict.
- `--technical` — keep chat output in the engineer-level voice. **Without it (the default), everything reported to the developer in chat — per-PR verdicts, cross-findings, the sprint gate report, the batch-post confirmation — follows `skills/plain-language/STANDARD.md`**; the GitHub reviews/comments actually posted, the sprint PR body, and tracker mirrors keep their fixed technical form either way. Recorded as `technical` in `review-state.json` at Step 0 init so `--resume` keeps the mode; passing the flag at resume overrides. With `--close`, the mode carries into the inline `sprint-pr` procedure.
- `--show-stats` — auto-publish the fixed-format usage report (per-dispatch model/timing/tokens) as a claude.ai Artifact when the run concludes. Dispatch data is always collected and always snapshotted locally regardless of this flag — forgot to pass it? `/sdlc:show-stats <run-id>` renders the same report on demand, mid-run or after. Default: off (report still exists; it just isn't auto-published). See **Usage statistics** below.
- `--resume` — continue from `docs/stories/_reviews/<run-id>/review-state.json` (completed per-PR reviews are not re-run). `effort` and `review` are both read back from state, not re-resolved — passing `--effort` again is harmless (it just reasserts or deliberately changes it, same as `story-run`); a PR whose step 2a already ran isn't re-run on resume, same as step 2.

## Steps — Mode A (PR batch)

0. **Preflight.** `gh` authenticated; resolve the tracker per `skills/tracker-adapter/SKILL.md` (`.sdlc/config.json`, or detect the registered MCP family and ask — same resolution `story-run` uses); project config resolved from the target repo's `CLAUDE.md` (project key, verify commands, required CI check names, mandatory rules). **Resolve `effort`** per `skills/model-effort/SKILL.md`: `--effort <tier>` if passed, else `.sdlc/config.json`'s `effort`, else `high`. Every `pr-reviewer`/`integrator` dispatch for the rest of this run passes an explicit `model` argument looked up from that skill's table for this tier — not restated at each dispatch below. Initialize `docs/stories/_reviews/<run-id>/review-state.json` (untracked — `docs/stories/.gitignore` covers it; run-id = sorted PR numbers or `sprint-<id>`), recording `effort` and `review` (whether `--review` was passed) in it.

1. **Resolve the review set.** For each PR: `gh pr view --json number,title,author,baseRefName,headRefName,state,mergeable,statusCheckRollup`. Derive each story key from the PR title/branch; when a tracker is configured, fetch its issue (full AC) via the adapter's `get_issue` op; fetch its design note path. Under `tracker: none`, skip the fetch — the AC lives in the design note and/or the PR body, and `pr-reviewer` is told so rather than being handed an empty AC as if it were real. A PR that is closed, already merged (in Mode A), or key-less is reported and dropped from the set — not silently skipped.

2. **Parallel per-PR reviews.** Dispatch one `pr-reviewer` per PR **in a single message** (concurrent Task calls), each with: the PR number, story key + full AC (or design-note/PR-body AC under `tracker: none`), design note path, quoted mandatory repo rules, and required CI check names. Reviewers work from `gh pr diff` + repo reads — **never `gh pr checkout`** (parallel checkouts would fight over the shared working tree). Each returns a structured verdict (`APPROVE`/`REQUEST_CHANGES`/`BLOCKED`), DoD checklist, findings, declared obligations, and Depends-on keys.

2a. **Code-review pass (only with `--review`).** For each PR in the batch, in turn (invoked inline via the Skill tool, not a Task dispatch — these run one at a time, unlike step 2's parallel `pr-reviewer` calls): run `/code-review <PR#>` at low/medium effort. Add its findings into that PR's finding set from step 2, in the same shape (severity, file/line, suggested fix) `pr-reviewer` already produces, tagged with `source: code-review` for the audit trail only — everything downstream (integration, consolidation, posting, triage) treats them identically to `pr-reviewer`'s own findings.

3. **Integration pass (barrier — needs all of stage 2, and 2a when it ran).** Dispatch `integrator` with every reviewer's structured output plus the PR diffs: pairwise contract/schema drift, shared-file conflicts, cross-story obligations (§5 of each design note — declared by one story, honored by its dependents?), and a safe **merge order** derived from Depends-on chains. Cross-findings carry severities like per-PR findings.

4. **Consolidate and report.** Per-PR: verdict + findings. Cross: compatibility verdict + merge order + conflicts, each mapped to the owning story/PR. Anything `BLOCKED` or with BLOCKING cross-findings is called out first.

5. **Post (gated) — the single gate covers both GitHub and the tracker.** With `--post`, or after your one-time batch confirmation: for each PR, submit `gh pr review` (`--request-changes` when there are GAPs/BLOCKING/MAJOR findings, `--approve` only on a clean pass, `--comment` otherwise) with the verdict + findings in the body; line-anchor findings that map to diff lines via the review-comments API. Cross-findings are posted on **every** PR they implicate, cross-referencing the others. **Under that same gate** — never on any other condition — dispatch `scribe` (`REVIEW_NOTES`) to mirror each story's outcome onto its tracker story via the adapter's `add_comment` op; skipped when `tracker: none` (nothing to mirror to). **Without `--post` and without the batch confirmation, nothing external happens at all** — no GitHub review, no tracker comment; findings stay in chat only. Persist outcomes to the state file. Without `--fix`, this is the end of the run: write the local stats snapshot now regardless of `--show-stats`, and if it was passed, also render and publish the Artifact (see **Usage statistics** below). **Nothing under `docs/stories/_reviews/<run-id>/` is deleted** when the batch completes — `review-state.json` and `_stats/` are both already local-only and gitignored, so they're just left as a bonus local reference.

6. **Fix (only with `--fix`).** For each not-clean PR (verdict `REQUEST_CHANGES`/`BLOCKED`, or any BLOCKING/MAJOR finding) **authored by the current developer**, run the `/sdlc:review-fix` procedure inline, **sequentially** (its fix loop checks out the PR's head branch — the shared working tree rule from step 2 applies), passing that PR's reviewer findings directly — `pr-reviewer`'s and, when step 2a ran, `code-review`'s, already merged into one set. Also pass through whether `--review` was set on this run: review-fix's own convergence check (step 4e) then also re-runs `/code-review` fresh, not just `pr-reviewer` — inherited, never re-asked. Skips are explicit in the report: teammate-authored PRs ("report-only — not your PR"), and integrator cross-findings (always escalate, never autofixed). Each PR's outcome (`FIXED_CLEAN`, or `ESCALATE` with residuals) is appended to the state file; its dispatches are recorded in this run's `dispatches[]` — one run, one stats report. The `effort` resolved at Step 0 passes straight through to review-fix's inline dispatches (`assessor`, `coder`, `validator`, `pr-reviewer`) — it is not re-resolved. Then close out as step 5 describes (snapshot, optional Artifact).

## Steps — Mode B (sprint close)

0. **`branchModel` gate.** Read `.sdlc/config.json`. **If `branchModel: direct`, stop immediately** and say plainly: this repo merges story PRs straight to `main`, self-approved — there is no sprint branch and nothing for a sprint-close gate to verify. Point at `/sdlc:story-pr` and `/sdlc:close-story` for the normal merge path, and at Mode A for review coverage on a `direct` repo. Do nothing else — no inventory, no dispatches, no state file. Under `branchModel: sprint`, proceed to Step 1; everything below is unchanged from the team workflow. Before Step 1, also **resolve `effort`** per `skills/model-effort/SKILL.md` (same resolution order as Mode A) and record it in `review-state.json` — every `pr-reviewer`/`integrator` dispatch below passes an explicit `model` argument looked up from that skill's table for this tier.

1. **Inventory the sprint.** Resolve `sprint/<id>`; list the story PRs merged into it (merge commits) and reconcile against the tracker's sprint/cycle board (the adapter's `search` op): every merged story **Done** in the tracker (flag any that aren't), every board story either merged or explicitly out (flag In Progress strays), any open PRs still targeting the sprint branch (they land or get descoped before close — never silently ride or vanish).

2. **Per-story verification at `--depth`.** Parallel `pr-reviewer` dispatches over the merged story PRs — *spot*: completion record exists and its evidence (CI run, merge SHA, AC mapping) checks out; *full*: complete re-review. Discrepancies (completion record claims vs. reality) are BLOCKING.

3. **Aggregate integration audit.** Dispatch `integrator` with the full `git diff main...sprint/<id>`, the sprint's design notes and their §5 obligation matrices, and the per-story results: cross-story compatibility on the *final* combined state (not per-PR snapshots), unmet obligations, contract drift vs. `main`, and integration gaps no per-story test plan covered — with a concrete "what to exercise" list for the sprint PR's integration-verification checklist.

4. **Local quality gate.** Dispatch `validator` with the resolved verify commands against the sprint branch head (single checkout — sequential with step 3's diff reads, after any checkout switch is complete).

5. **Sync check.** Has `main` advanced since the sprint branch was cut? If yes, the verdict can be at most `HOLD: reconcile main first` — per `/sdlc:sprint-pr`, main merges into the sprint branch *before* the PR exists, never inside it. (Note: that reconciliation happens on `sprint/<id>` and is the developer's step — see the hook carve-out note below.)

6. **Verdict.** Consolidate into `SPRINT_READY` or `HOLD` with an itemized blocker list, each mapped to its owning story/PR and a concrete resolution. Print the full gate report. Persist to the state file.

7. **Close (only with `--close`, only on `SPRINT_READY`).** Do what `/sdlc:sprint-pr` does: open the sprint→main PR with the template body, embedding this run's gate report (story inventory, integration findings, quality-gate outcomes, the integrator's "what to exercise" list) — then **stop**. Requesting the teammate review, approving, and merging are human steps; `HOLD` never opens a PR. Write the local stats snapshot now regardless of `--show-stats`, and if it was passed, also render and publish the Artifact, regardless of whether this step actually opened a PR (see **Usage statistics** below). **Nothing under `docs/stories/_reviews/<run-id>/` is deleted** once the report is delivered (or the PR is open).

## Mode B under `branchModel: direct`

`--sprint` bails at Step 0 above with no further action — there is nothing to inventory or gate. This is a deliberate design boundary, not a missing feature: a `direct` repo has no sprint branch, no teammate merge gate, and no aggregate diff to audit as one integration surface. Its review coverage is Mode A (per-PR, as PRs open) and its merge path is `/sdlc:story-pr` → `/sdlc:close-story` straight onto `main`.

## Usage statistics (`--show-stats`)

**Collection is unconditional — it never depends on this flag.** Append a `dispatches[]` entry to `review-state.json` after every subagent dispatch (`pr-reviewer`, `integrator`, `validator`, `scribe`, in either mode; plus `assessor`/`coder` when `--fix` chains into the review-fix procedure) — model tier, the **specific model version** actually running (e.g. "Sonnet 5" — read from the orchestrating session's own environment context at dispatch time, not the tool result; see `skills/run-stats/schema.md`), wall-clock duration, tokens, and tool-call count. An explicit `model` override outside `opus`/`sonnet`/`haiku` (e.g. overriding `pr-reviewer` for a high-stakes PR) records role `other` (one fixed color, never a new hue per override) with `model_version` carrying the specific name. `review-run` has no `phase_history` today — use coarse phase markers (`review`, `integration`, `gate`) for the report's phase timeline, or just the run's own start/end if that's all that's tracked.

At the end of the run (Mode A step 5 / Mode B step 7): **always** write a local JSON snapshot to `docs/stories/_reviews/<run-id>/_stats/review-run-<UTC timestamp>.json` — a subfolder nested inside the same working directory everything else for this run already lives in — **never committed, never pushed**, consistent with this command's existing "nothing is committed to git by this command, ever" invariant (see the schema doc and the Notes section below — none of this needs an exception to that rule, since nothing about it touches git). Nothing in that directory is ever deleted, so `/sdlc:show-stats <run-id>` works even when `--show-stats` wasn't passed — the live `review-state.json` itself is available for it to read, not just the `_stats/` snapshot.

**`--show-stats` controls only automatic publishing:** when passed, also render `skills/run-stats/template.html` (load the `artifact-design` and `dataviz` skills first, per the template's own instructions) filled in from the collected `dispatches[]`, publish it via the Artifact tool, and print the URL in the final report.

## When the human is asked

- **Posting external reviews (and, Mode A, any tracker mirror alongside them)** — once per batch (skipped with `--post`). Reviews on teammates' PRs are outward-facing; the batch confirmation is the only gate, and it covers both destinations together, never one without the other.
- **Opening the sprint→main PR** — only via explicit `--close` or an explicit yes at the verdict.
- **HOLD overrides** — the run never overrides its own `HOLD`; if you want to close anyway, that's your call, made outside the run.
- Everything else — review depth judgments, severity calls, merge-order derivation — is autonomous and lands in the reports.

## State & provenance

- Working state: `docs/stories/_reviews/<run-id>/review-state.json` — untracked (covered by `docs/stories/.gitignore`), persisted per completed per-PR review so `--resume` skips finished work. Left in place after the run completes, same as everything else under that directory — it's a local convenience, not the record of what happened.
- Provenance: **GitHub reviews/comments on the PRs themselves** (the natural home for review records), the gate report embedded in the sprint PR body, and — **Mode A only, under the same `--post`/batch-confirmation gate as the GitHub reviews, never on its own** — a per-story tracker mirror via `scribe`. Mode B never touches the tracker at all (consistent with "never transitions the tracker" — its record of what happened is the gate report in the sprint PR body). Nothing is committed to git by this command, ever.

## Model tiering

The table below is the `high`-tier default — what every agent's own frontmatter already declares, and what a repo with no `effort` configured runs at. For every other tier (`very-low`/`low`/`medium`/`extra-high`), see `skills/model-effort/SKILL.md`'s table — this run resolves `effort` once at Step 0 (both modes) and passes an explicit `model` override on every dispatch below looked up from there, superseding the agent file's own default without editing it.

| Agent | Model | Why |
|-------|-------|-----|
| `pr-reviewer` | `sonnet` | Per-PR review runs N-wide in parallel; sonnet catches DoD/correctness/conformance issues at defensible cost. Override to `opus` at dispatch for high-stakes PRs or `--depth full` sprint audits. |
| `integrator` | `opus` | Cross-ticket compatibility is the highest-judgment task here — it reasons about interactions nobody's individual PR shows. |
| `validator` | `haiku` | (reused) Mechanical gate on the sprint head. |
| `scribe` | `haiku` | (reused, Mode A only, gated by `--post`/batch confirmation) Tracker mirrors of review outcomes. |

## Notes

- **Never merges, never approves its own work, never transitions the tracker.** Under `branchModel: sprint`, the org's no-self-approval rule on `main` is absolute; this system prepares evidence for the human gate, it is not the gate. Under `branchModel: direct`, self-merge onto `main` is the design — but it still stays with `/sdlc:story-pr`/`/sdlc:close-story`, never this command.
- **No `gh pr checkout` in parallel stages.** Reviewers read diffs via `gh pr diff` and code via the current checkout; only Mode B's validator step and step 6's sequential review-fix loops may switch the working tree, alone.
- **Read-only against code, structurally.** Review-run's own agents (`pr-reviewer`, `integrator`) never write; `--fix` doesn't change that — it delegates every write to the `/sdlc:review-fix` procedure and its gates (author-owned PRs only, no sprint branches, cross-findings always escalate). `/code-review` under `--review` is read-only too — it reviews and reports, it doesn't apply anything, here.
- **`/code-review` is a Claude Code skill, not one of this plugin's own subagents.** Invoked via the Skill tool inline in this session (step 2a), not the Task tool — so, unlike `pr-reviewer`, it can't be dispatched in parallel across a batch, and its own internal effort/model choices are entirely independent of `skills/model-effort/SKILL.md`'s `effort` tier, which only governs this plugin's own agents.
- **Hook carve-out required (pre-ship TODO):** `gate-git.js` currently denies *all* commits on `sprint/*`, but reconciling main into the sprint branch (Mode B step 5's prerequisite, and `/sdlc:sprint-pr` step 3) legitimately commits merge resolutions there. Amend the hook to allow commits on `sprint/*` when a merge is in progress (`.git/MERGE_HEAD` exists) — direct work commits stay blocked. This affects `/sdlc:sprint-pr` today, independent of review-run, and only matters on `branchModel: sprint` repos (a `direct` repo has no `sprint/*` branches at all).
- Every subagent ends with a single JSON block; unparseable → re-dispatch once, then report that PR/story as `BLOCKED` — never guess.
- Dispatch names: `pr-reviewer`, `integrator`, `validator`, `scribe`, and — via `--fix` only — `assessor`, `coder` (plugin-qualified `sdlc:<name>` on collision).

