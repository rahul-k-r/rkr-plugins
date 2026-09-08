# Design Note

<!-- This is a living document. Update it as understanding evolves during
     implementation. "Living" means the note tracks ground truth — if the
     code diverges from what's written here, update the note, not the other
     way around. -->

| Field       | Value                                |
|-------------|--------------------------------------|
| Story       | <!-- tracker key (e.g. ENG-42), or a local slug like add-dark-mode --> |
| Title       | <!-- one-line story title -->        |
| Date        | <!-- YYYY-MM-DD of first draft -->   |
| Author      | <!-- who drove the design review --> |
| Status      | living                               |
| Depends-on  | <!-- story keys this consumes -->    |
| Related     | <!-- story keys touched but not owned --> |

---

## 1. Scope

<!-- What this story delivers. Be concrete: name the packages, endpoints,
     schemas, or behaviours that land. -->

**What it is:**

**What it is NOT:**

<!-- Name the adjacent owner explicitly. "Not X" is only useful if someone
     else owns X and you say who. -->

**Adjacent owner of the rest:**

---

## 2. Reconciliation

<!-- Compare the ticket's acceptance criteria against the as-built ground
     truth of the codebase at the time of this review. If this is greenfield
     with no prior code, write "N/A — greenfield." If existing code already
     partially satisfies the AC, note what's already true and what remains.
     Skip this section entirely if there is nothing to reconcile. -->

---

## 3. Key Design Issues

<!-- This is the heart of the design note. Surface the 2–5 decisions that
     actually matter for this story. Trivial stories may have only one.

     Per issue, follow the structure below. Do not pad — if an issue has an
     obvious answer, say so briefly and move on. The value is in the
     deliberation, not in filling every sub-heading. -->

### 3.N — <!-- Issue title: a concise statement of the design question -->

**Alternatives considered:**

<!-- List the realistic options with pros and cons. Two alternatives is
     fine; five is a smell. -->

| Alternative | Pros | Cons |
|-------------|------|------|
|             |      |      |

**Stress lenses:**

<!-- Apply each lens. One sentence each is often enough. -->

- **Failure direction (fail open / fail closed?):**
  <!-- If this breaks, does the system fail safe or fail dangerous?
       Which failure direction did you choose and why? -->

- **Degenerate / edge case (feature or hole?):**
  <!-- What happens at zero, one, max, nil, concurrent, or malformed
       input? Is the edge case a designed feature or an unhandled hole? -->

- **Sole barrier vs. defence in depth:**
  <!-- Is this the only thing preventing a bad outcome, or is there a
       second layer? If it's a sole barrier, is that acceptable? -->

**Deliberation:**

<!-- Brief narrative of the reasoning that led to the decision. Reference
     the stress lenses where they influenced the choice. -->

**Decision:**

<!-- State the decision crisply. One or two sentences. -->

**Invariant established / inherited:**

<!-- Name the guarantee this decision creates or relies on. Name
     invariants by what they enforce, never by prospective names.
     Example: "Every ledger event carries a non-empty tenant ID"
     not "tenant-id-invariant". -->

> **Frozen contract**
> <!-- Use this block ONLY for auditor-critical or interop-critical
>      invariants. A frozen contract may only be changed via a versioned
>      migration (ADR + deprecation window). Delete this block if the
>      invariant is not frozen. -->

---

## 4. Decisions & Open Items

<!-- Summarize all decisions from §3 and note their graduation target. -->

### Locked

| # | Decision | Graduation |
|---|----------|------------|
|   | <!-- decision summary --> | <!-- ADR / DECISIONS.md / stays in note --> |

### Flagged / Deferred

| # | Item | Disposition |
|---|------|-------------|
|   | <!-- open question or deferred scope --> | <!-- deferred to STORY-KEY / needs spike / blocked on X --> |

---

## 5. Cross-Story Obligations & Handoffs

<!-- Constraints this story pushes onto other tickets. Each obligation MUST
     have a traceability comment posted on the target ticket (or, with no
     tracker configured, printed for you to track manually) before the
     design note is considered resolved. -->

| Obligation | Target ticket | Traceability comment posted? |
|------------|---------------|------------------------------|
|            |               | <!-- yes / no — if no, do it before closing --> |

<!-- Upstream dependencies consumed by this story. -->

| Dependency | Source ticket | Status |
|------------|-------------|--------|
|            |             | <!-- merged / in-flight / not started --> |

---

## 6. Reviewer Verification

<!-- What a reviewer or Definition-of-Done check confirms to accept this
     story. Tie each item back to the acceptance criteria. -->

- [ ] <!-- AC line → evidence (test, code path, config) -->
- [ ] All §5 obligations have traceability comments posted on target tickets
- [ ] <!-- additional verification items as needed -->

---

## 7. Implementation Findings

<!-- Appended at PR time. Record anything discovered during implementation
     that modifies, refines, or overrides decisions in §3. If nothing
     changed, write "No material deviations from the design note." -->
