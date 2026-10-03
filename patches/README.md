# Dependency patches

`braces@3.0.3.patch` mitigates
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
which has no patched upstream release as of 2026-10-03. It bounds combined
brace/parenthesis nesting, recursive AST walkers, and expansion parent walks.
The fixed AST depth limit is 128 and cannot be disabled through options.
Ordinary alternatives, ranges, escaping, quotes and bracket syntax retain
their behavior. This patch addresses stack exhaustion; it does not claim to
bound every possible expansion-related resource cost.

pnpm applies the patch to every `braces@3.0.3` consumer using
`patchedDependencies` in `pnpm-workspace.yaml`; the lockfile pins its hash.
The registry continues to report the original version. `audit-production.mjs`
accepts only this advisory after `scripts/lib/braces-security.cjs` verifies the
five reviewed file hashes along every reported dependency path. Missing,
altered, differently versioned, or unresolved copies still fail audit, as do
unrelated advisories. Regression tests are in `__tests__/braces-security.test.js`.

When upstream publishes a fixed version, replace this patch with that version,
remove the advisory-specific verification, and rerun `pnpm run check` and
`pnpm dlx expo-doctor@1.20.3`.
