# Principles

The rules in `registry/` are the checkable part. These principles are the reason for them. When a case is
not covered by a rule, decide by these.

## 1. Make wrong states unrepresentable, then make the compiler say so

Rust's reputation comes from a compiler that refuses unsound programs. Other ecosystems get most of the way
with the strictest compiler flags, a strict linter, and types that model the domain.

| Rust gives you | TypeScript | Swift | Kotlin | C# | Python |
|---|---|---|---|---|---|
| No null | `strict`, `noUncheckedIndexedAccess` | Optionals, no `!` | Null safety, no `!!` | Nullable reference types | `mypy --strict` / pyright strict |
| Exhaustive matching | `switch-exhaustiveness-check` | `switch` is exhaustive | `when` as expression | switch expressions + analyzers | `assert_never` |
| Errors are values | `Result` at boundaries | `Result`, typed throws | `Result`, sealed classes | Result types by convention | exceptions + typed returns |
| Data-race freedom | Workers share nothing | Swift 6 language mode | Structured concurrency | `Nullable` + analyzers | no shared mutable state |
| Warnings can fail the build | `--max-warnings 0` | warnings as errors | `allWarningsAsErrors` | `TreatWarningsAsErrors` | `filterwarnings = error` |

Honest limit: only Rust proves memory safety at compile time. Everywhere else the rules reduce the risk;
they do not eliminate it. That is why tests are not optional.

## 2. Test first, always

Red, green, refactor. The failing test is the specification; it also proves the test can fail. A bug fix
starts with a test that reproduces the bug. Pure logic gets property tests (merge, parsing, migrations);
the built artefact gets end-to-end tests, because bundlers and browsers change what unit tests see.

## 3. Validate where data enters, trust types inside

`JSON.parse(text) as T` is a lie the compiler believes. Parse into a validated type at the boundary (file,
network, storage, user input). Inside the boundary, types are enough. Failures become values.

## 4. Prefer what the platform ships

Standard library and vendor frameworks are maintained with the platform, audited more often, optimised for
it and add no supply chain. A third-party dependency needs a reason: what it does that the platform cannot,
and who owns the upgrade. Examples: `node:test` over a test framework for a CLI; `pathlib` over a path
package; Apple frameworks over community packages; `Microsoft.Extensions.*` over equivalents.

## 5. Crash-safe by design

Errors are caught at one place and shown, not swallowed. State is written so that a crash loses seconds,
not hours. Deletes are soft. Schemas are versioned and migrated. A render error must not blank the app.

## 6. Fast by default

Pay for what the user opens. Lazy-load what they might not need, cache hashed assets immutably, keep a
budget for bundle size and start-up time and fail the build when it is exceeded.

## 7. Rules are data, and they evolve

A rule has a level (`proposed`, `should`, `must`), a scope (ecosystems, topologies) and checks. A new rule
starts as `proposed`; it is measured on every project before it becomes `must`. A project that cannot comply
yet records a waiver with a reason and an expiry date. See `docs/adr/`.

## 8. Agents follow the same rules

Claude Code gets the rules through `CLAUDE.md`, slash commands for repeated workflows, and the same CI
gates as everyone else. An instruction file that is too long is skimmed, so it stays short and links out.
