---
description: "Open the end-of-week sprint→main PR — the reviewed, approval-required merge that lands a whole sprint onto main."
argument-hint: "[sprint-id] [--technical]"
---

# /sdlc:sprint-pr

Open the end-of-week **sprint→main** pull request — the reviewed, approval-required merge that lands a whole sprint's worth of stories onto `main`. This is the gated boundary: unlike per-story PRs (which merge into the sprint branch self-approved), this one needs a teammate's approving review and green required checks before it can merge. The reviewer verifies the aggregate diff against each included story's completion record and acceptance criteria.

This command's entire purpose only makes sense under `branchModel: sprint` — see **Preflight** below for what happens on a `direct` repo.

Arguments arrive as `$ARGUMENTS`: `$1` is an optional sprint id, resolved as `sprint/<id>`. If none is given, detect the active one as the highest-numbered `sprint/*` on origin (`git ls-remote --heads origin 'sprint/*'`); if ambiguous, ask.

## Output style (`--technical`)

`--technical` (anywhere in `$ARGUMENTS`) keeps chat output in the engineer-level voice. Without it (the default), everything explained to the developer — sprint readiness, any story flagged as not Done, why reconciliation with `main` is needed, and the pending gate — follows `agent-plugin/skills/plain-language/STANDARD.md`; the PR title/body keep their fixed template in both modes.

## Steps

0. **Preflight.** Read `.sdlc/config.json`. **If `branchModel: direct`, stop immediately** and say plainly: this repo is configured `direct` (merges straight to `main`) — there's no sprint branch to close; see `/sdlc:story-pr` and `/sdlc:close-story` instead. Do nothing else. Under `branchModel: sprint`, proceed — everything below is unchanged. Then resolve project config from the target repo's `CLAUDE.md`: verify commands and required CI check names.

1. **Resolve the sprint branch** and confirm it exists on origin.

2. **Confirm the sprint is ready to land.** The sprint→main merge should bundle finished work, not work-in-progress:
   - List the stories merged into the sprint branch (from merge commits / the tracker's sprint or cycle board — `agent-plugin/skills/tracker-adapter/SKILL.md`) with their keys.
   - Confirm each is **Done** in the tracker (or explicitly call out any intentionally-included-but-not-Done item). A story still In Progress shouldn't ride to `main` silently — flag it and let the user decide (hold it, or descope it out of this merge).

3. **Sync and reconcile with `main`.** `git fetch origin`. If `main` has advanced since the sprint branch was cut, merge `main` into `sprint/<id>` first and resolve conflicts there — so the PR diff is clean and CI runs against the real post-merge state. Never resolve sprint-vs-main conflicts inside the PR merge itself.

4. **Run the full local quality gate** (`/sdlc:build-check`) on the sprint branch head. If any step fails, stop and report — don't open the PR.

5. **Open the PR.** `gh pr create --base main --head sprint/<id> --title "Sprint <id>: merge to main" --body "<body>"`. The title is **not** key-prefixed — it spans multiple stories. **Always** populate the body from this template; tick what's verified and leave the rest visible:

   ```markdown
   ## Sprint <id> → main

   ## Included stories  (each already Done at its story→sprint merge)
   - [ ] <KEY> — <one-line summary> <tracker link>
   - [ ] <KEY> — ...

   ## Test plan
   Local quality gate on the sprint head (real outcomes):
   - [ ] <verify command 1>
   - [ ] <verify command 2>   (<n> tests)
   - [ ] Integration verification across stories (interactions the per-story PRs couldn't cover, e.g. a shared package/contract): <what was exercised, or "n/a">

   (Each included story carries its own per-story test plan in its merged PR — this covers the aggregate, not a re-test of every story.)

   ## Required CI checks (gate this PR)
   - [ ] <check name 1>
   - [ ] <check name 2>

   ## Follow-ups / known gaps
   - <deferred item — linked story> (or "none")
   ```

6. **State the gate.** This PR merges only when the required checks are green **and** it has **1 approving review from a teammate with write access — no self-approval.** Request a reviewer.

7. **Report back.** Print the PR URL, the included story keys, and the pending gate (CI + review). After it merges, remind the user to cut the next `sprint/<id+1>` branch from the updated `main`.

## Updating an existing PR

When the sprint→main PR already exists and you're making a follow-up change (resolving a conflict, fixing a red check, addressing review), **do not auto-push** — pushing updates the live, reviewed PR:

- Make the edit and commit locally per the `/sdlc:commit` convention. Re-run the full quality gate first.
- **Stop at the commit.** Report the new commit (SHA + subject) and state clearly it is **not yet pushed**.
- Offer to push and do so only on an explicit yes. (Pushing new commits dismisses/re-requests review on some rulesets.)

## Notes

- The included stories are already **Done** (closed at their story→sprint merge by `/sdlc:close-story`); this merge is integration + the peer-review gate, not a re-close. Don't re-transition them.
- No self-approval, ever, on this PR — that's the whole point of moving the review here.
- The title spans the sprint, so it carries no single tracker key; tracker links happen via the per-story PRs already merged into the branch.
- `gh` resolves the repo from the remote — no machine-specific paths. If `gh` isn't authenticated, stop and tell the user to run `gh auth login`.
- This command only ever runs under `branchModel: sprint` (Step 0 stops it otherwise), but stays tracker-generic like every other command — a `sprint`-model repo can still use Jira, Linear, or no tracker at all; see `agent-plugin/skills/tracker-adapter/SKILL.md`.
