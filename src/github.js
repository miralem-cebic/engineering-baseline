import { isRecord } from './guards.js';

const API = 'https://api.github.com';

/** @param {unknown} value */
const enabled = (value) => isRecord(value) && value['enabled'] === true;

/** @param {unknown} value */
const statusOn = (value) => isRecord(value) && value['status'] === 'enabled';

/**
 * Flattens the GitHub REST answers into the stable keys the repo-setting checks use, so rules do not
 * depend on the API's nesting.
 * @param {{ repo: unknown; protection: unknown; vulnerabilityAlerts: boolean; workflowPermissions: unknown }} raw
 * @returns {Record<string, unknown>}
 */
export function normalizeSettings({ repo, protection, vulnerabilityAlerts, workflowPermissions }) {
  const r = isRecord(repo) ? repo : {};
  const analysis = isRecord(r['security_and_analysis']) ? r['security_and_analysis'] : {};
  const p = isRecord(protection) ? protection : null;

  const statusChecks = p !== null && isRecord(p['required_status_checks']) ? p['required_status_checks'] : null;
  const names = new Set();
  if (statusChecks !== null) {
    if (Array.isArray(statusChecks['contexts'])) {
      for (const name of statusChecks['contexts']) if (typeof name === 'string') names.add(name);
    }
    if (Array.isArray(statusChecks['checks'])) {
      for (const entry of statusChecks['checks']) {
        if (isRecord(entry) && typeof entry['context'] === 'string') names.add(entry['context']);
      }
    }
  }
  const reviews = p !== null && isRecord(p['required_pull_request_reviews']) ? p['required_pull_request_reviews'] : null;
  const approvals = reviews?.['required_approving_review_count'];
  const permissions = isRecord(workflowPermissions) ? workflowPermissions['default_workflow_permissions'] : undefined;

  return {
    defaultBranch: typeof r['default_branch'] === 'string' ? r['default_branch'] : 'main',
    allowSquashMerge: r['allow_squash_merge'] === true,
    allowMergeCommit: r['allow_merge_commit'] === true,
    allowRebaseMerge: r['allow_rebase_merge'] === true,
    deleteBranchOnMerge: r['delete_branch_on_merge'] === true,
    secretScanning: statusOn(analysis['secret_scanning']),
    pushProtection: statusOn(analysis['secret_scanning_push_protection']),
    vulnerabilityAlerts,
    workflowPermissions: typeof permissions === 'string' ? permissions : 'unknown',
    branchProtection: {
      enabled: p !== null,
      requiredChecks: [...names].map(String).toSorted(),
      pullRequestRequired: reviews !== null,
      requiredReviews: typeof approvals === 'number' ? approvals : 0,
      upToDate: statusChecks?.['strict'] === true,
      enforceAdmins: p !== null && enabled(p['enforce_admins']),
      // Unprotected means anything goes.
      allowForcePushes: p === null ? true : enabled(p['allow_force_pushes']),
      allowDeletions: p === null ? true : enabled(p['allow_deletions']),
    },
  };
}

/** @param {string} text @returns {unknown} */
function parseBody(text) {
  if (text === '') return null;
  try {
    return /** @type {unknown} */ (JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * Reads live repository settings through the GitHub REST API. The token comes from the caller and is only
 * ever sent to api.github.com; it never appears in an error message.
 * @param {{ repo: string; token: string | undefined; fetch: typeof globalThis.fetch }} options
 * @returns {import('./types.js').GithubPort}
 */
export function createGithubPort({ repo, token, fetch }) {
  /**
   * @param {string} path
   * @returns {Promise<{ status: number; body: unknown }>}
   */
  async function get(path) {
    const response = await fetch(`${API}/repos/${repo}${path}`, {
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'engineering-baseline',
      },
    });
    return { status: response.status, body: parseBody(await response.text()) };
  }

  return {
    getSettings: async () => {
      if (token === undefined || token === '') return { ok: false, error: 'no token (set GITHUB_TOKEN)' };
      try {
        const main = await get('');
        if (main.status !== 200) {
          const hint = main.status === 401 || main.status === 403 ? ' (token missing rights?)' : main.status === 404 ? ' (repo not found or no access)' : '';
          return { ok: false, error: `GitHub answered ${main.status} for the repository${hint}` };
        }
        const branch = isRecord(main.body) && typeof main.body['default_branch'] === 'string' ? main.body['default_branch'] : 'main';
        const [protection, alerts, permissions] = await Promise.all([
          get(`/branches/${encodeURIComponent(branch)}/protection`),
          get('/vulnerability-alerts'),
          get('/actions/permissions/workflow'),
        ]);
        if (protection.status !== 200 && protection.status !== 404) {
          return { ok: false, error: `GitHub answered ${protection.status} for branch protection` };
        }
        return {
          ok: true,
          value: normalizeSettings({
            repo: main.body,
            protection: protection.status === 200 ? protection.body : null,
            vulnerabilityAlerts: alerts.status === 204,
            workflowPermissions: permissions.status === 200 ? permissions.body : null,
          }),
        };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}
