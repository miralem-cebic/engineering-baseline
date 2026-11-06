# Third-party libraries behind an adapter

Rule: `GEN-021` (proposed). Principle: [5 in rules/principles.md](../rules/principles.md).

Project code never imports a third-party library directly. It imports a module the project owns, the
**adapter**, and only the adapter imports the library.

```
application code  ──▶  adapter (your module, your types)  ──▶  third-party library
```

## Why

- **Deprecation.** The library renames or removes `methodA`: one edit in the adapter, not one per call site.
- **Replacement.** Swapping the library means rewriting the adapter; callers do not change.
- **Upgrades.** A major version touches one file, so the review is small and the blast radius is known.
- **Tests.** The adapter is the one place to fake; no test needs to know the library.
- **Visibility.** One file shows what the project really uses of a library. It is also the place for timeouts,
  retries, logging and input validation that the library does not provide.

## How an adapter looks

1. **One adapter per library or capability**, in one folder (for example `src/adapters/`).
2. **Only what the project uses.** Do not wrap the whole library API. A first version may mirror the used methods
   one to one (`library.methodA` becomes `adapter.methodA`); that already contains deprecations and renames.
3. **Your types at the boundary.** Parameters and return values are project types. If a library class, response
   object or exception shows up in a caller's signature, the library is still everywhere. A pure mirror protects
   against renames; for a real replacement, shape the methods by what the caller needs, not by what the library
   offers.
4. **Errors are values.** The adapter catches the library's exceptions and returns a `Result` (principles 3 and 5).
5. **Nothing else imports the library.** Enforce it (see below), do not rely on memory.
6. **Register it.** Add the adapter to the dependency register (`docs/dependencies.md`, `GEN-012`) next to the
   reason for the library.

```ts
// src/adapters/clock.ts: the only file that imports dayjs
import dayjs from 'dayjs';

export type IsoDate = string; // 'YYYY-MM-DD', not a Dayjs

export function addDays(date: IsoDate, days: number): IsoDate {
  return dayjs(date).add(days, 'day').format('YYYY-MM-DD');
}
```

Callers import `addDays` from `adapters/clock` and never see `dayjs`. If `dayjs` is deprecated, `addDays` is
rewritten once.

## What is exempt

- The language and platform standard library (principle 4).
- Frameworks that define the shape of the application: React, SwiftUI, Jetpack Compose, ASP.NET Core, Django.
  Replacing one is a rewrite, not a swap, and a wrapper would only hide its idioms.
- Build, test and lint tooling (dev dependencies) and type-only packages (`@types/*`).

Everything else gets an adapter: service SDKs (Supabase, Stripe), HTTP clients, date and time, validation,
parsing, persistence, logging, crypto and UI widgets (a grid, a chart, an editor are wrapped in a component of
your own).

When in doubt: if replacing the library would touch more than one module, it needs an adapter.

## Enforcing the boundary

`GEN-021` is a `manual` check for now: reviewers look at new imports in pull requests. The boundary is enforced
by the project's own tooling, and the stronger the module system, the stronger the guard. These are starting
points; none has been measured on a real project yet.

| Ecosystem | Mechanism |
|---|---|
| TypeScript | ESLint `no-restricted-imports` for the package, switched off for the adapter folder (below) |
| C# | The adapter is its own project; only it references the NuGet package |
| Kotlin | The adapter is its own Gradle module; only it declares the dependency, as `implementation` rather than `api` |
| Swift | The adapter is its own SwiftPM target; only it depends on the package, and it uses `internal import` |
| Python | An `import-linter` forbidden contract with external packages included |

```js
// eslint.config.js
{
  files: ['src/**/*.ts'],
  ignores: ['src/adapters/**'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{ name: 'dayjs', message: 'Import src/adapters/clock.ts instead (GEN-021).' }],
    }],
  },
},
```

A mechanical check in this tool (imports of runtime dependencies are allowed only below the adapter folder) needs
two decisions that should come from measurement: the folder convention and the list of exempt packages. It
follows once the rule has run on the fleet.

Related: [saas-modularity.md](saas-modularity.md) applies the same idea one level up, with ports and adapters
between the core and its local or SaaS back end.
