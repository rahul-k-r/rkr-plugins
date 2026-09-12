---
name: plan-the-design
description: Run the full design-review protocol for a story as an interactive dialogue with the developer, producing a design note and posting cross-story obligations. Callable as /sdlc:plan-the-design.
---

# /sdlc:plan-the-design

Run the full design-review protocol (Q1-Q7) for a story as an interactive dialogue with the developer, producing a design note in `docs/design-notes/<KEY>.md` and posting cross-story obligations.

> **Path Resolution**: Resolve all referenced plugin paths (`commands/...`, `skills/...`) relative to the plugin directory (two levels above this `SKILL.md`).
> **Tool Translation**: Use `ask_question` for structured inquiries when clarifying options with the user, `view_file` for reading code, and `write_to_file` for creating the design note.

Read `commands/plan-the-design.md` (in the plugin directory) in full and follow its steps.
Pass through `$ARGUMENTS` (`<STORY-KEY> [--plain]`).

