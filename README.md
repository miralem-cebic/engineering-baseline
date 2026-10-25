# engineering-baseline

A machine-checkable quality rule set for my projects, and the small CLI that checks it.

Goal: high quality, fast, crash-resistant, memory-safe where the platform allows. Rust's guarantees, approximated
in every ecosystem by the strictest compiler and linter settings, plus test-first work and platform-native
modules. See [rules/principles.md](rules/principles.md).

## How it fits together

```
rules/registry/*.json   the rules (data: id, rationale, level, scope, checks)
        │
        ▼
baseline check          measures one project against the rules for its profile
baseline fleet          measures many projects, prints a rules × projects matrix
baseline docs           generates rules/generated/ (CI fails when it is stale)
        ▲
baseline.json           in each project: ecosystems, topology, waivers
```

A **profile** is ecosystems × topology:

| Ecosystems | Topology |
|---|---|
| `typescript`, `react`, `postgres` (proven) · `swift`, `kotlin`, `csharp`, `python` (proposed) | `local-only` (file://, no server) · `hosted-no-db` (static host, e.g. Netlify) · `hosted-db` (host + database, e.g. Supabase) |

Levels: `must` fails the run, `should` fails with `--strict`, `proposed` is only reported. A project that cannot
comply yet records a **waiver** with a reason and an expiry date.

## Use it in a project

```bash
# 1. add baseline.json (see templates/baseline.json), copy templates/ you want
# 2. check
npx github:miralem-cebic/engineering-baseline check            # exits 1 when a must rule fails
npx github:miralem-cebic/engineering-baseline check --strict   # also should rules
npx github:miralem-cebic/engineering-baseline check --json
```

Install the project's dependencies first: ESLint rules are judged against the project's own resolved config.
To keep a project on the baseline, call the reusable workflow
([templates/ci-conformance.yml](templates/ci-conformance.yml)).

## Measure several projects

```bash
cp fleet.local.json.example fleet.local.json   # or write your own, see below
node bin/baseline.js fleet fleet.local.json
```

`fleet.local.json` lists `{ name, path, ecosystems, topology }` per project. Result for teamtodo, kontor and
cracms: [docs/conformance.md](docs/conformance.md).

## Rules

Generated documentation: [rules/generated/README.md](rules/generated/README.md). Decisions: [docs/adr](docs/adr).
Repository and pipeline setup: [docs/repo-setup.md](docs/repo-setup.md). Local-first to SaaS: [docs/saas-modularity.md](docs/saas-modularity.md). Claude Code workflow:
[docs/claude-code.md](docs/claude-code.md).

## Develop

```bash
npm ci
npm run verify
```

Test-first, no runtime dependencies, JavaScript with JSDoc under strict `tsc`. See [CLAUDE.md](CLAUDE.md).

## Status

0.1.0. The TypeScript, React, local-only, hosted and Postgres/RLS rules are measured against real projects.
The Swift, Kotlin, C# and Python rules are informed proposals and have not been validated on a real project.
Licence: MIT.
