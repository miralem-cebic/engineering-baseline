import { validateConfig } from './config.js';
import { isRecord, isNonEmptyString } from './guards.js';
import { parseJsonc } from './jsonc.js';
import { selectRules } from './registry.js';
import { runRules } from './runner.js';

/**
 * @typedef {object} FleetProject
 * @property {string} name
 * @property {string} path relative to the fleet file
 * @property {import('./types.js').ProjectConfig} config
 */

/**
 * Parses fleet.json: the list of projects measured together. Existing projects need no baseline.json
 * for this; their profile is declared here.
 * @param {string} text
 * @returns {import('./types.js').Result<FleetProject[]>}
 */
export function parseFleet(text) {
  const parsed = parseJsonc(text);
  if (!parsed.ok) return { ok: false, error: `fleet file is not valid JSON: ${parsed.error}` };
  const projects = isRecord(parsed.value) ? parsed.value['projects'] : undefined;
  if (!Array.isArray(projects) || projects.length === 0) return { ok: false, error: 'fleet needs a non-empty "projects" list' };

  /** @type {FleetProject[]} */
  const out = [];
  for (const entry of projects) {
    if (!isRecord(entry) || !isNonEmptyString(entry['name']) || !isNonEmptyString(entry['path'])) {
      return { ok: false, error: 'every project needs a name and a path' };
    }
    const { name, path } = entry;
    if (out.some((project) => project.name === name)) return { ok: false, error: `duplicate project name ${name}` };
    const config = validateConfig({ baseline: 'fleet', ...entry });
    if (!config.ok) return { ok: false, error: `${name}: ${config.error}` };
    out.push({ name, path, config: config.value });
  }
  return { ok: true, value: out };
}

/**
 * @param {readonly import('./types.js').Rule[]} rules
 * @param {readonly FleetProject[]} projects
 * @param {(project: FleetProject) => import('./types.js').Context} makeContext
 */
export async function runFleet(rules, projects, makeContext) {
  /** @type {{ name: string; results: import('./types.js').RuleResult[] }[]} */
  const out = [];
  for (const project of projects) {
    const selected = selectRules(rules, project.config);
    out.push({ name: project.name, results: await runRules(selected, project.config.waivers, makeContext(project)) });
  }
  return out;
}
