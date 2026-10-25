const ORDER = /** @type {const} */ (['pass', 'fail', 'waived', 'manual', 'skip']);

const SYMBOL = /** @type {const} */ ({ pass: '✅', fail: '❌', waived: '🟡', manual: '👁', skip: '⏭' });

/**
 * @param {readonly import('./types.js').RuleResult[]} results
 */
export function formatSummary(results) {
  const parts = ORDER.map((status) => ({ status, count: results.filter((r) => r.status === status).length }))
    .filter(({ count }) => count > 0)
    .map(({ status, count }) => `${count} ${status}`);
  return parts.length === 0 ? 'no rules selected' : parts.join(', ');
}

/**
 * Failures with their details and the hint how to fix them; passing rules stay silent.
 * @param {readonly import('./types.js').RuleResult[]} results
 */
export function formatText(results) {
  const lines = [];
  for (const { rule, status, details } of results) {
    if (status !== 'fail') continue;
    lines.push(`✖ [${rule.level}] ${rule.id} ${rule.title}`);
    for (const detail of details) lines.push(`    ${detail}`);
    if (rule.hint !== undefined) lines.push(`    → ${rule.hint}`);
  }
  lines.push(formatSummary(results));
  return lines.join('\n');
}

/**
 * Rules by projects as a markdown table; `–` marks a rule that does not apply to a project.
 * @param {readonly { name: string; results: readonly import('./types.js').RuleResult[] }[]} projects
 */
export function formatMatrix(projects) {
  /** @type {Map<string, import('./types.js').Rule>} */
  const rules = new Map();
  for (const project of projects) {
    for (const { rule } of project.results) if (!rules.has(rule.id)) rules.set(rule.id, rule);
  }
  const names = projects.map((p) => p.name);
  const lines = [
    `| Rule | Level | Title | ${names.join(' | ')} |`,
    `| --- | --- | --- | ${names.map(() => ':---:').join(' | ')} |`,
  ];
  for (const rule of [...rules.values()].toSorted((a, b) => a.id.localeCompare(b.id))) {
    const cells = projects.map((project) => {
      const found = project.results.find((r) => r.rule.id === rule.id);
      return found === undefined ? '–' : SYMBOL[found.status];
    });
    lines.push(`| ${rule.id} | ${rule.level} | ${rule.title} | ${cells.join(' | ')} |`);
  }
  const totals = projects.map((project) => {
    const measurable = project.results.filter((r) => r.rule.level === 'must' && (r.status === 'pass' || r.status === 'fail'));
    return `${measurable.filter((r) => r.status === 'pass').length}/${measurable.length}`;
  });
  lines.push(`| **Must passing** | | | ${totals.join(' | ')} |`);
  return `${lines.join('\n')}\n`;
}
