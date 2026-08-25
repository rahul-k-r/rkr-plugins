---
description: "Gate check before implementation: verify the design note, fetch the full AC (or record locally-stated criteria), cut the correctly-named branch from the resolved base branch, and move the issue to In Progress."
argument-hint: "<STORY-KEY> [--worktree <path> | --no-worktree] [--incognito] [--technical] (e.g. AGL-19)"
---

# /sdlc:story-start

Pick up a story: verify the design-note gate, read the full acceptance criteria (or record success criteria directly when there's no tracker), cut the correctly-named branch from the resolved base branch, and move the issue to In Progress. This is the front of the lifecycle (`To Do → In Progress`) — investigate before you write.

Arguments arrive as `$ARGUMENTS`: `$1` is the story key. Resolve the tracker per `skills/tracker-adapter/SKILL.md` (Step 0) before doing anything else. If a tracker is configured and `$1` looks like it, treat it as a real key — resolved from the tracker, never inferred or guessed; translate any legacy ticket-ID scheme first. If it doesn't resolve, or `tracker: none`, or no `$1` was given at all, this is a **local key / no-ticket run** — the same handling `/sdlc:story-run` uses: no lookup is ever attempted against the key, the developer states success criteria directly instead of an AC fetch, and every tracker write redirects to `docs/stories/<KEY>/provenance.md`. `--incognito` forces that write-redirect even when a real tracker key resolved (reads still happen normally) — a local key implies it automatically, no flag needed.

## Output style (`--technical`)

`--technical` (anywhere in `$ARGUMENTS`) keeps chat output in the engineer-level voice. Without it (the default), everything explained to the developer — the AC summary, any refusal and what's missing, the assignment questions, and the subtask plan — follows `skills/plain-language/STANDARD.md`; branch names, tracker keys, and posted comments (or provenance entries) keep their fixed technical form either way.

## Steps

0. **Preflight — resolve the tracker and write-mode.** Per `skills/tracker-adapter/SKILL.md`: read `.sdlc/config.json` (or detect the registered MCP family this session and ask, offering to persist the choice). `tracker: none` is **never** a reason to stop — it just means this is a local-key run (see above). Resolve `write_mode`: `--incognito` passed, or a local key, or `tracker: none` → `incognito`; otherwise `normal`.

1. **Check the design note exists.** Verify `docs/design-notes/$1.md` is present. If missing, refuse: "No design note found. Run `/sdlc:plan-the-design $1` first."

2. **Check the design note is substantive.** Read it and verify:
   - §1 (Scope) has concrete content in "What it is" and "What it is NOT" — not template placeholders or HTML comments only.
   - §3 (Key Design Issues) has at least one issue with a filled Decision and Invariant — not stub text.
   - §5 (Cross-Story Obligations) either has entries with "Traceability comment posted? yes" or is explicitly empty/N/A.
   If any check fails, refuse with a specific message naming the deficient section.

3. **Story text and acceptance criteria.** **Real tracker key:** fetch the issue via the tracker-adapter's `get_issue` op. Confirm it's a real story in the repo's tracker project and not already In Progress/Done under someone else. Read the *complete* AC and design detail — partial reads cause mis-scoped stories and premature closes. Summarize the AC back to the user as a checklist so scope is explicit up front. Resolve any legacy ticket-ID references in the body to live keys via the adapter's `search` op — never assume a legacy ID maps 1:1 — and record the mapping. **Local key / `tracker: none`:** skip the fetch entirely — ask the developer directly for the story's success criteria (paste them, or point at what was already discussed in this chat) and wait for their answer before continuing; record it verbatim as `local_ac` for use through the rest of this run.

3a. **Assignment check (typo guard) — runs only when a real tracker key resolved; skipped entirely for a local key (nothing to assign).** Resolve the user's own tracker account via the adapter's `get_current_user` op and compare to the issue's assignee:
   - *Assigned to them* → proceed.
   - *Unassigned* → show the summary and ask: **assign it to you and add it to the active sprint/cycle?** Yes → assign the issue and `add_to_cycle`; no → stop (an unassigned key is the classic typo signature).
   - *Assigned to someone else* → show the summary and current assignee; require a **second explicit confirmation plus a one-line reason**; on confirm, reassign via the adapter's write op and record the reassignment (previous → new assignee, the reason) — as a tracker comment under `write_mode: normal`, or a provenance entry under `incognito` — a takeover is never silent. On decline, stop.

4. **Check tracker alignment.** **Jira:** read the ticket's "Design Note" custom field; verify it references `docs/design-notes/$1.md` (path or URL). If the field is empty or points elsewhere, warn but do not block — print a reminder to update the field. **Linear:** has no custom-field equivalent (per `skills/tracker-adapter/SKILL.md`'s `update_field` row) — skip this check; the design note's location is recorded in the completion record `/sdlc:close-story` posts instead. **Local key / `tracker: none`:** skip — there's no ticket to align.

5. **Sync the base branch.** Read `branchModel` from `.sdlc/config.json`. Under `branchModel: sprint`, detect the active sprint branch as the highest-numbered `sprint/*` on origin (`git ls-remote --heads origin 'sprint/*'`); if none exists or more than one is plausible, ask — accept an explicit override. Under `branchModel: direct`, the base is `main` — no detection needed. Then make the local copy current: `git fetch origin && git switch <base> && git pull --ff-only`, so the story branch is cut from the latest base head.

6. **Create or confirm the story branch and worktree.** Name the branch by the kind of work, slug from the story summary (or `local_ac`): `feat/<key-lower>-slug` (new functionality), `fix/<key-lower>-slug` (bug fix), or `chore/<key-lower>-slug` (tooling/hygiene) — or the repo's own convention from `CLAUDE.md`. **Apply worktree mode**, per `skills/worktree-mode/SKILL.md`: default (neither flag passed) → `git worktree add .claude/worktrees/<key-lower>-slug -b <branch> <base>`; `--worktree <path>` → verify it's a registered worktree (`git worktree list`) on the right branch and use it as-is, don't create; `--no-worktree` → cut/confirm the branch directly in the current checkout (`git switch -c <branch>` from the base if new; if the branch already exists, confirm it's based on the current base head). Never force-push or reset existing branches. Record `worktree` (absolute path, or `null`) in `story-state.json` — this session's own root never moves regardless of which mode applies; every subsequent git/file operation this story's commands perform targets `worktree` via path-qualified commands when it's set, never a session-level directory change. `docs/stories/<KEY>/` always resolves relative to this session's own root, not `worktree` — see that skill for why.

6a. **Commit the design note onto the branch.** `/sdlc:plan-the-design` wrote `docs/design-notes/$1.md` before this branch existed, so it's likely still untracked (or, on an existing branch, may have uncommitted edits from a later `/sdlc:design-review` pass). Check `git status docs/design-notes/$1.md docs/adr` (`-C <worktree>` when set): if anything is untracked or modified, `git add` it and commit now (`git commit -m "$1: add design note"`) so it ships as part of this story's history from the start. Never leave it to ride along accidentally in a later commit.

7. **Move the issue to In Progress.** **Real tracker key, `write_mode: normal`:** use the tracker-adapter's `transition_status` op. Already In Progress → skip. If the transition fails, report the error and current status — don't retry silently. (Jira note: the transition tool's inline `comment` parameter requires Atlassian Document Format — passing Markdown fails with *"Operation value must be an Atlassian Document"*. Transition without the inline comment; post any comment separately via `add_comment`.) **`write_mode: incognito`** (explicit `--incognito`, or automatic via a local key / `tracker: none`): skip the tracker call entirely and append a provenance entry instead — "would have transitioned `<key>` to In Progress."

8. **Derive the implementation-subtask plan.** From the design note's §1 (Scope), §3 (Key Design Issues / Decisions), and §6 (Reviewer Verification) — and, for a local-key run, the `local_ac` recorded in Step 3 — produce an ordered list of implementation subtasks. Each subtask: one sentence, the package(s) touched, and which decision(s) it realizes.

9. **Print the plan and stop.** Output the subtask list. Do not write code. Do not create files beyond the branch. The developer proceeds from here — manually via `/sdlc:commit` → `/sdlc:build-check` → `/sdlc:story-pr`, or autonomously via `/sdlc:story-run`.
