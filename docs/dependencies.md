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
