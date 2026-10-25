import { activeWaiver } from './config.js';
import { runCheck } from './checks.js';

/**
 * Combines the results of a rule's checks: any fail fails the rule; a pass counts even next to manual
 * checks; a rule with only manual checks is manual; a rule with nothing measurable is skipped.
 * @param {readonly import('./types.js').CheckResult[]} results
 * @returns {import('./types.js').Status}
 */
function aggregate(results) {
  if (results.some((r) => r.status === 'fail')) return 'fail';
  if (results.some((r) => r.status === 'pass')) return 'pass';
  if (results.some((r) => r.status === 'manual')) return 'manual';
  return 'skip';
}

/**
 * @param {readonly import('./types.js').Rule[]} rules
 * @param {readonly import('./types.js').Waiver[]} waivers
 * @param {import('./types.js').Context} ctx
 * @returns {Promise<import('./types.js').RuleResult[]>}
 */
export async function runRules(rules, waivers, ctx) {
  /** @type {import('./types.js').RuleResult[]} */
  const out = [];
  for (const rule of rules) {
    /** @type {import('./types.js').CheckResult[]} */
    const results = [];
    for (const check of rule.checks) results.push(await runCheck(check, ctx));
    const status = aggregate(results);
    const details = results.filter((r) => r.status !== 'pass').map((r) => r.detail);

    const waiver = activeWaiver(waivers, rule.id, ctx.now);
    if (waiver !== undefined) {
      if (status === 'fail') {
        out.push({ rule, status: 'waived', details: [`waived until ${waiver.expires}: ${waiver.reason}`, ...details] });
      } else {
        out.push({ rule, status, details: [...details, `waiver for ${rule.id} is no longer needed`] });
      }
      continue;
    }

    const expired = waivers.find((w) => w.rule === rule.id);
    out.push({
      rule,
      status,
      details: expired === undefined ? details : [`waiver expired on ${expired.expires}`, ...details],
    });
  }
  return out;
}

/**
 * 1 when a must rule fails; with `strict` also when a should rule fails. Proposed rules never fail a run.
 * @param {readonly import('./types.js').RuleResult[]} results
 * @param {boolean} strict
 */
export function exitCode(results, strict) {
  const blocking = results.some(
    (r) => r.status === 'fail' && (r.rule.level === 'must' || (strict && r.rule.level === 'should')),
  );
  return blocking ? 1 : 0;
}
