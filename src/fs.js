import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', 'bin', 'obj', '.venv', 'build']);

// Never useful for rule checks; hidden from listings so checks do not trip over vendored or VCS content.
const HIDDEN_ENTRIES = new Set(['node_modules', '.git']);

/**
 * Normalizes a relative path to posix form. Returns null when it would leave the root.
 * @param {string} path
 * @returns {string | null}
 */
function normalize(path) {
  /** @type {string[]} */
  const stack = [];
  for (const part of path.split(/[\\/]/)) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (stack.length === 0) return null;
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return stack.join('/');
}

/**
 * @param {string} path
 * @param {readonly string[]} exts
 */
function hasExt(path, exts) {
  return exts.some((ext) => path.endsWith(ext));
}

/**
 * @param {string} path
 */
function isInIgnoredDir(path) {
  return path.split('/').slice(0, -1).some((segment) => IGNORED_DIRS.has(segment));
}

/**
 * In-memory file system for tests.
 * @param {Record<string, string>} files
 * @returns {import('./types.js').Fs}
 */
export function createMemoryFs(files) {
  const map = new Map(Object.entries(files));
  return {
    readText: (path) => {
      const normalized = normalize(path);
      return Promise.resolve(normalized === null ? null : (map.get(normalized) ?? null));
    },
    exists: (path) => {
      const normalized = normalize(path);
      if (normalized === null) return Promise.resolve(false);
      if (normalized === '' || map.has(normalized)) return Promise.resolve(true);
      return Promise.resolve([...map.keys()].some((key) => key.startsWith(`${normalized}/`)));
    },
    list: (dir) => {
      const normalized = normalize(dir);
      if (normalized === null) return Promise.resolve(null);
      const prefix = normalized === '' ? '' : `${normalized}/`;
      /** @type {Set<string>} */
      const names = new Set();
      for (const key of map.keys()) {
        if (!key.startsWith(prefix)) continue;
        const first = key.slice(prefix.length).split('/')[0];
        if (first !== undefined && first !== '') names.add(first);
      }
      return Promise.resolve(names.size === 0 ? null : [...names].filter((name) => !HIDDEN_ENTRIES.has(name)));
    },
    walk: (dir, exts) => {
      const normalized = normalize(dir);
      if (normalized === null) return Promise.resolve([]);
      const prefix = normalized === '' ? '' : `${normalized}/`;
      const found = [...map.keys()].filter(
        (key) => key.startsWith(prefix) && hasExt(key, exts) && !isInIgnoredDir(key.slice(prefix.length)),
      );
      return Promise.resolve(found.toSorted());
    },
  };
}

/**
 * File system rooted at a directory. Paths that leave the root, also through symlinks, are treated as missing.
 * @param {string} root
 * @returns {import('./types.js').Fs}
 */
export function createNodeFs(root) {
  const absoluteRoot = resolve(root);

  /**
   * @param {string} path
   * @returns {Promise<string | null>}
   */
  async function inside(path) {
    const normalized = normalize(path);
    if (normalized === null) return null;
    const absolute = join(absoluteRoot, normalized);
    try {
      const [realRoot, real] = await Promise.all([realpath(absoluteRoot), realpath(absolute)]);
      const rel = relative(realRoot, real);
      return rel.startsWith('..') || isAbsolute(rel) ? null : absolute;
    } catch {
      return null;
    }
  }

  /**
   * @param {string} absolute
   * @param {string} prefix
   * @param {readonly string[]} exts
   * @returns {Promise<string[]>}
   */
  async function walkDir(absolute, prefix, exts) {
    const entries = await readdir(absolute, { withFileTypes: true });
    /** @type {string[]} */
    const out = [];
    for (const entry of entries) {
      const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) out.push(...(await walkDir(join(absolute, entry.name), relativePath, exts)));
      } else if (entry.isFile() && hasExt(entry.name, exts)) {
        out.push(relativePath);
      }
    }
    return out;
  }

  return {
    readText: async (path) => {
      const absolute = await inside(path);
      if (absolute === null) return null;
      try {
        return await readFile(absolute, 'utf8');
      } catch {
        return null;
      }
    },
    exists: async (path) => (await inside(path)) !== null,
    list: async (dir) => {
      const absolute = await inside(dir);
      if (absolute === null) return null;
      try {
        return (await readdir(absolute)).filter((name) => !HIDDEN_ENTRIES.has(name));
      } catch {
        return null;
      }
    },
    walk: async (dir, exts) => {
      const normalized = normalize(dir);
      const absolute = await inside(dir);
      if (normalized === null || absolute === null) return [];
      try {
        if (!(await stat(absolute)).isDirectory()) return [];
        return (await walkDir(absolute, normalized, exts)).toSorted();
      } catch {
        return [];
      }
    },
  };
}
