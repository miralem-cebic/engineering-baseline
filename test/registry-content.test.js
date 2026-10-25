import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ECOSYSTEMS, TOPOLOGIES } from '../src/config.js';
import { createNodeFs } from '../src/fs.js';
import { loadRegistry } from '../src/registry.js';

const result = await loadRegistry(createNodeFs(process.cwd()), 'rules/registry');
if (!result.ok) throw new Error(`shipped registry is invalid: ${result.error}`);
const rules = result.value;

describe('shipped registry', () => {
  it('is not empty', () => {
    assert.ok(rules.length > 0);
  });

  it('has rules for every ecosystem', () => {
    for (const ecosystem of ECOSYSTEMS) {
      assert.ok(rules.some((rule) => rule.ecosystems?.includes(ecosystem)), `no rule for ${ecosystem}`);
    }
  });

  it('has rules for every topology', () => {
    for (const topology of TOPOLOGIES) {
      assert.ok(rules.some((rule) => rule.topologies?.includes(topology)), `no rule for ${topology}`);
    }
  });

  it('keeps non-TypeScript ecosystems at proposed until a project proves them', () => {
    const unproven = rules.filter((rule) => rule.ecosystems?.some((e) => ['swift', 'kotlin', 'csharp', 'python'].includes(e)));
    assert.ok(unproven.length > 0);
    assert.ok(unproven.every((rule) => rule.level === 'proposed'));
  });

  it('gives every must rule a way to fix it or a self-explanatory check', () => {
    const musts = rules.filter((rule) => rule.level === 'must');
    assert.ok(musts.length > 0);
    assert.ok(musts.every((rule) => rule.rationale.length >= 20));
  });
});
