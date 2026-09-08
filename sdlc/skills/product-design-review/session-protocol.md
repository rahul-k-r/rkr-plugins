# product-design-review — human review session protocol

A session is one human (wearing one partition's hat) working that partition's
docket to completion, possibly across multiple sittings and chats. The
orchestrator runs the session; this protocol is binding.

## Opening a session (`--session <partition>`)

1. Load `run-state.json` + `decision-docket.md`. If the partition is
   COMPLETE, say so and show its verdict summary instead.
2. Present the **cross-partition brief** (one screen max): decisions other
   partitions have already made that touch this partition's items — "ENG
   accepted PDR-12 (retry semantics change), which affects your PDR-31 (progress
   UI)." Skip if nothing intersects.
3. Show the partition scoreboard: N items by severity, M already decided,
   estimated remaining.

## Working the docket

One issue per turn, severity order (BLOCKER → GAP → RISK → QUESTION), each
presented self-contained:

> **PDR-14 · GAP · rework|in-flight|unbuilt · CROSS-signed?** — title
> **Finding:** one paragraph. **Evidence:** verbatim quotes with refs.
> **Panel:** each lens's position, dissents verbatim, `NEEDS_HUMAN_DEBATE` flagged.
> **Verifier:** CONFIRMED (searched: …).
> **Recommendation + draft remedy:** the exact ticket/AC/amendment text.
> **Your verdict?** ACCEPT / MODIFY / REJECT / DEFER / INVESTIGATE

Verdict handling:

- `ACCEPT` — remedy as drafted → `ACCEPTED-pending-publish`.
- `MODIFY <direction>` — orchestrator revises the draft inline, human confirms
  the revision, then as ACCEPT.
- `REJECT <reason>` — reason is mandatory and recorded; rejected findings stay
  in the report marked rejected-with-rationale (they are audit history, not
  erased).
- `DEFER` — allowed except on BLOCKERs; deferred items land in the report's
  residue section with a named revisit trigger.
- `INVESTIGATE <question>` — dispatch one targeted agent (tracer/verifier
  scope) mid-session; present the answer on the same item and re-ask.

**Batch mode:** IMPROVEMENT-grade items are presented as a compact table; the
human may verdict them individually or `ACCEPT ALL` / `DEFER ALL`.

**QUESTION items:** the human's answer may reclassify (→ GAP with remedy, or
→ resolved-no-action); record the answer either way — and when the answer
supplies something the design docs don't state, auto-draft the corresponding
`doc-change` manifest entry (skill write-back rule), so the answer outlives
the audit.

## Rules

- **No tracker writes during sessions.** Verdicts mark intent; publish is a
  separate bulk gate.
- **CROSS items:** decidable only in the combined session (`--session all`) or
  by collecting recorded sign-off from two partitions — the state tracks
  which partitions have signed.
- Every verdict appends to `session-minutes.md`: item, verdict, rationale,
  human, timestamp. Minutes are the audit's decision log — write them as if
  they'll be read in six months (they will).
- Any pause: offer save-and-exit; state carries `docket_progress`; resume in
  any chat with the same `--session` flag.
- The orchestrator never argues a verdict. It may state, once, a material
  consequence the human seems unaware of ("note: rejecting this leaves
  BLOCKER PDR-2 unresolvable as drafted") — then records what the human decides.

## Session close

When the last item is decided: verdict summary (accepted / modified / rejected
/ deferred by severity), mark the partition COMPLETE, and if all partitions are
COMPLETE announce that `--publish` is now available.
