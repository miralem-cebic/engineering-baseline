import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ECOSYSTEMS, SURFACES, TOPOLOGIES } from '../src/config.js';
import { createMemoryFs, createNodeFs } from '../src/fs.js';
import { loadRegistry, selectRules } from '../src/registry.js';
import { runRules } from '../src/runner.js';

const result = await loadRegistry(createNodeFs(process.cwd()), 'rules/registry');
if (!result.ok) throw new Error(`shipped registry is invalid: ${result.error}`);
const rules = result.value;

describe('shipped registry', () => {
  it('is not empty', () => {
    assert.ok(rules.length > 0);
  });

  it('has rules for every ecosystem', () => {
    for (const ecosystem of ECOSYSTEMS) {
      assert.ok(rules.some((rule) => rule.ecosystems?.includes(ecosystem)), `no rule for ${ecosystem}`);
    }
  });

  it('has rules for every topology', () => {
    for (const topology of TOPOLOGIES) {
      assert.ok(rules.some((rule) => rule.topologies?.includes(topology)), `no rule for ${topology}`);
    }
  });

  it('has rules for every surface', () => {
    for (const surface of SURFACES) {
      assert.ok(rules.some((rule) => rule.surfaces?.includes(surface)), `no rule for ${surface}`);
    }
  });

  it('keeps non-TypeScript ecosystems at proposed until a project proves them', () => {
    const unproven = rules.filter((rule) => rule.ecosystems?.some((e) => ['swift', 'kotlin', 'csharp', 'python'].includes(e)));
    assert.ok(unproven.length > 0);
    assert.ok(unproven.every((rule) => rule.level === 'proposed'));
  });

  it('gives every must rule a way to fix it or a self-explanatory check', () => {
    const musts = rules.filter((rule) => rule.level === 'must');
    assert.ok(musts.length > 0);
    assert.ok(musts.every((rule) => rule.rationale.length >= 20));
  });
});

describe('GEN-014 lock files', () => {
  /** @param {Record<string, string>} files */
  async function gen014(files) {
    const rule = rules.find((r) => r.id === 'GEN-014');
    assert.ok(rule);
    const ctx = {
      fs: createMemoryFs(files),
      eslint: { printConfig: () => Promise.resolve({ ok: /** @type {const} */ (false), error: 'n/a' }) },
      now: new Date('2026-10-28'),
    };
    return (await runRules([rule], [], ctx))[0]?.status;
  }

  it('accepts a NuGet lock file in a nested project', async () => {
    assert.equal(await gen014({ 'src/App/packages.lock.json': '{}' }), 'pass');
  });

  it('still accepts a root lock file and still fails without any', async () => {
    assert.equal(await gen014({ 'package-lock.json': '{}' }), 'pass');
    assert.equal(await gen014({ 'README.md': '' }), 'fail');
  });
});

describe('GEN-021 third-party libraries sit behind an adapter', () => {
  const rule = rules.find((r) => r.id === 'GEN-021');

  it('exists and starts as proposed like every new rule (ADR 0004)', () => {
    assert.ok(rule, 'GEN-021 is missing');
    assert.equal(rule.level, 'proposed');
  });

  it('applies to every ecosystem and topology, because the idea is language-agnostic', () => {
    for (const ecosystem of ECOSYSTEMS) {
      for (const topology of TOPOLOGIES) {
        const selected = selectRules(rules, { ecosystems: [ecosystem], topology });
        assert.ok(selected.some((r) => r.id === 'GEN-021'), `not selected for ${ecosystem} / ${topology}`);
      }
    }
  });

  it('points to a guide that exists', async () => {
    assert.ok(rule);
    const guide = /docs\/[\w-]+\.md/.exec(rule.hint ?? '')?.[0];
    assert.ok(guide, 'the hint names no guide under docs/');
    assert.equal(await createNodeFs(process.cwd()).exists(guide), true, `${guide} does not exist`);
  });
});

describe('HOS rules by surface (ADR 0007)', () => {
  const API_RULES = ['HOS-009', 'HOS-010', 'HOS-011', 'HOS-012'];

  /** @param {{ ecosystems: import('../src/types.js').Ecosystem[]; topology: import('../src/types.js').Topology; surface?: import('../src/types.js').Surface }} profile */
  const hos = (profile) => selectRules(rules, profile).filter((r) => r.id.startsWith('HOS-')).map((r) => r.id);

  it('leaves a hosted project without a surface on exactly the rules it had before', () => {
    const expected = ['HOS-001', 'HOS-002', 'HOS-003', 'HOS-004', 'HOS-005', 'HOS-006', 'HOS-007', 'HOS-008'];
    assert.deepEqual(hos({ ecosystems: ['typescript', 'react', 'postgres'], topology: 'hosted-db' }), expected);
    assert.deepEqual(hos({ ecosystems: ['typescript'], topology: 'hosted-no-db', surface: 'web' }), expected);
  });

  it('swaps the static-host header rules for the API header rules on an api surface', () => {
    assert.deepEqual(hos({ ecosystems: ['csharp'], topology: 'hosted-db', surface: 'api' }), ['HOS-005', 'HOS-008', ...API_RULES]);
  });

  it('starts the API rules as proposed (ADR 0004)', () => {
    for (const id of API_RULES) assert.equal(rules.find((r) => r.id === id)?.level, 'proposed', id);
  });

  /**
   * @param {Record<string, string>} files
   * @returns {Promise<Map<string, string>>} rule id to status
   */
  async function measure(files) {
    const selected = selectRules(rules, { ecosystems: ['csharp', 'typescript'], topology: 'hosted-db', surface: 'api' }).filter((r) =>
      API_RULES.includes(r.id),
    );
    const ctx = {
      fs: createMemoryFs(files),
      eslint: { printConfig: () => Promise.resolve({ ok: /** @type {const} */ (false), error: 'n/a' }) },
      now: new Date('2026-11-12'),
    };
    return new Map((await runRules(selected, [], ctx)).map((r) => [r.rule.id, r.status]));
  }
  /** @param {Map<string, string>} status @param {string} expected */
  const all = (status, expected) => {
    assert.deepEqual([...status], API_RULES.map((id) => [id, expected]));
  };

  const middleware = [
    'internal sealed class SecurityHeadersMiddleware : IFunctionsWorkerMiddleware',
    '{',
    '    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)',
    '    {',
    '        await next(context);',
    '        var headers = context.GetHttpResponseData()?.Headers;',
    '        headers?.Add("Content-Security-Policy", "default-src \'none\'; frame-ancestors \'none\'");',
    '        headers?.Add("X-Content-Type-Options", "nosniff");',
    '        headers?.Add("Cache-Control", "no-store");',
    '        headers?.Add("Strict-Transport-Security", "max-age=31536000; includeSubDomains");',
    '    }',
    '}',
  ].join('\n');

  it('pass when C# middleware sets the headers', async () => {
    all(await measure({ 'src/App.Functions/SecurityHeadersMiddleware.cs': middleware }), 'pass');
  });

  it('pass when the Azure Functions host.json sets them', async () => {
    const hostJson = JSON.stringify({
      version: '2.0',
      extensions: {
        http: {
          hsts: { isEnabled: true, maxAge: '365.00:00:00' },
          customHeaders: {
            'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store',
          },
        },
      },
    }, null, 2);
    all(await measure({ 'src/App.Functions/host.json': hostJson }), 'pass');
  });

  it('pass when a TypeScript handler sets them', async () => {
    const server = [
      "res.setHeader('Content-Security-Policy', \"default-src 'none'; frame-ancestors 'none'\");",
      "res.setHeader('X-Content-Type-Options', 'nosniff');",
      "res.setHeader('Cache-Control', 'no-store');",
      "res.setHeader('Strict-Transport-Security', 'max-age=31536000');",
    ].join('\n');
    all(await measure({ 'api/headers.ts': server }), 'pass');
  });

  it('count helmet for nosniff and HSTS only, because its CSP is a page policy and it sets no Cache-Control', async () => {
    const status = await measure({ 'src/server.ts': "import helmet from 'helmet';\napp.use(helmet());" });
    assert.deepEqual([...status], [['HOS-009', 'fail'], ['HOS-010', 'pass'], ['HOS-011', 'fail'], ['HOS-012', 'pass']]);
  });

  it('fail for an API that sets no headers in code', async () => {
    all(await measure({ 'src/App/Webhook.cs': 'return req.CreateResponse(HttpStatusCode.Accepted);' }), 'fail');
  });

  it('HOS-009 needs frame-ancestors too, because it does not fall back to default-src', async () => {
    assert.ok(middleware.includes("; frame-ancestors 'none'"));
    const status = await measure({ 'src/A.cs': middleware.replace("; frame-ancestors 'none'", '') });
    assert.equal(status.get('HOS-009'), 'fail');
  });

  it('HOS-011 does not count a fetch option as a response header', async () => {
    const status = await measure({ 'src/client.ts': "await fetch(url, { cache: 'no-store' });" });
    assert.equal(status.get('HOS-011'), 'fail');
  });
});
