---
name: agy-product-design-review
description: Antigravity-invocable form of /sdlc:product-design-review — autonomous product-level design audit, traceability matrix, flow sweep, lens-panel deliberation, adversarial verification, then human review sessions and a gated publish.
---

# /agy-product-design-review

Read `commands/product-design-review.md` in full and follow its steps exactly, verbatim,
**except**:

1. Every "dispatch `<agent>`" — translate per `docs/antigravity-port-notes.md`'s **"How to
   translate a Task dispatch"** section (`invoke_subagent`, persona injected into `Prompt`, model
   from `skills/gemini-model-effort/SKILL.md`). Applies to every `surveyor`, `cartographer`,
   `flow-tracer`, `panelist`, `moderator`, `verifier`, `publisher` dispatch throughout.
2. **Effort/model resolution** — use `skills/gemini-model-effort/SKILL.md` in place of
   `skills/model-effort/SKILL.md` everywhere the file says to resolve one. Its own "Model tiering"
   table (all at `High`) translates as:

   | This file says | Use instead |
   |---|---|
   | `surveyor` = sonnet | `flash` |
   | `cartographer` = opus | `pro` |
   | `flow-tracer` = opus (P1/P2) / sonnet (P3) | `pro` (P1/P2) / `flash` (P3) — same split, translated |
   | `panelist` = opus | `pro` |
   | `moderator` = opus | `pro` |
   | `verifier` = opus | `pro` |
   | `publisher` = haiku | `flash_lite` |

   For any other effort tier, read `skills/gemini-model-effort/SKILL.md`'s table directly rather
   than re-deriving it here.
3. **`--show-stats`'s Artifact-publish step is unavailable, not ported** — this file says its
   telemetry conventions are "identical to story-run," so the same caveat from
   `docs/antigravity-port-notes.md` applies: still collect and snapshot locally, skip the publish
   step and say so.

Everything else — INVENTORY/PROFILE GATE/FLOW SWEEP/DELIBERATE/VERIFY+SYNTHESIZE, the
persona-partitioned human sessions, the bulk publish gate, budget guardrails, tracker-adapter
resolution — applies completely unchanged; every path it references resolves identically under
Antigravity (shared `agents/`/`skills/` folders, no redirect needed).
