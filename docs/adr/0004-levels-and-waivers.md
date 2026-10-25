# 4. Rule levels, ratchet and waivers

Date: 2026-10-25 · Status: accepted

## Context

A new strict rule would turn every existing project red at once. Without an exit, rules get ignored.

## Decision

- `proposed`: reported, never fails. New rules start here, and so does every rule for an ecosystem no real
  project has used yet (Swift, Kotlin, C#, Python).
- `should`: fails only with `--strict`.
- `must`: fails the run.
- Promotion `proposed` to `should` to `must` requires a fleet run (`baseline fleet`) in the PR that shows who
  would fail. Failing projects either get fixed or get a waiver.
- A waiver in `baseline.json` has a rule id, a reason and an expiry date. It makes the rule `waived` until
  the date; afterwards the rule fails again and says the waiver expired. A waiver for a passing rule is
  reported as no longer needed.
- Counts that must only go down (for example lint violations) use ESLint bulk suppressions as a ratchet.

## Consequences

Strictness can rise without a flag day, and every exception is visible, justified and temporary.
