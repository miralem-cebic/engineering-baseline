import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatMatrix, formatSummary, formatText } from '../src/report.js';

/**
 * @param {string} id
 * @param {import('../src/types.js').Status} status
 * @param {import('../src/types.js').Level} [level]
 * @returns {import('../src/types.js').RuleResult}
 */
const result = (id, status, level = 'must') => ({
  rule: { id, title: `Title ${id}`, rationale: 'r', level, since: '0.1.0', checks: [{ type: 'manual' }], hint: `fix ${id}` },
  status,
  details: status === 'fail' ? [`detail ${id}`] : [],
});

describe('formatSummary', () => {
  it('counts by status', () => {
    const summary = formatSummary([result('A-001', 'pass'), result('A-002', 'fail'), result('A-003', 'fail')]);
    assert.match(summary, /1 pass/);
    assert.match(summary, /2 fail/);
  });
});

describe('formatText', () => {
  it('lists failures with detail and hint, but not passes', () => {
    const text = formatText([result('A-001', 'pass'), result('A-002', 'fail')]);
    assert.match(text, /A-002/);
    assert.match(text, /detail A-002/);
    assert.match(text, /fix A-002/);
    assert.doesNotMatch(text, /Title A-001/);
  });

  it('marks the level of a failing rule', () => {
    assert.match(formatText([result('A-002', 'fail', 'should')]), /should/);
  });
});

describe('formatMatrix', () => {
  const projects = [
    { name: 'alpha', results: [result('A-001', 'pass'), result('A-002', 'fail')] },
    { name: 'beta', results: [result('A-001', 'pass')] },
  ];

  it('renders a markdown table with one column per project', () => {
    const lines = formatMatrix(projects).split('\n');
    assert.equal(lines[0], '| Rule | Level | Title | alpha | beta |');
    assert.equal(lines[1], '| --- | --- | --- | :---: | :---: |');
    assert.match(lines[2] ?? '', /^\| A-001 \| must \| Title A-001 \| ✅ \| ✅ \|$/);
  });

  it('shows a dash where a rule does not apply to a project', () => {
    const lines = formatMatrix(projects).split('\n');
    assert.match(lines[3] ?? '', /\| ❌ \| – \|$/);
  });

  it('ends with a totals row per project', () => {
    const lines = formatMatrix(projects).trimEnd().split('\n');
    assert.match(lines.at(-1) ?? '', /^\| \*\*Must passing\*\* \| \| \| 1\/2 \| 1\/1 \|$/);
  });
});
