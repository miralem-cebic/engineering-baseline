import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createMemoryFs, createNodeFs } from '../src/fs.js';
import { loadRegistry, selectRules } from '../src/registry.js';
import { runRules } from '../src/runner.js';

const loaded = await loadRegistry(createNodeFs(process.cwd()), 'rules/registry');
if (!loaded.ok) throw new Error(`shipped registry is invalid: ${loaded.error}`);
const rules = selectRules(loaded.value, { ecosystems: ['csharp'], topology: 'local-only' }).filter((rule) =>
  rule.id.startsWith('CSH-'),
);

const TEMPLATE_DIR = new URL('../templates/csharp/', import.meta.url);

/** The files a C# project gets from `templates/csharp`, plus the CLAUDE.md line that names the format gate. */
function compliantProject() {
  /** @type {Record<string, string>} */
  const files = {};
  for (const name of readdirSync(TEMPLATE_DIR)) files[name] = readFileSync(new URL(name, TEMPLATE_DIR), 'utf8');
  files['CLAUDE.md'] = '# CLAUDE.md\n\ndotnet format MyApp.slnx --verify-no-changes\n';
  return files;
}

/**
 * @param {Record<string, string>} files
 * @returns {Promise<Map<string, string>>} rule id to status
 */
async function measure(files) {
  const ctx = {
    fs: createMemoryFs(files),
    eslint: { printConfig: () => Promise.resolve({ ok: /** @type {const} */ (false), error: 'n/a' }) },
    now: new Date('2026-10-28'),
  };
  const results = await runRules(rules, [], ctx);
  return new Map(results.map((result) => [result.rule.id, result.status]));
}

describe('C# rules', () => {
  it('cover the build baseline: unsafe, overflow, banned APIs, lock files, audit, SDK pin', () => {
    const ids = rules.map((rule) => rule.id);
    for (let n = 1; n <= 18; n++) assert.ok(ids.includes(`CSH-${String(n).padStart(3, '0')}`), `CSH-${n} is missing`);
  });

  it('are all pass or manual for the project that follows templates/csharp', async () => {
    const status = await measure(compliantProject());
    const bad = [...status].filter(([, value]) => value !== 'pass' && value !== 'manual');
    assert.deepEqual(bad, []);
  });

  /** @type {readonly (readonly [string, string, string, string])[]} */
  const violations = [
    ['CSH-005', 'Directory.Packages.props', '<ManagePackageVersionsCentrally>true', '<ManagePackageVersionsCentrally>false'],
    ['CSH-007', 'Directory.Build.props', '<AllowUnsafeBlocks>false', '<AllowUnsafeBlocks>true'],
    ['CSH-008', 'Directory.Build.props', '<CheckForOverflowUnderflow>true', '<CheckForOverflowUnderflow>false'],
    ['CSH-009', 'Directory.Build.props', '<MSBuildTreatWarningsAsErrors>true', '<MSBuildTreatWarningsAsErrors>false'],
    ['CSH-010', 'Directory.Build.props', 'Microsoft.CodeAnalysis.BannedApiAnalyzers', 'Some.Other.Analyzer'],
    ['CSH-011', 'BannedSymbols.txt', 'P:System.DateTime.UtcNow', 'P:System.DateTime.Ticks'],
    ['CSH-011', 'BannedSymbols.txt', 'P:System.Threading.Tasks.Task`1.Result', 'P:System.Threading.Tasks.Task`1.Status'],
    ['CSH-012', 'Directory.Build.props', '<RestorePackagesWithLockFile>true', '<RestorePackagesWithLockFile>false'],
    ['CSH-013', 'Directory.Build.props', '<NuGetAuditMode>all', '<NuGetAuditMode>direct'],
    ['CSH-014', 'global.json', '"version"', '"versionX"'],
    ['CSH-015', 'global.json', '"Microsoft.Testing.Platform"', '"VSTest"'],
    ['CSH-016', 'Directory.Build.props', '</PropertyGroup>', '<NoWarn>CS1591</NoWarn></PropertyGroup>'],
    ['CSH-017', '.editorconfig', '[*.cs]', '[*.txt]'],
    ['CSH-018', 'CLAUDE.md', '--verify-no-changes', '--check'],
  ];

  for (const [id, file, from, to] of violations) {
    it(`${id} fails when ${file} changes "${from}" to "${to}"`, async () => {
      const files = compliantProject();
      const text = files[file];
      if (text === undefined || !text.includes(from)) assert.fail(`fixture ${file} does not contain ${from}`);
      files[file] = text.replace(from, to);
      assert.equal((await measure(files)).get(id), 'fail');
    });
  }

  it('CSH-016 allows an empty NoWarn element', async () => {
    const files = compliantProject();
    files['Directory.Build.props'] = (files['Directory.Build.props'] ?? '').replace('</PropertyGroup>', '<NoWarn></NoWarn></PropertyGroup>');
    assert.equal((await measure(files)).get('CSH-016'), 'pass');
  });

  it('CSH-018 also accepts the format gate in the pipeline', async () => {
    const files = compliantProject();
    delete files['CLAUDE.md'];
    files['.github/workflows/ci.yml'] = 'steps:\n  - run: dotnet format App.slnx --verify-no-changes\n';
    assert.equal((await measure(files)).get('CSH-018'), 'pass');
  });
});
