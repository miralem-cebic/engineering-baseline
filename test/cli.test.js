import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { main } from '../src/cli.js';
import { createMemoryFs } from '../src/fs.js';

const registry = JSON.stringify([
  {
    id: 'GEN-001',
    title: 'Has readme',
    rationale: 'People need an entry point.',
    level: 'must',
    since: '0.1.0',
    checks: [{ type: 'file-exists', paths: ['README.md'] }],
    hint: 'Add a README.md',
  },
  {
    id: 'GEN-002',
    title: 'Has changelog',
    rationale: 'Releases need notes.',
    level: 'should',
    since: '0.1.0',
    checks: [{ type: 'file-exists', paths: ['CHANGELOG.md'] }],
  },
]);

const config = JSON.stringify({ baseline: '0.1.0', ecosystems: ['typescript'], topology: 'local-only' });

/**
 * @param {{ project?: Record<string, string>; others?: Record<string, Record<string, string>>; existing?: Record<string, string> }} setup
 */
function harness({ project = {}, others = {}, existing = {} } = {}) {
  /** @type {string[]} */
  const out = [];
  /** @type {string[]} */
  const err = [];
  /** @type {Record<string, string>} */
  const written = {};
  /** @type {string[]} */
  const githubRepos = [];
  /** @type {import('../src/types.js').GithubPort | undefined} */
  const github = {
    getSettings: () => Promise.resolve({ ok: /** @type {const} */ (true), value: { allowSquashMerge: true } }),
  };
  const deps = {
    registryFs: createMemoryFs({ 'rules/registry/general.json': registry }),
    createFs: (/** @type {string} */ root) => createMemoryFs(root === '.' ? project : (others[root] ?? {})),
    createGithub: (/** @type {string} */ repo) => {
      githubRepos.push(repo);
      return github;
    },
    createEslint: () => ({ printConfig: () => Promise.resolve({ ok: /** @type {const} */ (false), error: 'n/a' }) }),
    readFile: (/** @type {string} */ path) => Promise.resolve(existing[path] ?? written[path] ?? null),
    writeFile: (/** @type {string} */ path, /** @type {string} */ text) => {
      written[path] = text;
      return Promise.resolve();
    },
    now: new Date('2026-10-25'),
    stdout: (/** @type {string} */ text) => out.push(text),
    stderr: (/** @type {string} */ text) => err.push(text),
  };
  return { deps, out, err, written, githubRepos };
}

describe('check', () => {
  it('exits 0 when every must rule passes', async () => {
    const { deps, out } = harness({ project: { 'baseline.json': config, 'README.md': '' } });
    assert.equal(await main(['check'], deps), 0);
    assert.match(out.join('\n'), /pass/);
  });

  it('exits 1 and explains a failing must rule', async () => {
    const { deps, out } = harness({ project: { 'baseline.json': config } });
    assert.equal(await main(['check'], deps), 1);
    assert.match(out.join('\n'), /GEN-001/);
    assert.match(out.join('\n'), /Add a README\.md/);
  });

  it('fails on should rules only with --strict', async () => {
    const { deps } = harness({ project: { 'baseline.json': config, 'README.md': '' } });
    assert.equal(await main(['check'], deps), 0);
    assert.equal(await main(['check', '--strict'], deps), 1);
  });

  it('prints machine readable output with --json', async () => {
    const { deps, out } = harness({ project: { 'baseline.json': config, 'README.md': '' } });
    await main(['check', '--json'], deps);
    assert.match(out.join(''), /"id":"GEN-001"/);
    assert.match(out.join(''), /"status":"pass"/);
  });

  it('exits 2 when baseline.json is missing', async () => {
    const { deps, err } = harness();
    assert.equal(await main(['check'], deps), 2);
    assert.match(err.join('\n'), /baseline\.json/);
  });

  it('exits 2 when baseline.json is invalid', async () => {
    const { deps, err } = harness({ project: { 'baseline.json': '{"baseline":"0.1.0"}' } });
    assert.equal(await main(['check'], deps), 2);
    assert.match(err.join('\n'), /ecosystems/);
  });
});

describe('repo settings', () => {
  const settingRule = JSON.stringify([
    {
      id: 'REPO-001',
      title: 'Squash only',
      rationale: 'Linear history, one commit per PR.',
      level: 'must',
      since: '0.1.0',
      checks: [{ type: 'repo-setting', path: 'allowSquashMerge', expected: true }],
    },
  ]);
  const withRepo = JSON.stringify({ baseline: '0.1.0', ecosystems: ['typescript'], topology: 'local-only', repo: 'o/r' });

  it('queries GitHub for the repo named in baseline.json', async () => {
    const { deps, githubRepos, out } = harness({ project: { 'baseline.json': withRepo } });
    deps.registryFs = createMemoryFs({ 'rules/registry/repo.json': settingRule });
    assert.equal(await main(['check'], deps), 0);
    assert.deepEqual(githubRepos, ['o/r']);
    assert.match(out.join('\n'), /1 pass/);
  });

  it('does not ask GitHub when baseline.json names no repo', async () => {
    const { deps, githubRepos, out } = harness({ project: { 'baseline.json': config } });
    deps.registryFs = createMemoryFs({ 'rules/registry/repo.json': settingRule });
    assert.equal(await main(['check'], deps), 0);
    assert.deepEqual(githubRepos, []);
    assert.match(out.join('\n'), /1 skip/);
  });
});

describe('docs', () => {
  it('writes the generated pages', async () => {
    const { deps, written } = harness();
    assert.equal(await main(['docs', '--out', 'out'], deps), 0);
    assert.ok(written['out/README.md']?.includes('Generated'));
    assert.ok(written['out/gen.md']?.includes('GEN-001'));
  });

  it('--check fails when the files on disk are stale', async () => {
    const { deps, err } = harness({ existing: { 'out/README.md': 'old', 'out/gen.md': 'old' } });
    assert.equal(await main(['docs', '--out', 'out', '--check'], deps), 1);
    assert.match(err.join('\n'), /out of date/);
  });

  it('--check passes when the files are current', async () => {
    const { deps } = harness();
    await main(['docs', '--out', 'out'], deps);
    assert.equal(await main(['docs', '--out', 'out', '--check'], deps), 0);
  });
});

describe('fleet', () => {
  const fleet = JSON.stringify({
    projects: [
      { name: 'alpha', path: 'alpha', ecosystems: ['typescript'], topology: 'local-only' },
      { name: 'beta', path: 'beta', ecosystems: ['typescript'], topology: 'local-only' },
    ],
  });

  it('prints a matrix across projects', async () => {
    const { deps, out } = harness({ others: { alpha: { 'README.md': '' }, beta: {} }, existing: { 'fleet.json': fleet } });
    assert.equal(await main(['fleet', 'fleet.json'], deps), 0);
    assert.match(out.join('\n'), /\| Rule \| Level \| Title \| alpha \| beta \|/);
    assert.match(out.join('\n'), /\| GEN-001 \| must \| Has readme \| ✅ \| ❌ \|/);
  });

  it('exits 2 for a missing fleet file', async () => {
    const { deps, err } = harness();
    assert.equal(await main(['fleet', 'nope.json'], deps), 2);
    assert.match(err.join('\n'), /nope\.json/);
  });
});

describe('usage', () => {
  it('prints help for no or unknown commands', async () => {
    const first = harness();
    assert.equal(await main([], first.deps), 2);
    assert.match(first.err.join('\n'), /Usage/);
    const second = harness();
    assert.equal(await main(['frobnicate'], second.deps), 2);
  });
});
