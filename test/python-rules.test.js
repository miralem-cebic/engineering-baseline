import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createMemoryFs, createNodeFs } from '../src/fs.js';
import { loadRegistry, selectRules } from '../src/registry.js';
import { runRules } from '../src/runner.js';

const loaded = await loadRegistry(createNodeFs(process.cwd()), 'rules/registry');
if (!loaded.ok) throw new Error(`shipped registry is invalid: ${loaded.error}`);
const all = selectRules(loaded.value, { ecosystems: ['python'], topology: 'hosted-db' });
const rules = all.filter((rule) => rule.id.startsWith('PY-'));

const TEMPLATE_DIR = new URL('../templates/python/', import.meta.url);
const GATE = '# CLAUDE.md\n\n```bash\nuv run ruff format --check .\nuv run pytest\nuv run pip-audit --strict\n```\n';

/** The files a Python project gets from `templates/python`, plus the CLAUDE.md lines that name the gate. */
function compliantProject() {
  /** @type {Record<string, string>} */
  const files = {};
  for (const name of readdirSync(TEMPLATE_DIR)) files[name] = readFileSync(new URL(name, TEMPLATE_DIR), 'utf8');
  files['CLAUDE.md'] = GATE;
  return files;
}

/**
 * @param {Record<string, string>} files
 * @param {typeof rules} [selected]
 * @returns {Promise<Map<string, string>>} rule id to status
 */
async function measure(files, selected = rules) {
  const ctx = {
    fs: createMemoryFs(files),
    eslint: { printConfig: () => Promise.resolve({ ok: /** @type {const} */ (false), error: 'n/a' }) },
    now: new Date('2026-11-17'),
  };
  const results = await runRules(selected, [], ctx);
  return new Map(results.map((result) => [result.rule.id, result.status]));
}

describe('Python rules', () => {
  it('cover types, lint, warnings, interpreter, locked audit and the format gate', () => {
    const ids = rules.map((rule) => rule.id);
    for (let n = 1; n <= 11; n++) assert.ok(ids.includes(`PY-${String(n).padStart(3, '0')}`), `PY-${n} is missing`);
  });

  it('are all pass or manual for the project that follows templates/python', async () => {
    const status = await measure(compliantProject());
    const bad = [...status].filter(([, value]) => value !== 'pass' && value !== 'manual');
    assert.deepEqual(bad, []);
  });

  /** @type {readonly (readonly [string, string, string, string])[]} */
  const violations = [
    ['PY-001', 'pyproject.toml', 'strict = true', 'check_untyped_defs = true'],
    ['PY-003', 'pyproject.toml', 'filterwarnings', 'warning_filters'],
    ['PY-004', 'pyproject.toml', 'requires-python', 'python-version'],
    ['PY-006', 'pyproject.toml', 'select = ["ALL"]', 'select = ["E", "F"]'],
    ['PY-007', 'CLAUDE.md', 'ruff format --check', 'ruff format'],
    ['PY-009', 'pyproject.toml', '"ignore-without-code"', '"redundant-expr"'],
    ['PY-010', 'pyproject.toml', '--strict-markers', '--verbose'],
    ['PY-010', 'pyproject.toml', 'xfail_strict = true', 'xfail_strict = false'],
    ['PY-011', 'CLAUDE.md', 'pip-audit', 'pip list'],
  ];

  for (const [id, file, from, to] of violations) {
    it(`${id} fails when ${file} changes "${from}" to "${to}"`, async () => {
      const files = compliantProject();
      const text = files[file];
      if (text === undefined || !text.includes(from)) assert.fail(`fixture ${file} does not contain ${from}`);
      files[file] = text.replaceAll(from, to);
      assert.equal((await measure(files)).get(id), 'fail');
    });
  }

  it('PY-001 does not mistake pytest options for strict type checking', async () => {
    const files = compliantProject();
    files['pyproject.toml'] = '[tool.pytest.ini_options]\naddopts = ["--strict-markers"]\nxfail_strict = true\n';
    assert.equal((await measure(files)).get('PY-001'), 'fail');
    files['pyrightconfig.json'] = '{ "typeCheckingMode": "strict" }\n';
    assert.equal((await measure(files)).get('PY-001'), 'pass');
  });

  it('PY-002 fails without any Ruff configuration', async () => {
    const files = compliantProject();
    files['pyproject.toml'] = '[project]\nrequires-python = ">=3.14"\n';
    assert.equal((await measure(files)).get('PY-002'), 'fail');
  });

  it('PY-008 fails without .python-version', async () => {
    const files = compliantProject();
    delete files['.python-version'];
    assert.equal((await measure(files)).get('PY-008'), 'fail');
  });

  it('PY-007 and PY-011 also accept the gate in a script or an Azure Pipelines file', async () => {
    for (const path of ['scripts/verify.sh', 'azure-pipelines.yml']) {
      const files = compliantProject();
      delete files['CLAUDE.md'];
      files[path] = 'uv run ruff format --check src tests\nuv run pip-audit --strict -r requirements.txt\n';
      const status = await measure(files);
      assert.equal(status.get('PY-007'), 'pass', path);
      assert.equal(status.get('PY-011'), 'pass', path);
    }
  });
});

describe('AI-003 for Python projects', () => {
  const ai003 = all.filter((rule) => rule.id === 'AI-003');

  it('accepts the commands a uv project names in CLAUDE.md', async () => {
    for (const line of ['uv run pytest', 'uv run mypy', 'uv run ruff check src']) {
      const status = await measure({ 'CLAUDE.md': `# CLAUDE.md\n\n${line}\n` }, ai003);
      assert.equal(status.get('AI-003'), 'pass', line);
    }
  });

  it('still fails when CLAUDE.md names no command', async () => {
    const status = await measure({ 'CLAUDE.md': '# CLAUDE.md\n\nRun the tests.\n' }, ai003);
    assert.equal(status.get('AI-003'), 'fail');
  });
});
