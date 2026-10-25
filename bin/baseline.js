#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/cli.js';
import { createEslintPort } from '../src/eslint-port.js';
import { createNodeFs } from '../src/fs.js';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

process.exitCode = await main(process.argv.slice(2), {
  registryFs: createNodeFs(packageRoot),
  createFs: createNodeFs,
  createEslint: createEslintPort,
  readFile: async (path) => {
    try {
      return await readFile(path, 'utf8');
    } catch {
      return null;
    }
  },
  writeFile: async (path, text) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text, 'utf8');
  },
  now: new Date(),
  stdout: (text) => process.stdout.write(`${text}\n`),
  stderr: (text) => process.stderr.write(`${text}\n`),
});
