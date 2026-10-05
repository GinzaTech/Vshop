# Startup logo as the application icon

Date: 2026-10-04. Scope: launcher branding requested by the user.

## Brief

Use the exact sculpted graphite cart already approved for the startup screen.
Reuse its original high-resolution ImageGen source; no new drawing, lettering
or styling. Match the pale startup background. Prepare an opaque 1024px icon
and a transparent 1024px Android foreground with the mark inside its safe zone.
The startup image remains the existing lightweight 256px derivative.

## Implementation and evidence

- [x] Add a failing configuration regression for the new generated icon paths
  and startup-matching adaptive background before changing app.json.
- [x] Prepare deterministic launcher derivatives using installed Expo asset
  utilities, record source hashes and conversion parameters under
  assets/generated/production/startup/, and inspect them at launcher size.
- [x] Point Expo common icon and Android adaptive foreground at the new assets.
  Keep notification artwork independent because Android notifications require
  a monochrome silhouette.
- [x] Run scoped configuration/startup tests, pnpm run check, Android export,
  asset dimension/alpha/safe-zone verification and diff checks. Record failures
  honestly, including pre-existing production audit findings.
- [x] Review the bounded change; update README and CHANGELOG.
- [ ] Native launcher screenshot: pending a freshly built native application.
  Source configuration and JS export do not replace an installed launcher icon.

## Ownership

app.json; __tests__/launcher-icon-config.test.ts; generated launcher PNGs and
their provenance; this plan; branding notes in README/CHANGELOG. Preserve all
unrelated worktree changes. This task does not publish a native release.

## Recorded evidence

External logs: `C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/`.

- `launcher-icon-red.log`: valid old-config behavior,3FAIL/1PASS before app.json
  changed (old icon, old adaptive foreground and old background).
- `launcher-icon-green.log`:3suites/22testsPASS, including PNG headers,
  decoded pixels, safe circle/padding and default/QA resolution.
- `launcher-icon-resources.log`: installed Expo icon plugin generated legacy,
  round and adaptive foreground resources at all five Android densities, plus
  the universal iOS1024px icon, in an isolated external fixture. Not an APK build.
- `launcher-icon-android-export.log`:PASS; total10.68/12MiB, Hermes7.88/8MiB,
  largest asset1.49/1.5MiB; the unique workspace export directory was removed.
- `launcher-icon-full-check.log`: final TypeScript and zero-warning ESLintPASS;
  204suites/2,834testsPASS in55.284s. Full checkFAIL at the existing production
  audit advisory1240992 (`braces`); the audit rule was not relaxed. Android
  export was run independently because the audit interrupts the aggregate check.
- `launcher-icon-diff-check.log`:PASS. Repeat icon preparation reproduced both
  exact asset hashes. `launcher-icon-expo-config.json` resolves the new paths.
- Independent bounded review: no outstanding issue after decoded PNG and QA
  config regression coverage was added. Final source test typing was corrected
  before the final full-check run.
- Startup256px source SHA-256 still
  `792F8907A439E02C300E79A5AC1B911676C5DFFB96F765832CB28AA5FCAF54D2`.
- Native installed launcher: **NOT VERIFIED**, pending a freshly built native
  application and physical screenshot.
