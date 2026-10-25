# Working with Claude Code

How agents get the rules, and how their work is held to the same bar as everyone's.

## What goes where

| Mechanism | Use it for | Check |
|---|---|---|
| `CLAUDE.md` | Commands, hard invariants, definition of done, layout. Short. | `AI-001`..`AI-006` |
| `@docs/...` imports in `CLAUDE.md` | Long reference material, loaded when needed | `AI-002` keeps the main file short |
| `.claude/commands/*.md` | Repeated workflows: `/tdd`, `/verify`, `/add-adr`, `/new-rule` | `AI-008` |
| `.claude/settings.json` | Shared permissions (allow `npm run *`, deny reading `.env*`) and hooks | `AI-007` |
| CI | The same gates for agents and humans; the agent cannot skip them | `GEN-002`, `TS-010` |

## Habits that matter

1. Say test-first in `CLAUDE.md` and give the commands; an agent that cannot run the gates cannot honestly say it is done.
2. Plan first for anything that touches tenancy, auth, migrations or shared types; implement after the plan is agreed.
3. One task per session or branch. Commit small; Conventional Commits; squash merge.
4. Read the failing output. "Tests pass" is a claim until the output was looked at.
5. Keep the instruction file under 250 lines. Move detail to `docs/` and import it.
6. Promote repeated corrections into `CLAUDE.md` or a command, not into the next prompt.
7. Review diffs of agent work like any other; `CODEOWNERS` still applies.

## Starting a new project

1. Copy `templates/` into the new repository (including `.claude/`).
2. Edit `baseline.json`: ecosystems and topology.
3. Run `npx github:miralem-cebic/engineering-baseline check` and work through the failures, most severe first.
4. Add the `conformance.yml` call to CI so the project stays on the baseline.
