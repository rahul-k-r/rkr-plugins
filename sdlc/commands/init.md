---
description: "Bootstrap a repo for the sdlc workflow. Idempotent — safe to run repeatedly."
argument-hint: "(no arguments)"
---

# /sdlc:init

1. **Ensure `docs/design-notes/` exists.** Create the directory if missing. Do not error if it already exists.

2. **Ensure `docs/adr/` exists.** Create the directory if missing. Do not error if it already exists.

3. **Copy the design-note template.** Write `skills/design-review/template.md` (from this plugin) to `docs/design-notes/_TEMPLATE.md`. If `_TEMPLATE.md` already exists, compare contents — overwrite only if the plugin's template is newer (by version in plugin.json). Print whether the template was written, skipped, or updated.

4. **Create process pointer.** Ensure `docs/process/` exists. Write `docs/process/design-review.md` with content:
   ```
   # Design-Review Process

   This repo uses the sdlc plugin's design-review process.
   See the canonical process document: sdlc/skills/design-review/process.md
   ```
   If the file already exists with this content, skip. If it exists with different content, do not overwrite — warn the user.

5. **Resolve and persist `.sdlc/config.json`.** If it already exists, print its current values and skip straight to step 6 — this step never overwrites an existing config; use a plain edit (or delete the file) to change it later.

   Otherwise, ask two questions (see `skills/tracker-adapter/SKILL.md` for the full resolution logic behind the first one):

   - **Tracker**: try auto-detection first (which MCP tool family — Jira or Linear — is registered this session). Exactly one found → confirm it with the developer rather than asking cold. Both or neither found → ask outright, offering `jira` / `linear` / `none` (`none` is a real, fully-supported answer — not a fallback to apologize for). If `jira`, also ask for the project key; Linear's team prefix is read off issue keys directly and doesn't need to be asked separately.
   - **Branch model**: does this repo use sprint branches with a teammate-approved sprint→main merge, or does it merge story PRs straight to `main`, self-approved? Offer `sprint` / `direct`, defaulting the suggestion to `direct` if the repo has no `sprint/*` branches on `origin` (a real signal, not a guess) and to `sprint` if it does.

   Write `.sdlc/config.json`:
   ```json
   {
     "tracker": "jira|linear|none",
     "trackerProjectKey": "<Jira project key, or null>",
     "branchModel": "sprint|direct"
   }
   ```

6. **Report.** Print a summary of actions taken (created / skipped / updated for each path, including the config). No commits — the user decides when to commit the scaffolding.
