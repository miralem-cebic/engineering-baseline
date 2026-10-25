# CLAUDE.md

<One sentence: what this project is and for whom.>

## Commands

```bash
npm run dev          # start
npm run typecheck    # tsc --noEmit
npm run lint         # eslint . --max-warnings 0
npm test             # unit tests
npm run verify       # everything CI runs
```

## Hard invariants

- **Test first.** Write the failing test, see it fail for the right reason, then implement. A bug fix starts with a red test.
- <Invariant that must never be broken, with the reason in a few words.>
- <Another one.>

## Definition of done

`npm run verify` is green and the output was read. Behaviour changes have a test that failed first. `CHANGELOG.md` has an entry under `[Unreleased]`. Commits are Conventional Commits.

## Pointers

| Working on | Start here |
|---|---|
| <area> | <path> |

Detailed rules: @docs/DEVELOPMENT.md
