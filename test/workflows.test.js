import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const conformance = readFileSync(new URL('../.github/workflows/conformance.yml', import.meta.url), 'utf8');

test('conformance workflow runs the CLI from a checkout, not via npx on a github: spec', () => {
  // npm 10 fails `npx github:...` with "GitFetcher requires an Arborist constructor to pack a tarball".
  const commands = conformance.split('\n').filter((line) => !line.trim().startsWith('#'));
  assert.ok(!commands.some((line) => /\bnpx\b.*github:/.test(line)), 'npx github: is used');
  assert.match(conformance, /git clone .*engineering-baseline/);
  assert.match(conformance, /git -C .* checkout .*BASELINE_REF/);
  assert.match(conformance, /node .*bin\/baseline\.js" check/);
});

test('conformance workflow runs the checker from the commit of the workflow file unless baseline-ref is set', () => {
  // Pinning `uses: ...conformance.yml@<commit>` must pin the checker too; a `main` default let both drift apart.
  const input = /baseline-ref:\n(?<body>(?: {8,}.*\n)+)/.exec(conformance)?.groups?.['body'] ?? '';
  assert.ok(input.length > 0, 'baseline-ref input is missing');
  assert.doesNotMatch(input, /default:\s*main\b/, 'baseline-ref still defaults to main');
  assert.match(input, /default:\s*''/);
  assert.match(conformance, /BASELINE_REF:\s*\$\{\{\s*inputs\.baseline-ref\s*\|\|\s*job\.workflow_sha\s*\}\}/);
});

test('conformance workflow stops when it does not know which version of the checker to run', () => {
  // job.workflow_sha is not available on GitHub Enterprise Server; falling back to main would hide the problem.
  assert.match(conformance, /if \[ -z "\$BASELINE_REF" \]; then[\s\S]*Set the baseline-ref input[\s\S]*exit 1/);
});

test('documented conformance calls pin the workflow to a commit, never to main', () => {
  const sources = ['../README.md', '../templates/ci-conformance.yml', '../.github/workflows/conformance.yml'];
  for (const path of sources) {
    const text = readFileSync(new URL(path, import.meta.url), 'utf8');
    const calls = text.match(/conformance\.yml@\S+/g) ?? [];
    assert.ok(calls.length > 0, `${path} shows no conformance.yml call`);
    for (const call of calls) assert.doesNotMatch(call, /@(main|master)\b/, `${path}: ${call}`);
  }
});
