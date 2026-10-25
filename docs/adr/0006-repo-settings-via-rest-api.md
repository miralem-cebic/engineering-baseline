# 6. Repository settings are read through the GitHub REST API

Date: 2026-10-25 · Status: accepted

## Context

Branch protection, merge methods and secret scanning are repository settings, not files, so the offline
checks cannot see them. Yet they decide whether the CI gates can be bypassed.

## Decision

`baseline.json` may name `repo`. A `repo-setting` check reads normalized live settings through a `GithubPort`
(REST API, `fetch`, token from `GITHUB_TOKEN`) and compares them like `json-value`. Without a repo or a token
the check is skipped, never passed. The desired state is applied by a script that uses the GitHub CLI
(`templates/scripts/apply-repo-settings.sh`); the tool itself never writes to GitHub. All `REPO-*` rules start
as `proposed`.

## Consequences

Settings drift becomes visible in the same report as everything else. Checking needs a token with read rights,
so it runs locally or in a scheduled job rather than on every pull request. Rulesets are not covered yet.
