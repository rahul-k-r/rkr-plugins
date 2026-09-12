---
name: worktree-mode
description: Resolves whether a story runs in its own git worktree or directly in the current checkout, how a freshly created worktree is bootstrapped (dependency install per detected manifest, or .sdlc/config.json's worktreeSetup), and how ephemeral state (docs/stories/) stays anchored to the main checkout regardless. Used by story-start's branch-cutting step and story-run's equivalent inline setup.
---

# Skill: worktree-mode

`EnterWorktree` (the harness tool) moves the *session's own root* into a worktree — and once there, the previous root (typically the main checkout) becomes unwritable and unreadable. This is proven, not assumed: a live test wrote to a main-checkout path from inside an `EnterWorktree`'d session and got an explicit isolation rejection; reading behaved the same way. That rules out ever having the orchestrating session itself call `EnterWorktree` — a run that did would permanently lose its own ability to write `docs/stories/<KEY>/` the moment it entered.

The fix isn't clever path resolution — it's that **the orchestrating session's root never moves.** A plain `git worktree add` (unrelated to `EnterWorktree`) creates an ordinary nested directory under `.claude/worktrees/<name>/`; since it's a *descendant* of the main checkout, a session rooted at main can read and write into it exactly like any other subdirectory — no special access needed, confirmed live the same way. So: create the worktree with plain git, never touch it with `EnterWorktree`, and reach it only through path-qualified operations — the same pattern `hooks/gate-git.js` already uses to target a repo other than its own cwd (`cd <path> &&` / `git -C <path>`).

## Resolution (in `story-start`'s branch-cutting step, and `story-run`'s equivalent inline setup)

1. **`--worktree <path>`** — target that existing worktree. Don't create anything; verify it's a registered worktree of this repo (`git worktree list`) and that its checked-out branch matches (or can be switched to) the story branch.
2. **`--no-worktree`** — skip worktree creation entirely; operate directly in the current checkout, exactly like the plugin's original (pre-worktree) behavior.
3. **Otherwise (default)** — create one: `git worktree add .claude/worktrees/<key-lower>-slug -b <branch> <base>`. Same slug the branch itself uses, so the directory name and branch name stay obviously paired.

Record the result in `story-state.json`: `worktree: "<absolute path>"` or `worktree: null` (`--no-worktree`, or no worktree involved at all). This field already appeared informally in a real run before this skill existed — same name, now formalized.

**A freshly created worktree is not ready to use until it has been bootstrapped** — see the next section. The `git worktree add` and the bootstrap are one step: whichever command creates the worktree (`story-start` Step 6, `story-run` Step 1, standalone `design-run` Step 1) runs the bootstrap immediately after, before recording state or handing off to any later phase.

## Bootstrapping a fresh worktree

A worktree is a clean checkout: everything gitignored that the repo's tooling depends on is absent — installed dependencies (`node_modules/`, `.venv/`, `vendor/`), submodule contents, generated local files. The main checkout has all of it; the worktree has none.

The failure this causes is a **silent trap, not a clean error.** In a real run on a monorepo with `frontend/package.json`, several batches of lint, typecheck and tests passed inside the worktree because Node's module resolution walked *upward* out of `.claude/worktrees/<slug>/frontend/` and found the main checkout's `node_modules/` — then `npm run build` failed, because Turbopack's workspace-root detection doesn't fall back that way. Nothing surfaced until deep into the implement loop, and the symptom looked like a code failure. The same shape recurs on other stacks: a Python run silently uses the main checkout's `.venv` (or the system interpreter) until something imports a package only the lockfile knows; a repo with submodules builds until a submodule path is touched. The fix is structural, not per-tool: **make the worktree equivalent to the main checkout once, at creation, and make an un-bootstrapped worktree recognizable when it does slip through** (see *Recognizing the symptom* below).

### When it runs

- **Default mode (the worktree was just created)** — always, exactly once, right after `git worktree add`, before `worktree` is recorded in state and before any phase (DESIGN, INTAKE, …) runs. Not per batch, not lazily at the first verify.
- **`--worktree <path>`** — skip. It's the developer's own worktree and is assumed ready; if it isn't, the validator's symptom classification below catches it at the first gate rather than after several.
- **`--no-worktree`** — nothing to do; the current checkout is already set up.
- **`--resume`** — never re-run; read `worktree_setup` back from state like every other resolved field.

### Resolving what to run

Three sources, first match wins:

1. **`.sdlc/config.json`'s `worktreeSetup`** — an explicit, ordered list of `{ "dir": "<path relative to the worktree root>", "command": "<shell command>" }`. When present it is the *complete* list: auto-detection is skipped entirely, so a repo that needs a custom install must also list its ordinary ones. This is the escape hatch for anything auto-detection can't know — a venv activated from a path convention, a `requirements.txt` install, a code-generation step that must precede the build, copying an untracked `.env` from the main checkout, a private registry login. Example:
   ```json
   "worktreeSetup": [
     { "dir": "frontend", "command": "npm ci" },
     { "dir": "backend",  "command": "uv sync --frozen" }
   ]
   ```
2. **Auto-detection from tracked manifests.** List the worktree's tracked files with `git -C <worktree> ls-files` (tracked-only, so gitignored `node_modules/`, `vendor/`, build output and nested worktrees are never walked) and map each directory that contains a recognized lockfile to one command, run from that directory. One entry per directory: a monorepo with `package-lock.json` at the root *and* in `frontend/` gets two `npm ci` runs; a workspace member without its own lockfile is covered by the root's install and gets nothing. Root first, then nested directories in path order.

   | Signal (in that directory) | Command | Notes |
   |---|---|---|
   | `.gitmodules` (root only) | `git submodule update --init --recursive` | Always first — `git worktree add` registers submodules but leaves their directories empty. |
   | `package.json` with a `packageManager` field | that manager's frozen install (`npm ci` / `yarn install --immutable` / `pnpm install --frozen-lockfile` / `bun install --frozen-lockfile`) | Wins over the lockfile row when both are present — it's the repo's declared choice (Corepack). |
   | `package-lock.json` | `npm ci` | |
   | `yarn.lock` | `yarn install --frozen-lockfile`; `--immutable` instead if `.yarnrc.yml` exists (Yarn Berry) | |
   | `pnpm-lock.yaml` | `pnpm install --frozen-lockfile` | |
   | `bun.lock` / `bun.lockb` | `bun install --frozen-lockfile` | |
   | `uv.lock` | `uv sync --frozen` | Creates the worktree's own `.venv/`. |
   | `poetry.lock` | `poetry install` | Poetry keys its venv cache by project path, so a new worktree always means a new venv. |
   | `Pipfile.lock` | `pipenv install --deploy` | |
   | `Gemfile.lock` | `bundle install` | |
   | `composer.lock` | `composer install` | |
   | `go.mod`, `Cargo.toml`, `*.csproj`/`*.sln`, `pom.xml`, `build.gradle(.kts)` | *(nothing)* | Deliberate no-ops: Go's module cache, Cargo's registry, NuGet, Maven and Gradle caches are all global, and `go build`/`cargo build`/`dotnet build` resolve from them; `dotnet build` restores implicitly. A cold `target/`/`bin/` is slower, not broken. Don't invent an install step for these. |

   A dependency manifest with **no lockfile and no mapped runner** — `requirements.txt`, `pyproject.toml` alone, `Pipfile` without its lock, `environment.yml` — is *recognized but unmapped*: it's a real signal that the worktree needs setup, but the command (which venv, which runner) isn't knowable from the file. Fall through to 3.
3. **Ask once, offer to persist.** Show the developer what was detected (each directory, the manifest, the mapped command or `unmapped`) and ask for the command(s) to run for anything unmapped — same pattern as undocumented verify commands. Offer to write the resolved list to `.sdlc/config.json` as `worktreeSetup` so the next story doesn't ask again; don't write without a yes. If nothing at all was detected (a Go repo, a docs-only repo), don't ask — proceed with an empty list and say so in one line.

### Running it

Run each entry in order from `<worktree>/<dir>`, path-qualified (`cd <worktree>/<dir> && <command>`) — never a session-level directory change, per the rule above. **Any step failing stops the run** with the exact trimmed output and the step that failed; nothing downstream is attempted. This is the one place a hard stop is right: a half-bootstrapped worktree is *exactly* the silent trap this section exists to prevent, and the cause (network, a missing toolchain, a lockfile out of sync with its manifest) is the developer's to fix, not the coder's.

Record the outcome in the state file so `--resume` and the hand-off can see it:

```json
"worktree_setup": {
  "source": "config|auto|asked|none",
  "steps": [{"dir": "frontend", "command": "npm ci", "status": "PASS"}]
}
```

`null` when no worktree was created this run (`--worktree <path>`, `--no-worktree`). `source: "none"` with empty `steps` is the legitimate result for a stack that needs nothing.

### Recognizing the symptom

Bootstrapping covers creation; the validator covers everything that still slips through — a `--worktree <path>` the developer never set up, a stack auto-detection doesn't know, a lockfile added mid-story. `validator` classifies a step whose failure is environment-shaped (a module/package/import not found, a missing interpreter or venv, a tool absent from `PATH` inside the worktree, a bundler or build tool unable to locate its workspace or project root) as `FAIL_ENV` rather than `FAIL`, and the orchestrator treats `FAIL_ENV` as an **ESCALATE**, never a coder RETRY — the coder can't install dependencies by editing source, and every retry spent on it burns budget while the real cause stays hidden. The escalation names the step, the excerpt, and the likely fix (re-run the bootstrap for that directory, or add a `worktreeSetup` entry).

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
