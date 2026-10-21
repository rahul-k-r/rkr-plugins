# Codex model effort

Resolve effort in this order: an explicit `--effort` argument, the saved
run's effort when resuming, `.sdlc/config.json`'s `effort`, then `high`.

Codex's `multi_agent_v1__spawn_agent` currently accepts concrete model
overrides. It does not provide stable tier aliases to plugin skills, so SDLC
defines semantic model slots and resolves them against the models currently
advertised by the Codex tool at dispatch time:

- `economy`: the fastest, lowest-cost agentic coding model available.
- `balanced`: the balanced agentic coding model available.
- `workhorse`: the reliable everyday agentic coding model available.
- `flagship`: the most capable model available for demanding work.

The model slot is a plugin-level pointer; the concrete model ID is supplied by
Codex's current tool metadata. Do not write generation-specific IDs into this
file or into a command adapter. If a slot cannot be resolved from the models
Codex advertises, stop and report the missing capability instead of inheriting
the parent session's model.

## The table

The public effort tier selects a calibrated model-slot and native
`reasoning_effort` pair. The slash separates them. Across each agent's effort
ladder, an adjacent tier changes **at most one axis**: either the model slot
or the reasoning level. Mechanical agents may remain unchanged. Do not combine
a model-class jump with a reasoning-budget jump in one step.

| Agent | High (default) | Very Low | Low | Medium | Extra High |
|---|---|---|---|---|---|
| `coder` | `workhorse` / `high` | `balanced` / `low` | `balanced` / `medium` | `balanced` / `high` | `flagship` / `high` |
| `coder (retry)` | `workhorse` / `high` | `balanced` / `medium` | `workhorse` / `medium` | `workhorse` / `high` | `flagship` / `high` |
| `architect` | `workhorse` / `high` | `balanced` / `low` | `balanced` / `medium` | `workhorse` / `medium` | `flagship` / `high` |
| `designer` | `workhorse` / `high` | `balanced` / `low` | `balanced` / `medium` | `workhorse` / `medium` | `workhorse` / `xhigh` |
| `panelist` | `workhorse` / `high` | `balanced` / `low` | `balanced` / `medium` | `balanced` / `high` | `workhorse` / `xhigh` |
| `verifier` | `workhorse` / `high` | `balanced` / `low` | `balanced` / `medium` | `balanced` / `high` | `workhorse` / `xhigh` |
| `moderator` | `workhorse` / `high` | `balanced` / `low` | `balanced` / `medium` | `balanced` / `high` | `workhorse` / `xhigh` |
| `cartographer` | `workhorse` / `high` | `balanced` / `low` | `balanced` / `medium` | `balanced` / `high` | `workhorse` / `xhigh` |
| `flow-tracer` | `workhorse` / `high` | `balanced` / `low` | `balanced` / `medium` | `balanced` / `high` | `workhorse` / `xhigh` |
| `integrator` | `workhorse` / `high` | `balanced` / `low` | `balanced` / `medium` | `balanced` / `high` | `workhorse` / `xhigh` |
| `reviewer` | `balanced` / `high` | `economy` / `low` | `economy` / `medium` | `balanced` / `medium` | `workhorse` / `high` |
| `planner` | `balanced` / `high` | `economy` / `low` | `economy` / `medium` | `balanced` / `medium` | `workhorse` / `high` |
| `intake` | `balanced` / `high` | `economy` / `low` | `economy` / `medium` | `balanced` / `medium` | `balanced` / `xhigh` |
| `surveyor` | `balanced` / `high` | `economy` / `low` | `economy` / `medium` | `balanced` / `medium` | `balanced` / `xhigh` |
| `validator` | `economy` / `low` | `economy` / `low` | `economy` / `low` | `economy` / `low` | `economy` / `low` |
| `publisher` | `economy` / `low` | `economy` / `low` | `economy` / `low` | `economy` / `low` | `economy` / `low` |

**The retry ladder.** `coder (retry)` is not an agent: it is the row used for
every retry of a batch, every final-review fix dispatch, and every `review-fix`
coder dispatch (a resumed dispatch after a mid-batch death keeps the row of the
attempt that died). The first attempt starts cheaper than High at Low and
Medium and escalates on failure; High and Extra High never escalate. This
mirrors `internal/model-effort/SKILL.md`; the slots map to its models as
`economy`≈haiku, `balanced`≈sonnet, `workhorse`≈opus, `flagship`≈fable. At
Medium, `designer` moves up to `workhorse` and `coder` starts at `balanced`.
Codex has no advisor equivalent, so the ladder is the only escalation path.

At dispatch time, resolve the slot to a concrete model ID, then pass that ID
with the table's `reasoning_effort`. Every dispatch must set both fields;
never inherit the parent model. Record the resolved effort in run state and,
on resume, read the saved value before repository configuration.
