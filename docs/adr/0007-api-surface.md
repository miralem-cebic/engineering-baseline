# 7. Hosted APIs declare `"surface": "api"`

Date: 2026-11-12 · Status: accepted · Extends [ADR 5](0005-profiles.md)

## Context

`HOS-001` (CSP), `HOS-002` (HSTS), `HOS-003` (nosniff / frame-ancestors) and `HOS-006` (immutable caching) apply to
every hosted project. They read only static-host header files: `netlify.toml`, `_headers`, `vercel.json`,
`staticwebapp.config.json`. A hosted HTTP API without browser content has none of those files. Our example is
jira-ado-sync (Azure Functions webhook receivers, `csharp` / `hosted-db`). Such a project sets its headers in code or
not at all, and its only way out today is a waiver. jira-ado-sync has four, valid until 2027-05-31. A waiver hides the
question instead of checking it. `HOS-006` does not apply to an API at all. `HOS-004` and `HOS-007` pass only because
the file they inspect is missing.

An API also needs different header values from a site. A page needs a CSP that allows its own scripts, and its hashed
assets should be cached for a long time. An API response needs a CSP that allows nothing, and it must not be cached at
all ([OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)).

We considered two options:

1. Add a profile axis `surface` (`web`, `api`). On `api` it replaces the static-host header rules with API header
   rules, which are checked over the source.
2. Keep the profile as it is, and let the HOS checks also accept headers that are set in code (`repo-contains`).

## Decision

Option 1.

- `baseline.json` and fleet entries may declare `"surface": "web"` or `"surface": "api"`. Without the field the
  surface is `web`, so every existing profile selects exactly the rules it selected before.
- A rule may scope `surfaces`. As with ecosystems and topologies, a rule without that scope applies to every surface.
- The rules about browser content are `web`: `HOS-001..004`, `006` and `007` (page CSP, static-host headers, hashed
  assets, the client bundle). `HOS-005` and `HOS-008` stay unscoped.
- `api` gets four new rules. `HOS-009` requires `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`,
  `HOS-010` requires `nosniff`, `HOS-011` requires `Cache-Control: no-store` and `HOS-012` requires HSTS. Each is
  checked with `repo-contains` over the source of any ecosystem and over the Azure Functions `host.json`. They start as
  `proposed` (ADR 4).
- A project that serves pages and an API from one deployment stays `web`. No project in the fleet does that today.
  When one does, `surface` can become a list without breaking existing files.

Why not option 2:

- The engine requires every check of a rule to pass, so "static file or code" needs a new any-of check type. Even then,
  `HOS-006` would still need a waiver on an API, because the rule does not apply there.
- One rule with two possible locations accepts the wrong values. An API would pass `HOS-001` with a page policy.
- It would loosen the `must` rules `HOS-001` and `HOS-004` for every hosted project. A CSP string anywhere in `src`
  would pass a web app whose host never sends that header.

Why not a new topology: a topology says where a project runs and whether it has a database. An API can have a
database or not, so `hosted-api` would need a `hosted-api-db` twin and duplicated DB scoping. The surface is a
separate question.

## Consequences

- An API project drops its HOS waivers by declaring `"surface": "api"`. It is then measured on the headers an API
  should send.
- The checks are static. They find the header values in the code, not on the wire, and the first matching file wins,
  so a test that asserts a header also counts. Only a request against the deployment proves the header is sent.
- A web app that sets its headers in server code instead of a static-host file is still not measured. That needs a
  separate decision (an any-of check) once such a project joins the fleet.
- A project must move to a checker that knows `surface` before it drops its waivers. Older releases ignore the field
  and select the web rules again.
