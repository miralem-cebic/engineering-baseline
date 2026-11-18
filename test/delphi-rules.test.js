import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createMemoryFs, createNodeFs } from '../src/fs.js';
import { loadRegistry, selectRules } from '../src/registry.js';
import { runRules } from '../src/runner.js';

const loaded = await loadRegistry(createNodeFs(process.cwd()), 'rules/registry');
if (!loaded.ok) throw new Error(`shipped registry is invalid: ${loaded.error}`);
const rules = selectRules(loaded.value, { ecosystems: ['delphi'], topology: 'local-only' }).filter((rule) =>
  rule.id.startsWith('DEL-'),
);

const TEMPLATE_DIR = new URL('../templates/delphi/', import.meta.url);

/** The files a Delphi project gets from `templates/delphi/`, plus a minimal .dproj and the CLAUDE.md lines the docs ask for. */
function compliantProject() {
  /** @type {Record<string, string>} */
  const files = {};
  for (const name of readdirSync(TEMPLATE_DIR)) files[name] = readFileSync(new URL(name, TEMPLATE_DIR), 'utf8');
  files['project.dproj'] = '<?xml version="1.0" encoding="UTF-8"?>\n<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">\n</Project>\n';
  files['CLAUDE.md'] = [
    '# CLAUDE.md',
    '',
    'Builds with Delphi 13 (RAD Studio 13).',
    '',
    'MSBuild project.dproj /p:config=Release /t:Build',
    '',
  ].join('\n');
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
    now: new Date('2026-11-18'),
  };
  const results = await runRules(rules, [], ctx);
  return new Map(results.map((result) => [result.rule.id, result.status]));
}

describe('Delphi rules', () => {
  it('cover: gitignore, gitattributes, .dproj present, edition named, build command documented', () => {
    const ids = rules.map((rule) => rule.id);
    for (let n = 1; n <= 5; n++) assert.ok(ids.includes(`DEL-${String(n).padStart(3, '0')}`), `DEL-${n} is missing`);
  });

  it('are all pass or manual for the project that follows templates/delphi', async () => {
    const status = await measure(compliantProject());
    const bad = [...status].filter(([, value]) => value !== 'pass' && value !== 'manual');
    assert.deepEqual(bad, []);
  });

  /** @type {readonly (readonly [string, string, string, string])[]} */
  const violations = [
    ['DEL-001', '.gitignore', '__history/', '# history dir removed'],
    ['DEL-002', '.gitattributes', '*.pas    text eol=crlf', '# pas line ending removed'],
    ['DEL-004', 'CLAUDE.md', 'Delphi 13 (RAD Studio 13)', 'A Pascal tool.'],
    ['DEL-005', 'CLAUDE.md', 'MSBuild project.dproj', '# build command removed'],
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

  it('DEL-003 fails when no .dproj file is in the tree', async () => {
    const files = compliantProject();
    delete files['project.dproj'];
    assert.equal((await measure(files)).get('DEL-003'), 'fail');
  });

  it('DEL-003 passes when the .dproj sits under src/', async () => {
    const files = compliantProject();
    const dproj = files['project.dproj'];
    delete files['project.dproj'];
    if (dproj === undefined) assert.fail('fixture has no project.dproj');
    files['src/project.dproj'] = dproj;
    assert.equal((await measure(files)).get('DEL-003'), 'pass');
  });
});
