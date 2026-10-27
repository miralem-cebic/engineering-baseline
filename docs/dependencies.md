# Dependencies

Runtime dependencies: **none**. The tool uses only Node built-ins (`node:fs`, `node:path`, `node:util`,
`node:module`, `node:url`, `node:test`).

Development dependencies, each with the native alternative that was considered:

| Package | Purpose | Native alternative considered |
|---|---|---|
| `typescript` | Strict type check of the JSDoc-typed JavaScript | None: Node strips types but does not check them |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` | Zero-warning lint with type-aware rules | None; the type-aware rules are the point |
| `@types/node` | Types for Node built-ins | None |

The tool loads the **project's own** ESLint at run time (never a bundled one), so it adds no dependency for the
projects it checks.

## Pinned on purpose

| Package | Held at | Why | Lift when |
|---|---|---|---|
| `typescript` | below 6.1 | `typescript-eslint` declares a peer range of `<6.1`; TypeScript 7 makes `npm ci` fail with ERESOLVE | `typescript-eslint` supports TS 7 |
| `@types/node` | major 22 | Types must match the Node version CI and `engines` use | The project moves to a newer Node LTS |

Both are enforced by `ignore` entries in `.github/dependabot.yml`, so Dependabot does not propose them.

## Dependabot PR titles

Dependabot's default title is `Bump x from a to b`, which is not a Conventional Commit and fails the PR title check.
Every `updates` entry therefore sets `commit-message`, so titles read `chore(deps): bump ...`,
`chore(deps-dev): bump ...` and `ci(deps): bump ...`. Copy `templates/dependabot.yml` into a project and drop the
`ignore` entries that do not apply. For an existing PR with a wrong title, edit the title once; later PRs are correct.
