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

## Adopt it in a project

Worked example: teamtodo. About 30 minutes for the first pass; the fixes then happen in small PRs.

**1. Prerequisites.** Node 22+, and the project's dependencies installed (`npm ci`). ESLint rules are judged
against the project's own resolved config, so without `node_modules` those checks are skipped, not passed.

**2. Add `baseline.json`** to the project root (start from [templates/baseline.json](templates/baseline.json)):

```json
{
  "baseline": "0.1.0",
  "ecosystems": ["typescript", "react"],
  "topology": "local-only",
  "repo": "miralem-cebic/teamtodo",
  "waivers": []
}
```

`ecosystems` and `topology` select the rules (table above). `repo` is optional and enables the live
repository-settings checks (step 7).

**3. First run.** From the project root:

```bash
npx github:miralem-cebic/engineering-baseline check
```

| Output | Meaning | Exit code |
|---|---|---|
| `✖ [must]` | Violated rule that blocks | 1 |
| `✖ [should]` | Violated, blocks only with `--strict` | 0 (1 with `--strict`) |
| `✖ [proposed]` | New or unproven rule, information only | 0 |
| `skip` | Not measurable here (no ESLint, no token); never counts as passed | 0 |
| `manual` | Needs a human decision | 0 |

For teamtodo this reports 45 pass, 15 fail: one `must` (TS-010, lint without `--max-warnings 0`), six `should`
(test-first and definition of done in `CLAUDE.md`, ADR folder, E2E in the pipeline, floating promises,
`engines.node`) and eight `proposed`.

**4. Triage.** Fix or waive, most severe first, one small PR per theme:

| Level | What to do |
|---|---|
| `must` | Fix now, or add a waiver with a reason and an expiry date |
| `should` | Plan it; make `--strict` green over time |
| `proposed` | Read the rationale in [rules/generated](rules/generated/README.md); adopt what fits |

```json
"waivers": [{ "rule": "TS-010", "reason": "exhaustive-deps warnings are being cleaned up", "expires": "2026-12-31" }]
```

A waiver hides the failure until the date, then the rule fails again and says the waiver expired.

**5. Copy what the templates provide.**

| From `templates/` | To the project | Rules |
|---|---|---|
| `CLAUDE.md` sections (test-first, definition of done) | merge into the existing `CLAUDE.md` | AI-005, AI-006 |
| `.claude/settings.json`, `.claude/commands/` | `.claude/` | AI-007, AI-008 |
| `PULL_REQUEST_TEMPLATE.md`, `release.yml` | `.github/` | GEN-009, PIPE-003 |
| ADR folder and `docs/dependencies.md` | `docs/` | GEN-010, GEN-012 |
| `scripts/apply-repo-settings.sh` | `scripts/` | REPO-* |

**6. Keep it green in CI.** Add the reusable workflow to the project's `ci.yml`
([templates/ci-conformance.yml](templates/ci-conformance.yml)):

```yaml
conformance:
  uses: miralem-cebic/engineering-baseline/.github/workflows/conformance.yml@main
  with:
    strict: false   # switch to true once the should rules pass
```

**7. Repository settings.** Apply the expected settings once (GitHub CLI, admin rights), then check them live.
Details: [docs/repo-setup.md](docs/repo-setup.md).

```bash
scripts/apply-repo-settings.sh miralem-cebic/teamtodo "verify,pr-title"
GITHUB_TOKEN=... npx github:miralem-cebic/engineering-baseline check
```

**8. Stay current.** A rule that is promoted to `must` turns the conformance job red in every project until it
is fixed or waived; the PR that promotes it shows the impact (`baseline fleet`). To pin a project to a known rule
set, use `baseline-ref` in the workflow and `npx github:miralem-cebic/engineering-baseline#<tag> check` locally.

Other flags: `check --strict` (also fail on `should`), `check --json` (machine-readable), `check --root <dir>`.

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
