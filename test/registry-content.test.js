import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ECOSYSTEMS, TOPOLOGIES } from '../src/config.js';
import { createMemoryFs, createNodeFs } from '../src/fs.js';
import { loadRegistry, selectRules } from '../src/registry.js';
import { runRules } from '../src/runner.js';

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

describe('GEN-014 lock files', () => {
  /** @param {Record<string, string>} files */
  async function gen014(files) {
    const rule = rules.find((r) => r.id === 'GEN-014');
    assert.ok(rule);
    const ctx = {
      fs: createMemoryFs(files),
      eslint: { printConfig: () => Promise.resolve({ ok: /** @type {const} */ (false), error: 'n/a' }) },
      now: new Date('2026-10-28'),
    };
    return (await runRules([rule], [], ctx))[0]?.status;
  }

  it('accepts a NuGet lock file in a nested project', async () => {
    assert.equal(await gen014({ 'src/App/packages.lock.json': '{}' }), 'pass');
  });

  it('still accepts a root lock file and still fails without any', async () => {
    assert.equal(await gen014({ 'package-lock.json': '{}' }), 'pass');
    assert.equal(await gen014({ 'README.md': '' }), 'fail');
  });
});

describe('GEN-021 third-party libraries sit behind an adapter', () => {
  const rule = rules.find((r) => r.id === 'GEN-021');

  it('exists and starts as proposed like every new rule (ADR 0004)', () => {
    assert.ok(rule, 'GEN-021 is missing');
    assert.equal(rule.level, 'proposed');
  });

  it('applies to every ecosystem and topology, because the idea is language-agnostic', () => {
    for (const ecosystem of ECOSYSTEMS) {
      for (const topology of TOPOLOGIES) {
        const selected = selectRules(rules, { ecosystems: [ecosystem], topology });
        assert.ok(selected.some((r) => r.id === 'GEN-021'), `not selected for ${ecosystem} / ${topology}`);
      }
    }
  });

  it('points to a guide that exists', async () => {
    assert.ok(rule);
    const guide = /docs\/[\w-]+\.md/.exec(rule.hint ?? '')?.[0];
    assert.ok(guide, 'the hint names no guide under docs/');
    assert.equal(await createNodeFs(process.cwd()).exists(guide), true, `${guide} does not exist`);
  });
});
