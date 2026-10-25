import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createMemoryFs, createNodeFs } from '../src/fs.js';

/** @param {import('../src/types.js').Fs} fs */
function contract(fs) {
  it('reads text of an existing file and returns null for a missing one', async () => {
    assert.equal(await fs.readText('a/b.txt'), 'hello');
    assert.equal(await fs.readText('a/missing.txt'), null);
  });

  it('knows files and directories', async () => {
    assert.equal(await fs.exists('a/b.txt'), true);
    assert.equal(await fs.exists('a'), true);
    assert.equal(await fs.exists('nope'), false);
  });

  it('lists the direct children of a directory', async () => {
    const names = await fs.list('a');
    assert.deepEqual(names?.toSorted(), ['b.txt', 'sub']);
    assert.equal(await fs.list('nope'), null);
  });

  it('walks files with the given extensions and skips node_modules', async () => {
    const files = await fs.walk('a', ['.ts']);
    assert.deepEqual(files.toSorted(), ['a/sub/c.ts']);
  });

  it('refuses paths that leave the root', async () => {
    assert.equal(await fs.readText('../outside.txt'), null);
    assert.equal(await fs.exists('../outside.txt'), false);
    assert.equal(await fs.list('..'), null);
  });
}

describe('memory fs', () => {
  const fs = createMemoryFs({
    'a/b.txt': 'hello',
    'a/sub/c.ts': 'x',
    'a/node_modules/d.ts': 'x',
  });
  contract(fs);
});

describe('node fs', () => {
  /** @type {string} */
  let root = '';
  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'baseline-fs-'));
    await mkdir(join(root, 'a', 'sub'), { recursive: true });
    await mkdir(join(root, 'a', 'node_modules'), { recursive: true });
    await writeFile(join(root, 'a', 'b.txt'), 'hello');
    await writeFile(join(root, 'a', 'sub', 'c.ts'), 'x');
    await writeFile(join(root, 'a', 'node_modules', 'd.ts'), 'x');
  });
  after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  contract({
    readText: (p) => createNodeFs(root).readText(p),
    exists: (p) => createNodeFs(root).exists(p),
    list: (p) => createNodeFs(root).list(p),
    walk: (p, e) => createNodeFs(root).walk(p, e),
  });
});
