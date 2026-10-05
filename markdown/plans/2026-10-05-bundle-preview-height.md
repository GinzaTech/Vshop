# Taller Bundle preview

User explicitly clarified vertical enlargement, not horizontal enlargement.
Increase banner height50% at unchanged full card width: aspect ratio4.8 becomes
3.2. Keep displayIcon2 preference, cached image/fallback, title/price/ending time
below the image and initially collapsed details with existing disclosure owner.

Before phone screenshot: external vshop-test-20261005-followup/bundle-before-taller.png.

- [x] Actual rendered hero geometry tests fail before source edit; missing-image
  reserved-space expectations updated in the full scoped run.
- [x] Change ratio only; preserve carousel dimensions and disclosure motion.
- [x] Scoped tests and independent source review.
- [x] Final full source/export checks executed after source freeze; existing
  audit failure remains reported below.
- [x] Main Expo reload and native banner/detail screenshots.

External vshop-test-20261005-followup/: bundle-height-red.log6 behavior failures
before implementation; latest-scoped-green.log134/134 tests in8 suites PASS.
Native bundles-after.png/XML show the taller full-width Champions/Warden art,
ending time below and closed items. bundle-open.png and interactions.json verify
open/close/reopen with the taller banner. No purchase or account mutation.

Final source snapshot includes the latest Profile width correction:
TypeScript/lint PASS,212suites/2936tests PASS,109.065s; overallcheck FAIL at
existing braces1240992. Coverage75.51% below80%. Separate Android export and
diffcheck PASS; output removed. See check-third-final.log/export-third-final.log.
