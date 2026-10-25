# Contributing

Thanks for helping. Keep changes small and test-first.

1. Fork, branch, `npm ci`.
2. Write a failing test, then the change. `node:test` only; no framework.
3. `npm run verify` must be green: types, lint with zero warnings, tests, generated docs, self-check.
4. Open a PR with a Conventional Commit title (`feat(rules): ...`, `fix(checks): ...`); it is squash-merged.
5. A new or promoted rule needs a rationale and a fleet run in the description. New rules start as `proposed`.

By contributing you agree your work is released under the MIT licence.
