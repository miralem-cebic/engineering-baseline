import { isDeepStrictEqual } from 'node:util';
import { isRecord } from './guards.js';
import { parseJsonc } from './jsonc.js';

/** @typedef {import('./types.js').Check} Check */
/** @typedef {import('./types.js').CheckResult} CheckResult */
/** @typedef {import('./types.js').Context} Context */

/** @param {string} detail @returns {CheckResult} */
const pass = (detail) => ({ status: 'pass', detail });
/** @param {string} detail @returns {CheckResult} */
const fail = (detail) => ({ status: 'fail', detail });
/** @param {string} detail @returns {CheckResult} */
const skip = (detail) => ({ status: 'skip', detail });

/**
 * @param {unknown} value
 * @param {string} dotted
 * @returns {unknown}
 */
function getPath(value, dotted) {
  /** @type {unknown} */
  let current = value;
  for (const key of dotted.split('.')) {
    if (Array.isArray(current)) {
      current = /^\d+$/.test(key) ? current[Number(key)] : undefined;
    } else if (isRecord(current)) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current;
}

/** @param {string} file */
function dirOf(file) {
  const index = file.lastIndexOf('/');
  return index === -1 ? '' : file.slice(0, index);
}

/**
 * @param {string} from file that contains the extends
 * @param {string} target value of `extends`
 * @returns {string | null} workspace path, or null for package references
 */
function resolveExtendsPath(from, target) {
  if (!target.startsWith('.')) return null;
  const parts = [...dirOf(from).split('/').filter((part) => part !== ''), ...target.split('/')];
  /** @type {string[]} */
  const stack = [];
  for (const part of parts) {
    if (part === '..') stack.pop();
    else if (part !== '.' && part !== '') stack.push(part);
  }
  const joined = stack.join('/');
  return joined.endsWith('.json') ? joined : `${joined}.json`;
}

/**
 * Looks a dotted path up in a JSONC file, optionally following `extends`; the child wins.
 * @param {import('./types.js').Fs} fs
 * @param {string} file
 * @param {string} dotted
 * @param {boolean} follow
 * @param {Set<string>} visited
 * @returns {Promise<import('./types.js').Result<unknown>>}
 */
async function lookup(fs, file, dotted, follow, visited) {
  if (visited.has(file)) return { ok: true, value: undefined };
  visited.add(file);
  const text = await fs.readText(file);
  if (text === null) return { ok: false, error: `${file} not found` };
  const parsed = parseJsonc(text);
  if (!parsed.ok) return { ok: false, error: `${file} is not valid JSON: ${parsed.error}` };
  const own = getPath(parsed.value, dotted);
  if (own !== undefined || !follow) return { ok: true, value: own };

  const parents = getPath(parsed.value, 'extends');
  const list = typeof parents === 'string' ? [parents] : Array.isArray(parents) ? parents : [];
  for (const parent of list.toReversed()) {
    if (typeof parent !== 'string') continue;
    const target = resolveExtendsPath(file, parent);
    if (target === null) continue;
    const inherited = await lookup(fs, target, dotted, follow, visited);
    if (!inherited.ok) return inherited;
    if (inherited.value !== undefined) return inherited;
  }
  return { ok: true, value: undefined };
}

/**
 * @param {unknown} actual
 * @param {unknown} expected a JSON value or an `{ exists }` / `{ oneOf }` matcher
 */
function matches(actual, expected) {
  if (isRecord(expected) && expected['exists'] === true && Object.keys(expected).length === 1) {
    return actual !== undefined;
  }
  if (isRecord(expected) && Array.isArray(expected['oneOf']) && Object.keys(expected).length === 1) {
    return expected['oneOf'].some((candidate) => isDeepStrictEqual(actual, candidate));
  }
  return isDeepStrictEqual(actual, expected);
}

/**
 * @param {string} pattern
 * @param {string | undefined} flags
 */
function compile(pattern, flags) {
  return new RegExp(pattern, flags);
}

/**
 * @param {import('./types.js').Fs} fs
 * @param {readonly string[]} paths
 * @returns {Promise<{ path: string; text: string }[]>}
 */
async function readExisting(fs, paths) {
  /** @type {{ path: string; text: string }[]} */
  const found = [];
  for (const path of paths) {
    const text = await fs.readText(path);
    if (text !== null) found.push({ path, text });
  }
  return found;
}

/**
 * @param {import('./types.js').Fs} fs
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function readPackageJson(fs) {
  const text = await fs.readText('package.json');
  if (text === null) return null;
  const parsed = parseJsonc(text);
  return parsed.ok && isRecord(parsed.value) ? parsed.value : null;
}

/** @param {string} sql */
function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

/** @param {string} raw */
function tableName(raw) {
  return raw.replaceAll('"', '').replace(/^public\./i, '').toLowerCase();
}

/**
 * @param {readonly string[]} severity
 * @param {unknown} setting
 */
function isEnabled(severity, setting) {
  /** @type {unknown} */
  const level = Array.isArray(setting) ? setting[0] : setting;
  if (typeof level !== 'string' && typeof level !== 'number') return false;
  return !severity.includes(String(level));
}

const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * Runs one check against a project. Never throws: problems become results.
 * @param {Check} check
 * @param {Context} ctx
 * @returns {Promise<CheckResult>}
 */
export async function runCheck(check, ctx) {
  const { fs } = ctx;
  switch (check.type) {
    case 'manual':
      return { status: 'manual', detail: 'needs human review' };

    case 'file-exists': {
      for (const path of check.paths) {
        if (await fs.exists(path)) return pass(path);
      }
      return fail(`missing: ${check.paths.join(' or ')}`);
    }

    case 'file-named': {
      for (const dir of check.dirs) {
        const found = (await fs.walk(dir, check.names)).find((file) => check.names.includes(file.slice(file.lastIndexOf('/') + 1)));
        if (found !== undefined) return pass(found);
      }
      return fail(`no file named ${check.names.join(' or ')} in ${check.dirs.join(', ')}`);
    }

    case 'file-contains': {
      const files = await readExisting(fs, check.paths);
      if (files.length === 0) return fail(`missing: ${check.paths.join(' or ')}`);
      const regex = compile(check.pattern, check.flags);
      const hit = files.find((file) => regex.test(file.text));
      return hit ? pass(hit.path) : fail(`${files.map((f) => f.path).join(', ')} does not match /${check.pattern}/`);
    }

    case 'file-not-contains': {
      const files = await readExisting(fs, check.paths);
      const regex = compile(check.pattern, check.flags);
      const hit = files.find((file) => regex.test(file.text));
      return hit ? fail(`${hit.path} matches /${check.pattern}/`) : pass('no match');
    }

    case 'json-value': {
      let lastError = `none of ${check.files.join(', ')} found`;
      for (const file of check.files) {
        if (!(await fs.exists(file))) continue;
        const found = await lookup(fs, file, check.path, check.resolveExtends === true, new Set());
        if (!found.ok) return fail(found.error);
        if (matches(found.value, check.expected)) return pass(`${file}: ${check.path}`);
        lastError = `${file}: ${check.path} is ${found.value === undefined ? 'absent' : JSON.stringify(found.value)}, expected ${JSON.stringify(check.expected)}`;
        return fail(lastError);
      }
      return fail(lastError);
    }

    case 'package-script': {
      const pkg = await readPackageJson(fs);
      if (pkg === null) return fail('package.json missing or invalid');
      const scripts = pkg['scripts'];
      if (!isRecord(scripts)) return fail('package.json has no scripts');
      const missing = check.scripts.filter((name) => typeof scripts[name] !== 'string');
      if (missing.length > 0) return fail(`missing scripts: ${missing.join(', ')}`);
      if (check.pattern !== undefined) {
        const regex = compile(check.pattern, undefined);
        const bad = check.scripts.filter((name) => !regex.test(String(scripts[name])));
        if (bad.length > 0) return fail(`scripts not matching /${check.pattern}/: ${bad.join(', ')}`);
      }
      return pass(check.scripts.join(', '));
    }

    case 'package-dependency': {
      const pkg = await readPackageJson(fs);
      if (pkg === null) return fail('package.json missing or invalid');
      const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
      const known = new Set(sections.flatMap((section) => {
        const entry = pkg[section];
        return isRecord(entry) ? Object.keys(entry) : [];
      }));
      const missing = check.names.filter((name) => !known.has(name));
      return missing.length > 0 ? fail(`missing dependencies: ${missing.join(', ')}`) : pass(check.names.join(', '));
    }

    case 'dir-unique-prefix': {
      /** @type {Map<string, string[]>} */
      const byNumber = new Map();
      let anyDir = false;
      for (const dir of check.dirs) {
        const names = await fs.list(dir);
        if (names === null) continue;
        anyDir = true;
        for (const name of names) {
          if (!name.startsWith(check.prefix)) continue;
          const number = /^\d+/.exec(name.slice(check.prefix.length))?.[0];
          if (number === undefined) continue;
          byNumber.set(number, [...(byNumber.get(number) ?? []), `${dir}/${name}`]);
        }
      }
      if (!anyDir) return skip(`no directory of ${check.dirs.join(', ')}`);
      const duplicates = [...byNumber].filter(([, names]) => names.length > 1);
      if (duplicates.length === 0) return pass('all numbers unique');
      return fail(duplicates.map(([number, names]) => `${number}: ${names.join(', ')}`).join('; '));
    }

    case 'sql-tables-have-rls': {
      const files = (await Promise.all(check.dirs.map((dir) => fs.walk(dir, ['.sql'])))).flat();
      if (files.length === 0) return skip('no SQL files');
      /** @type {Set<string>} */
      const created = new Set();
      /** @type {Set<string>} */
      const secured = new Set();
      for (const file of files) {
        const sql = stripSqlComments((await fs.readText(file)) ?? '');
        for (const match of sql.matchAll(/create\s+(?!temp\b|temporary\b)(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi)) {
          if (match[1] !== undefined) created.add(tableName(match[1]));
        }
        for (const match of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)\s+enable\s+row\s+level\s+security/gi)) {
          if (match[1] !== undefined) secured.add(tableName(match[1]));
        }
      }
      const open = [...created].filter((name) => !secured.has(name)).toSorted();
      return open.length > 0 ? fail(`tables without RLS: ${open.join(', ')}`) : pass(`${created.size} tables secured`);
    }

    case 'eslint-rule': {
      const candidates = [...(await fs.walk('src', SOURCE_EXTS)), ...(await fs.walk('.', SOURCE_EXTS))];
      const sample = candidates[0];
      if (sample === undefined) return skip('no source file to resolve the ESLint config for');
      const config = await ctx.eslint.printConfig(sample);
      if (!config.ok) return skip(`ESLint not available: ${config.error}`);
      const rules = config.value['rules'];
      if (!isRecord(rules)) return skip('ESLint returned no rules');
      return isEnabled(['0', 'off'], rules[check.rule])
        ? pass(`${check.rule} is on`)
        : fail(`${check.rule} is off or not configured`);
    }

    case 'max-lines': {
      const text = await fs.readText(check.path);
      if (text === null) return skip(`${check.path} not found`);
      const lines = text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
      return lines <= check.max ? pass(`${lines} lines`) : fail(`${check.path} has ${lines} lines, max ${check.max}`);
    }

    case 'repo-setting': {
      if (ctx.github === undefined) return skip('no GitHub access: set "repo" in baseline.json and provide GITHUB_TOKEN');
      const live = await ctx.github.getSettings();
      if (!live.ok) return skip(`GitHub settings not available: ${live.error}`);
      const actual = getPath(live.value, check.path);
      return matches(actual, check.expected)
        ? pass(`${check.path} ok`)
        : fail(`${check.path} is ${actual === undefined ? 'absent' : JSON.stringify(actual)}, expected ${JSON.stringify(check.expected)}`);
    }

    case 'repo-contains': {
      const regex = compile(check.pattern, check.flags);
      for (const dir of check.dirs) {
        for (const file of await fs.walk(dir, check.exts)) {
          const text = await fs.readText(file);
          if (text !== null && regex.test(text)) return pass(file);
        }
      }
      return fail(`no ${check.exts.join('/')} file in ${check.dirs.join(', ')} matches /${check.pattern}/`);
    }
  }
}
