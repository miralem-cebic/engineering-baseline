# 2. Rules are data, checked by a small CLI

Date: 2026-10-25 · Status: accepted

## Context

Prose guidelines drift. Three projects already diverge: kontor is on React 18 while teamtodo is on 19, one
project lints without `--max-warnings 0`, another has `any` switched off. Nobody decided that; nobody noticed.

## Decision

Every rule is an entry in `rules/registry/*.json` with an id, rationale, level, scope and machine-checkable
checks. A CLI evaluates a project against the rules for its profile. Documentation is generated from the
registry. A generic check set (file exists, file contains, JSON value, package script, ESLint rule, SQL RLS,
migration numbers) covers most rules; `manual` marks what only a human can judge.

## Consequences

- Adding a rule is a data change plus a measurement on the fleet.
- A rule is only as good as its check; wrong checks are bugs and get a test.
- Rules that cannot be checked yet stay visible (`manual`) instead of being forgotten.
