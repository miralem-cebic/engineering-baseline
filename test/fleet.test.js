import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseFleet, runFleet } from '../src/fleet.js';
import { createMemoryFs } from '../src/fs.js';

describe('parseFleet', () => {
  const entry = { name: 'alpha', path: '../alpha', ecosystems: ['typescript'], topology: 'local-only' };

  it('accepts a list of projects', () => {
    const result = parseFleet(JSON.stringify({ projects: [entry] }));
    assert.equal(result.ok, true);
    assert.equal(result.value[0]?.name, 'alpha');
  });

  it('rejects an empty fleet', () => {
    assert.equal(parseFleet(JSON.stringify({ projects: [] })).ok, false);
  });

  it('rejects duplicate names', () => {
    assert.equal(parseFleet(JSON.stringify({ projects: [entry, entry] })).ok, false);
  });

  it('reuses the project config validation and names the project', () => {
    const result = parseFleet(JSON.stringify({ projects: [{ ...entry, topology: 'moon' }] }));
    assert.equal(result.ok, false);
    assert.match(result.error, /alpha/);
    assert.match(result.error, /topology/);
  });

  it('rejects broken JSON', () => {
    assert.equal(parseFleet('{').ok, false);
  });
});

describe('runFleet', () => {
  const rules = [
    {
      id: 'GEN-001',
      title: 'Has readme',
      rationale: 'r',
      level: /** @type {const} */ ('must'),
      since: '0.1.0',
      checks: [{ type: /** @type {const} */ ('file-exists'), paths: ['README.md'] }],
    },
    {
      id: 'PY-001',
      title: 'Python only',
      rationale: 'r',
      level: /** @type {const} */ ('must'),
      since: '0.1.0',
      ecosystems: [/** @type {const} */ ('python')],
      checks: [{ type: /** @type {const} */ ('manual') }],
    },
  ];

  it('evaluates each project with its own profile', async () => {
    const projects = [
      { name: 'a', path: 'a', config: { baseline: '0.1.0', ecosystems: [/** @type {const} */ ('typescript')], topology: /** @type {const} */ ('local-only'), waivers: [] } },
      { name: 'b', path: 'b', config: { baseline: '0.1.0', ecosystems: [/** @type {const} */ ('python')], topology: /** @type {const} */ ('hosted-db'), waivers: [] } },
    ];
    const fileSystems = { a: createMemoryFs({ 'README.md': '' }), b: createMemoryFs({}) };
    const results = await runFleet(rules, projects, (project) => ({
      fs: project.name === 'a' ? fileSystems.a : fileSystems.b,
      eslint: { printConfig: () => Promise.resolve({ ok: /** @type {const} */ (false), error: 'n/a' }) },
      now: new Date('2026-10-25'),
    }));
    assert.deepEqual(results.map((r) => r.name), ['a', 'b']);
    assert.deepEqual(results[0]?.results.map((r) => [r.rule.id, r.status]), [['GEN-001', 'pass']]);
    assert.deepEqual(results[1]?.results.map((r) => [r.rule.id, r.status]), [['GEN-001', 'fail'], ['PY-001', 'manual']]);
  });
});
