---
description: "Orchestrate several stories as one batch: read every ticket, sequence them by real dependencies (contract, shared pattern, file overlap), run independent ones in parallel worktrees via story-run subagents, and optionally post cross-ticket comments at the end."
argument-hint: "<KEY> <KEY>... [--parallel N] [--comment] [--no-gate batch] [--base <branch>] [--bypass] [--turbo] [--effort <tier>] [--max-retries N] [--max-replans N] [--gate <phase,...>] [--no-gate <phase,...>] [--review] [--incognito] [--plain] [--show-stats] [--resume]"
---

# /sdlc:batch-run

Takes several tickets, works out the order they must land in, and drives each one through `/sdlc:story-run` — in parallel where the graph allows, serially where it doesn't. The session is the **batch orchestrator**: it plans the sequence, spawns story subagents, relays what only you can decide, and reconciles the results. It never implements, reviews, or merges anything itself; every story still goes through the full story-run pipeline and its hooks.

## Usage

```
/sdlc:batch-run AGL-101 AGL-102 AGL-103 --bypass --turbo
/sdlc:batch-run AGL-201 AGL-202 AGL-203 AGL-204 AGL-205 --parallel 4 --comment
/sdlc:batch-run AGL-101 AGL-102 --incognito
/sdlc:batch-run --resume
```

Positional arguments are ticket keys (or local slugs — see story-run's no-ticket handling). Every other flag is batch-only (below) or **passed through verbatim to each story-run**: `--bypass`, `--turbo`, `--effort`, `--max-retries`, `--max-replans`, `--gate`/`--no-gate <story phases>`, `--review`, `--incognito`, `--plain`, `--show-stats`. `--worktree`/`--no-worktree` are not passable — the orchestrator owns worktrees. Rejected up front: `--incognito` with `--bypass`.

- `--parallel <N>` — most stories running at once. Default `2`. A **ceiling, not a target**: the orchestrator still decides what may run concurrently from the dependency graph and file overlap, and runs fewer when the graph is narrower. The heavy-work lock (below) serializes test suites and dependency installs regardless of `N`, so a higher `N` buys concurrent design/coding/review, not concurrent builds.
- `--comment` — **standing authorization to post cross-ticket comments at the end of the batch**, with no further confirmation. See step 8.
- `--no-gate batch` — skip the batch-plan approval gate (default **on**). Story-level gates follow `--gate`/`--no-gate` as in story-run.
- `--resume` — continue from `docs/stories/_batch/<BATCH-ID>/batch-state.json` (the only key-less form; if several batches exist, ask which).

## Why the orchestrator can run stories as subagents

story-run's own text assumes only the live session can dispatch agents. In Claude Code a subagent can itself dispatch subagents (verified: a spawned `general-purpose` agent spawned a nested one and got its result back). So each story runs as a **story subagent** that is the orchestrator *for that story*, dispatching `designer`/`coder`/`reviewer`/… as usual. If a harness refuses the nested spawn, run that story **inline** in this session and say so; parallelism is lost, nothing else is. Codex/Antigravity: see `skills/batch-run/SKILL.md` (unverified there).

## Cache economics: subagents get a 5-minute prompt cache, this session gets 1 hour

A subagent turn that starts more than ~5 minutes after its previous one re-pays its *entire* context at full price; a story subagent is mostly idle-waiting on long dispatches. The orchestrator, with its 1-hour cache, can idle cheaply *provided its own context stays small*. Rules:

1. **A story subagent's context is disposable; the state files are the memory.** story-run guarantees nothing needed to continue exists only in chat (state + `checkpoint.md` + `handoff.md`), so a fresh subagent resumed at a clean boundary costs one cold start instead of repeatedly rewriting a grown transcript.
2. **Segment at clean boundaries.** A story subagent runs one **segment** and returns; the orchestrator respawns it with `--resume`. Default boundaries, all persisted points: (a) setup + DESIGN + INTAKE + PLAN approved (`phase: IMPLEMENT` set); (c) after Step 9 — discovered-work items collected, hand-off persisted; (d) each bypass-tail step that waits (CI). **Per-batch boundaries (b)** — return after a batch's verdict is acted on (after 5g) — apply only when the plan has more than 3 batches or a batch's dispatches ran past ~5 minutes; for small stories the cold start costs more than it saves, so run (a)→(c) as one segment. The orchestrator decides after segment (a) from `plan-summary.md`.
3. **Never wait inside a subagent.** A wait that could exceed ~4 minutes — CI, an unanswered escalation, a dependency not yet landed, the heavy-work lock — is a **return**: the subagent checkpoints and returns, the orchestrator waits (a background until-loop whose completion wakes the session — no polling turns) and respawns. The story-run 20-minute CI poll never runs in delegated mode.
4. **Cold starts load only what they need.** The first segment reads `commands/story-run.md` in full; later ones read its header, **Resume semantics**, **State schema**, **Under `/sdlc:batch-run`**, and only the step sections for their phase.
5. **The orchestrator stays lean.** Per-story facts live in `batch-state.json`; a returned story contributes one JSON block and a `handoff.md` read. Anything that would pull a diff or transcript into this session (extracting a landed contract for `batch-context.md`, say) is delegated to a `haiku` subagent that returns a few lines.

Known costs this does not remove: within a segment, any dispatch over 5 minutes (a big coder batch, a full test suite) still makes that subagent's next turn cold, and a respawn adds a cold start. The design bounds *growth*, not every miss.

## Delegated mode — what a story subagent cannot do

A subagent cannot ask you. Story subagents run story-run in **delegated mode**, which differs from interactive story-run in exactly this: *every point where story-run would ask the developer* instead **checkpoints (escalation with options and recommendation appended, `checkpoint.md` and `checkpoint.resume_phase` written, state persisted) and returns `PAUSED`**; discovered-work triage returns its items unresolved (a ticket is created only for an item you explicitly chose). To keep pauses meaningful rather than routine, the orchestrator removes the *predictable* ones up front:
- **Step 0 is resolved once, here**, and passed to every story as already-resolved config (tracker, write-mode, effort, `local_docs`, branch model, verify commands, required CI check names) — a story never asks about them, and never has to pause before its state file exists.
- **At the batch gate** you are asked, once: *unassigned tickets — assign to me and add to the sprint? (yes/no)*, passed as pre-authorization for that case only (tickets assigned to someone else are surfaced at the gate by name, never taken over silently); and *keep the `design` gate on for autonomously designed stories?* (default yes — they then arrive as one coalesced approval prompt instead of N interruptions).

The orchestrator is the relay: it asks you (step 7), writes your answer into the story's `escalations[].decision`/`decided_at`, and respawns it with `--resume`; story-run's Resume rule for `PAUSED` then *consumes* a recorded decision instead of re-asking.

## Steps

0. **Preflight.** As story-run Step 0, once for the batch (including the Step 0 questions — this is where they get asked). Reject duplicate keys and `--incognito` + `--bypass`. Allocate `BATCH-ID` = `batch-<UTC yyyymmdd-HHMM>-<first key lower>` (never reused) and create `docs/stories/_batch/<BATCH-ID>/` (inside the already-gitignored `docs/stories/`; ensure `docs/stories/.gitignore` exists first). Initialize `batch-state.json` immediately.

1. **Read every ticket** (fetch in parallel; `haiku` subagents for fetch-and-summarize — the orchestrator keeps the judgment): full AC, tracker links (blocks / is-blocked-by / relates), the design note and ADR references, and any `DECISIONS.md` entries they cite. Confirm each is a real, not-Done story. Note any assigned to someone else (for the gate).

2. **Build the dependency graph.** Evidence, strongest first: explicit tracker links; design-note cross-story obligations; what each AC says it consumes or produces (an API, schema, component, config); and a read-only **code survey** of the files each story will likely touch. Classify every edge — the type decides execution:

   | Edge | Meaning | B may start when… |
   |---|---|---|
   | `needs-code` | B uses something A creates or changes (backend contract before frontend, migration before consumer, shared component before its users) | A has **landed**: A's phase is `CLOSED` (under `--bypass`), or A's PR is merged (`gh pr view --json mergedAt`; checked on each scheduling pass and on `--resume`). Without `--bypass` nobody merges for you, so B waits and the batch may end with B `WAITING` — resume it after you merge A. |
   | `shared-files` | A and B likely edit the same files and would conflict, with no real dependency | Same as `needs-code` — serialized behind A's landing. |
   | `follows-pattern` | B must look/behave like A and only needs to *see* A's result (the lead of a family of similar screens, agents, endpoints) | A reaches `READY_FOR_PR` or later. A's branch is read-only reference; B's base is unaffected. |
   | `none` | Independent | Immediately. |

   There is **no stacking**: a story never branches from another story's unmerged branch. (Stacked PRs need retargeting after merge and a rebase when the predecessor was squash-merged; waiting for the merge is simpler and honest about what "land first" means. Add stacking later if the waiting proves too costly.) Under `--incognito` nothing is ever pushed, so a `needs-code`/`shared-files` edge can never be satisfied — it is raised at the gate for you to drop or split into separate runs; `follows-pattern` and `none` work.

   **Families.** When tickets must stay consistent — five agents sharing one template, five UI items sharing one layout — pick a **lead** (the one that establishes the template, or the most general), make each sibling `follows-pattern` on it (or `needs-code`, when the lead *creates* the shared component the siblings then use), and write each sibling's **deltas**: what legitimately differs from the lead. The lead runs first; its design note and implementation settle the template, so siblings inherit it instead of five stories each re-deciding it. If you judged tickets *not* to be a family, say so in the plan.

   A cycle, or an edge not decidable from evidence, is never guessed at — it goes to the gate as an open question.

3. **Plan the schedule** into **lanes**:
   - A **lane** is an ordered chain of stories sharing one worktree. A story starts a fresh worktree by default. A later story in a lane **reuses** the previous story's worktree only when that predecessor is **terminal and landed** (`CLOSED`, or PR merged) — its worktree is then no longer needed, so nothing is corrupted if it is ever resumed. The reusing story is told `--worktree <path>`; story-run cuts its branch there (Step 1) and re-bootstraps if the base moved a lockfile/manifest. Otherwise (no `--bypass`, nothing merged yet) stories get fresh worktrees, so reuse mainly pays off in `--bypass` chains.
   - Lanes run concurrently up to `--parallel`; a story whose predecessors haven't landed waits; a stuck story blocks only its dependents.
   - **Base and setup.** Every story cuts from `origin/<base>` after `git fetch origin <base>` — never `git switch` in the shared root checkout (concurrent stories would race on it). Fetch and `git worktree add` happen under the heavy-work lock.
   - Under `branchModel: sprint` + `--bypass`, a story whose base is `main` stops at story-run's own guard — surface that at the gate, not per story.
   - **Reserved ADR numbers.** Parallel stories each number ADRs "highest + 1" and would collide; give each lane a distinct block (e.g. lane N → `N×10+1…`) in its `batch-context.md`, and stories use only their block.
   - **Cross-story context.** Before spawning a story, write `docs/stories/<KEY>/batch-context.md` (below).

   Write `docs/stories/_batch/<BATCH-ID>/batch-plan.md`: the graph (each edge with type and evidence), families with leads and deltas, lanes and order, per-story base, expected merge order, and what was judged independent and why.

4. **Batch gate** (default on; `--no-gate batch` skips — the two questions under *Delegated mode* then take their defaults: assign-unassigned = ask-and-stop, design gate = on). Show `batch-plan.md`; ask: approve, reorder, merge or split families, cut a ticket, plus the two policy questions. Sequencing is the highest-leverage judgment in the batch and cheap to change before any code exists. Record `gates.batch`.

5. **Execute.** Loop until every story is terminal or blocked.
   - **Runnable** = every predecessor satisfied per its edge type, and a parallel slot free. Spawn a **story subagent**: `Agent`, `subagent_type: general-purpose`, **no `model` override** (it inherits this session's model; story-run applies per-agent tiers below that), `run_in_background: true`. Its prompt:
     1. "You are the orchestrator for one **segment** of one story. Follow `commands/story-run.md` from the sdlc plugin for `<KEY>` with arguments `<passthrough flags> [--worktree <path>] [--resume]`. Step 0 is already resolved: `<config>`. Load: `<full file | the sections named in Cache economics rule 4>`."
     2. "**Delegated mode.** You cannot ask the user and must never wait more than ~4 minutes in this agent (5-minute cache). At every point story-run would ask, and every wait (CI, dependency, backoff, lock), checkpoint (escalation with options + recommendation; `checkpoint.md`; `checkpoint.resume_phase`; persist) and return."
     3. "**Heavy-work lock.** Before any dependency bootstrap, `git worktree add`, or `validator` dispatch, take `docs/stories/_batch/<ID>/heavy.lock` (create it atomically with `mkdir`; write `<KEY> <UTC time>` inside; remove it when the step ends; a lock older than 30 minutes is stale — break it). If held, retry every 30 s for up to 3 minutes, then return `WAITING_LOCK`. Test and build commands carry an explicit worker cap of 2."
     4. "**Stop at the end of this segment** (`<boundary>`): persist state, set `phase` as story-run does, return. Do not run into the next segment."
     5. "Before DESIGN, read `docs/stories/<KEY>/batch-context.md` and pass it to every designer/intake/planner dispatch as locked upstream input; use only your reserved ADR numbers."
     6. "Before every return, set `handoff.stop_reason`/`handoff.notes` in state and persist."
     7. "Return ONE JSON block as your final report, via your harness's return channel (`SubagentHandback` where the harness provides it): `{story, status: SEGMENT_DONE|AWAITING_CI|WAITING_LOCK|PAUSED|FAILED|TERMINAL, phase, pr, branch, worktree, escalations_open: n, handoff: \"docs/stories/<KEY>/handoff.md\"}`."
   - `status` is **control flow only**; milestones come from `phase` and the story's `bypass`. `TERMINAL` = `CLOSED`, or `PR_OPENED`/`READY_FOR_PR` with no `--bypass` (nothing left to resume). Under `--bypass`, `PR_OPENED` is never terminal — respawn into the tail (story-run Resume handles `PR_OPENED` + `bypass: true`).
   - **On a return**, read **only the JSON block and `handoff.md`**; update `batch-state.json`, then:
     - `SEGMENT_DONE` → respawn the same story for its next segment (its slot is held; not a new scheduling decision).
     - `AWAITING_CI` → the **orchestrator** waits (bounded until-loop on the required checks, default 20 min, in the background), frees the slot meanwhile, then respawns with `--resume`. Red checks: respawn so the story reports the failing check verbatim. Before a story's merge step, if its PR is `BEHIND`/not mergeable, update the branch (`gh pr update-branch`) and re-enter `AWAITING_CI`; **merge steps run one story at a time** across the batch (merge lock, same mechanism as the heavy-work lock) so parallel `--bypass` merges onto one base don't race.
     - `WAITING_LOCK` → respawn after a short delay (this is a return, not a wait).
     - `PAUSED` → relay (step 7). Its dependents wait; independents continue.
     - `TERMINAL` → mark landed per the edge table and rewrite each dependent's `batch-context.md` with what actually landed, before spawning it.
     - `FAILED` / nested-spawn refusal → mark `FAILED`; dependents `BLOCKED` with the reason; keep going; report at the end.
   - Budgets are per story (story-run's own). The batch adds none except `--parallel`.

6. **`batch-context.md`.** Written into `docs/stories/<KEY>/` before the story is spawned and **rewritten** when an upstream story lands. Built from artifacts, not memory: the story's place in the graph and why; for each landed `needs-code`/`shared-files` upstream, the contract it landed (signatures/schemas from the merged diff — extracted by a `haiku` subagent) and the PR; for a `follows-pattern` lead, its branch/PR, design-note path, the pattern to follow, and **this story's deltas** (what must differ, what must not); a sibling roster (key, one line, status); the reserved ADR block. story-run treats it as locked upstream input — a conflict with the ticket is an escalation. A story already past DESIGN is not retroactively changed by a rewrite; the orchestrator flags that in the relay if the new facts contradict decisions it already made.

7. **Relaying decisions.** As stories return `PAUSED`, ask in chat — **coalescing everything pending at that moment into one prompt**, each item with story, question, options, and recommendation (from its `handoff.md`; `--plain` applies). Don't wait for the batch to idle; running lanes keep running while you decide. Record each answer in that story's `escalations[]` and respawn it with `--resume`. Design-gate approvals and discovered-work triage use the same prompt.

8. **Cross-ticket comments** (only once every story is terminal or blocked). One comment per **real-keyed ticket in the batch**, built from `batch-state.json` and the stories' states. Content is engineering facts only: what this ticket depends on and the contract or pattern taken from each upstream (with PR links); what depends on it; for a family, the lead and this ticket's deltas; the order the PRs should merge in; and, where a sibling isn't done, a plain statement of what that means for this ticket ("AGL-103 isn't implemented yet; this PR doesn't include its changes") — not narration of how the pipeline ran.
   - **With `--comment`: post them, no further confirmation.** The flag authorizes *these* cross-reference comments only: on tickets that are members of this batch, comments only. It does not create tickets, change status, comment outside the batch, or post discovered-work comments (per-item choices). Each story-run's own provenance posts (plan digest, batch records, escalations, review notes, and under `--bypass` the completion record) are separate and unchanged. Local keys and `--incognito`/`tracker: none` write the same text to each story's `provenance.md`.
   - **Without `--comment`:** write them to `docs/stories/_batch/<BATCH-ID>/comments-draft.md`; post nothing.
   - Written as the developer's own note: no mention of agents, instructions, or approvals. Record `comments.tickets[KEY].posted_at` **after each post**, and skip any ticket already recorded on `--resume` (a partial post must not duplicate).

9. **Hand off.** A per-story table (status, phase, PR, anything awaiting you), the merge order, stories still `WAITING` on a merge you owe, blocked/failed stories with reasons, and each story's `handoff.md`. Final `batch-state.json`; `hooks/write-handoff.js` renders `docs/stories/_batch/<BATCH-ID>/batch-handoff.md` — the rollup a fresh chat reads instead of this one. Each member's own `handoff.md` points to `/sdlc:batch-run --resume`, not a bare story-run. Stats: each story snapshots its own (`/sdlc:show-stats <KEY>`).

## State: `docs/stories/_batch/<BATCH-ID>/batch-state.json`

```json
{
  "batch_id": "batch-20261020-1430-agl-101",
  "schema_version": 1,
  "keys": ["AGL-101", "AGL-102"],
  "flags": {"passthrough": ["--bypass", "--turbo"], "parallel": 2, "comment": false},
  "phase": "PLAN|GATE|EXECUTE|COMMENT|DONE",
  "gates": {"batch": {"status": "APPROVED|PENDING|SKIPPED", "approved_at": null}},
  "policy": {"assign_unassigned": true, "design_gate": true},
  "edges": [{"from": "AGL-101", "to": "AGL-102", "type": "needs-code|shared-files|follows-pattern", "evidence": "..."}],
  "families": [{"lead": "AGL-201", "members": ["AGL-202"], "deltas": {"AGL-202": "..."}}],
  "stories": [
    {"key": "AGL-101", "lane": 1, "status": "WAITING|RUNNING|AWAITING_CI|PAUSED|PR_OPENED|READY_FOR_PR|CLOSED|FAILED|BLOCKED",
     "phase": null, "base": "main", "worktree": null, "pr": {"number": null, "url": null}, "blocked_by": null, "adr_block": "11-20"}
  ],
  "comments": {"tickets": {"AGL-101": {"posted_at": null}}}
}
```

Each story's `story-state.json` carries `batch: {id, lane, depends_on: [{key, type}]}` — informational, set from the prompt.

## Notes

- **Hooks apply per story, unchanged.** `gate-git.js` resolves a worktree's story state from the main checkout, so the push gate holds for lane worktrees; `validate-state.js` validates every story's state; each story's `handoff.md` renders as usual.
- **Resume.** `--resume` reloads `batch-state.json`, reconciles each non-terminal story against its own `story-state.json` (and `gh pr view` for merged-ness), and continues. A story that was `RUNNING` when the session died is respawned with `--resume`, which keeps commits and drops the dirty tree.
- **Advisor.** If a session advisor is configured, the orchestrator consults it only at an escalation decision, never routinely; story subagents apply `internal/model-effort/SKILL.md` for their own dispatches.
- **What it won't do:** merge anything itself (only a story's own `--bypass` tail merges), post outside the `--comment` scope, create tickets, or `--bypass` onto `main` in a `sprint`-model repo.
