# Product Design Audit — <Project> — <run-id>

audited: <date> · depth: <quick|standard|exhaustive> · archetype: <...>
inputs: <spec, tdd, decisions, adrs, eval framework — with versions/dates>
pipeline: /sdlc:product-design-review · dispatches: <n> · flows traced: <n> · issues: <n>

## 1. Verdict at a glance

Three sentences max: overall design health, the dominant gap pattern, the one
thing to fix first. Then the table:

| Severity | Found | Accepted | Modified | Rejected | Deferred |
|---|---|---|---|---|---|
| BLOCKER / GAP / RISK / IMPROVEMENT / QUESTION | … | | | | |

## 2. Product profile

The resolved P1–P13 checklist: dimension · answer · status · citation/source
(docs vs human-at-gate). STATED_NO_RATIONALE dimensions link to their
fitness findings in §4.

## 3. Coverage & traceability

Matrix summary: N requirements, N design-anchored, N ticket-covered. The four
orphan lists (requirements without design / without tickets; stories without
requirements; components without stories) — full lists, not samples. Under
`tracker: none`, the ticket-side counts are zero by construction — say so
plainly rather than presenting it as a coverage gap.
If an eval framework is configured: the domain maturity scorecard
(domain · score 0–4 · CRITICAL flag · related findings).

## 4. Flow sweep results

Per flow (inventory order): coverage verdict, variants traced, findings raised.
Flag every `unowned` and `implied_only` flow explicitly. Note each flow's build state
(NONE/PARTIAL/FULL) and list all `DESIGN_CODE_DRIFT` findings — where the
built product and the documents disagree — separately: they are the
mid-implementation review's most actionable output.

## 5. Findings

Grouped by severity, then partition. Each: the docket entry (finding, evidence,
panel positions **with dissents verbatim**, verifier verdict) + the human
verdict and rationale from the minutes. Rejected findings appear here marked
rejected-with-rationale.

## 6. Decisions & debate outcomes

Every `NEEDS_HUMAN_DEBATE` item: the split/red-line, who decided, what, why.
These are candidate entries for the decisions ledger — list the graduation
backlog explicitly.

## 7. Published changes

The executed manifest: tickets created (keys), ACs amended, comments posted,
doc changes committed. Publisher's per-entry results including failures. Under
`tracker: none`, this section covers doc-side changes only — note that the
ticket-facing remedies remain drafted-but-unpublished in `findings.json` until
a tracker is configured.

## 8. Residue

Deferred items with revisit triggers · open QUESTIONs · REFUTED-findings
appendix (finding + refuting citation — kept as evidence the audit checked) ·
known limits of this run (depth cuts, docs not ingested, flows skipped).

## 9. Provenance

Run directory contents, agent dispatch counts by role/model, token/timing
stats (`/sdlc:show-stats <run-id>`), session sittings and
participants.
