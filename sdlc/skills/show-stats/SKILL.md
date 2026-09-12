---
name: show-stats
description: Render the usage-stats report (per-agent model/timing/tokens, phase durations) for a story-run/design-run/review-run/review-fix. Callable as /sdlc:show-stats.
---

# /sdlc:show-stats

Render the usage-stats report (per-agent model/timing/tokens, phase durations) for a story-run/design-run/review-run/review-fix run, on demand.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `skills/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Artifact Rendering**: Under Antigravity, render `skills/run-stats/template.html` filled with data and save it as an artifact in the session artifact directory (`<artifactDirectoryPath>/stats.html` or `.md`) for user viewing.

Read `commands/show-stats.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (`[STORY-KEY | review run-id]`).

