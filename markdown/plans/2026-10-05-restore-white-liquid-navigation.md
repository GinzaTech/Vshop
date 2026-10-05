# Restore white Liquid Glass navigation

User reports the navigation lost Liquid Glass after the opaque-white change.
Restore the existing native page-only blur, real refraction lens and moving
selection/glyphs with a white translucent tint; keep gray pages and border/shadow0.
This supersedes the opaque-white material requirement, while preserving its light
appearance and dark readable labels. No new engine or content-card redesign.

Use a transparent capsule behind a light blur/white veil; white opaque fallback
until the page target is ready or on unsupported platforms. Keep a translucent
white selected lens and light native refraction tint. Respect Reduce Transparency
through the existing shared preferences and retire backdrop blur when hidden;
existing refraction handles focus/foreground/Reduce Motion/transparency.
Primary native UI kick, route ownership, intent revision guards and glyphs stay.

- [x] Capture/observe current main Expo opaque navbar before code.
- [x] Behavior RED for restoring light blur and non-opaque underlay.
- [x] Native white glass restored; accessibility/fallback/rim guards preserved.
- [x] Scoped native ordering/lifecycle/refraction tests and independent review.
- [x] Full source/export checks attempted; exact audit/coverage status reported.
- [x] Main Expo after screenshots over Profile and scrolled More + primary replay.

Evidence is external at C:/Users/kona/.codex/artifacts/vshop-white-glass-20261005/.

backdrop-red.log3 behavior failures/5 preservation passes; auth rapid-retarget
RED1 failure before source edits (initial and frozen logs). scoped-green.log:
120/120 tests in5 suites,4.164s. Source review approved layering, sharp owners,
shared-preference cleanup/unknown fallback, no new input delay or route remount.
check.log: TypeScript/lint PASS,212suites/2939tests PASS,61.606s; overallcheck
FAIL at existing braces1240992. Coverage75.51% statements below80%.
export.log PASS9.17/12MiB total,7.86/8MiB Hermes,0.92/1.5MiB largest; temp removed.
Diffcheck PASS.

Main Expo on45218ba: profile-after/final-after and more-top/scroll-after PNG/XML
show white glass over gray pages/content. Actual primary-tab-backdrop-blur and
navigation-native-refraction are present in all captured views, not just mocked.
Native replay10 accepted primary selections PASS; More swipe retains owner and
sharp tab controls. No account mutations. gfx-after records765frames/237janky
(30.98%), P9540ms in debug; no causal FPS improvement or60fps claim. The earlier
reset output was a mixed-history sample and is not a matched baseline.
Reduce Transparency/unsupported/hidden behavior is source-tested, not physically
toggled in this window. Still-image/selection proof does not measure first pixels.
