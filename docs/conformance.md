# Conformance snapshot

Measured on 2026-10-25 with baseline 0.1.0 (115 rules) (`baseline fleet`). Profiles: teamtodo and kontor are
`typescript + react / local-only`; cracms is `typescript + react + postgres / hosted-db`.
✅ pass · ❌ fail · 👁 needs human review · ⏭ skipped (not measurable) · – rule does not apply to the profile.

Rules whose checks are `manual` show 👁 everywhere; they are listed so they are not forgotten.

## What the measurement found

Each item was verified against the project's files; the first two columns are facts, not guesses.

| Finding | Project | Rule |
|---|---|---|
| React 18.3 while the others are on 19.3 | kontor | REL-004 |
| `eslint . ` without `--max-warnings 0`, and `react-hooks/exhaustive-deps` is `warn` | teamtodo, kontor | TS-010 |
| `no-explicit-any` is `off` | cracms | TS-012 |
| Non-null assertions are not forbidden (243 occurrences measured with ESLint) | cracms | TS-013 |
| `script-src` contains `'unsafe-inline'` | cracms | HOS-004 |
| `SECURITY.md` still contains the GitHub template text | cracms | GEN-004 |
| No error boundary in `src` | cracms | REL-001 |
| `policy_type_config` is created without enabling RLS in `supabase/patches` | cracms | DB-003 |
| No `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns` | cracms | TS-003..005 |
| No Dependabot, CODEOWNERS, PR template, `.editorconfig`, changelog, licence | cracms | GEN-003..009 |
| No `engines.node` | all three | TS-020 |
| No `no-floating-promises` | all three | TS-014 |
| CLAUDE.md has no test-first statement | all three | AI-005 |

`policy_type_config` may be intentionally global; RLS should still be on (read-only policy). Treat DB-003 as a
review item, not a verdict.

Repository settings (`REPO-*`) are skipped here: they need a token with read access to each repo.

## Matrix

| Rule | Level | Title | teamtodo | kontor | cracms |
| --- | --- | --- | :---: | :---: | :---: |
| AI-001 | must | CLAUDE.md exists | ✅ | ✅ | ✅ |
| AI-002 | should | CLAUDE.md stays short | ✅ | ✅ | ❌ |
| AI-003 | should | CLAUDE.md lists the commands to verify work | ✅ | ✅ | ✅ |
| AI-004 | should | CLAUDE.md states hard invariants | ✅ | ✅ | ✅ |
| AI-005 | should | CLAUDE.md requires test-first work | ❌ | ❌ | ❌ |
| AI-006 | should | CLAUDE.md defines when a task is done | ❌ | ❌ | ✅ |
| AI-007 | proposed | Claude Code settings are committed | ❌ | ❌ | ❌ |
| AI-008 | proposed | Repeated workflows are slash commands | ❌ | ❌ | ❌ |
| DB-001 | must | Tenant isolation is enforced by row-level security | – | – | 👁 |
| DB-002 | must | Migration numbers are unique | – | – | ✅ |
| DB-003 | must | Every table enables RLS | – | – | ❌ |
| DB-004 | should | RLS policies have automated tests | – | – | ❌ |
| DB-005 | should | Deletes are soft and reads filter them | – | – | 👁 |
| DB-006 | should | Changes are audited by a trigger | – | – | 👁 |
| DB-007 | should | Generated database types are committed | – | – | ✅ |
| GEN-001 | should | Conventional Commits are enforced in CI | ✅ | ✅ | ❌ |
| GEN-002 | must | CI runs on every pull request | ✅ | ✅ | ✅ |
| GEN-003 | must | Dependency updates are automated | ✅ | ✅ | ❌ |
| GEN-004 | must | SECURITY.md describes a real reporting path | ✅ | ✅ | ❌ |
| GEN-005 | should | LICENSE is present | ✅ | ✅ | ❌ |
| GEN-006 | should | CHANGELOG keeps an Unreleased section | ✅ | ✅ | ❌ |
| GEN-007 | should | .editorconfig fixes whitespace and line endings | ✅ | ✅ | ❌ |
| GEN-008 | should | CODEOWNERS names reviewers | ✅ | ✅ | ❌ |
| GEN-009 | should | Pull request template asks for the checklist | ✅ | ✅ | ❌ |
| GEN-010 | should | Architecture decisions are recorded | ❌ | ✅ | ❌ |
| GEN-011 | must | Environment files are git-ignored | ✅ | ✅ | ✅ |
| GEN-012 | proposed | Third-party dependencies are justified | ❌ | ❌ | ❌ |
| GEN-013 | must | README gives a way in | ✅ | ✅ | ✅ |
| GEN-014 | must | A lockfile is committed | ✅ | ✅ | ✅ |
| GEN-020 | should | Vendor and platform modules are preferred over third-party ones | 👁 | 👁 | 👁 |
| HOS-001 | must | A Content-Security-Policy is served | – | – | ✅ |
| HOS-002 | should | HSTS is enabled | – | – | ❌ |
| HOS-003 | should | Framing and MIME sniffing are blocked | – | – | ✅ |
| HOS-004 | must | script-src has no unsafe-inline | – | – | ❌ |
| HOS-005 | should | Required environment is documented | – | – | ✅ |
| HOS-006 | should | Hashed assets are cached immutably | – | – | ✅ |
| HOS-007 | must | No secret is exposed to the client bundle | – | – | ✅ |
| HOS-008 | proposed | Every deploy can be rolled back | – | – | 👁 |
| LOC-001 | must | The built file works from file:// | ✅ | ✅ | – |
| LOC-002 | must | CSP forbids all network connections | ✅ | ✅ | – |
| LOC-003 | must | Stored data carries a schema version | ✅ | ✅ | – |
| LOC-004 | must | The real build is tested with a browser | ✅ | ✅ | – |
| LOC-005 | should | Deletes are soft | ✅ | ✅ | – |
| LOC-006 | should | Browser file APIs live in one module | 👁 | 👁 | – |
| LOC-007 | should | Writes survive crashes | 👁 | 👁 | – |
| LOC-008 | must | No network access in the code | 👁 | 👁 | – |
| PIPE-001 | should | The build is a reusable workflow | ✅ | ✅ | ❌ |
| PIPE-002 | should | Releases are cut from version tags | ✅ | ✅ | ❌ |
| PIPE-003 | should | Release notes are generated from merged PRs | ✅ | ✅ | ❌ |
| PIPE-004 | should | Superseded CI runs are cancelled | ✅ | ✅ | ❌ |
| PIPE-005 | should | End-to-end tests run against the built artefact in the pipeline | ❌ | ✅ | ❌ |
| PIPE-006 | proposed | Hosted projects get a preview deploy per pull request | – | – | 👁 |
| REL-001 | must | The UI has an error boundary | ✅ | ✅ | ❌ |
| REL-002 | should | Routes and heavy views are lazy-loaded | – | – | ✅ |
| REL-003 | must | React hooks rules are linted | ✅ | ✅ | ✅ |
| REL-004 | should | React is on the current major | ✅ | ❌ | ✅ |
| REL-005 | proposed | Performance budgets are checked | 👁 | 👁 | 👁 |
| REPO-001 | proposed | Only squash merges are allowed | ⏭ | ⏭ | ⏭ |
| REPO-002 | proposed | Merged branches are deleted automatically | ⏭ | ⏭ | ⏭ |
| REPO-003 | proposed | The default branch is protected from force pushes and deletion | ⏭ | ⏭ | ⏭ |
| REPO-004 | proposed | Changes reach main through pull requests with required checks | ⏭ | ⏭ | ⏭ |
| REPO-005 | proposed | Branches must be up to date before merging | ⏭ | ⏭ | ⏭ |
| REPO-006 | proposed | Secret scanning with push protection is on | ⏭ | ⏭ | ⏭ |
| REPO-007 | proposed | Dependabot alerts are enabled | ⏭ | ⏭ | ⏭ |
| REPO-008 | proposed | The default workflow token is read-only | ⏭ | ⏭ | ⏭ |
| REPO-009 | proposed | Administrators follow the branch rules | ⏭ | ⏭ | ⏭ |
| SEC-001 | should | Dependencies are audited in CI | ✅ | ✅ | ❌ |
| SEC-002 | proposed | An SBOM is generated for releases | ❌ | ❌ | ❌ |
| SEC-003 | should | Workflows declare minimal permissions | ✅ | ✅ | ❌ |
| SEC-004 | proposed | Third-party actions are pinned to a commit | ❌ | ❌ | ❌ |
| TDD-001 | must | A test script exists | ✅ | ✅ | ✅ |
| TDD-002 | proposed | Pure logic has property-based tests | ✅ | ✅ | ❌ |
| TDD-003 | should | The real build is tested end to end | ✅ | ✅ | ❌ |
| TDD-004 | should | Every bug fix starts with a failing test | 👁 | 👁 | 👁 |
| TS-001 | must | TypeScript strict mode is on | ✅ | ✅ | ✅ |
| TS-002 | must | Indexed access is checked | ✅ | ✅ | ✅ |
| TS-003 | should | Optional properties are exact | ✅ | ✅ | ❌ |
| TS-004 | should | Index-signature access uses brackets | ✅ | ✅ | ❌ |
| TS-005 | should | Every code path returns | ✅ | ✅ | ❌ |
| TS-006 | must | Switch fallthrough is an error | ✅ | ✅ | ✅ |
| TS-007 | should | Unused code is an error | ✅ | ✅ | ✅ |
| TS-008 | proposed | Type-only imports are explicit | ❌ | ❌ | ❌ |
| TS-009 | proposed | Overrides are explicit | ❌ | ❌ | ❌ |
| TS-010 | must | Lint fails on warnings | ❌ | ❌ | ✅ |
| TS-011 | must | A type-check script exists | ✅ | ✅ | ✅ |
| TS-012 | must | any is forbidden | ✅ | ✅ | ❌ |
| TS-013 | should | Non-null assertions are forbidden | ✅ | ✅ | ❌ |
| TS-014 | should | Promises cannot be left floating | ❌ | ❌ | ❌ |
| TS-015 | should | Switches over unions are exhaustive | ✅ | ✅ | ❌ |
| TS-016 | proposed | Type assertions are restricted | ❌ | ❌ | ❌ |
| TS-020 | should | The Node version is pinned | ❌ | ❌ | ❌ |
| TS-021 | must | CI installs from the lockfile | ✅ | ✅ | ✅ |
| TS-022 | should | External data is validated at the boundary | 👁 | 👁 | 👁 |
| TS-023 | proposed | Failures are values at module boundaries | 👁 | 👁 | 👁 |
| **Must passing** | | | 20/21 | 20/21 | 16/22 |

