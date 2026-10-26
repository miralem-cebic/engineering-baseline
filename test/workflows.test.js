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
