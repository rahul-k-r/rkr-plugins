---
name: gemini-model-effort
description: Resolves which Antigravity subagent model tier to use for each SDLC agent at very-low, low, medium, high, or extra-high effort.
---

# Antigravity model effort

Resolve effort in this order: an explicit `--effort` argument, the saved
run's effort when resuming, `.sdlc/config.json`'s `effort`, then `high`.

## Dispatch

Pass an explicit `Model` value to every `invoke_subagent` entry. Do not use
`"inherit"`: subagent capability must not depend on the orchestrating session's
selected model.

Available model tier keys:

| Slot | `Model` value |
|---|---|
| economy | `"flash_lite"` |
| balanced | `"flash"` |
| flagship | `"pro"` |

## The table

| Agent | High (default) | Very Low | Low | Medium | Extra High |
|---|---|---|---|---|---|
| `coder` | `pro` | `flash` | `flash` | `pro` | `pro` |
| `architect` | `pro` | `flash` | `flash` | `pro` | `pro` |
| `designer` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `panelist` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `verifier` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `moderator` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `cartographer` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `flow-tracer` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `integrator` | `pro` | `flash` | `flash` | `flash` | `pro` |
| `reviewer` | `flash` | `flash_lite` | `flash` | `flash` | `pro` |
| `planner` | `flash` | `flash_lite` | `flash` | `flash` | `pro` |
| `intake` | `flash` | `flash_lite` | `flash` | `flash` | `flash` |
| `surveyor` | `flash` | `flash_lite` | `flash` | `flash` | `flash` |
| `validator` | `flash_lite` | `flash_lite` | `flash_lite` | `flash_lite` | `flash_lite` |
| `publisher` | `flash_lite` | `flash_lite` | `flash_lite` | `flash_lite` | `flash_lite` |

Record the resolved effort in run state. On resume, read the saved value before
repository configuration.
