# Plain-Language Output Standard (`--technical`)

This plugin's commands that explain, deliberate, or gate — `story-run`, `design-run`, `review-run`, `review-fix`, `plan-the-design`, `design-review`, `story-start`, `story-pr`, `story-check`, `sprint-pr`, `close-story` — accept a `--technical` flag. It controls one thing: **the voice of what the command says to the developer in chat.** The mechanical commands (`adr`, `build-check`, `commit`, `help`, `init`, `show-stats`) don't take the flag: invoked standalone they keep their normal voice; executed inside a run or another flagged command, they inherit the caller's mode (see **Cascade** below).

- **Without `--technical` (the default):** everything explained to the developer in chat follows the standard below — briefings, scope framings, design issues, alternatives with pros & cons, questions, escalations, gate digests, verdicts, reports, and hand-offs. This is the accessible mode: someone without an engineering background should be able to follow the run and make every decision it asks of them.
- **With `--technical`:** chat output uses the plugin's engineer-level voice — terse, jargon-fluent, no re-explaining of fundamentals.

Parse `--technical` from anywhere in `$ARGUMENTS`. It composes with every other flag.

## What the flag never changes

Durable artifacts keep their fixed technical form in **both** modes — they are records read by teammates, reviewers, CI, and future runs, not chat:

- design notes, ADRs, `DECISIONS.md` entries
- commit messages, branch names, PR titles/bodies, GitHub reviews and review comments
- tracker comments (plan digests, batch records, escalation audit copies, completion records, obligation comments) — or local provenance entries under incognito
- code, tests, config, and everything committed to the repo
- state files, checkpoints, context packs, and stats snapshots

In plain mode, a command that produces one of these artifacts still writes it exactly per its template — and then explains **in chat, in plain language** what the artifact says and why it matters. The artifact is the record; the chat is the explanation of the record.

Exact values are also never translated away: ticket keys, branch names, file paths, command names, SHAs, URLs, counts, and verdicts (PASS/FAIL, READY/GAPS, SPRINT_READY/HOLD) stay verbatim in both modes — the developer needs them to act. Plain mode explains what each one *is for*, it does not blur it.

## The standard

The model interaction (the origin of this standard is `plan-the-design`'s Phase 0.5 briefing): *"Explain in plain language the scope of what we are planning to implement in this story, the design issues, the implications, the alternatives, pros & cons."* Generalize that shape to everything said in chat:

1. **Outcome first, in words anyone can repeat back.** Lead with what the thing is or what just happened and why it matters, in one or two sentences, before any mechanism. "The safety checks on your change all passed, so it's ready to be proposed for merging" before any command output.
2. **Define jargon at first use, or replace it.** "Branch (a separate working copy of the code where this story's changes live)", "CI (the automated checks that run on every proposed change)", "merge (folding these changes into the shared code)". Once defined in the conversation, the term may be used freely.
3. **Explanations follow the briefing shape:** scope (what we're building/doing) → the issues that matter and why → the implications → the realistic alternatives → their pros & cons → the recommendation. Prose over tables; short sentences; no acronym soup.
4. **Questions must be answerable without reading code.** Whenever the developer is asked to decide — an escalation, a gate, discovered-work triage — state each option's practical consequence: what they gain, what they risk, what is hard to undo. Always include a recommendation and the reason for it.
5. **Plain is not vague.** Failures are stated as failures, gaps as gaps. Quote the verbatim error or finding when it's evidence, then follow it with one plain sentence saying what it means and what happens next. Never soften a verdict to make it friendlier.
6. **Don't over-explain the routine.** A step that worked needs one plain sentence, not a paragraph. Spend the words where a decision or a problem is.

## Propagation in multi-agent runs

The orchestrating session is the only thing that talks to the developer, so the flag lives there: subagents (`designer`, `architect`, `coder`, …) are dispatched exactly as today and return their normal technical output — the orchestrator translates when presenting in plain mode. Never dilute a dispatch prompt or an agent's artifact for the flag's sake.

Long-running commands (`story-run`, `design-run`, `review-run`) record `"technical": true|false` in their state file at init, so `--resume` continues in the same mode without re-passing the flag; passing `--technical` at resume time overrides the stored value.

## Cascade — the mode follows the run

The output mode is set **once, at the top-level invocation**, and governs everything that invocation does — including every other command's procedure it executes inline. Concretely:

- `story-run`'s DESIGN phase (the `design-run` procedure), its verify steps (`build-check`), its PR step (`story-pr`'s body template and report-back), and — under `--bypass` — the entire tail (`review-run` Mode A, the `review-fix` fix loop, the `story-check` audit, `close-story` inline) all speak in the mode the `story-run` invocation set. `story-run AGL-42 --bypass --technical` is engineer-voiced end to end; without `--technical` the whole lifecycle is narrated plainly.
- `review-run --close` carries its mode into the inline `sprint-pr` procedure.
- On `--resume`, the state file's `technical` field restores the mode for whatever remains of the run, including the tail.

There is no per-phase renegotiation: a run never switches voice mid-flight unless the developer explicitly asks it to.
