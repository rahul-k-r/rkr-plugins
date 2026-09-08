---
description: "Autonomous full-lifecycle story execution: design (architect-reviewed), plan, implement batch-by-batch, final review, and open the PR — escalating to the human only where judgment genuinely requires it."
argument-hint: "[<KEY>] [--base <branch>] [--worktree <path> | --no-worktree] [--effort <tier>] [--max-retries N] [--max-replans N] [--gate <phase,...>] [--no-gate <phase,...>] [--bypass] [--review] [--incognito] [--technical] [--show-stats] [--resume]"
---

# /sdlc:story-run

Runs the full story lifecycle autonomously — design note (if none exists), story setup, implementation plan, batch-by-batch coding with review and validation, a story-level final review, and the PR to the base branch — orchestrated from this live session using a fixed set of subagents (`agent-plugin/agents/designer.md`, `architect.md`, `intake.md`, `planner.md`, `coder.md`, `reviewer.md`, `validator.md`, `assessor.md`, `scribe.md`), each dispatched fresh via the Task tool so no reviewer or assessor ever inherits the reasoning of the agent it judges. The session itself is the orchestrator (subagents cannot dispatch subagents, and only the session can put a question to the developer), so it operates with the judgment of a highly experienced engineer: it decides what it has evidence for, and it **asks the developer only where judgment is genuinely theirs** — everything else runs unattended. By default it ends by informing the developer that the PR is open and ready for their review; closing the story stays human (`/sdlc:close-story`). With `--bypass`, it instead keeps going — auto-review, merge, and close — see that flag below. With `--incognito` (or whenever no tracker is configured at all), it never pushes automatically — see **`--incognito` and no-ticket runs** below.

> **Where this sits in the chain:** `/sdlc:plan-the-design` (interactive; optional — story-run designs autonomously when no note exists) → **`story-run`** (design + setup + plan + implement + final review + PR) → the developer reviews the PR → merge → `/sdlc:close-story` (and, in `sprint`-model repos, `/sdlc:sprint-pr` at week's end — `direct`-model repos merge straight to `main` and have no sprint boundary to close). The manual equivalent is `/sdlc:story-start` → `/sdlc:commit` → `/sdlc:build-check` → `/sdlc:story-pr` → `/sdlc:story-check`. Without `--bypass`, `story-run` never transitions the tracker past In Progress and never posts a completion record — those stay `close-story`'s job. With `--bypass`, on a clean run it does both, as `close-story` itself, inline (see **`--bypass`: continuing past hand-off**).
>
> All commits during the loop are **local only**; the plugin's PreToolUse hook (`hooks/gate-git.js`) hard-blocks `git push`/`gh pr create` on a story-run-managed branch until the final review passes (`phase: READY_FOR_PR`), so "validated before it leaves the machine" is enforced, not promised. Under `--incognito` (or `tracker: none`) that gate is the *whole* story — the run never pushes itself at all; see below.

## When the human is asked

The run is autonomous by default. It stops and asks the developer (in chat, with the scribe posting an audit copy to the tracker — or to the local provenance file, under incognito) **only** for:

- **Locked-design authority** — any conflict with `DECISIONS.md` or an Accepted ADR, from any agent, at any phase. Never auto-resolved.
- **ADR-threshold open questions** — decisions the designer or architect judges genuinely contestable (high cost of being wrong, no decisive evidence). Small decisions are made autonomously, recorded with their evidence.
- **Budget exhaustion** — retries or replans exceeding their caps.
- **Ambiguity it must not guess at** — e.g. the base branch can't be determined unambiguously, or (no-ticket runs) the local key it inferred needs confirming.

Everything else — plan sign-off, batch verdicts, fix decisions, MINOR-finding dispositions — is decided by the pipeline's own reviewers and recorded in the audit trail. Anything decided autonomously that a human might reasonably want to re-examine is **tagged, not buried**: it lands in the final review notes on the PR and the tracker story (or provenance file).

## Pausing and checkpoints

Every pause — an escalation, or the developer interrupting mid-run — ends with two questions: *what do you want to say/change/clarify*, and *continue now, or save and come back later?* On **save**, checkpoint before stopping:

- Write `docs/stories/<KEY>/checkpoint.md` capturing everything that currently lives only in this chat: the exact phase and sub-step, decisions made so far with their evidence, the designer/architect cycle status and any unresolved findings, answers the developer already gave, the pending question, and the precise next action on resume.
- If `context-pack.md` exists, append a **Run addenda** section with facts discovered since intake that downstream agents will need (code realities, corrected assumptions) — the context pack is their only interface, so post-intake knowledge must land there or it's lost to them.
- Persist the state file with the `checkpoint` block filled, set `phase: PAUSED`.
- Tell the developer: resume any time, **in any chat** — `/sdlc:story-run <KEY> --resume`.

This matters most *early*: before INTAKE there is no context pack and no plan, so a mid-DESIGN pause has no carrier except the state file and checkpoint.md — which is why the state file is initialized in Step 1 and the checkpoint is written on every save, at any phase. The standing rule: **nothing needed to continue the run may exist only in the chat transcript.**

## Usage

```
/sdlc:story-run [<KEY>] [--base <branch>] [--worktree <path> | --no-worktree] [--effort <tier>] [--max-retries N] [--max-replans N] [--gate <phase,...>] [--no-gate <phase,...>] [--bypass] [--review] [--incognito] [--technical] [--show-stats] [--resume]
```

Arguments arrive as `$ARGUMENTS`; positionally, `$1` is the story key. Examples:

```
/sdlc:story-run AGL-42
/sdlc:story-run AGL-42 --base main --max-retries 2
/sdlc:story-run AGL-42 --gate plan,replans
/sdlc:story-run AGL-42 --no-gate design
/sdlc:story-run AGL-42 --bypass --show-stats
/sdlc:story-run AGL-42 --bypass --review
/sdlc:story-run AGL-42 --no-worktree
/sdlc:story-run AGL-42 --worktree .claude/worktrees/agl-42-slug
/sdlc:story-run AGL-42 --effort low
/sdlc:story-run add-dark-mode --incognito
/sdlc:story-run --incognito
/sdlc:story-run AGL-42 --resume
```

- **Key resolution.** Resolve the tracker per `agent-plugin/skills/tracker-adapter/SKILL.md` first. If a tracker is configured and `$1` looks like it, treat it as a real key (resolved from the tracker — never inferred or guessed; translate legacy ticket IDs first). If it doesn't resolve, or `tracker: none`, or no `$1` was given at all, treat this as a **no-ticket run** — see **`--incognito` and no-ticket runs** below for how the key, AC, and provenance are handled.
- `--base <branch>` — the branch to cut from and PR into. Under `branchModel: sprint` (from `.sdlc/config.json`), if omitted, auto-detect the highest-numbered `sprint/*` on origin; **if that is ambiguous or absent, ask — never guess a base branch.** Under `branchModel: direct`, the base is `main` unless overridden — no detection needed, nothing to disambiguate. The resolved base is recorded at branch-cut time and is the PR target.
- `--worktree <path>` / `--no-worktree` — how the story's git/file work is isolated, per `agent-plugin/skills/worktree-mode/SKILL.md`. Default (neither passed): create a fresh `git worktree` at `.claude/worktrees/<key-lower>-slug`. `--worktree <path>` targets an existing one instead of creating it. `--no-worktree` skips worktree isolation entirely, operating directly in the current checkout. Mutually exclusive with each other. This session never calls `EnterWorktree` itself for any of the three — see that skill for why.
- `--effort <tier>` — override `.sdlc/config.json`'s `effort` for this run only, per `agent-plugin/skills/model-effort/SKILL.md` (`very-low`/`low`/`medium`/`high`/`extra-high`). Omitted → the config's `effort`, or `high` if that's unset too.
- `--max-retries N` — per-batch (and final-review) retry budget before escalation (default `4`, i.e. up to 5 attempts per batch).
- `--max-replans N` — replan budget for the whole story before escalation (default `2`).
- `--gate <phase,...>` / `--no-gate <phase,...>` — turn a human gate on/off. Gates and defaults: **`design` on** (approve the finished design note — only reached when the run designs autonomously), **`plan` off** (the `architect`'s PLAN_REVIEW signs off), **`replans` off** (budgeted, architect-reviewed). A cautious run: `--gate plan,replans`; fully hands-off: `--no-gate design`. Inline escalations (locked decisions, panel red lines, budget exhaustion) always happen regardless of gate flags.
- `--incognito` — force `writeMode: incognito` (per `agent-plugin/skills/tracker-adapter/SKILL.md`) regardless of what tracker is configured: every read still happens normally (so context/AC is as good as ever), but every write — comments, status transitions, discovered-work tickets — is redirected to `docs/stories/<KEY>/provenance.md` instead of the real tracker. Also forces the run to stop once its final review passes rather than auto-pushing (see Step 7) — pushing/opening the PR becomes your explicit, manual action. For contributing to a repo you don't own: it never posts anything to a tracker you weren't invited to touch, and never surprises anyone with a PR you haven't personally signed off on first. **Incompatible with `--bypass`** — rejected at Step 0 if both are passed (bypass's whole point is auto-push→merge→close, which incognito exists to prevent). Default: off — but behaves as on automatically whenever `tracker: none` resolves, no flag needed (see below).
- `--technical` — keep chat output in the engineer-level voice. **Without it (the default), everything said to the developer in chat — escalations, gate digests, batch progress, discovered-work triage, the hand-off — follows `agent-plugin/skills/plain-language/STANDARD.md`**; durable artifacts (commits, PRs, tracker comments or provenance entries, design notes, state) keep their fixed technical form either way. Recorded as `technical` in the state file at Step 1 init so `--resume` keeps the mode; passing the flag at resume overrides. The mode cascades into every procedure the run executes inline — the DESIGN phase (design-run's procedure), the verify and PR steps, and under `--bypass` the whole auto-review/CI/merge/close tail — one voice for the entire lifecycle (see the standard's **Cascade** section).
- `--bypass` — after the PR opens (Step 9), keep going instead of stopping: auto-review the fresh PR, auto-fix a not-clean review where the findings are mechanically fixable (the `/sdlc:review-fix` procedure, budget 2 — design-level findings still stop the run), and on a clean pass, wait for CI, merge, and auto-close the story — a full, uninterrupted lifecycle. Every existing escalation point (locked-decision conflicts, budget exhaustion, `--gate`/`--no-gate`, discovered-work triage) is untouched — it still stops for those exactly as today. See **`--bypass`: continuing past hand-off** below. Default: off.
- `--review` — **only meaningful with `--bypass`** (this run never invokes `review-run`/`review-fix` without it, so the flag is otherwise a no-op). Passed straight through to the bypass tail's AUTO_REVIEW step, which runs it as `review-run <PR#> --review` — a `/code-review` pass alongside `pr-reviewer`'s, per `review-run.md`'s step 2a — and, if AUTO_FIX runs, to its inline `review-fix` procedure the same way, so its convergence check re-verifies via `/code-review` too. Recorded in state, read back on `--resume`. Default: off.
- `--show-stats` — auto-publish the fixed-format usage report (per-dispatch model/timing/tokens, phase durations including the design phase) as a claude.ai Artifact at hand-off. Dispatch data is always collected and always snapshotted locally regardless of this flag — forgot to pass it? `/sdlc:show-stats <KEY>` renders the same report on demand, mid-run or after. Composes with `--bypass` — the auto-published report then covers the whole bypassed lifecycle. Default: off (report still exists; it just isn't auto-published). See **Usage statistics** below.
- `--resume` — continue from `docs/stories/<KEY>/story-state.json` per **Resume semantics** below. If a state file exists and `--resume` wasn't passed, ask rather than guess.

## `--incognito` and no-ticket runs

Two situations land here: an explicit `--incognito` on a repo that has *something* readable (a tracker, a GitHub issue) you don't want to write back to, and a repo with no ticketing system in play at all (`tracker: none`) — the "we discussed the plan in this chat" case. Both resolve to `writeMode: incognito`; the difference is only whether a real key/AC exists to read.

- **Local key.** Pass a bare slug as `$1` (e.g. `add-dark-mode`) to use it as a local-only identifier — no tracker lookup is ever attempted against it, it's opaque. Omit `$1` entirely and the run infers a short slug from the plan already discussed in this chat, then **confirms it with you before cutting the branch** (it's the one piece of judgment worth a beat — everything downstream names files and branches off it). Recorded as `local_key: true` in state.
- **Success criteria without a ticket.** When no real tracker key resolved, Step 1 skips the AC fetch and asks you to state the task's success criteria directly — paste them, or point at what was already discussed — and records the answer verbatim as `local_ac`. `story-check`/`close-story` check completeness against this instead of a fetched AC field.
- **Every write goes to `docs/stories/<KEY>/provenance.md`** instead of the tracker: the plan digest, each batch record, escalations, review notes, the completion record — same structured entries `scribe` would otherwise post, just local. It lives under `docs/stories/<KEY>/`, already untracked by the `.gitignore` Step 3 ensures — confirm that's actually in place before pushing anything, since leaking your own working notes into a diff you send to a repo you don't own is exactly what this exists to prevent.
- **The run never pushes itself.** Step 7 stops at `phase: READY_FOR_PR` once the final review is clean, and reports what's ready — rework/consolidate commits as you like, then push and open the PR yourself (or run `/sdlc:story-pr`) when you're ready. `--bypass` is rejected outright at Step 0 in this mode; there is no auto-merge path.
- **Discovered-work triage** (Step 8) never creates or comments on a real ticket — "new story" becomes a local backlog entry in the provenance file instead.

## Steps

0. **Preflight.**
   - **Resolve the tracker and write-mode** per `agent-plugin/skills/tracker-adapter/SKILL.md`: read `.sdlc/config.json` (or detect the registered MCP family and ask, offering to persist the choice). Resolve `writeMode`: `--incognito` passed → `incognito`; else `tracker: none` → `incognito`; else `normal`. **If both `--incognito` and `--bypass` were passed, stop immediately and say why** — they're incompatible. `tracker: none` is never itself a reason to stop; it just means every write for this run goes local (see **`--incognito` and no-ticket runs**).
   - **Resolve `effort`** per `agent-plugin/skills/model-effort/SKILL.md`: `--effort <tier>` if passed, else `.sdlc/config.json`'s `effort`, else `high`. Every subagent dispatch for the rest of this run passes an explicit `model` argument looked up from that skill's table for this tier — not restated at each dispatch below.
   - **Resolve worktree mode** per `agent-plugin/skills/worktree-mode/SKILL.md`: `--worktree <path>` / `--no-worktree` / default (create one). This session never calls `EnterWorktree` for any of the three modes — worktree creation, when it happens, is a plain `git worktree add`, and every git/file operation that needs to reach it does so via path-qualified commands, never a session-level directory change. Resolved here but *applied* in Step 1, once the branch/key are known (the worktree's directory name needs the slug).
   - **Resolve `local_docs`** per `agent-plugin/skills/local-docs/SKILL.md`: `.sdlc/config.json`'s `localDocs`, default `false`. `true` changes where design notes/ADRs live (session's own root, never the worktree) and means Step 2 never stages or commits them — see that step.
   - **Node.js on PATH** — the plugin's hooks (push gate, protected-branch guards, state validation, session announcements) are Node scripts.
   - **`gh` authenticated** — the run ends by opening a PR (unless incognito); check early, not at Step 7.
   - **Resolve project config from the target repo** and hold it for every dispatch:
     - *Project key & conventions* from `CLAUDE.md` (default: branch `feat|fix|chore/<key-lower>-<slug>`, commit subject `<KEY>: <imperative summary>`).
     - *Verify commands* from `CLAUDE.md` or stack defaults (Go: `go build ./...` · `go vet ./...` · `go test ./... -race -count=1` · `golangci-lint run`; Python: `ruff check .` · `ruff format --check .` · `mypy .` · `pytest` in the repo's environment; React/Next: `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` with the repo's actual package manager. Mixed repos run every applicable gate). If undocumented, confirm the defaults with the user.
     - *Mandatory repo rules* (the `CLAUDE.md` conventions / Do-NOT sections), quoted verbatim into the context pack.
     - *Branch model* (`sprint`/`direct`) from `.sdlc/config.json` — governs base-branch resolution (Step 1) and the `--bypass` merge guard.
     - *Required CI check names* from `CLAUDE.md` (same resolution `review-run`/`story-check` already do) — only needed with `--bypass`, whose CI-wait step (below) polls these by name; confirm with the user if undocumented and `--bypass` was passed.

1. **Story setup.** If a real tracker key resolved in Step 0, fetch the issue (full AC) and confirm it's a real story in the tracker's project and not Done. Otherwise (no-ticket run), skip the fetch — resolve the local key and `local_ac` per **`--incognito` and no-ticket runs** above. Initialize `story-state.json` immediately (phase `DESIGN`, plus `tracker`, `write_mode`, `local_key`) — every later pause needs somewhere to persist, including pauses before any other artifact exists.

   **Assignment check (typo guard) — runs only when a real tracker key resolved; skipped entirely for a local key (nothing to assign).** Resolve the triggering developer's own tracker account (`get_current_user`, per the adapter) and compare it to the issue's assignee:
   - *Assigned to them* → proceed.
   - *Unassigned* → show the issue summary and ask: **assign it to you and add it to the active sprint/cycle?** On yes, assign the issue and add it (`add_to_cycle`); on no, stop — an unassigned key is the classic typo signature.
   - *Assigned to someone else* → show the summary and current assignee, and require a **second explicit confirmation plus a one-line reason**. On confirm: reassign, and record the reassignment (previous assignee → new assignee, the reason, triggered by story-run) via the tracker's write op — or the provenance file, under incognito — a takeover is never silent. On decline, stop.

   Then resolve the base branch (see `--base`), sync it (`git fetch origin && git switch <base> && git pull --ff-only`). **Apply worktree mode** (resolved at Step 0, per `agent-plugin/skills/worktree-mode/SKILL.md`): default → `git worktree add .claude/worktrees/<key-lower>-slug -b <branch> <base>`; `--worktree <path>` → verify it's a registered worktree (`git worktree list`) on the right branch, use as-is; `--no-worktree` → cut/confirm the branch directly in the current checkout, same as the plugin's original behavior. Record `branch`, `base_branch`, and `worktree` (the absolute path, or `null` under `--no-worktree`) in the state file. **From here on, every git operation and every file this run commits — code, tests, design notes, ADRs — target `worktree` when it's non-null**, via `-C`/`cd`-qualified commands and absolute paths, never by changing this session's own working directory. **`docs/stories/<KEY>/` is the one exception**, always resolving relative to this session's own root regardless of `worktree`, because this session never leaves it and it's never committed to any branch anyway.

   **If `worktree` is non-null, `local_docs` is `false`, and `docs/design-notes/<KEY>.md` (and/or `docs/adr/`) already exist at this session's own root** — the interactive `/sdlc:plan-the-design` case, since that command runs before a branch or worktree necessarily exists — copy them into the worktree's directory now, before anything tries to commit them there. Nothing downstream (Step 2's existence check, `intake`, `close-story`'s §7 check) should ever need to look in two places for the same file; from this point on the worktree's copy is the only one that matters for anything that gets committed. **Under `local_docs: true`, skip this entirely** — per `agent-plugin/skills/local-docs/SKILL.md`, design notes/ADRs always stay at the session's own root regardless of `worktree`, since nothing ever commits them; also ensure `docs/design-notes/.gitignore` and `docs/adr/.gitignore` exist (bare `*`, same as `docs/stories/.gitignore`) if `/sdlc:init` hasn't already created them.

   Transition the issue to In Progress via the tracker's write op — skipped under `writeMode: incognito` (recorded as a provenance entry instead: "would have transitioned `<key>` to In Progress"); skip also if already In Progress (the transition tool's inline `comment` parameter requires ADF — transition without it). If the developer already ran `/sdlc:story-start`, detect it (branch matches, issue In Progress, `worktree` already resolved the same way) and skip the setup — but never the assignment check.

   **If this session is itself already isolated inside an entered worktree** (the developer used `EnterWorktree` or the VS Code extension's equivalent before invoking this command) — detected by a write to this session's own `docs/stories/` failing with an isolation rejection — don't stop. Redirect all of this run's `docs/stories/<KEY>/` writes to the worktree's own copy instead, note it once in the state file and in the hand-off, and proceed. Recovering it into main is `--resume`'s job the next time this story is resumed from a main-rooted session (see **Resume semantics**), not something this run can do to itself.

2. **DESIGN** (`phase: DESIGN`).
   - **A design note from an interactive `/sdlc:plan-the-design` session always wins.** Check `docs/design-notes/<KEY>.md` at its resolved location — the session's own root under `local_docs: true`, `worktree` otherwise (already copied there in Step 1 if it existed only at main). If it exists and passes the substantive checks (§1/§3/§5 filled — same checks as `story-start`), record `design.source: "interactive"` and skip to INTAKE. If it exists but is hollow, stop and tell the developer to finish it — don't silently redesign over a half-deliberated note.
   - Otherwise, **do what `/sdlc:design-run` does** (it is this phase, standalone — one canonical procedure, defined there): FRAME (designer frames scope + design issues, architect validates the issue list) → DELIBERATE (parallel `panelist` lens panel on high-stakes issues; designer-with-evidence on minor ones) → SYNTHESIZE (consensus rules: convergent → decide with dissents recorded verbatim; split/red-lined on high-stakes, or any locked-decision conflict → escalate to the developer) → DRAFT (full note + ADR scaffolds, written directly under the resolved location above — the `designer`/`architect`/`panelist` dispatches are told that working root explicitly, same as `coder`'s) → `architect` `DESIGN_REVIEW` (revise budget 2, then escalate) → the **design gate** (on by default; `--no-gate design` skips — inline escalations happened regardless).
   - On approval: **under `local_docs: false`**, commit the design artifacts yourself — `git -C <worktree> add docs/design-notes/<KEY>.md docs/adr && git -C <worktree> commit -m "<KEY>: add design note (design-run, architect-approved)"` (drop `-C <worktree>` under `--no-worktree`). **Under `local_docs: true`, skip staging/committing entirely** — the files stay on disk at the session's own root, exactly as `agent-plugin/skills/local-docs/SKILL.md` describes; there is nothing to add or commit. Either way, record `design.source: "autonomous"` plus the deliberation and review history in the state file. **The design note and any threshold ADRs must exist and be complete before a line of implementation — no exceptions** (committed too, unless `local_docs: true`).

3. **INTAKE** (`phase: INTAKE`). First ensure `docs/stories/.gitignore` exists containing `*` — everything under `docs/stories/` is **untracked working state**, never committed and never part of the story's diff; provenance lives in the tracker comments the scribe posts (or `provenance.md`, under incognito). Then dispatch `intake` with the story key (or local key + `local_ac`) and project config. It assembles `docs/stories/<KEY>/context-pack.md` read-only. `BLOCKED` (a *referenced* decision/ADR doesn't resolve) → stop and surface exactly what's missing; broken or missing referenced artifacts are never worked around.

4. **PLAN** (`phase: PLAN`). Dispatch `planner` with the context pack; it writes `docs/stories/<KEY>/plan-summary.md` and the `plan` block. Initialize `story-state.json` with the plan.

   **Plan sign-off:** by default, dispatch `architect` with directive `PLAN_REVIEW`. APPROVE → record `gates.plan: {status: APPROVED, mode: architect}` and proceed. REVISE → back to `planner` (2-cycle budget, then escalate). ESCALATE → ask the developer. With `--gate plan`, show `plan-summary.md` to the developer instead and proceed only on explicit approval (`mode: human`). Either way, dispatch `scribe` with `PLAN_APPROVED` to post the plan digest (subtask/batch table, approval mode) — to the tracker story under normal write-mode, to `provenance.md` under incognito; that record is the plan's provenance either way — `plan-summary.md` itself is ephemeral working state.

5. **IMPLEMENT LOOP** (`phase: IMPLEMENT`). For the next batch with `status != DONE`:

   ```
   coder(batch) ──> reviewer(diff) ──> validator(gate) ──> assessor(all outputs)
        ▲                                                        │
        │ RETRY (fix-list, same batch, attempt+1)                │ verdict
        │◄───────────────────────────────────────────────────────┤
        │ REPLAN ──> planner (remaining subtasks only)           │
        │ ESCALATE ──> ask developer; scribe posts audit copy    │
        │ PROCEED ──> next batch (last one → FINAL REVIEW)       │
   ```

   a. If this is the batch's **first** attempt, record `git rev-parse HEAD` in `batch_base_shas[<batch>]` — fixed for the life of the batch so retries are reviewed cumulatively. Dispatch `coder` with the batch spec (and, on retry, the assessor's fix-list). It commits locally, one commit per subtask, staging only files it touched — never pushes, never stages `docs/stories/`.
   b. Dispatch `reviewer` with `git diff <batch_base_sha>..HEAD` and the context pack only — **not** the coder's summary or reasoning. (`docs/stories/` is untracked, so the diff is pure implementation.)
   c. Dispatch `validator` with the resolved verify commands.
   d. Dispatch `assessor` with the plan, batch spec, coder output, reviewer findings, validator results, and the budgets.
   e. Append the `batch_results` entry and persist the state file (disk only — never committed).
   f. Dispatch `scribe` with `BATCH_COMPLETE` — this record (subtasks, verdicts, any escalation decision resolved since the last one) is the batch's provenance, posted to the tracker or appended to `provenance.md` per `write_mode`. On `FAILED`, record the error in the batch's `scribe` field, tell the developer at hand-off, and continue — but since this record is the provenance, more than one consecutive failure is worth an escalation rather than a silent gap in it.
   g. Act on the verdict:
      - **PROCEED** — mark the batch `DONE`, advance; after the last batch → FINAL REVIEW.
      - **RETRY** — increment `retries_used[batch]`; over budget → ESCALATE. Otherwise re-run from (a) with the fix-list (same base sha).
      - **REPLAN** — increment `replans_used`; over budget → ESCALATE. Otherwise `planner` re-decomposes the remaining subtasks; new batches get **fresh numbers, never reusing a dead batch's number** (retry budgets are keyed by batch number). Architect PLAN_REVIEW applies to the revised plan; `--gate replans` routes it to the developer instead. A rejection is an ESCALATE.
      - **ESCALATE** (including any coder `DESIGN_CONFLICT` — always an escalation, never a replan) — append to `escalations[]`, dispatch `scribe` with `ESCALATION`, ask the developer in chat (answer now, or save and come back later — see **Pausing and checkpoints**) and wait. If they save, or the session ends unanswered, checkpoint and set `phase: PAUSED`; `--resume` picks it up in any chat. The developer's decision is recorded and injected verbatim into the next coder/planner dispatch.

6. **FINAL REVIEW** (`phase: FINAL_REVIEW`) — the story-level pass the batches can't see.
   a. Dispatch `reviewer` with the **whole-story diff** `git diff <base_branch>..HEAD`, the context pack, and the design note, framed as a final story-level review: every acceptance criterion demonstrably implemented *and* tested, design conformance across batch boundaries, cross-batch interactions no single batch review could see.
   b. Dispatch `validator` with the full gate.
   c. Dispatch `assessor` with the results. **RETRY** → `coder` fixes (budget: `max_retries` for this phase, then escalate), then re-run (a)–(c). **ESCALATE** → as in Step 5g. **PROCEED** →
   d. **Fill design note §7 (Implementation Findings):** append material deviations, discoveries, and assumptions made during the run — sourced from `batch_results` and coder summaries — or "no material deviations." Under `local_docs: false`, commit it (`-C <worktree>` when set); under `local_docs: true`, just save it — nothing to commit. (`/sdlc:close-story` checks §7, at its resolved location either way; an autonomous run doesn't get to skip the artifact obligations a human run has.)
   e. **Collect the review notes:** every item that deserves a reviewer's deeper look — whether that reviewer is a human or a `/sdlc:review-run` pass — carried-forward MINOR findings, accepted-with-caveat decisions, assumptions the run made under its own judgment (from the designer's evidence list, assessor rationales, and reviewer notes). Store them in `final_review.notes`. Set `phase: READY_FOR_PR`, persist.

7. **PUSH + PR** (`phase: READY_FOR_PR` → `PR_OPENED`).
   - **Under `writeMode: incognito`, stop here instead of pushing.** Report: batches completed, final review clean, branch `<branch>` ready at its current commits. Invite the developer to rework or consolidate commits before pushing, and tell them `/sdlc:story-pr` (or a manual `git push` + `gh pr create`) is theirs to run when ready — that action *is* the explicit go-ahead this mode exists to require, so nothing here needs to gate it further. `phase` stays `READY_FOR_PR` (already a legitimate "may push" phase in `gate-git.js`'s `PUSH_OK` set). Skip to Step 8.
   - Otherwise: push the branch (`git push -u origin <branch>`, `-C <worktree>` when set) and open the PR: `gh pr create --base <base_branch> --title "<KEY>: <summary>" --body <body>` (same worktree-qualified form) using the `/sdlc:story-pr` body template — AC checklist with evidence, test plan with real outcomes, required CI checks. Add an **Audit trail** line pointing at the design note (and ADRs) in the diff and the provenance record (tracker comments, or `provenance.md`) on the story.
   - Post the review notes from 6e as a PR comment (line-anchored via the review-comments API where a note maps to a diff line; otherwise one summary comment), and dispatch `scribe` with `REVIEW_NOTES` to mirror them onto the tracker story.
   - Record `pr: {number, url, base}`, set `phase: PR_OPENED`, persist.

8. **Discovered-work triage.** Throughout the run, the orchestrator accumulates `discovered_work` in the state file from every source — coder discoveries, reviewer findings judged out-of-scope, assessor carry-notes, designer open items deferred as future work. Now research each item before presenting it: when a real tracker is in normal write-mode, search it for existing tickets that already cover it (by symptom, package, and key terms — including the story's Depends-on neighbors); skip the search when `tracker: none` or the key is local — nothing to search. Present every item with options and a recommendation:
   - **New story** — nothing existing covers it; provide a draft summary + AC skeleton and the evidence. Under incognito, this becomes a local backlog entry in `provenance.md` instead of a real ticket.
   - **Comment on an existing ticket** — name the ticket found and why it's the right home. Not offered under incognito (nothing gets written to a real ticket).
   - **Drop** — with the reason it isn't worth tracking.
   The developer decides per item — **tickets are never created without their explicit choice.** On their decision: create the issue (linked to this story, backlog unless they say otherwise) or post the comment — or, under incognito, append the equivalent entry to `provenance.md` — and record the resolution in the hand-off summary.

9. **Hand off.** Print: the PR URL (or, under incognito, the branch and how to push it), subtasks completed, commits, budgets consumed, the design decisions made autonomously (with evidence pointers), the review notes, the discovered-work resolutions, and any scribe failures (gaps in the tracker/provenance record the developer should know about).

   **Unless `--bypass` was passed, stop here** — this is the run's normal ending: write the local stats snapshot now regardless of `--show-stats` (see **Usage statistics** below), and if `--show-stats` was passed, also render and publish the Artifact. **Nothing under `docs/stories/<KEY>/` is deleted** — `story-state.json`, `context-pack.md`, `plan-summary.md`, `checkpoint.md`, `provenance.md` (if written), and `_stats/` all stay; every file there is already local-only and gitignored, so there's no cleanup to do. (The phase stays `PR_OPENED` in normal write-mode — which `session-start.js` already treats as done, so it won't be announced as in-flight on a later session — or `READY_FOR_PR` under incognito, which `session-start.js` correctly *keeps* announcing as in-flight until you push, since it genuinely isn't finished yet.) Provenance for the *record of what happened* remains the tracker comments (plan digest, batch records, escalations and decisions, review notes) or `provenance.md`, plus the committed design note/ADRs — the working files are just left in place as a bonus local reference, not relied on as the source of truth. Tell the developer the PR is ready for review — theirs or a `/sdlc:review-run` pass — recommending the flagged notes first; if `--show-stats` wasn't passed, mention `/sdlc:show-stats <KEY>` is still available to render the report. **Stop.** Merging, `/sdlc:story-check` in reviewer hands, and `/sdlc:close-story` remain theirs. (Incomplete runs — `PAUSED` or mid-phase — keep their state for `--resume`, same as always.)

   **With `--bypass`:** don't delete state and don't stop — continue into **`--bypass`: continuing past hand-off** below. (Unreachable under incognito — rejected at Step 0.) (The stats snapshot is written, and the Artifact published if `--show-stats` was passed, once at the very end of the bypass tail instead, so either covers the whole lifecycle — see that section.)

## `--bypass`: continuing past hand-off

Additive at the tail only — nothing above this point changes. Every escalation point already documented (locked-decision conflicts, budget exhaustion, ambiguity, `--gate`/`--no-gate`, Step 8's discovered-work triage requiring the developer's explicit per-item choice) still stops the run exactly as it does today. What `--bypass` adds is a continuation past Step 9's hand-off, through an auto-review → auto-fix (when needed) → CI-wait → merge → auto-close tail, stopping immediately — the same way an escalation stops — the moment any of the following becomes true:

- the auto-review verdict isn't clean (`REQUEST_CHANGES`/`BLOCKED`, or any BLOCKING/MAJOR finding) **and the AUTO_FIX loop couldn't converge it** — its triage escalated everything, its budget ran out, or a fix hit a `DESIGN_CONFLICT`,
- a required CI check comes back red,
- under `branchModel: sprint`, the base branch is `main` (no sprint branch in use for this merge) — merging there needs a teammate's approving review; **`--bypass` never self-approves onto `main` in a `sprint`-model repo**, matching `sprint-pr.md`'s and `review-run.md`'s "no self-approval, ever, on main" rule there. Stop and hand off exactly as `story-pr.md` already does ("say plainly that a teammate approving review is required before merge"). **Under `branchModel: direct`, `main` is the expected base and self-merge is allowed** — that's the whole point of a `direct` repo having no second human in the loop; see the merge step below.

1. **AUTO_REVIEW** (`phase: AUTO_REVIEW`). Run `review-run`'s Mode A procedure against the PR just opened, as `review-run <PR#> --review` when this run's own `--review` was set (otherwise without it) — a single-PR set, so its integrator cross-ticket pass is a no-op with nothing to compare against and is skipped, and with `--review`, step 2a's `/code-review` pass runs too, merged into the same finding set. Since the developer explicitly opted into "uninterrupted" via `--bypass`, treat the usual one-time batch-post confirmation as pre-authorized: post the review automatically rather than pausing for it. Record `auto_review: {verdict, findings, posted_at}`.
   - **Clean** (`APPROVE`, no BLOCKING/MAJOR) → continue to 2.
   - **Not clean** → continue to 1a — the fix loop gets first crack before anything stops.

1a. **AUTO_FIX** (`phase: AUTO_FIX`). Run the `/sdlc:review-fix` procedure inline against the findings just recorded (see that command for the full contract — triage rules, loop mechanics, hard boundaries) — with this run's `review` state passed through the same way, so review-fix's own convergence check (its step 4e) also re-runs `/code-review` fresh when set, not just `pr-reviewer`. This tail is review-fix's best case: `context: full` (the design note, context pack, and locked decisions all live in this run), so the assessor triages at full strictness rather than the mechanical-only fallback. Budget: **2 fix attempts for the whole tail**, tracked as `auto_review.fix_attempts` — attempts spent before a pause stay spent on resume. The phase is what legalizes the loop's pushes: `gate-git.js` allows `git push` at `AUTO_FIX` (and nowhere else in the tail). Its dispatches (`assessor`, `coder`, `validator`, `pr-reviewer`) append to this run's `dispatches[]` — one run, one stats report.
   - **`FIXED_CLEAN`** → record it in `auto_review` and continue to 2. Review-fix's own fresh convergence re-review *is* the clean AUTO_REVIEW pass — don't run a third.
   - **`ESCALATE`** (all-escalate triage, budget exhausted, or a coder `DESIGN_CONFLICT`) → report what was fixed (commits pushed so far stand) and what remains with the assessor's reasoning, checkpoint `phase: AUTO_REVIEW`, and stop — the same hand-off as before, now with the fix attempts on the record. (`--resume` re-runs the review fresh, since the developer's fixes will have changed the diff.)

2. **AWAITING_CI** (`phase: AWAITING_CI`). Poll the PR's required checks (the CI check names resolved in Step 0) with an until-loop rather than a tight sleep loop, up to a bounded timeout (default 20 minutes).
   - **Green** → continue to 3.
   - **Red** → report the failing check verbatim (never fabricate a result) and stop; this is exactly the kind of thing "a human review was required" covers.
   - **Still pending at the timeout** → this isn't an escalation (there's no question to ask, just time to let pass): checkpoint `phase: AWAITING_CI` and stop; `--resume` re-polls.

3. **Merge.** Guard, always: under `branchModel: sprint`, the base branch must be a `sprint/*` branch (self-approval legitimately allowed per the sprint model documented in `close-story.md`/`story-check.md`) — if base is `main`, stop per the boundary above instead of merging. Under `branchModel: direct`, `main` is the expected base — proceed. Either way, once past the guard, `gh pr merge` using the repo's documented merge-method convention (or ask once if genuinely undocumented, same pattern as verify-command resolution). This is the plugin's first-ever autonomous merge — log it loudly: print exactly what was merged (PR#, head SHA, method, target branch) before moving on. Record `merge: {sha, method, merged_at}`, set `phase: MERGED`, persist.

4. **Auto-close.** Do what `/sdlc:close-story` does, inline — same pattern Step 2 already uses to reuse `design-run`'s procedure: verify the DoD with a fresh `story-check` audit (the guard for reusing a cached one doesn't apply — this conversation ran `review-run`'s procedure, not `story-check`'s), confirm merged (true, per step 3), fill and post the completion record, transition the tracker to Done, report unblocked tickets. Write the local stats snapshot now regardless of `--show-stats` (covering the whole bypassed lifecycle — design through merge), and if `--show-stats` was passed, also render and publish the Artifact (see **Usage statistics** below). Set `phase: CLOSED`, persist, and stop — this is the tail's real terminal state (distinct from `MERGED`, which still means "merge happened, Auto-close may not have finished" for `--resume` purposes). Nothing under `docs/stories/<KEY>/` is deleted, same as Step 9's non-bypass ending.

## Usage statistics (`--show-stats`)

**Collection is unconditional — it never depends on this flag.** Append a `dispatches[]` entry to `story-state.json` after **every** subagent dispatch across the whole run — Steps 2 through 7's `designer`/`architect`/`panelist`/`intake`/`planner`/`coder`/`reviewer`/`validator`/`assessor`/`scribe`, and, under `--bypass`, the `pr-reviewer` dispatch(es) in the AUTO_REVIEW step too — model tier, the **specific model version** actually running (e.g. "Opus 4.8" — read from the orchestrating session's own environment context at dispatch time, not from the tool result; see `agent-plugin/skills/run-stats/schema.md`), wall-clock duration, tokens, and tool-call count, all already visible in that dispatch's own tool result (except the version, which the session already knows about itself). If a dispatch was given an explicit `model` override outside `opus`/`sonnet`/`haiku` (per the Model tiering table's own "pass a model override" note), record its role as `other` — one fixed color, never a new hue per override model — with `model_version` carrying the specific name. Phase timing needs nothing new — `phase_history[].started`/`.ended` already covers every phase including `DESIGN`, so "how much did the design phase take" is already answerable without new tracking. Collecting this costs nothing extra to dispatch — it's bookkeeping on data already in hand — so there's no reason to gate it behind a flag nobody remembers to pass.

At the point the run actually ends — Step 9 (or, under `--bypass`, the end of Auto-close) — **always** write a local JSON snapshot to `docs/stories/<KEY>/_stats/story-run-<UTC timestamp>.json` — a subfolder nested inside the same directory everything else for this run already lives in — **never committed, never pushed**, same as every other file under `docs/stories/` (see the schema doc for exactly why and what it contains). Nothing under `docs/stories/<KEY>/` is ever deleted (see Step 9), so `/sdlc:show-stats <KEY>` works even when `--show-stats` wasn't passed — the live `story-state.json` itself is available for it to read, not just the `_stats/` snapshot.

**`--show-stats` controls only automatic publishing**, not collection: when passed, also render `agent-plugin/skills/run-stats/template.html` (load the `artifact-design` and `dataviz` skills first, per the template's own instructions) filled in from the collected `dispatches[]` and `phase_history`, publish it via the Artifact tool, and print the URL in the hand-off — at that same point, right before writing the snapshot. Without the flag, the snapshot (and, while the run is still live or paused, `story-state.json` itself) is all `/sdlc:show-stats <KEY>` needs to render the identical report later, on demand.

## Resume semantics

`--resume` first **locates** `docs/stories/<KEY>/story-state.json`, per `agent-plugin/skills/worktree-mode/SKILL.md`: check this session's own root (main) first — the common case. Not found there → run `git worktree list` and check each registered worktree's `docs/stories/<KEY>/` for a match; found in one → **copy** the whole `docs/stories/<KEY>/` directory into main, then continue from the copy. This is what recovers a run that got trapped writing to a worktree's own copy because the developer had already entered it (see Step 1) — it only happens once someone resumes from a main-rooted session after exiting (`ExitWorktree keep`), not automatically at any earlier point.

Once located, read `story-state.json` — and, whenever the `checkpoint` block is filled, `checkpoint.md` first: it names the exact sub-step to continue from and carries the context that never made it into formal artifacts. `write_mode`, `tracker`, `local_key`, `effort`, `worktree`, and `local_docs` are read back from state, not re-derived — a repo's tracker/effort config could have changed between sessions, but the run stays consistent with what it started as. (Passing `--incognito` again at resume is harmless; there's no supported way to *un*-incognito a resumed run, since earlier writes may already have gone local only — start a fresh run instead if the tracker situation genuinely changed. Passing `--effort` again at resume *does* change it, deliberately — see the state-schema note above.) Resume works in a brand-new chat by design. Then act by phase:

- **`DESIGN`** — if the note draft exists but wasn't architect-approved, resume at the pending review/revision cycle; unanswered `open_questions` are re-asked.
- **`INTAKE`** — re-dispatch intake fresh (read-only, idempotent).
- **`PLAN`** — resume at the pending sign-off (architect or human per flags); never re-plan silently.
- **`IMPLEMENT` (died mid-batch)** — **keep commits, drop the dirty tree**: completed subtask commits stand; discard uncommitted work (`git reset --hard HEAD`) — it's unverified and of unknown intent; re-dispatch the coder with the batch spec plus the commits already made (`git log <batch_base_sha>..HEAD --oneline`). Review still diffs from the batch's fixed base, so nothing escapes cumulative review.
- **`PAUSED` (escalation)** — the decision channel of record is **chat**: ask for the decision (the tracker comment, or provenance entry, is the notification/audit copy), record it (`decision`, `decided_at`), inject it verbatim, continue.
- **`FINAL_REVIEW`** — re-run Step 6 from (a); it's idempotent over the current HEAD.
- **`READY_FOR_PR`** — go straight to Step 7 (which itself stops again immediately if `write_mode` is `incognito` — nothing new to resume there beyond re-reporting readiness). **`PR_OPENED`** — if `bypass` is `false` on the state file, report the PR URL and stop; the run is complete. If `bypass` is `true`, continue into the `--bypass` tail at step 1 (AUTO_REVIEW) — the PR was opened but the tail hadn't started (or didn't finish) before the session ended.
- **`AUTO_REVIEW`** (bypass tail) — re-run the review pass fresh; the developer's fixes since the last attempt will have changed the diff, so nothing here is safe to reuse from before the pause.
- **`AUTO_FIX`** (bypass tail, died mid-fix) — same recovery as a mid-batch death: keep commits, drop the dirty tree (`git reset --hard HEAD` — uncommitted fixes are unverified), then re-enter the tail at AUTO_REVIEW with a fresh review; `auto_review.fix_attempts` already spent stay spent against the budget of 2.
- **`AWAITING_CI`** (bypass tail) — re-poll the required checks; no other state changed while paused.
- **`MERGED`** (bypass tail) — the merge already happened; skip straight to Auto-close (step 4). Before reposting the completion record, check whether one was already posted for this merge SHA — writes aren't idempotent, so don't duplicate it on resume.
- **`CLOSED`** (bypass tail) — the story is already closed; report that and stop. Nothing to resume — this is the tail's genuine terminal state, distinct from `MERGED`.

## State schema

`docs/stories/<KEY>/story-state.json` — **untracked working state** (kept out of git by `docs/stories/.gitignore`), persisted to disk after every phase transition and every batch so `--resume` survives a dead session. Left in place after the run completes (`PR_OPENED`/`READY_FOR_PR`/`CLOSED`) — nothing under `docs/stories/<KEY>/` is deleted — but it's a local convenience, not the record of what happened: provenance is the tracker comment trail the scribe posts (plan digest, per-batch records, escalations with their decisions, review notes) — or `provenance.md`, under incognito — plus the committed design note and ADRs.

```json
{
  "story_key": "<KEY or local slug>",
  "schema_version": 4,
  "tracker": "jira|linear|none",
  "write_mode": "normal|incognito",
  "local_key": false,
  "local_ac": "verbatim success criteria — present only when local_key is true or tracker is none",
  "provenance_file": "docs/stories/<KEY>/provenance.md — present once write_mode has redirected at least one write there",
  "branch_model": "sprint|direct",
  "effort": "very-low|low|medium|high|extra-high",
  "worktree": "absolute path, or null under --no-worktree",
  "local_docs": false,
  "phase": "DESIGN|INTAKE|PLAN|IMPLEMENT|FINAL_REVIEW|READY_FOR_PR|PR_OPENED|AUTO_REVIEW|AUTO_FIX|AWAITING_CI|MERGED|CLOSED|PAUSED",
  "branch": "feat/<key-lower>-slug",
  "base_branch": "main, or sprint/<id> under branchModel: sprint — resolved at branch cut; the PR target",
  "bypass": false,
  "review": false,
  "incognito": false,
  "technical": false,
  "phase_history": [
    {"phase": "DESIGN", "started": "...", "ended": "...", "outcome": "APPROVED"}
  ],
  "dispatches": [
    {"seq": 1, "phase": "DESIGN", "agent": "designer", "mode": "framing", "model": "opus", "model_version": "Opus 4.8",
     "attempt": 1, "duration_ms": 45210, "tokens": 12500, "tool_uses": 6, "outcome": "DRAFTED"}
  ],
  "design": {
    "note_path": "docs/design-notes/<KEY>.md",
    "source": "interactive|autonomous",
    "reviews": [{"attempt": 1, "verdict": "APPROVE", "findings": []}],
    "adrs": []
  },
  "context_pack": "docs/stories/<KEY>/context-pack.md",
  "project_config": {
    "verify_commands": ["..."],
    "commit_convention": "<KEY>: <imperative summary>",
    "stacks": ["go|python|react-next"]
  },
  "plan": {
    "approved_at": "...",
    "subtasks": [
      {"id": "ST-1", "title": "...", "acceptance": ["..."], "batch": 1,
       "risk": "DESIGN_SENSITIVE|null", "status": "PENDING|IN_PROGRESS|DONE", "commits": []}
    ]
  },
  "current_batch": 1,
  "batch_base_shas": {"1": "<HEAD sha before the batch's first attempt — fixed across retries>"},
  "batch_results": [
    {"batch": 1, "attempt": 1,
     "coder": {"status": "DONE", "summary": "..."},
     "review": {"verdict": "PASS_WITH_NITS", "findings": []},
     "validation": {"overall": "PASS", "steps": []},
     "assessor_verdict": "PROCEED", "assessor_rationale": "...",
     "scribe": {"status": "POSTED", "error": null}}
  ],
  "final_review": {
    "attempts": [{"review": {}, "validation": {}, "assessor_verdict": "PROCEED"}],
    "notes": [{"note": "...", "ref": "file:line or §", "kind": "MINOR|ASSUMPTION|CAVEAT"}]
  },
  "pr": {"number": null, "url": null, "base": null},
  "auto_review": {"verdict": null, "findings": [], "posted_at": null,
    "fix_attempts": 0, "fix_outcomes": [{"attempt": 1, "fixed": [], "escalated": [], "verdict": "FIXED_CLEAN|ESCALATE"}]},
  "merge": {"sha": null, "method": null, "merged_at": null},
  "discovered_work": [
    {"description": "...", "evidence": "file:line or batch", "source": "coder|reviewer|assessor|designer|final_review",
     "recommendation": "new-story|comment-on:<KEY>|drop", "resolution": null}
  ],
  "checkpoint": {"saved_at": null, "phase_substep": null, "pending_question": null, "notes": "docs/stories/<KEY>/checkpoint.md"},
  "budgets": {
    "max_retries_per_batch": 4, "max_replans": 2,
    "retries_used": {}, "replans_used": 0
  },
  "gates": {
    "design": {"status": "APPROVED|PENDING|SKIPPED", "mode": "human|skipped"},
    "plan": {"status": "APPROVED|PENDING|REJECTED", "mode": "architect|human"},
    "replan_approvals": []
  },
  "escalations": [
    {"phase": "IMPLEMENT", "batch": 2, "question": "...", "options": ["..."],
     "recommendation": "...", "decision": null, "decided_at": null}
  ]
}
```

`retries_used` is keyed by batch number; replans never reuse a number, so a replacement batch always starts at zero.

`bypass` is set at Step 1 init from whether `--bypass` was passed — it's what tells `--resume` whether a `PR_OPENED`-or-later state should stop (default) or continue the tail; it's always `false` on an incognito run (rejected together at Step 0). `review` is set the same way from `--review` and read back on `--resume` — it only has an effect when `bypass` is also `true` (see that flag's description above), passed through verbatim to the bypass tail's AUTO_REVIEW/AUTO_FIX steps. `incognito` and `write_mode`/`tracker`/`local_key`/`branch_model` are set the same way from Step 0's resolution and read back on `--resume`. `effort` is resolved once at Step 0 per `agent-plugin/skills/model-effort/SKILL.md` and read back (not re-resolved) on `--resume` — passing `--effort` again is harmless, and unlike `write_mode` there's no correctness reason to forbid changing it mid-run if you deliberately want to. `worktree` is set at Step 1 per `agent-plugin/skills/worktree-mode/SKILL.md` and never changes for the life of the run; `local_docs` is set the same way from Step 0's resolution per `agent-plugin/skills/local-docs/SKILL.md` and likewise never changes. `technical` is set the same way from `--technical` and read back on `--resume` so the run keeps its output voice across sessions (see `agent-plugin/skills/plain-language/STANDARD.md`). `dispatches` is always appended to, regardless of `--show-stats` — that flag only gates auto-publishing the Artifact, not collection (see **Usage statistics**). `auto_review` and `merge` are populated only by the `--bypass` tail; both stay null on an ordinary run (always null on an incognito run, since bypass is unreachable there).

## Model tiering (cost control)

The table below is the `high`-tier default — what every agent's own frontmatter already declares, and what a repo with no `effort` configured runs at. For every other tier (`very-low`/`low`/`medium`/`extra-high`), see `agent-plugin/skills/model-effort/SKILL.md`'s table — this run resolves `effort` once at Step 0 and passes an explicit `model` override on every dispatch below looked up from there, superseding the agent file's own default without editing it.

| Agent | Model (`high`) | Why |
|-------|-------|-----|
| `designer` | `opus` | Autonomous design decisions — the highest-stakes judgment in the run. |
| `architect` | `opus` | The adversarial check on those decisions and on the plan; must out-judge what it reviews. |
| `panelist` | `opus` | Lens-panel deliberation on high-stakes design issues (via the design-run procedure). |
| `coder` | `opus` | The implementation itself — highest-risk generation step. |
| `intake` | `sonnet` | Mostly mechanical, but inexact quoting corrupts everything downstream. |
| `planner` | `sonnet` | Batch decomposition and ordering is a real judgment call. |
| `reviewer` | `sonnet` | Catches design/correctness issues without paying Opus twice per batch. |
| `assessor` | `sonnet` | Decisive control-flow judgment, not code generation. |
| `validator` | `haiku` | Mechanical command-running and PASS/FAIL classification. |
| `scribe` | `haiku` | Template-driven tracker comments (or provenance entries) from structured state. |
| `pr-reviewer` | `sonnet` | (`--bypass` only) The AUTO_REVIEW step's single-PR pass and AUTO_FIX's convergence re-reviews, reused from `review-run`/`review-fix`. |

To rebalance a single dispatch beyond what the resolved tier already does, pass a further `model` override on that Task call. (Installed marketplace plugins are read-only on the installee's machine.)

## Notes

- **Dispatch names are explicit.** Task tool `subagent_type`: `designer`, `architect`, `panelist`, `intake`, `planner`, `coder`, `reviewer`, `validator`, `assessor`, `scribe`, and (`--bypass` only) `pr-reviewer` — plugin-qualified `sdlc:<name>` if another plugin collides. Confirm once per machine via `/agents`.
- Every subagent ends with a single JSON block as its final message; that block is the only thing this command parses. No parseable block → re-dispatch once, then ESCALATE — never guess at missing fields.
- **Hooks (all Node scripts via `hooks/hooks.json`).** In workflow repos (those with `docs/stories/` or `docs/design-notes/`), `gate-git.js` (PreToolUse) denies `git push`/`gh pr create` on a story-run-managed branch before `READY_FOR_PR`/`PR_OPENED`, denies `git commit` directly on `main`/`master` (and `sprint/*` when `branchModel: sprint`) except merge-resolution commits while a merge is in progress, and denies force-pushes to protected branches. `validate-state.js` (PostToolUse) checks every write to a `story-state.json` parses with a legal phase — corruption is flagged the moment it happens. `session-start.js` (SessionStart) announces paused or in-flight runs so parked work isn't forgotten. Other repos and branches are unaffected.
- **`--bypass`'s merge step is this plugin's first autonomous `git`/`gh` action that isn't gated by a hook.** `gate-git.js` only pattern-matches `git commit`/`git push`/`gh pr create` — it doesn't intercept `gh pr merge`, so nothing about the hook needed to change, but nothing about it double-checks this new caller either. The command-level guards are what carry the weight here: never onto `main` in a `sprint`-model repo, never without a clean AUTO_REVIEW verdict, never without green required checks. Treat those guards as load-bearing, not advisory.
- **Artifact integrity is non-negotiable.** Durable artifacts (design note, threshold ADRs) are created before they're needed, validated when referenced, and committed when changed; working artifacts (context pack, plan, state) exist for the life of the run. A missing or broken artifact stops the run; it is never worked around.
- All run state lives on disk in `docs/stories/<KEY>/` (untracked); nothing depends on session memory, which is what makes `--resume` safe after a dead session. Corollary: don't run `git clean -fdx` mid-run — it deletes the state of an in-flight story.
- See `agent-plugin/skills/tracker-adapter/SKILL.md` for the full tracker/write-mode resolution logic referenced throughout, `agent-plugin/skills/model-effort/SKILL.md` for the full model-tier table and resolution, `agent-plugin/skills/worktree-mode/SKILL.md` for the full worktree resolution/fallback/recovery logic, and `agent-plugin/skills/local-docs/SKILL.md` for the full design-note/ADR locality logic — this file only describes how story-run *uses* each, not how they work.
- **`gate-git.js` needs no worktree-awareness of its own.** It already resolves "the repo a Bash command actually targets" independently, from the command string itself (`cd <path> &&` / `git -C <path>` prefixes) — the same mechanism this file's git operations use to reach `worktree`. A push/commit this run issues against the worktree is gated correctly without any change to the hook.

