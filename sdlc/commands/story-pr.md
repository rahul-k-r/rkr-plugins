---
description: "Commit, push the story branch, and open the story PR against the resolved base branch — the step that triggers CI."
argument-hint: "[STORY-KEY] [--review] [--fix] [--technical]"
---

# /sdlc:story-pr

Commit the current work, push the branch, and open a GitHub PR with the tracker key in the title — the step that takes a green local branch to "CI is running on a PR." Sits between `/sdlc:build-check` (local gate) and `/sdlc:story-check` (post-CI readiness) / `/sdlc:close-story` (close).

Opening the PR is what triggers CI. The tracker links the PR to the issue by the `<KEY>:` prefix in the title (Jira and Linear both auto-link a mentioned key in a PR title or body), so the title format is not optional — except for a local key (no tracker), where nothing auto-links and the prefix is purely a naming convention.

> **Base branch:** read `branchModel` from `.sdlc/config.json`. Under `branchModel: sprint`, the story PR targets the **active sprint branch** `sprint/<id>` — it may be self-approved/merged once CI is green (the approval-required review happens later at the sprint→main merge, `/sdlc:sprint-pr`). Detect the sprint branch as the highest-numbered `sprint/*` on origin (`git ls-remote --heads origin 'sprint/*'`); if it can't be determined unambiguously, ask, and accept an explicit base override. Under `branchModel: direct`, the story PR targets `main` directly and may likewise be self-approved/merged once CI is green — there is no sprint boundary and no second-reviewer gate in this model.

> **story-run interplay:** on a branch managed by `/sdlc:story-run`, the plugin's PreToolUse hook blocks push/PR until the story reaches `READY_FOR_PR`. That's intended — finish or resume the run first. Unmanaged branches are unaffected.

Arguments arrive as `$ARGUMENTS`: `$1` is an optional story key — a real tracker key, or a local key when the story has no tracker (`tracker: none`, or an `--incognito` story-run). If no key is given, derive it from the branch name (`feat/<key-lower>-slug` → `<KEY>`); if it can't be derived, ask. Reference a real tracker key only in its live form — never infer or guess; translate any legacy ticket IDs first. A local key is used opaquely, as-is.

**Flags:**
- `--review` — run a pre-PR self-review of the diff (off by default; see step 3a). Catches the obvious stuff before an external reviewer does.
- `--fix` — with `--review`, apply the high-confidence findings to the working tree instead of only reporting them. Ignored without `--review`.
- `--technical` — keep chat output in the engineer-level voice. Without it (the default), everything explained to the developer — the diff walkthrough, self-review findings and their disposition options, and the report-back — follows `agent-plugin/skills/plain-language/STANDARD.md`; commit messages and the PR title/body keep their fixed technical form either way.

## Steps

0. **Resolve project config** from the target repo's `CLAUDE.md`: project key, commit convention, verify commands, and the names of the required CI checks (from `CLAUDE.md` or `.github/workflows/`). Also resolve `branchModel` from `.sdlc/config.json` — it decides the base branch for every step below.

0a. **Resolve the worktree, if any.** Check `docs/stories/<KEY>/story-state.json` for a `worktree` field, using the key from `$1` or as derived above (per `agent-plugin/skills/worktree-mode/SKILL.md`) — the file may not exist (this story never went through `/sdlc:story-start`'s worktree creation), in which case there's nothing to resolve and everything below runs in the current checkout exactly as before. When it resolves to a path, every git command below targets it via `git -C <worktree>`, and `gh pr create` via a `cd <worktree> &&` prefix, instead of the session's own checkout.

1. **Confirm the branch.** `git rev-parse --abbrev-ref HEAD` (`-C <worktree>` when resolved above). If on `main`, or (under `branchModel: sprint`) any `sprint/*` branch, **stop** — never commit directly to a base branch. Offer to cut a story branch from the resolved base (`feat|fix|chore/<key-lower>-slug`), then continue on it.

2. **Run the local quality gate** (`/sdlc:build-check`). It must be green before opening a PR — a red PR wastes a reviewer's time and a CI run. If any step *runs and fails*, stop and report — do not push. If a gate tool isn't installed locally, don't hard-stop and don't tick its box: leave it unchecked and note that the required CI check covers it.

3. **Review the diff with the user.** Show `git status` and `git diff` (staged + unstaged; `-C <worktree>` when set). Never commit or push without the user reviewing the diff. Stage the intended files.

3a. **Pre-PR self-review (only with `--review`).** Skip entirely unless `--review` was passed. Run `/code-review` over the staged diff at low/medium effort (high-confidence findings only — broader effort surfaces nitpicks that stall the push). On top of generic correctness/quality, also flag violations of the repo's mandatory rules — the `CLAUDE.md` conventions / Do-NOT sections.

   **This is a hard gate — every finding must be dispositioned with the user before moving past this step.** Do not commit, push, or open the PR while any finding is unresolved:
   - Present the findings as a numbered list (each with file:line and severity).
   - For **each** finding, get an explicit decision: **fix now**, **defer** (record as a follow-up for the PR body and, if warranted, a linked tracker story), or **accept/won't-fix** (with a one-line reason).
   - Apply the "fix now" items (`--fix` may pre-apply the high-confidence ones, but per-finding sign-off still applies). After any fix, re-run the local gate and re-stage.
   - Only once the list has no undecided items — proceed. If the user steps away, stop here rather than opening the PR with findings unaddressed.

3b. **Check the design note is current.** If `docs/design-notes/<KEY>.md` exists (in `worktree` when set — that's where it was actually committed, per `agent-plugin/skills/worktree-mode/SKILL.md`), check it for uncommitted changes specifically (`git status`/`git diff` on that path, `-C <worktree>` when set) — don't let it ride along silently or get left behind. If the implementation deviated from the design during this story, fill §7 (Implementation Findings) now; otherwise confirm it says "no material deviations." Stage and include it in this PR's commit(s).

4. **Commit** per the `/sdlc:commit` convention: atomic commits, subject prefixed with the key, a body explaining the *why* when the change isn't self-explanatory.

5. **Push and set upstream.** `git push -u origin <branch>` (`-C <worktree>` when set).

6. **Open the PR against the resolved base branch.** `gh pr create --base <base_branch> --title "<KEY>: <summary>" --body "<body>"` (`cd <worktree> &&` prefix when set) — `<base_branch>` is `sprint/<id>` under `branchModel: sprint`, or `main` under `branchModel: direct` (both resolved above). **Always** populate the body from this template — the checklists (`- [ ]`) are not optional; tick what's verified and leave the rest visible so the reviewer sees what's outstanding:

   ```markdown
   ## Summary
   <what the story delivers, 2–4 sentences> — closes <KEY>

   ## Acceptance criteria
   - [ ] <AC 1> — <how this PR satisfies it: file:line / behavior>
   - [ ] <AC 2> — ...

   ## Test plan
   Local quality gate (real outcomes):
   - [ ] <verify command 1>
   - [ ] <verify command 2>   (<n> tests)
   - [ ] ...

   Coverage & verification:
   - [ ] New/updated tests mapped to AC (<which test covers which AC>); edge cases: <…>
   - [ ] Manual / out-of-band steps where tests don't fully cover the AC: <commands, endpoints, expected output — or "n/a">

   ## Required CI checks (gate this PR)
   - [ ] <check name 1>
   - [ ] <check name 2>
   ```

   `closes <KEY>` in the Summary is what links the PR to the issue — Jira and Linear both auto-link a mentioned key in the PR title/body, no separate link needed. **For a local key, omit the linking clause entirely** — `<what the story delivers, 2–4 sentences>` with nothing to close, since there's no tracker issue behind it.

   Don't tick a box you haven't actually verified — an unchecked item is a signal, not a formatting miss. The AC block may instead be a Markdown table with a status column (✅/⬜) if that reads cleaner; either form is fine as long as every AC maps to evidence.

7. **Report back.** Print the PR URL, its base, and the required checks that gate the merge. Next steps: wait for CI green, then merge into `<base_branch>` (self-approval allowed under this repo's `branchModel`), `/sdlc:story-check` to verify, `/sdlc:close-story` to close.

## Updating an existing PR

When the story PR already exists and you're making a follow-up change (addressing review feedback, fixing a red check), **do not auto-push** — pushing updates the live PR:

- Make the edit and commit locally per the commit convention. Re-run the local quality gate first.
- **Stop at the commit.** Report the new commit (SHA + subject) and state clearly it is **not yet pushed**.
- Offer to push and do so only on an explicit yes. (Pushing new commits dismisses/re-requests review on some rulesets — another reason it's the user's call.)

## Notes

- This command does **not** transition the tracker issue or post the completion record — that happens after CI is green (`/sdlc:close-story`), citing the real CI run. It also does not merge.
- `gh` resolves the repo from the remote — no machine-specific paths. If `gh` isn't authenticated, stop and tell the user to run `gh auth login`.
