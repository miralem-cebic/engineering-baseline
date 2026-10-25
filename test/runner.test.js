import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryFs } from '../src/fs.js';
import { exitCode, runRules } from '../src/runner.js';

/**
 * @param {string} id
 * @param {import('../src/types.js').Level} level
 * @param {import('../src/types.js').Check[]} checks
 * @returns {import('../src/types.js').Rule}
 */
const rule = (id, level, checks) => ({ id, title: id, rationale: 'because', level, since: '0.1.0', checks });

const exists = (/** @type {string} */ path) => /** @type {const} */ ({ type: 'file-exists', paths: [path] });

/** @param {Record<string, string>} files */
function ctx(files) {
  return {
    fs: createMemoryFs(files),
    eslint: { printConfig: () => Promise.resolve({ ok: /** @type {const} */ (false), error: 'n/a' }) },
    now: new Date('2026-10-25'),
  };
}

describe('runRules', () => {
  it('passes a rule whose checks all pass', async () => {
    const [result] = await runRules([rule('GEN-001', 'must', [exists('a')])], [], ctx({ a: '' }));
    assert.equal(result?.status, 'pass');
  });

  it('fails a rule when any check fails and keeps the detail', async () => {
    const [result] = await runRules([rule('GEN-001', 'must', [exists('a'), exists('b')])], [], ctx({ a: '' }));
    assert.equal(result?.status, 'fail');
    assert.match(result.details.join(' '), /b/);
  });

  it('reports manual when only manual checks exist', async () => {
    const [result] = await runRules([rule('GEN-002', 'must', [{ type: 'manual' }])], [], ctx({}));
    assert.equal(result?.status, 'manual');
  });

  it('treats pass plus manual as pass', async () => {
    const [result] = await runRules([rule('GEN-003', 'must', [exists('a'), { type: 'manual' }])], [], ctx({ a: '' }));
    assert.equal(result?.status, 'pass');
  });

  it('skips a rule whose checks are all skipped', async () => {
    const [result] = await runRules([rule('GEN-004', 'must', [{ type: 'max-lines', path: 'x', max: 1 }])], [], ctx({}));
    assert.equal(result?.status, 'skip');
  });

  it('waives a failing rule with an active waiver', async () => {
    const waivers = [{ rule: 'GEN-001', reason: 'later', expires: '2027-01-01' }];
    const [result] = await runRules([rule('GEN-001', 'must', [exists('a')])], waivers, ctx({}));
    assert.equal(result?.status, 'waived');
    assert.match(result.details.join(' '), /later/);
  });

  it('reports an expired waiver and evaluates the rule normally', async () => {
    const waivers = [{ rule: 'GEN-001', reason: 'later', expires: '2026-01-01' }];
    const [result] = await runRules([rule('GEN-001', 'must', [exists('a')])], waivers, ctx({}));
    assert.equal(result?.status, 'fail');
    assert.match(result.details.join(' '), /expired/);
  });
});

describe('exitCode', () => {
  /** @param {import('../src/types.js').Level} level @param {import('../src/types.js').Status} status */
  const result = (level, status) => ({ rule: rule('GEN-001', level, [{ type: 'manual' }]), status, details: [] });

  it('is 1 when a must rule fails', () => {
    assert.equal(exitCode([result('must', 'fail')], false), 1);
  });

  it('ignores failing should and proposed rules unless strict', () => {
    assert.equal(exitCode([result('should', 'fail'), result('proposed', 'fail')], false), 0);
    assert.equal(exitCode([result('should', 'fail')], true), 1);
  });

  it('never fails on proposed rules', () => {
    assert.equal(exitCode([result('proposed', 'fail')], true), 0);
  });

  it('is 0 for waived, manual and skipped rules', () => {
    assert.equal(exitCode([result('must', 'waived'), result('must', 'manual'), result('must', 'skip')], true), 0);
  });
});
