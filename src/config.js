import { isNonEmptyString, isRecord, pick } from './guards.js';
import { parseJsonc } from './jsonc.js';

export const ECOSYSTEMS = /** @type {const} */ (['typescript', 'react', 'postgres', 'swift', 'kotlin', 'csharp', 'python']);
export const TOPOLOGIES = /** @type {const} */ (['local-only', 'hosted-no-db', 'hosted-db']);

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {unknown} value
 * @returns {import('./types.js').Result<import('./types.js').Waiver>}
 */
function parseWaiver(value) {
  if (!isRecord(value)) return { ok: false, error: 'waiver must be an object' };
  const { rule, reason, expires } = value;
  if (!isNonEmptyString(rule)) return { ok: false, error: 'waiver.rule is required' };
  if (!isNonEmptyString(reason)) return { ok: false, error: `waiver ${rule}: a reason is required` };
  if (typeof expires !== 'string' || !DATE.test(expires) || Number.isNaN(Date.parse(expires))) {
    return { ok: false, error: `waiver ${rule}: expires must be a date YYYY-MM-DD` };
  }
  return { ok: true, value: { rule, reason, expires } };
}

/**
 * Parses and validates baseline.json of a project. Never throws.
 * @param {string} text
 * @returns {import('./types.js').Result<import('./types.js').ProjectConfig>}
 */
export function parseConfig(text) {
  const parsed = parseJsonc(text);
  if (!parsed.ok) return { ok: false, error: `baseline.json is not valid JSON: ${parsed.error}` };
  return validateConfig(parsed.value);
}

/**
 * Validates an already parsed project config; shared with the fleet file.
 * @param {unknown} raw
 * @returns {import('./types.js').Result<import('./types.js').ProjectConfig>}
 */
export function validateConfig(raw) {
  if (!isRecord(raw)) return { ok: false, error: 'baseline.json must be an object' };

  const { baseline, ecosystems, topology, waivers } = raw;
  if (!isNonEmptyString(baseline)) return { ok: false, error: 'baseline (version) is required' };

  if (!Array.isArray(ecosystems) || ecosystems.length === 0) {
    return { ok: false, error: 'ecosystems must be a non-empty list' };
  }
  /** @type {import('./types.js').Ecosystem[]} */
  const knownEcosystems = [];
  for (const item of ecosystems) {
    const ecosystem = pick(ECOSYSTEMS, item);
    if (ecosystem === undefined) {
      return { ok: false, error: `unknown ecosystem ${JSON.stringify(item)}; known: ${ECOSYSTEMS.join(', ')}` };
    }
    knownEcosystems.push(ecosystem);
  }

  const knownTopology = pick(TOPOLOGIES, topology);
  if (knownTopology === undefined) {
    return { ok: false, error: `unknown topology ${JSON.stringify(topology)}; known: ${TOPOLOGIES.join(', ')}` };
  }

  /** @type {import('./types.js').Waiver[]} */
  const knownWaivers = [];
  if (waivers !== undefined) {
    if (!Array.isArray(waivers)) return { ok: false, error: 'waivers must be a list' };
    for (const item of waivers) {
      const waiver = parseWaiver(item);
      if (!waiver.ok) return waiver;
      knownWaivers.push(waiver.value);
    }
  }

  return {
    ok: true,
    value: { baseline, ecosystems: knownEcosystems, topology: knownTopology, waivers: knownWaivers },
  };
}

/**
 * A waiver is valid through the end of its expiry day (UTC).
 * @param {readonly import('./types.js').Waiver[]} waivers
 * @param {string} ruleId
 * @param {Date} now
 * @returns {import('./types.js').Waiver | undefined}
 */
export function activeWaiver(waivers, ruleId, now) {
  return waivers.find((waiver) => {
    if (waiver.rule !== ruleId) return false;
    const endOfDay = Date.parse(`${waiver.expires}T23:59:59.999Z`);
    return now.getTime() <= endOfDay;
  });
}
