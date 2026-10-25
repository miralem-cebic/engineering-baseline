import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runCheck } from '../src/checks.js';
import { createMemoryFs } from '../src/fs.js';

/**
 * Keeps the literal `type` of fixtures so they stay assignable to Check.
 * @template {import('../src/types.js').Check} T
 * @param {T} check
 * @returns {T}
 */
const chk = (check) => check;

/**
 * @param {Record<string, string>} files
 * @param {Record<string, unknown> | null} eslintRules
 */
function ctx(files, eslintRules = null) {
  return {
    fs: createMemoryFs(files),
    eslint: {
      printConfig: () =>
        Promise.resolve(
          eslintRules === null ? { ok: /** @type {const} */ (false), error: 'no eslint' } : { ok: /** @type {const} */ (true), value: { rules: eslintRules } },
        ),
    },
    now: new Date('2026-10-25'),
  };
}

describe('manual', () => {
  it('is reported as manual', async () => {
    assert.equal((await runCheck({ type: 'manual' }, ctx({}))).status, 'manual');
  });
});

describe('file-exists', () => {
  it('passes when any alternative exists', async () => {
    const check = chk({ type: 'file-exists', paths: ['SECURITY.md', '.github/SECURITY.md'] });
    assert.equal((await runCheck(check, ctx({ '.github/SECURITY.md': 'x' }))).status, 'pass');
  });

  it('fails and names the alternatives when none exists', async () => {
    const check = chk({ type: 'file-exists', paths: ['SECURITY.md'] });
    const result = await runCheck(check, ctx({}));
    assert.equal(result.status, 'fail');
    assert.match(result.detail, /SECURITY\.md/);
  });
});

describe('file-contains / file-not-contains', () => {
  it('matches a pattern in an existing file', async () => {
    const check = chk({ type: 'file-contains', paths: ['ci.yml'], pattern: 'pull_request' });
    assert.equal((await runCheck(check, ctx({ 'ci.yml': 'on: pull_request' }))).status, 'pass');
    assert.equal((await runCheck(check, ctx({ 'ci.yml': 'on: push' }))).status, 'fail');
  });

  it('fails when the file is missing', async () => {
    const check = chk({ type: 'file-contains', paths: ['ci.yml'], pattern: 'x' });
    assert.equal((await runCheck(check, ctx({}))).status, 'fail');
  });

  it('respects regex flags', async () => {
    const check = chk({ type: 'file-contains', paths: ['a'], pattern: 'HELLO', flags: 'i' });
    assert.equal((await runCheck(check, ctx({ a: 'hello' }))).status, 'pass');
  });

  it('not-contains passes for missing files and fails on a match', async () => {
    const check = chk({ type: 'file-not-contains', paths: ['a'], pattern: 'TODO' });
    assert.equal((await runCheck(check, ctx({}))).status, 'pass');
    assert.equal((await runCheck(check, ctx({ a: 'TODO later' }))).status, 'fail');
    assert.equal((await runCheck(check, ctx({ a: 'done' }))).status, 'pass');
  });
});

describe('json-value', () => {
  const strict = chk({ type: 'json-value', files: ['tsconfig.json'], path: 'compilerOptions.strict', expected: true });

  it('compares a nested value, with comments allowed', async () => {
    const files = { 'tsconfig.json': '{ // c\n "compilerOptions": { "strict": true, } }' };
    assert.equal((await runCheck(strict, ctx(files))).status, 'pass');
  });

  it('fails on a different value and shows both', async () => {
    const files = { 'tsconfig.json': '{"compilerOptions":{"strict":false}}' };
    const result = await runCheck(strict, ctx(files));
    assert.equal(result.status, 'fail');
    assert.match(result.detail, /false/);
  });

  it('fails when the key is absent', async () => {
    assert.equal((await runCheck(strict, ctx({ 'tsconfig.json': '{}' }))).status, 'fail');
  });

  it('supports exists and oneOf', async () => {
    const files = { 'tsconfig.json': '{"compilerOptions":{"target":"ES2023"}}' };
    const exists = { ...strict, path: 'compilerOptions.target', expected: { exists: true } };
    const oneOf = { ...strict, path: 'compilerOptions.target', expected: { oneOf: ['ES2022', 'ES2023'] } };
    assert.equal((await runCheck(exists, ctx(files))).status, 'pass');
    assert.equal((await runCheck(oneOf, ctx(files))).status, 'pass');
  });

  it('follows relative extends when asked', async () => {
    const files = {
      'tsconfig.json': '{"extends":"./tsconfig.base.json","compilerOptions":{}}',
      'tsconfig.base.json': '{"compilerOptions":{"strict":true}}',
    };
    assert.equal((await runCheck({ ...strict, resolveExtends: true }, ctx(files))).status, 'pass');
    assert.equal((await runCheck(strict, ctx(files))).status, 'fail');
  });

  it('prefers the child over the parent', async () => {
    const files = {
      'tsconfig.json': '{"extends":"./base.json","compilerOptions":{"strict":false}}',
      'base.json': '{"compilerOptions":{"strict":true}}',
    };
    assert.equal((await runCheck({ ...strict, resolveExtends: true }, ctx(files))).status, 'fail');
  });

  it('does not loop on cyclic extends', async () => {
    const files = { 'a.json': '{"extends":"./b.json"}', 'b.json': '{"extends":"./a.json"}' };
    const check = { ...strict, files: ['a.json'], resolveExtends: true };
    assert.equal((await runCheck(check, ctx(files))).status, 'fail');
  });

  it('fails clearly when no file exists or the file is invalid', async () => {
    assert.equal((await runCheck(strict, ctx({}))).status, 'fail');
    assert.equal((await runCheck(strict, ctx({ 'tsconfig.json': '{' }))).status, 'fail');
  });
});

describe('package-script / package-dependency', () => {
  const pkg = JSON.stringify({
    scripts: { lint: 'eslint . --max-warnings 0', test: 'vitest run' },
    dependencies: { zod: '^4.0.0' },
    devDependencies: { vitest: '^4.0.0' },
  });

  it('requires all scripts', async () => {
    assert.equal((await runCheck({ type: 'package-script', scripts: ['lint', 'test'] }, ctx({ 'package.json': pkg }))).status, 'pass');
    assert.equal((await runCheck({ type: 'package-script', scripts: ['lint', 'build'] }, ctx({ 'package.json': pkg }))).status, 'fail');
  });

  it('checks the script body against a pattern', async () => {
    const ok = chk({ type: 'package-script', scripts: ['lint'], pattern: '--max-warnings 0' });
    const bad = chk({ type: 'package-script', scripts: ['test'], pattern: '--max-warnings 0' });
    assert.equal((await runCheck(ok, ctx({ 'package.json': pkg }))).status, 'pass');
    assert.equal((await runCheck(bad, ctx({ 'package.json': pkg }))).status, 'fail');
  });

  it('finds dependencies in any dependency section', async () => {
    assert.equal((await runCheck({ type: 'package-dependency', names: ['zod', 'vitest'] }, ctx({ 'package.json': pkg }))).status, 'pass');
    const missing = await runCheck({ type: 'package-dependency', names: ['zod', 'fast-check'] }, ctx({ 'package.json': pkg }));
    assert.equal(missing.status, 'fail');
    assert.match(missing.detail, /fast-check/);
  });

  it('fails without a package.json', async () => {
    assert.equal((await runCheck({ type: 'package-script', scripts: ['lint'] }, ctx({}))).status, 'fail');
  });
});

describe('dir-unique-prefix', () => {
  const check = chk({ type: 'dir-unique-prefix', dirs: ['patches'], prefix: 'patch_' });

  it('passes for unique numbers', async () => {
    const files = { 'patches/patch_001_a.sql': '', 'patches/patch_002_b.sql': '' };
    assert.equal((await runCheck(check, ctx(files))).status, 'pass');
  });

  it('fails for duplicate numbers and names them', async () => {
    const files = { 'patches/patch_001_a.sql': '', 'patches/patch_001_b.sql': '' };
    const result = await runCheck(check, ctx(files));
    assert.equal(result.status, 'fail');
    assert.match(result.detail, /001/);
  });

  it('skips when the directory does not exist', async () => {
    assert.equal((await runCheck(check, ctx({}))).status, 'skip');
  });
});

describe('sql-tables-have-rls', () => {
  const check = chk({ type: 'sql-tables-have-rls', dirs: ['patches'] });

  it('passes when every created table enables RLS', async () => {
    const sql = 'create table if not exists public.notes (id uuid);\nalter table public.notes enable row level security;';
    assert.equal((await runCheck(check, ctx({ 'patches/a.sql': sql }))).status, 'pass');
  });

  it('accepts RLS enabled in a later file', async () => {
    const files = {
      'patches/a.sql': 'CREATE TABLE notes (id uuid);',
      'patches/b.sql': 'ALTER TABLE notes ENABLE ROW LEVEL SECURITY;',
    };
    assert.equal((await runCheck(check, ctx(files))).status, 'pass');
  });

  it('fails and names tables without RLS', async () => {
    const result = await runCheck(check, ctx({ 'patches/a.sql': 'create table secrets (id uuid);' }));
    assert.equal(result.status, 'fail');
    assert.match(result.detail, /secrets/);
  });

  it('ignores temporary tables and comments', async () => {
    const sql = '-- create table ghost (id int);\ncreate temp table scratch (id int);';
    assert.equal((await runCheck(check, ctx({ 'patches/a.sql': sql }))).status, 'pass');
  });

  it('skips without sql files', async () => {
    assert.equal((await runCheck(check, ctx({}))).status, 'skip');
  });
});

describe('eslint-rule', () => {
  const check = chk({ type: 'eslint-rule', rule: '@typescript-eslint/no-explicit-any' });
  const files = { 'src/a.ts': 'export {}' };

  it('passes when the rule is on in any severity notation', async () => {
    assert.equal((await runCheck(check, ctx(files, { '@typescript-eslint/no-explicit-any': [2] }))).status, 'pass');
    assert.equal((await runCheck(check, ctx(files, { '@typescript-eslint/no-explicit-any': 'error' }))).status, 'pass');
    assert.equal((await runCheck(check, ctx(files, { '@typescript-eslint/no-explicit-any': ['warn', {}] }))).status, 'pass');
  });

  it('fails when the rule is off or missing', async () => {
    assert.equal((await runCheck(check, ctx(files, { '@typescript-eslint/no-explicit-any': 0 }))).status, 'fail');
    assert.equal((await runCheck(check, ctx(files, {}))).status, 'fail');
  });

  it('skips when eslint cannot be resolved', async () => {
    assert.equal((await runCheck(check, ctx(files, null))).status, 'skip');
  });

  it('skips when there is no source file to ask about', async () => {
    assert.equal((await runCheck(check, ctx({}, {}))).status, 'skip');
  });
});

describe('max-lines', () => {
  it('compares the line count', async () => {
    const files = { 'CLAUDE.md': 'a\nb\nc\n' };
    assert.equal((await runCheck({ type: 'max-lines', path: 'CLAUDE.md', max: 3 }, ctx(files))).status, 'pass');
    assert.equal((await runCheck({ type: 'max-lines', path: 'CLAUDE.md', max: 2 }, ctx(files))).status, 'fail');
  });

  it('skips a missing file', async () => {
    assert.equal((await runCheck({ type: 'max-lines', path: 'CLAUDE.md', max: 3 }, ctx({}))).status, 'skip');
  });
});

describe('repo-contains', () => {
  const check = chk({ type: 'repo-contains', dirs: ['src'], exts: ['.ts'], pattern: 'ErrorBoundary' });

  it('finds a pattern anywhere below the directories', async () => {
    assert.equal((await runCheck(check, ctx({ 'src/deep/x.ts': 'class ErrorBoundary {}' }))).status, 'pass');
  });

  it('fails when nothing matches and ignores other extensions', async () => {
    assert.equal((await runCheck(check, ctx({ 'src/x.ts': 'nope', 'src/y.md': 'ErrorBoundary' }))).status, 'fail');
  });
});
