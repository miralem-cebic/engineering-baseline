import { ECOSYSTEMS, TOPOLOGIES } from './config.js';
import { isNonEmptyString, isRecord, isStringArray, pick } from './guards.js';
import { isJsonValue, parseJsonc } from './jsonc.js';

const LEVELS = /** @type {const} */ (['must', 'should', 'proposed']);
const ID = /^[A-Z]{2,5}-\d{3}$/;

/** @typedef {import('./types.js').Check} Check */

/**
 * @param {string} pattern
 * @param {unknown} flags
 * @returns {string | null} an error message, or null when the expression compiles
 */
function regexError(pattern, flags) {
  try {
    new RegExp(pattern, typeof flags === 'string' ? flags : undefined);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * @param {Record<string, unknown>} raw
 * @param {string} field
 * @returns {string[] | null}
 */
function stringList(raw, field) {
  const value = raw[field];
  return isStringArray(value) && value.length > 0 ? value : null;
}

/**
 * @param {unknown} value
 * @returns {import('./types.js').Result<Check>}
 */
export function parseCheck(value) {
  if (!isRecord(value) || typeof value['type'] !== 'string') return { ok: false, error: 'check needs a type' };
  const type = value['type'];
  /** @param {string} field */
  const missing = (field) => ({ ok: /** @type {const} */ (false), error: `check ${type}: ${field} is required` });
  const flags = typeof value['flags'] === 'string' ? value['flags'] : undefined;

  switch (type) {
    case 'manual':
      return { ok: true, value: { type } };
    case 'file-exists': {
      const paths = stringList(value, 'paths');
      return paths ? { ok: true, value: { type, paths } } : missing('paths');
    }
    case 'file-contains':
    case 'file-not-contains': {
      const paths = stringList(value, 'paths');
      const pattern = value['pattern'];
      if (!paths) return missing('paths');
      if (!isNonEmptyString(pattern)) return missing('pattern');
      const problem = regexError(pattern, flags);
      if (problem !== null) return { ok: false, error: `check ${type}: invalid pattern: ${problem}` };
      return { ok: true, value: flags === undefined ? { type, paths, pattern } : { type, paths, pattern, flags } };
    }
    case 'json-value': {
      const files = stringList(value, 'files');
      const path = value['path'];
      const expected = value['expected'];
      if (!files) return missing('files');
      if (!isNonEmptyString(path)) return missing('path');
      if (expected === undefined || !isJsonValue(expected)) return missing('expected');
      const resolveExtends = value['resolveExtends'] === true;
      return { ok: true, value: { type, files, path, expected, resolveExtends } };
    }
    case 'package-script': {
      const scripts = stringList(value, 'scripts');
      if (!scripts) return missing('scripts');
      const pattern = value['pattern'];
      if (typeof pattern === 'string') {
        const problem = regexError(pattern, undefined);
        if (problem !== null) return { ok: false, error: `check ${type}: invalid pattern: ${problem}` };
        return { ok: true, value: { type, scripts, pattern } };
      }
      return { ok: true, value: { type, scripts } };
    }
    case 'package-dependency': {
      const names = stringList(value, 'names');
      return names ? { ok: true, value: { type, names } } : missing('names');
    }
    case 'dir-unique-prefix': {
      const dirs = stringList(value, 'dirs');
      const prefix = value['prefix'];
      if (!dirs) return missing('dirs');
      // An empty prefix is valid: Supabase migrations are named by timestamp alone.
      return typeof prefix === 'string' ? { ok: true, value: { type, dirs, prefix } } : missing('prefix');
    }
    case 'sql-tables-have-rls': {
      const dirs = stringList(value, 'dirs');
      return dirs ? { ok: true, value: { type, dirs } } : missing('dirs');
    }
    case 'eslint-rule': {
      const rule = value['rule'];
      return isNonEmptyString(rule) ? { ok: true, value: { type, rule } } : missing('rule');
    }
    case 'max-lines': {
      const path = value['path'];
      const max = value['max'];
      if (!isNonEmptyString(path)) return missing('path');
      return typeof max === 'number' && Number.isInteger(max) && max > 0
        ? { ok: true, value: { type, path, max } }
        : missing('max');
    }
    case 'repo-contains': {
      const dirs = stringList(value, 'dirs');
      const exts = stringList(value, 'exts');
      const pattern = value['pattern'];
      if (!dirs) return missing('dirs');
      if (!exts) return missing('exts');
      if (!isNonEmptyString(pattern)) return missing('pattern');
      const problem = regexError(pattern, flags);
      if (problem !== null) return { ok: false, error: `check ${type}: invalid pattern: ${problem}` };
      return { ok: true, value: flags === undefined ? { type, dirs, exts, pattern } : { type, dirs, exts, pattern, flags } };
    }
    default:
      return { ok: false, error: `unknown check type "${type}"` };
  }
}

/**
 * @template {string} T
 * @param {readonly T[]} allowed
 * @param {unknown} value
 * @param {string} label
 * @returns {import('./types.js').Result<T[] | undefined>}
 */
function scopeList(allowed, value, label) {
  if (value === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(value) || value.length === 0) return { ok: false, error: `${label} must be a non-empty list` };
  /** @type {T[]} */
  const out = [];
  for (const item of value) {
    const known = pick(allowed, item);
    if (known === undefined) return { ok: false, error: `unknown ${label} ${JSON.stringify(item)}` };
    out.push(known);
  }
  return { ok: true, value: out };
}

/**
 * @param {unknown} value
 * @returns {import('./types.js').Result<import('./types.js').Rule>}
 */
export function parseRule(value) {
  if (!isRecord(value)) return { ok: false, error: 'rule must be an object' };
  const { id, title, rationale, since, hint } = value;
  if (typeof id !== 'string' || !ID.test(id)) return { ok: false, error: `invalid rule id ${JSON.stringify(id)}` };
  if (!isNonEmptyString(title)) return { ok: false, error: `${id}: title is required` };
  if (!isNonEmptyString(rationale)) return { ok: false, error: `${id}: rationale is required` };
  if (!isNonEmptyString(since)) return { ok: false, error: `${id}: since is required` };
  const level = pick(LEVELS, value['level']);
  if (level === undefined) return { ok: false, error: `${id}: unknown level ${JSON.stringify(value['level'])}` };

  const ecosystems = scopeList(ECOSYSTEMS, value['ecosystems'], 'ecosystem');
  if (!ecosystems.ok) return { ok: false, error: `${id}: ${ecosystems.error}` };
  const topologies = scopeList(TOPOLOGIES, value['topologies'], 'topology');
  if (!topologies.ok) return { ok: false, error: `${id}: ${topologies.error}` };

  const rawChecks = value['checks'];
  if (!Array.isArray(rawChecks) || rawChecks.length === 0) return { ok: false, error: `${id}: at least one check is required` };
  /** @type {Check[]} */
  const checks = [];
  for (const item of rawChecks) {
    const check = parseCheck(item);
    if (!check.ok) return { ok: false, error: `${id}: ${check.error}` };
    checks.push(check.value);
  }

  return {
    ok: true,
    value: {
      id,
      title,
      rationale,
      level,
      since,
      checks,
      ...(ecosystems.value === undefined ? {} : { ecosystems: ecosystems.value }),
      ...(topologies.value === undefined ? {} : { topologies: topologies.value }),
      ...(typeof hint === 'string' ? { hint } : {}),
    },
  };
}

/**
 * Loads every rules/registry/*.json file. Fails on the first invalid rule or duplicate id.
 * @param {import('./types.js').Fs} fs
 * @param {string} dir
 * @returns {Promise<import('./types.js').Result<import('./types.js').Rule[]>>}
 */
export async function loadRegistry(fs, dir) {
  const names = await fs.list(dir);
  if (names === null) return { ok: false, error: `registry directory ${dir} not found` };
  /** @type {import('./types.js').Rule[]} */
  const rules = [];
  /** @type {Map<string, string>} */
  const seen = new Map();
  for (const name of names.filter((entry) => entry.endsWith('.json')).toSorted()) {
    const file = `${dir}/${name}`;
    const text = await fs.readText(file);
    if (text === null) return { ok: false, error: `${file}: cannot be read` };
    const parsed = parseJsonc(text);
    if (!parsed.ok) return { ok: false, error: `${file}: ${parsed.error}` };
    if (!Array.isArray(parsed.value)) return { ok: false, error: `${file}: must contain a list of rules` };
    for (const item of parsed.value) {
      const rule = parseRule(item);
      if (!rule.ok) return { ok: false, error: `${file}: ${rule.error}` };
      const first = seen.get(rule.value.id);
      if (first !== undefined) return { ok: false, error: `duplicate rule id ${rule.value.id} in ${first} and ${file}` };
      seen.set(rule.value.id, file);
      rules.push(rule.value);
    }
  }
  return { ok: true, value: rules };
}

/**
 * Profile selection: unscoped rules apply everywhere; a scoped rule needs a matching ecosystem AND topology.
 * @param {readonly import('./types.js').Rule[]} rules
 * @param {{ ecosystems: readonly import('./types.js').Ecosystem[]; topology: import('./types.js').Topology }} profile
 */
export function selectRules(rules, profile) {
  return rules.filter((rule) => {
    const ecosystemOk = rule.ecosystems === undefined || rule.ecosystems.some((e) => profile.ecosystems.includes(e));
    const topologyOk = rule.topologies === undefined || rule.topologies.includes(profile.topology);
    return ecosystemOk && topologyOk;
  });
}
