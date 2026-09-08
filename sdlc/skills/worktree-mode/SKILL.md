---
name: worktree-mode
description: Resolves whether a story runs in its own git worktree or directly in the current checkout, and how ephemeral state (docs/stories/) stays anchored to the main checkout regardless. Used by story-start's branch-cutting step and story-run's equivalent inline setup.
---

# Skill: worktree-mode

`EnterWorktree` (the harness tool) moves the *session's own root* into a worktree — and once there, the previous root (typically the main checkout) becomes unwritable and unreadable. This is proven, not assumed: a live test wrote to a main-checkout path from inside an `EnterWorktree`'d session and got an explicit isolation rejection; reading behaved the same way. That rules out ever having the orchestrating session itself call `EnterWorktree` — a run that did would permanently lose its own ability to write `docs/stories/<KEY>/` the moment it entered.

The fix isn't clever path resolution — it's that **the orchestrating session's root never moves.** A plain `git worktree add` (unrelated to `EnterWorktree`) creates an ordinary nested directory under `.claude/worktrees/<name>/`; since it's a *descendant* of the main checkout, a session rooted at main can read and write into it exactly like any other subdirectory — no special access needed, confirmed live the same way. So: create the worktree with plain git, never touch it with `EnterWorktree`, and reach it only through path-qualified operations — the same pattern `hooks/gate-git.js` already uses to target a repo other than its own cwd (`cd <path> &&` / `git -C <path>`).

## Resolution (in `story-start`'s branch-cutting step, and `story-run`'s equivalent inline setup)

1. **`--worktree <path>`** — target that existing worktree. Don't create anything; verify it's a registered worktree of this repo (`git worktree list`) and that its checked-out branch matches (or can be switched to) the story branch.
2. **`--no-worktree`** — skip worktree creation entirely; operate directly in the current checkout, exactly like the plugin's original (pre-worktree) behavior.
3. **Otherwise (default)** — create one: `git worktree add .claude/worktrees/<key-lower>-slug -b <branch> <base>`. Same slug the branch itself uses, so the directory name and branch name stay obviously paired.

Record the result in `story-state.json`: `worktree: "<absolute path>"` or `worktree: null` (`--no-worktree`, or no worktree involved at all). This field already appeared informally in a real run before this skill existed — same name, now formalized.

## What targets the worktree vs. what stays at the session's root

- **Git operations** — branch checkout/creation, commits, diffs, `gh pr create` — target `worktree` via `-C`/`cd`-prefixed commands whenever it's non-null. Never via a session-level directory change.
- **File edits** (`coder`, and any other agent that writes source) — target absolute paths under `worktree` when it's set. Each dispatch prompt that hands off editing work states the effective working root explicitly (`worktree` if set, else the session's own cwd) so the agent never has to guess.
- **`docs/stories/<KEY>/`** — always resolves relative to the orchestrating session's own root (main), never inside `worktree`, because the session never leaves it. No resolution logic needed beyond "use the normal relative path" — that's the whole point of never calling `EnterWorktree`.

## The residual case: the developer already entered a worktree themselves

If the *developer* used `EnterWorktree` (or the VS Code extension's equivalent) before invoking a command, the orchestrating session itself is the isolated one — every write meant for main's `docs/stories/` lands in the worktree's own copy instead, because that's all the session can reach. This isn't a hard stop:

- Catch the failure, redirect the write to `docs/stories/<KEY>/` **inside the current (isolated) worktree** instead, and note it happened — in the run's own output and as a marker in whatever gets written, so it's visible rather than silently divergent. (This is exactly what happened, unprompted, in a real run before this skill existed — formalizing it here instead of leaving each run to rediscover the same recovery.)
- No preflight refusal, no forced `ExitWorktree`. The run keeps going.

## Recovering the orphaned state — `--resume`'s job

When `--resume` looks for `docs/stories/<KEY>/story-state.json`:

1. Check the session's own root (main) first — the common case, nothing further to do.
2. Not found there → run `git worktree list` and check each registered worktree's `docs/stories/<KEY>/` for a match.
3. Found in a worktree → **copy** (not read-in-place) the whole `docs/stories/<KEY>/` directory into main, then continue the resume from the copy. This is what actually "moves it to main" — it happens the first time someone resumes the run from a main-rooted session after having exited the worktree (`ExitWorktree keep`), not automatically at any earlier point, since nothing main-rooted was running in between to do the copy itself.

A run that reaches a terminal phase (`PR_OPENED` in normal write-mode, `CLOSED` under `--bypass`) while still trapped in a worktree and is never resumed again stays orphaned there — a real but low-stakes gap, since the actual outcome (the PR, the merge, the tracker transition) already exists independently by that point; only the local audit-trail convenience is at risk if the worktree later gets removed.
