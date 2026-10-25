import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isRecord } from './guards.js';

/**
 * Asks the project's own ESLint (not ours) for the effective config of a file, so rules are judged
 * against what the project really runs.
 * @param {string} root
 * @returns {import('./types.js').EslintPort}
 */
export function createEslintPort(root) {
  // createRequire and ESLint's cwd both need an absolute path.
  const absoluteRoot = resolve(root);
  return {
    printConfig: async (sampleFile) => {
      try {
        const entry = createRequire(join(absoluteRoot, 'package.json')).resolve('eslint');
        const mod = /** @type {unknown} */ (await import(pathToFileURL(entry).href));
        const ctor = isRecord(mod) ? mod['ESLint'] : undefined;
        if (typeof ctor !== 'function') return { ok: false, error: 'eslint module has no ESLint class' };
        const instance = /** @type {unknown} */ (Reflect.construct(ctor, [{ cwd: absoluteRoot }]));
        if (!isRecord(instance)) return { ok: false, error: 'eslint could not be instantiated' };
        /** @type {unknown} */
        const calculate = Reflect.get(instance, 'calculateConfigForFile');
        if (typeof calculate !== 'function') return { ok: false, error: 'eslint cannot calculate configs' };
        /** @type {unknown} */
        const config = await Reflect.apply(calculate, instance, [sampleFile]);
        return isRecord(config) ? { ok: true, value: config } : { ok: false, error: 'eslint found no config for the file' };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}
