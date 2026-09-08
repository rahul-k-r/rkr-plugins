---
description: "Bootstrap a repo for the sdlc workflow. Idempotent — safe to run repeatedly."
argument-hint: "(no arguments)"
---

# /sdlc:init

1. **Ensure `docs/design-notes/` exists.** Create the directory if missing. Do not error if it already exists.

2. **Ensure `docs/adr/` exists.** Create the directory if missing. Do not error if it already exists.

3. **Copy the design-note template.** Write `agent-plugin/skills/design-review/template.md` (from this plugin) to `docs/design-notes/_TEMPLATE.md`. If `_TEMPLATE.md` already exists, compare contents — overwrite only if the plugin's template is newer (by version in plugin.json). Print whether the template was written, skipped, or updated.

4. **Create process pointer.** Ensure `docs/process/` exists. Write `docs/process/design-review.md` with content:
   ```
   # Design-Review Process

   This repo uses the sdlc plugin's design-review process.
   See the canonical process document: sdlc/agent-plugin/skills/design-review/process.md
   ```
   If the file already exists with this content, skip. If it exists with different content, do not overwrite — warn the user.

5. **Resolve and persist `.sdlc/config.json`.** If it already exists, print its current values and skip straight to step 6 — this step never overwrites an existing config; use a plain edit (or delete the file) to change it later.

   Otherwise, ask four questions (see `agent-plugin/skills/tracker-adapter/SKILL.md`, `agent-plugin/skills/model-effort/SKILL.md`, and `agent-plugin/skills/local-docs/SKILL.md` for the full resolution logic behind the first, third, and fourth):

   - **Tracker**: try auto-detection first (which MCP tool family — Jira or Linear — is registered this session). Exactly one found → confirm it with the developer rather than asking cold. Both or neither found → ask outright, offering `jira` / `linear` / `none` (`none` is a real, fully-supported answer — not a fallback to apologize for). If `jira`, also ask for the project key; Linear's team prefix is read off issue keys directly and doesn't need to be asked separately.
   - **Branch model**: does this repo use sprint branches with a teammate-approved sprint→main merge, or does it merge story PRs straight to `main`, self-approved? Offer `sprint` / `direct`, defaulting the suggestion to `direct` if the repo has no `sprint/*` branches on `origin` (a real signal, not a guess) and to `sprint` if it does.
   - **Effort** (optional, default `high`): does this repo want every subagent at its full default model tier (`high` — the plugin's shipped behavior, safe to just accept), or a different baseline — cheaper/faster (`low`, `very-low`), a mixed step-down that still protects the highest-risk roles (`medium`), or maximum quality regardless of cost (`extra-high`)? Point at `agent-plugin/skills/model-effort/SKILL.md`'s table rather than re-explaining it here. Skip asking if the developer doesn't care — default to `high` silently.
   - **Local docs** (optional, default `false`): should design notes and ADRs be committed to the branch as usual, or stay local-only — written to disk, never staged or committed? Offer `false` / `true`. Skip asking if the developer doesn't care — default to `false` (the plugin's original behavior) silently.

   Write `.sdlc/config.json`:
   ```json
   {
     "tracker": "jira|linear|none",
     "trackerProjectKey": "<Jira project key, or null>",
     "branchModel": "sprint|direct",
     "effort": "very-low|low|medium|high|extra-high",
     "localDocs": false
   }
   ```

   Not asked here — an advanced, opt-in field a developer adds by hand later if their repo has a
   documented release-commit convention (e.g. a changelog rename + version bump, landed directly on
   a protected branch with no PR): `"releaseCommitPaths": ["CHANGELOG.md", "path/to/Version.file"]`.
   See `hooks/gate-git.js`'s top comment for exactly what it does.

6. **If `localDocs: true` was just chosen (or already was), ensure `docs/design-notes/.gitignore` and `docs/adr/.gitignore` exist**, each containing a bare `*` — the same reinforcement `agent-plugin/skills/local-docs/SKILL.md` describes, applied immediately rather than waiting for the first story to need it. Skip under `localDocs: false`.

7. **Report.** Print a summary of actions taken (created / skipped / updated for each path, including the config). No commits — the user decides when to commit the scaffolding.
