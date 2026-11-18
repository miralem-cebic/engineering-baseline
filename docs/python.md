# Python projects

The `python` ecosystem approximates compile-time guarantees with the strictest settings the common tools offer:
mypy in strict mode, Ruff with every rule, warnings as test failures, a pinned interpreter, locked and audited
dependencies. The rules are `PY-001..011` (see [generated rules](../rules/generated/py.md)); all are `proposed` until
a second project has used them (ADR 4).

The first project measured is the Elementar license key server (Flask under Apache mod_wsgi on the system
Python 3.14 of Ubuntu 26.04, SQLite, `hosted-db`, Azure DevOps). It passes every measurable `PY` rule; rules
006..011 come from its settings.

## Adopt it

1. `baseline.json`: `"ecosystems": ["python"]` and a topology.
2. Merge `templates/python/pyproject.toml` into the project's `pyproject.toml`; copy `templates/python/.python-version`.
   Every entry in Ruff's `ignore` gets a comment that says why.
3. Lock with uv (`uv lock`) and commit `uv.lock` (`GEN-014`).
4. Name the gate in `CLAUDE.md` or a `scripts/verify.sh` the pipeline calls, and run it before every commit:

```bash
uv sync --locked
uv run ruff format --check src tests
uv run ruff check src tests
uv run mypy
uv run pytest
uv export --locked --no-dev --no-emit-project --format requirements-txt --output-file requirements.txt
uv run pip-audit --strict --requirement requirements.txt
```

## What each rule is made of

| Rule | Setting or file |
|---|---|
| PY-001 | `[tool.mypy] strict = true` (or pyright `typeCheckingMode` `strict`) |
| PY-002, 006 | `[tool.ruff]`; `select = ["ALL"]` with commented ignores |
| PY-003, 010 | `filterwarnings = ["error"]`, `--strict-markers`, `xfail_strict = true` |
| PY-004, 008 | `requires-python`; `.python-version` |
| PY-005 | manual: standard library first, every runtime package in `docs/dependencies.md` |
| PY-007, 011 | `ruff format --check` and `pip-audit` in the gate (CLAUDE.md, `scripts/verify.sh`, the pipeline) |
| PY-009 | `enable_error_code = ["ignore-without-code", ...]` |

`templates/python/` is itself tested: `test/python-rules.test.js` requires that a project built from the template
passes every `PY` rule and that each rule fails when its setting is flipped.

## Findings from the first project

| Finding | Effect |
|---|---|
| `pip-audit --strict` fails on the project itself when it is installed editable | Audit the exported lock file (`--requirement`), not the environment; that is also exactly what production installs |
| Python 3.13+ warns about unclosed `sqlite3` connections; with `filterwarnings = error` such tests fail | Intended: close connections with `contextlib.closing` or fixtures |
| Ruff's `RUF100` with `--select` limited to some rules removes every other `noqa` as "unused" | Run `RUF100` fixes only with the full rule set |
| `PY-001` matched `--strict-markers` and `xfail_strict` | The pattern now requires `strict = true` or pyright's `strict` mode |
| `AI-003` did not accept `uv run pytest` | Accepted now |

Open for the baseline, not changed here: the project runs on Azure DevOps, so `GEN-001..003`, `SEC-001`, `SEC-003`
and `PIPE-002..004` look for GitHub files it cannot have; and a server-rendered web app sets its security headers
in code, which `HOS-001..004` (static-host header files) do not see.
