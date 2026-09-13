---
description: "Create atomic, convention-following commits from the working tree. Local only — never pushes."
argument-hint: "[STORY-KEY] [message]"
---

# /sdlc:commit

Create one or more atomic, well-titled commits from the current working tree, following the target repo's commit convention. Use this any time you commit — mid-story or right before a PR — so every commit on every machine is shaped the same way. It commits **locally only**; it never pushes or opens a PR — pushing happens through `/sdlc:story-pr` (or an explicit request), not here.

Arguments arrive as `$ARGUMENTS`: `$1` is an optional story key, the rest an optional message.

- No key given: derive it from the branch name (`feat/<key-lower>-slug` → `<KEY>`). If it can't be derived, ask.
- No message given: write one from the staged diff.
- Reference stories only by their live tracker key, resolved from the tracker (`internal/tracker-adapter/SKILL.md`) — never infer or guess. If the repo documents a legacy ticket-ID scheme, translate to the live key first. A local key (no tracker configured) needs no resolution — it's used as-is.

## Steps

1. **Resolve the repo convention** from the target repo's `CLAUDE.md`: project key, branch naming, commit-subject format (default: subject `<KEY>: <imperative summary>`).

1a. **Resolve the worktree, if any.** Check `docs/stories/<KEY>/story-state.json` for a `worktree` field, using the key from `$1` or as derived above (per `internal/worktree-mode/SKILL.md`) — the file may not exist (this story never went through `/sdlc:story-start`'s worktree creation), in which case there's nothing to resolve and everything below runs in the current checkout exactly as before. When it resolves to a path, every git command in this procedure (`rev-parse`, `status`, `diff`, `add`, `commit`) targets it via `git -C <worktree>` instead of the session's own checkout.

2. **Confirm the branch.** Run `git rev-parse --abbrev-ref HEAD` (`-C <worktree>` when resolved above). If on `main` or a `sprint/*` branch, **stop** — never commit directly to either. Offer to cut a story branch first — from the base branch (`main` under `branchModel: direct`, the active sprint branch under `branchModel: sprint` — read `.sdlc/config.json`): `feat/<key-lower>-slug`, `fix/<key-lower>-slug`, or `chore/<key-lower>-slug` (new functionality / bug fix / tooling+hygiene).

3. **Review what's changing.** Show `git status` and `git diff` (staged + unstaged; `-C <worktree>` when set). Never commit without the user seeing the diff.

4. **Split into atomic commits.** If the changes are several unrelated logical changes, group them and make one commit per logical change — stage selectively (`git add <paths>` / `git add -p`, `-C <worktree>` when set) rather than committing everything at once. One commit should be one reviewable, revertable idea.

5. **Write the message** for each commit:
   - **Subject:** `<KEY>: <imperative summary>` — present-tense imperative ("Add", "Fix", "Refactor"), ≤ ~72 chars, no trailing period. The key prefix is what links the commit to the tracker issue (where one exists), so it's required.
   - **Body (when the change isn't self-explanatory):** wrap at ~72 cols; explain the *why* and any non-obvious *what* / trade-off — not a restatement of the diff. Skip the body for trivial changes.

6. **Commit.** `git commit -m "<KEY>: <summary>" -m "<body>"` (`-C <worktree>` when set; the second `-m` only when there's a body).

7. **Report.** Print each commit's SHA and subject. Remind that this only commits — run `/sdlc:story-pr` to push and open the PR when the story's ready.

## Notes

- Commits don't have to be PR-ready (WIP is fine mid-story), but a commit should at least build. Run `/sdlc:build-check` before a PR.
- Don't `git add -A` blindly — stage intentionally so unrelated edits don't ride along.
- **Windows/CRLF:** formatters may flag whole files as unformatted due to `core.autocrlf` CRLF — a working-tree artifact git normalizes on commit, not a real diff. Confirm with `git diff --cached` before reformatting.
- **Never `git push` without explicit approval.** This command stops at the commit; pushing to a remote (and opening PRs) is a separate, explicitly-requested step.
- No machine-specific paths; works identically on every machine.
