import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { parseConfig } from './config.js';
import { renderRuleDocs } from './docs.js';
import { parseFleet, runFleet } from './fleet.js';
import { loadRegistry, selectRules } from './registry.js';
import { formatMatrix, formatSummary, formatText } from './report.js';
import { exitCode, runRules } from './runner.js';

const USAGE = `Usage: baseline <command> [options]

  check [--root <dir>] [--strict] [--json]   Check a project against the rules for its baseline.json
  fleet <fleet.json>                         Rules by projects matrix (markdown)
  docs [--out <dir>] [--check]               Generate (or verify) the rule documentation

Exit codes: 0 ok, 1 rule violations, 2 usage or configuration error.`;

const REGISTRY_DIR = 'rules/registry';

/**
 * @typedef {object} CliDeps
 * @property {import('./types.js').Fs} registryFs file system that holds this package (rules/registry)
 * @property {(root: string) => import('./types.js').Fs} createFs
 * @property {(root: string) => import('./types.js').EslintPort} createEslint
 * @property {(path: string) => Promise<string | null>} readFile
 * @property {(path: string, text: string) => Promise<void>} writeFile
 * @property {Date} now
 * @property {(text: string) => void} stdout
 * @property {(text: string) => void} stderr
 */

/**
 * @param {readonly string[]} argv
 * @param {CliDeps} deps
 * @returns {Promise<number>}
 */
export async function main(argv, deps) {
  const [command, ...rest] = argv;
  const fail = (/** @type {string} */ message) => {
    deps.stderr(message);
    return 2;
  };

  let parsed;
  try {
    parsed = parseArgs({
      args: rest,
      allowPositionals: true,
      strict: true,
      options: {
        root: { type: 'string', default: '.' },
        out: { type: 'string', default: 'rules/generated' },
        strict: { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
        check: { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    return fail(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
  }
  const { values, positionals } = parsed;

  if (command !== 'check' && command !== 'fleet' && command !== 'docs') return fail(USAGE);

  const registry = await loadRegistry(deps.registryFs, REGISTRY_DIR);
  if (!registry.ok) return fail(`cannot load the rule registry: ${registry.error}`);

  if (command === 'docs') {
    const files = renderRuleDocs(registry.value);
    if (values.check) {
      /** @type {string[]} */
      const stale = [];
      for (const [name, content] of Object.entries(files)) {
        if ((await deps.readFile(`${values.out}/${name}`)) !== content) stale.push(`${values.out}/${name}`);
      }
      if (stale.length > 0) {
        deps.stderr(`generated docs are out of date (run \`baseline docs\`): ${stale.join(', ')}`);
        return 1;
      }
      deps.stdout('docs are current');
      return 0;
    }
    for (const [name, content] of Object.entries(files)) await deps.writeFile(`${values.out}/${name}`, content);
    deps.stdout(`wrote ${Object.keys(files).length} files to ${values.out}`);
    return 0;
  }

  if (command === 'fleet') {
    const [fleetFile] = positionals;
    if (fleetFile === undefined) return fail(USAGE);
    const text = await deps.readFile(fleetFile);
    if (text === null) return fail(`cannot read ${fleetFile}`);
    const fleet = parseFleet(text);
    if (!fleet.ok) return fail(`${fleetFile}: ${fleet.error}`);
    const base = dirname(fleetFile);
    const results = await runFleet(registry.value, fleet.value, (project) => {
      const root = join(base, project.path);
      return { fs: deps.createFs(root), eslint: deps.createEslint(root), now: deps.now };
    });
    deps.stdout(formatMatrix(results));
    return 0;
  }

  const fs = deps.createFs(values.root);
  const configText = await fs.readText('baseline.json');
  if (configText === null) return fail(`baseline.json not found in ${values.root}; copy templates/baseline.json and set ecosystems and topology`);
  const config = parseConfig(configText);
  if (!config.ok) return fail(`baseline.json: ${config.error}`);

  const selected = selectRules(registry.value, config.value);
  const results = await runRules(selected, config.value.waivers, {
    fs,
    eslint: deps.createEslint(values.root),
    now: deps.now,
  });

  if (values.json) {
    deps.stdout(
      JSON.stringify({
        results: results.map(({ rule, status, details }) => ({ id: rule.id, level: rule.level, status, details })),
        summary: formatSummary(results),
      }),
    );
  } else {
    deps.stdout(formatText(results));
  }
  return exitCode(results, values.strict);
}
