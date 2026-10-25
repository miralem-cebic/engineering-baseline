import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderRuleDocs } from '../src/docs.js';

/**
 * @param {string} id
 * @param {import('../src/types.js').Level} level
 * @param {Partial<import('../src/types.js').Rule>} [extra]
 * @returns {import('../src/types.js').Rule}
 */
const rule = (id, level, extra = {}) => ({
  id,
  title: `Title ${id}`,
  rationale: `Because ${id}.`,
  level,
  since: '0.1.0',
  checks: [{ type: 'manual' }],
  ...extra,
});

describe('renderRuleDocs', () => {
  const rules = [
    rule('TS-002', 'should', { ecosystems: ['typescript'], hint: 'Do the thing' }),
    rule('GEN-001', 'must'),
    rule('LOC-001', 'proposed', { topologies: ['local-only'] }),
  ];

  it('is deterministic', () => {
    assert.deepEqual(renderRuleDocs(rules), renderRuleDocs([...rules].toReversed()));
  });

  it('produces an index and one page per rule family', () => {
    const files = renderRuleDocs(rules);
    assert.deepEqual(Object.keys(files).toSorted(), ['README.md', 'gen.md', 'loc.md', 'ts.md']);
  });

  it('lists every rule with level, scope, rationale and hint', () => {
    const page = renderRuleDocs(rules)['ts.md'] ?? '';
    assert.match(page, /## TS-002 Title TS-002/);
    assert.match(page, /\*\*Level:\*\* should/);
    assert.match(page, /typescript/);
    assert.match(page, /Because TS-002\./);
    assert.match(page, /Do the thing/);
  });

  it('marks unscoped rules as applying to every project', () => {
    assert.match(renderRuleDocs(rules)['gen.md'] ?? '', /all projects/);
  });

  it('counts rules per level in the index', () => {
    const index = renderRuleDocs(rules)['README.md'] ?? '';
    assert.match(index, /\| must \| 1 \|/);
    assert.match(index, /\| should \| 1 \|/);
    assert.match(index, /\| proposed \| 1 \|/);
  });

  it('says that the files are generated', () => {
    assert.match(renderRuleDocs(rules)['README.md'] ?? '', /Generated/);
  });
});
