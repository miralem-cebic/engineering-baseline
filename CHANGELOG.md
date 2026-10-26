# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1] - 2026-10-26

### Fixed

- `release.yml` no longer fails when the GitHub release for the tag already exists.
- `conformance.yml` runs the CLI from a checkout of `baseline-ref` instead of `npx github:...`, which fails on npm 10 with "GitFetcher requires an Arborist constructor to pack a tarball".

## [0.1.0] - 2026-10-25

### Added

- `baseline check`, `baseline fleet` and `baseline docs` commands.
- Rule registry with 115 rules across general, AI workflow, TDD, security,
  reliability, TypeScript/React, local-only apps, hosted apps and Postgres.
- Proposed rule sets for Swift, Kotlin, C# and Python.
- Project profiles: ecosystems times topology (`local-only`, `hosted-no-db`,
  `hosted-db`).
- Waivers with mandatory reason and expiry date.
- Repository rules `REPO-001..009` (squash-only, branch protection, secret scanning, ...) checked through the
  GitHub REST API (`repo-setting` check, `repo` in `baseline.json`, `GITHUB_TOKEN`); skipped without a token.
- Pipeline rules `PIPE-001..006`, a real `SEC-004` check for pinned actions, `release.yml` and
  `templates/scripts/apply-repo-settings.sh`.
- Dependabot ignores TypeScript 7 (breaks `typescript-eslint` peer range) and `@types/node` majors beyond Node 22.
- Step-by-step adoption guide in the README (worked example: teamtodo).
- Header rules `HOS-001..006` also accept `landing/_headers` (Netlify sites whose publish dir is generated from `landing/`).
- Templates for `CLAUDE.md`, slash commands, `baseline.json` and workflows.
