# Repository and pipeline setup

What a repository on this baseline looks like. Files are checked offline (`GEN-*`, `PIPE-*`, `SEC-*`).
Settings live on GitHub, not in the repository, so `REPO-*` rules read them through the REST API.

## Pipeline

| Workflow | Trigger | Does | Rules |
|---|---|---|---|
| `ci.yml` | pull request, push to `main` | `npm ci`, typecheck, lint with zero warnings, tests, audit, PR-title check, baseline conformance. Cancels superseded runs. | GEN-001, GEN-002, TS-021, SEC-001, PIPE-004 |
| `build.yml` | `workflow_call` (apps only) | One reusable build, used by CI and release; E2E against the built artefact; SBOM | PIPE-001, PIPE-005, SEC-002 |
| `release.yml` | tag `v*` | Runs the gates again, publishes, creates the release with generated notes | PIPE-002, PIPE-003 |
| `conformance.yml` | `workflow_call` | Runs `baseline check` in the calling project | |
| Hosted projects | pull request | Preview deploy; immutable deploys allow rollback | PIPE-006, HOS-008 |

Workflows declare `permissions: contents: read` at the top and widen per job (SEC-003). Third-party actions are
pinned to a commit SHA, with the tag in a comment (SEC-004).

## Files

`.github/`: `workflows/`, `dependabot.yml`, `CODEOWNERS`, `PULL_REQUEST_TEMPLATE.md`, `release.yml`.
Root: `README.md`, `LICENSE`, `SECURITY.md`, `CHANGELOG.md`, `CLAUDE.md`, `.editorconfig`, `baseline.json`.
`docs/`: `adr/`, `dependencies.md`.

## Settings

| Setting | Value | Rule |
|---|---|---|
| Merge methods | squash only, commit title = PR title | REPO-001 |
| Delete head branches after merge | on | REPO-002 |
| Default branch | protected: no force push, no deletion | REPO-003 |
| Pull request required, required checks | CI job names, e.g. `verify`, `pr-title` | REPO-004 |
| Require branches to be up to date | on | REPO-005 |
| Secret scanning and push protection | on | REPO-006 |
| Dependabot alerts and security updates | on | REPO-007 |
| Default workflow token | read-only | REPO-008 |
| Rules apply to administrators | on (a solo maintainer may waive) | REPO-009 |

Apply them with `templates/scripts/apply-repo-settings.sh owner/name "verify,pr-title"` (GitHub CLI, admin rights).

## Checking the settings

Put `"repo": "owner/name"` in `baseline.json` and run with a token that can read the repository's settings:

```bash
GITHUB_TOKEN=... npx github:miralem-cebic/engineering-baseline check
```

Without a token the `REPO-*` rules are reported as skipped, never as passed. The token is only sent to
`api.github.com`. Limits: classic branch protection is read; repositories that use rulesets instead need the
rulesets endpoint (not implemented yet). Private repositories on the free plan cannot have branch protection.
