# 3. The tool is JavaScript with JSDoc, strictly type-checked

Date: 2026-10-25 · Status: accepted

## Context

The tool should run through `npx github:owner/repo` without a build step. Node refuses to strip TypeScript
types for files below `node_modules`, which is where `npx` puts the package.

## Decision

Write JavaScript with JSDoc types and check it with `tsc` in strict mode with `checkJs`, plus the same strict
flags and typescript-eslint rules the baseline demands of projects. No runtime dependencies. Tests use
`node:test`. Shared types live in `src/types.d.ts`.

## Consequences

Same type safety as TypeScript for this code base, no compile step to publish, and the tool follows its own
rules (`baseline.json` in this repository). The price is JSDoc verbosity and `Result` plumbing without `as`.
