# From local-first apps to SaaS without a fork

teamtodo and kontor are public, local-first and file-based. The hosted versions should reuse most of that code.
That works if the domain code never learns where its data lives.

## Ports and adapters

| Port (interface in the core) | Local adapter (public repo) | SaaS adapter (private repo) |
|---|---|---|
| `Repository` (all reads and writes, `Result` values) | File System Access API, JSON files | Supabase tables with RLS |
| Identity | single local user | Supabase Auth, tenant and role |
| Numbering (kontor invoices) | local counter | database sequence per tenant, gap-free |
| Attachments | files next to the data | object storage per tenant |
| CSP and headers | `connect-src 'none'` | allow the API origin only |
| Sync and merge | field-level merge with `fieldUpdatedAt` | same merge, executed against the server |

The core exposes one composition root, `createApp({ repository, identity, numbering, attachments })`. The local
build and the SaaS build call it with different adapters.

## Repositories

```
teamtodo (public)  ──publishes──▶  @miralem/teamtodo-core   (domain, UI, ports)
kontor   (public)  ──publishes──▶  @miralem/kontor-core
                                          │ consumed by
teamtodo-cloud (private)  =  core + Supabase adapters + tenant UI
kontor-cloud   (private)  =  core + Supabase adapters + GoBD/DSGVO duties
```

Shared plumbing that both products need (merge engine, `Result`, validation helpers, ports) moves into a small
`local-first-kit` once two products need the same code, and a `saas-kit` (tenant context, RLS test helpers) once
two SaaS products need it. Not earlier: extract on the third use, not the first.

## Rules this implies

- The core has no imports from adapters; a lint rule on import boundaries enforces it.
- Every port has a contract test suite that both adapters must pass (the same idea as `test/fs.test.js` here).
- The SaaS repositories use profile `hosted-db` and so inherit the DB, headers and RLS rules automatically.
- The public repositories keep profile `local-only` and keep `connect-src 'none'`.

## Decisions you still have to make

| Question | Why it matters |
|---|---|
| Licence of the public repos (MIT vs AGPL) | MIT lets anyone host a competing SaaS from your code; AGPL does not |
| Contributor terms (DCO or CLA) | You cannot relicense or ship contributions in a private SaaS without them |
| kontor as SaaS | Gap-free invoice numbers, GoBD retention, DSGVO processing agreements and server-side audit trail are legal duties, not features |
| Start with teamtodo | Lower legal risk; use it to prove the port and package split before touching kontor |
