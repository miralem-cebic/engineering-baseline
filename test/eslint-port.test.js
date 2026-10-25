import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createEslintPort } from '../src/eslint-port.js';

describe('createEslintPort', () => {
  it('resolves the effective config of this repository through its own ESLint', async () => {
    const port = createEslintPort(process.cwd());
    const result = await port.printConfig('src/fs.js');
    assert.equal(result.ok, true);
    const rules = result.value['rules'];
    assert.ok(typeof rules === 'object' && rules !== null && '@typescript-eslint/no-explicit-any' in rules);
  });

  it('accepts a relative project root', async () => {
    const result = await createEslintPort('.').printConfig('src/fs.js');
    assert.equal(result.ok, true);
  });

  it('returns an error value when the project has no ESLint', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'baseline-noeslint-'));
    try {
      const result = await createEslintPort(empty).printConfig('src/a.ts');
      assert.equal(result.ok, false);
      assert.match(result.error, /eslint/i);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});
