---
name: local-docs
description: Resolves whether design notes and ADRs are committed artifacts (the plugin's original behavior) or stay local-only, never staged or committed, per repo. Every command that writes or commits docs/design-notes/ or docs/adr/ points here.
---

# Skill: local-docs

The plugin's original design treats `docs/design-notes/<KEY>.md` and `docs/adr/*` as **committed artifacts that ride the branch** — written into a worktree when one's in play, `git add`ed, and committed alongside the code (see `agent-plugin/skills/worktree-mode/SKILL.md`'s "What targets the worktree vs. what stays at the session's root"). Some repos don't want that — design notes stay as working reference, never enter the repo's history at all. This skill is the config knob and the resulting behavior change; it doesn't replace worktree-mode, it overrides one specific thing worktree-mode assumes by default.

## Resolution

`.sdlc/config.json`'s `localDocs` field: `true` or `false` (default `false` — the plugin's original commit-them behavior, unchanged for any repo that hasn't set this).

Resolved once per run (same point as `tracker`/`branchModel`/`effort`), recorded in whatever state file the command maintains, and read back — not re-resolved — on `--resume`.

## Behavior when `localDocs: true`

- **Location**: `docs/design-notes/<KEY>.md` and any `docs/adr/*` files this story creates are written at the **session's own root** — never inside a worktree, since there's no branch they're ever meant to ride. This is the same root `docs/stories/<KEY>/` already uses, for the same reason (survives worktree deletion, immune to `git worktree remove`).
- **Never staged, never committed.** Every command that would otherwise run `git add docs/design-notes/... docs/adr && git commit` skips that step entirely — the file exists on disk, fully written, just outside git's view of the branch.
- **Gitignore reinforcement**: ensure `docs/design-notes/.gitignore` and `docs/adr/.gitignore` exist, each containing a bare `*` — mirroring `docs/stories/.gitignore`'s existing pattern (`story-run.md` Step 3 already does this for that directory). This matters even in a repo that already gitignores markdown broadly by convention (nothing here should depend on that happening to be true) — it's what actually guarantees a stray `git add -A` elsewhere in a session can't sweep these files in by accident.
- **Every reader checks the session's own root, not the worktree** — `intake`'s design-note check, `story-start`'s design-note gate, `close-story`'s §7 (Implementation Findings) check, `design-review`'s critique pass. None of them need a fallback or a "check both places" — under `localDocs: true` there's only ever one copy, and it's always at the session's root.

## Behavior when `localDocs: false` (default)

Exactly what's already built: written into the worktree (or the current checkout, under `--no-worktree`), staged and committed as part of the story's history, same as any other tracked file.

## Interaction with `plan-the-design` (interactive)

An interactive design-review session runs before any branch or worktree necessarily exists, so it always writes `docs/design-notes/<KEY>.md` at the session's own root regardless of `localDocs` — that part doesn't change. What changes is what happens *next*: under `localDocs: false`, a later `story-start`/`story-run` copies that file into the worktree and commits it (per `agent-plugin/skills/worktree-mode/SKILL.md`'s Step-1 handling); under `localDocs: true`, it just stays where it already is — there's nothing to copy or commit.
