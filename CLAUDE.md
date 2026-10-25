# CLAUDE.md

Engineering baseline: a machine-checkable rule set for my projects, plus the CLI that checks it.
Rules are data (`rules/registry/*.json`); the tool measures a project against the rules for its profile.

## Commands

```bash
npm run verify        # typecheck + lint (zero warnings) + tests + docs:check + baseline:check
npm test              # node:test, no framework
npm run docs          # regenerate rules/generated from the registry
node bin/baseline.js check --root <dir>
node bin/baseline.js fleet fleet.local.json
```

## Hard invariants

- **Test first.** Write the failing test, watch it fail for the right reason, then implement. A bug fix starts with a red test.
- **No build step, no runtime dependencies.** JavaScript with JSDoc, checked by `tsc` (strict, `checkJs`). It must run via `npx github:` where Node refuses TypeScript stripping under `node_modules`.
- **Native first.** `node:test`, `node:util` `parseArgs`, `node:fs`. A new dependency needs a written reason in the PR.
- **Never throw across a module boundary.** Return `Result` values. Parse unknown data with guards from `src/guards.js`, never with `as`.
- **I/O only through ports** (`Fs`, `EslintPort`); logic is tested with `createMemoryFs`.
- **Registry is the source of truth.** `rules/generated` is output; never edit it by hand. CI runs `docs:check`.
- **Rule changes follow the lifecycle** in `docs/adr/0004-levels-and-waivers.md`: proposed, should, must. Promoting to `must` needs a fleet impact run in the PR.
- **Non-TypeScript ecosystems stay `proposed`** until a real project has used them.

## Definition of done

`npm run verify` is green and the output was read, not assumed. Behaviour changes have a test that failed first. `CHANGELOG.md` has an entry under `[Unreleased]`. Commits are Conventional Commits; PRs are squash-merged.

## Layout

| Path | Purpose |
|---|---|
| `src/checks.js` | One function per check type; add a type in `types.d.ts`, `registry.js` and here |
| `src/registry.js` | Rule parsing, loading, profile selection |
| `src/runner.js`, `src/report.js`, `src/fleet.js`, `src/docs.js`, `src/cli.js` | Aggregation, output, matrix, docs, commands |
| `rules/registry/*.json` | The rules |
| `rules/principles.md` | Why the rules exist |
| `docs/adr/` | Decisions |
| `templates/` | Files projects copy in |

## Adding a rule

Use `/new-rule`. Every rule needs a rationale (why, not what), a level, a scope (ecosystems, topologies) and at least one check; `manual` is allowed but should be rare. Measure it on the fleet before choosing a level.
