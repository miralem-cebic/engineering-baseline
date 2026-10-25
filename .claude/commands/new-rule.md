---
description: Propose a new baseline rule
argument-hint: <rule idea>
---

Add a rule for: $ARGUMENTS

1. Pick the registry file by id prefix and the next free number.
2. Write the test first (a registry or checks test that fails without the rule), then the entry.
3. Fill id, title, rationale (why, not what), level `proposed`, since, scope and at least one check; add a hint.
4. Run `npm run docs` and `npm run verify`.
5. Run `node bin/baseline.js fleet fleet.local.json` and put the matrix rows in the PR description.
