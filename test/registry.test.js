import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryFs } from '../src/fs.js';
import { loadRegistry, parseCheck, parseRule, selectRules } from '../src/registry.js';

const base = {
  id: 'GEN-001',
  title: 'Conventional Commits',
  rationale: 'Readable history, automatic changelog.',
  level: 'must',
  since: '0.1.0',
  checks: [{ type: 'file-exists', paths: ['.github/workflows/ci.yml'] }],
};

describe('parseRule', () => {
  it('accepts a minimal rule', () => {
    const result = parseRule(base);
    assert.equal(result.ok, true);
  });

  it('rejects ids that do not follow PREFIX-NNN', () => {
    assert.equal(parseRule({ ...base, id: 'gen1' }).ok, false);
  });

  it('rejects an unknown level', () => {
    assert.equal(parseRule({ ...base, level: 'nice' }).ok, false);
  });

  it('rejects an unknown check type and names it', () => {
    const result = parseRule({ ...base, checks: [{ type: 'magic' }] });
    assert.equal(result.ok, false);
    assert.match(result.error, /magic/)
  });

  it('rejects a check with missing fields', () => {
    assert.equal(parseRule({ ...base, checks: [{ type: 'file-exists' }] }).ok, false);
  });

  it('accepts an empty prefix for timestamp-named migrations', () => {
    const checks = [{ type: 'dir-unique-prefix', dirs: ['supabase/migrations'], prefix: '' }];
    assert.equal(parseRule({ ...base, checks }).ok, true);
  });

  it('rejects a rule without any check', () => {
    assert.equal(parseRule({ ...base, checks: [] }).ok, false);
  });

  it('rejects an invalid regular expression in a check', () => {
    const checks = [{ type: 'file-contains', paths: ['a'], pattern: '(' }];
    assert.equal(parseRule({ ...base, checks }).ok, false);
  });

  it('rejects unknown ecosystems and topologies', () => {
    assert.equal(parseRule({ ...base, ecosystems: ['cobol'] }).ok, false);
    assert.equal(parseRule({ ...base, topologies: ['moon'] }).ok, false);
  });

  it('accepts every check type with its required fields', () => {
    const checks = [
      { type: 'manual' },
      { type: 'file-contains', paths: ['a'], pattern: 'x' },
      { type: 'file-not-contains', paths: ['a'], pattern: 'x' },
      { type: 'json-value', files: ['tsconfig.json'], path: 'compilerOptions.strict', expected: true },
      { type: 'package-script', scripts: ['test'] },
      { type: 'package-dependency', names: ['zod'] },
      { type: 'dir-unique-prefix', dirs: ['supabase/patches'], prefix: 'patch_' },
      { type: 'sql-tables-have-rls', dirs: ['supabase/patches'] },
      { type: 'eslint-rule', rule: '@typescript-eslint/no-explicit-any' },
      { type: 'max-lines', path: 'CLAUDE.md', max: 250 },
      { type: 'repo-setting', path: 'allowSquashMerge', expected: true },
      { type: 'repo-contains', dirs: ['src'], exts: ['.ts'], pattern: 'x' },
      { type: 'file-named', names: ['packages.lock.json'], dirs: ['.'] },
    ];
    assert.equal(parseRule({ ...base, checks }).ok, true);
  });
});

describe('parseCheck file-named', () => {
  it('needs names and dirs', () => {
    assert.equal(parseCheck({ type: 'file-named', dirs: ['.'] }).ok, false);
    assert.equal(parseCheck({ type: 'file-named', names: ['a'] }).ok, false);
  });
});

describe('loadRegistry', () => {
  it('reads every json file in rules/registry', async () => {
    const fs = createMemoryFs({
      'rules/registry/general.json': JSON.stringify([base]),
      'rules/registry/ts.json': JSON.stringify([{ ...base, id: 'TS-001' }]),
    });
    const result = await loadRegistry(fs, 'rules/registry');
    assert.equal(result.ok && result.value.length, 2);
  });

  it('fails on duplicate ids and names the id', async () => {
    const fs = createMemoryFs({
      'rules/registry/a.json': JSON.stringify([base]),
      'rules/registry/b.json': JSON.stringify([base]),
    });
    const result = await loadRegistry(fs, 'rules/registry');
    assert.equal(result.ok, false);
    assert.match(result.error, /GEN-001/)
  });

  it('fails when the directory is missing', async () => {
    const result = await loadRegistry(createMemoryFs({}), 'rules/registry');
    assert.equal(result.ok, false);
  });

  it('reports the file of an invalid rule', async () => {
    const fs = createMemoryFs({ 'rules/registry/bad.json': JSON.stringify([{ ...base, level: 'x' }]) });
    const result = await loadRegistry(fs, 'rules/registry');
    assert.equal(result.ok, false);
    assert.match(result.error, /bad\.json/)
  });
});

describe('selectRules', () => {
  /** @param {string} id @param {object} extra */
  const rule = (id, extra = {}) => {
    const parsed = parseRule({ ...base, id, ...extra });
    if (!parsed.ok) throw new Error(parsed.error);
    return parsed.value;
  };
  const rules = [
    rule('GEN-001'),
    rule('TS-001', { ecosystems: ['typescript'] }),
    rule('PY-001', { ecosystems: ['python'] }),
    rule('LOC-001', { topologies: ['local-only'] }),
    rule('HOS-001', { topologies: ['hosted-no-db', 'hosted-db'] }),
    rule('DB-001', { ecosystems: ['postgres'], topologies: ['hosted-db'] }),
  ];

  it('keeps rules without scope for every project', () => {
    const ids = selectRules(rules, { ecosystems: ['typescript'], topology: 'local-only' }).map((r) => r.id);
    assert.deepEqual(ids, ['GEN-001', 'TS-001', 'LOC-001']);
  });

  it('requires both ecosystem and topology to match when a rule scopes both', () => {
    const ids = selectRules(rules, { ecosystems: ['typescript', 'postgres'], topology: 'hosted-db' }).map(
      (r) => r.id,
    );
    assert.deepEqual(ids, ['GEN-001', 'TS-001', 'HOS-001', 'DB-001']);
  });
});
