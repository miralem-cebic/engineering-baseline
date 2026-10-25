import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGithubPort, normalizeSettings } from '../src/github.js';

const repoResponse = {
  default_branch: 'main',
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  delete_branch_on_merge: true,
  security_and_analysis: {
    secret_scanning: { status: 'enabled' },
    secret_scanning_push_protection: { status: 'disabled' },
  },
};
const protectionResponse = {
  required_status_checks: { strict: true, contexts: ['verify'], checks: [{ context: 'verify' }, { context: 'pr-title' }] },
  required_pull_request_reviews: { required_approving_review_count: 1 },
  enforce_admins: { enabled: true },
  allow_force_pushes: { enabled: false },
  allow_deletions: { enabled: false },
};

describe('normalizeSettings', () => {
  it('flattens the API answers into stable, checkable keys', () => {
    const settings = normalizeSettings({
      repo: repoResponse,
      protection: protectionResponse,
      vulnerabilityAlerts: true,
      workflowPermissions: { default_workflow_permissions: 'read' },
    });
    assert.deepEqual(settings, {
      defaultBranch: 'main',
      allowSquashMerge: true,
      allowMergeCommit: false,
      allowRebaseMerge: false,
      deleteBranchOnMerge: true,
      secretScanning: true,
      pushProtection: false,
      vulnerabilityAlerts: true,
      workflowPermissions: 'read',
      branchProtection: {
        enabled: true,
        requiredChecks: ['pr-title', 'verify'],
        pullRequestRequired: true,
        requiredReviews: 1,
        upToDate: true,
        enforceAdmins: true,
        allowForcePushes: false,
        allowDeletions: false,
      },
    });
  });

  it('reports an unprotected branch as disabled with safe defaults', () => {
    const settings = normalizeSettings({ repo: repoResponse, protection: null, vulnerabilityAlerts: false, workflowPermissions: {} });
    assert.deepEqual(settings['branchProtection'], {
      enabled: false,
      requiredChecks: [],
      pullRequestRequired: false,
      requiredReviews: 0,
      upToDate: false,
      enforceAdmins: false,
      allowForcePushes: true,
      allowDeletions: true,
    });
    assert.equal(settings['workflowPermissions'], 'unknown');
  });
});

/**
 * @param {Record<string, { status: number; body?: unknown }>} routes
 * @returns {{ fetch: typeof globalThis.fetch; calls: { url: string; auth: string | null }[] }}
 */
function fakeFetch(routes) {
  /** @type {{ url: string; auth: string | null }[]} */
  const calls = [];
  /** @type {typeof globalThis.fetch} */
  const fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers);
    calls.push({ url, auth: headers.get('authorization') });
    const route = routes[new URL(url).pathname];
    if (route === undefined) return Promise.resolve(new Response('{}', { status: 404 }));
    return Promise.resolve(new Response(route.body === undefined ? null : JSON.stringify(route.body), { status: route.status }));
  };
  return { fetch, calls };
}

describe('createGithubPort', () => {
  const full = {
    '/repos/o/r': { status: 200, body: repoResponse },
    '/repos/o/r/branches/main/protection': { status: 200, body: protectionResponse },
    '/repos/o/r/vulnerability-alerts': { status: 204 },
    '/repos/o/r/actions/permissions/workflow': { status: 200, body: { default_workflow_permissions: 'read' } },
  };

  it('reads all four endpoints with the token and returns normalized settings', async () => {
    const { fetch, calls } = fakeFetch(full);
    const result = await createGithubPort({ repo: 'o/r', token: 't0k', fetch }).getSettings();
    assert.equal(result.ok, true);
    assert.equal(result.value['allowSquashMerge'], true);
    assert.equal(result.value['vulnerabilityAlerts'], true);
    assert.ok(calls.every((call) => call.auth === 'Bearer t0k'));
    assert.ok(calls.every((call) => call.url.startsWith('https://api.github.com/')));
  });

  it('treats 404 on protection and vulnerability alerts as "off", not as an error', async () => {
    const { fetch } = fakeFetch({ ...full, '/repos/o/r/branches/main/protection': { status: 404 }, '/repos/o/r/vulnerability-alerts': { status: 404 } });
    const result = await createGithubPort({ repo: 'o/r', token: 't', fetch }).getSettings();
    assert.equal(result.ok, true);
    assert.equal(result.value['vulnerabilityAlerts'], false);
  });

  it('fails without a token, without calling the network', async () => {
    const { fetch, calls } = fakeFetch(full);
    const result = await createGithubPort({ repo: 'o/r', token: undefined, fetch }).getSettings();
    assert.equal(result.ok, false);
    assert.match(result.error, /token/i);
    assert.equal(calls.length, 0);
  });

  it('explains an authorization failure and never echoes the token', async () => {
    const { fetch } = fakeFetch({ '/repos/o/r': { status: 401 } });
    const result = await createGithubPort({ repo: 'o/r', token: 'secret-value', fetch }).getSettings();
    assert.equal(result.ok, false);
    assert.match(result.error, /401/);
    assert.doesNotMatch(result.error, /secret-value/);
  });

  it('turns a network failure into an error value', async () => {
    /** @type {typeof globalThis.fetch} */
    const fetch = () => Promise.reject(new Error('offline'));
    const result = await createGithubPort({ repo: 'o/r', token: 't', fetch }).getSettings();
    assert.equal(result.ok, false);
    assert.match(result.error, /offline/);
  });
});
