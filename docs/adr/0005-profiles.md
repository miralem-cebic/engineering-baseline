# 5. A profile is ecosystems times topology

Date: 2026-10-25 · Status: accepted

## Context

A file:// app, a hosted static site and a multi-tenant SaaS with a database need different rules. So do
TypeScript, Swift and Python projects.

## Decision

A project declares `ecosystems` (typescript, react, postgres, swift, kotlin, csharp, python) and one
`topology` (`local-only`, `hosted-no-db`, `hosted-db`) in `baseline.json`. A rule without scope applies
everywhere; a scoped rule applies when any listed ecosystem matches and the topology matches. New ecosystems
and topologies are added by extending the registry, not the engine.

## Consequences

The general layer stays small, specific rules stay precise, and a new language is a new registry file.
