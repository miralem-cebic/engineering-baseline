import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activeWaiver, parseConfig } from '../src/config.js';

const valid = {
  baseline: '0.1.0',
  ecosystems: ['typescript', 'react'],
  topology: 'local-only',
  waivers: [{ rule: 'TS-010', reason: 'migration in progress', expires: '2027-01-31' }],
};

describe('parseConfig', () => {
  it('accepts a valid config', () => {
    const result = parseConfig(JSON.stringify(valid));
    assert.equal(result.ok, true);
    assert.equal(result.value.topology, 'local-only');
    assert.deepEqual(result.value.ecosystems, ['typescript', 'react']);
    assert.equal(result.value.waivers.length, 1);
  });

  it('defaults waivers to an empty list', () => {
    const { baseline, ecosystems, topology } = valid;
    const result = parseConfig(JSON.stringify({ baseline, ecosystems, topology }));
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.waivers, []);
  });

  it('rejects broken JSON', () => {
    assert.equal(parseConfig('{').ok, false);
  });

  it('rejects an unknown topology', () => {
    const result = parseConfig(JSON.stringify({ ...valid, topology: 'cloud' }));
    assert.equal(result.ok, false);
    assert.match(result.error, /topology/);
  });

  it('rejects an unknown ecosystem', () => {
    const result = parseConfig(JSON.stringify({ ...valid, ecosystems: ['cobol'] }));
    assert.equal(result.ok, false);
    assert.match(result.error, /ecosystem/);
  });

  it('rejects an empty ecosystem list', () => {
    assert.equal(parseConfig(JSON.stringify({ ...valid, ecosystems: [] })).ok, false);
  });

  it('requires a reason and a valid date on every waiver', () => {
    const noReason = { ...valid, waivers: [{ rule: 'TS-010', reason: '', expires: '2027-01-31' }] };
    const badDate = { ...valid, waivers: [{ rule: 'TS-010', reason: 'x', expires: 'soon' }] };
    assert.equal(parseConfig(JSON.stringify(noReason)).ok, false);
    assert.equal(parseConfig(JSON.stringify(badDate)).ok, false);
  });
});

describe('activeWaiver', () => {
  const waivers = [{ rule: 'TS-010', reason: 'r', expires: '2027-01-31' }];

  it('finds a waiver that has not expired', () => {
    assert.equal(activeWaiver(waivers, 'TS-010', new Date('2026-10-25'))?.reason, 'r');
  });

  it('is still active on the expiry day', () => {
    assert.notEqual(activeWaiver(waivers, 'TS-010', new Date('2027-01-31T12:00:00Z')), undefined);
  });

  it('ignores an expired waiver', () => {
    assert.equal(activeWaiver(waivers, 'TS-010', new Date('2027-02-01')), undefined);
  });

  it('ignores waivers for other rules', () => {
    assert.equal(activeWaiver(waivers, 'TS-011', new Date('2026-10-25')), undefined);
  });
});
