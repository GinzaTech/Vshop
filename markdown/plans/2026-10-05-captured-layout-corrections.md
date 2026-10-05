# Captured layout corrections and opaque white navigation

## User brief and observed evidence

Capture the described screens immediately so the phone can be unplugged, then
fix Night Market artwork width, Profile region and equipment-mode label clipping.
Navbar now has a fully white background; all app pages use a full neutral gray.
Keep previous larger Store2x2, Night2x3, Bundle disclosure, account chooser and
focus-render performance work.

Captured from main com.android.vshop through Expo on45218ba: current, Night,
Profile and More PNG/XML, outside Git in
C:/Users/kona/.codex/artifacts/vshop-ui-capture-20261005/. All screenshots copied
to the PC before informing the user the USB cable could be unplugged.
Night artwork background occupies only part of each card's width. Profile
visibly shows only A for AP and ellipsized Hồ sơ tran… for Hồ sơ trang bị.

## Work

- [x] Capture before PNG/XML and inspect actual pixels.
- [x] Night image frame explicitly fills card width for measured artwork height;
  maintain contain, complete weapon artwork and six-card height budget.
- [x] Profile region allocation fits the entire region; equipment/info toggle
  labels have room to wrap without overlapping the sliding thumb. Keep click,
  mode, Reduce Motion, owner and memo contracts.
- [x] Use existing neutral gray#eceef0 for page background and matching2px
  sampling texture; synchronize source startup background where applicable.
- [x] Opaque white navigation base with readable ink and retained UI-thread
  selection/glyph motion; avoid unused backdrop capture behind opaque paint.
- [x] RED/GREEN scoped regressions, independent review, full-check attempt and
  separate Android export. Overall fullcheck is blocked by the existing audit
  advisory below; this checkbox records execution, not a completely passing gate.

Native after screenshots require a connected device; before captures and source
tests are not after-render proof. No account mutation, release, push or shutdown.

## Source evidence and verification boundary

Night frame width had two behavioral failures before implementation; final
Night scope is75 tests/5 suites PASS. Profile's initial nine fit failures and
its separate one-failure transition-label checkpoint precede their fixes;
final Profile scope is159 tests/16 suites PASS. Theme had two behavioral
failures before implementation; final theme scope is107 tests/5 suites PASS.
Opaque navigation no-blur and transparent opt-in primitive guards also pass
7 tests in navigation-blur. Independent read-only review approved source;
its legacy blur-test mismatch was resolved before the final full-check rerun.

All raw evidence is outside Git under the capture directory above, including
night-frame-width/red.log and green.log, profile-header-text-red-valid.log,
profile-header-transition-red.log, profile-header-scoped-green-final.log,
theme-green.log, navigation-blur-current-green.log and final-check.log.
Android export passed with9.17MiB total,7.86MiB Hermes and0.92MiB largest asset;
its unique temporary directory was removed. See final-export.log.

Final full-check rerun: TypeScript and ESLint max-warnings0 PASS;
212 suites/2936 tests PASS,57.202s. Coverage75.51% statements remains below80%.
Overall pnpm run check FAIL at the existing braces advisory1240992; no
dependency or audit allowlist changes were made in this layout scope.
git diff --check PASS. Native after acceptance remains open.

The four before screenshots and XML files were copied successfully before
telling the user the phone could be unplugged. USB is now disconnected.
Current native after appearance and large-font fit remain NOT VERIFIED;
source assertions do not mark physical acceptance complete. Source splash
background requires a new native build to update the installed native splash.

## Connected Expo follow-up

User requested fresh tests and reconnected45218ba. Full Metro reload made
Profile VP/RP/KC, AP and equipment label visible, and white navigation/gray page
visible on device. Initial reopen had retained the previous JS bundle.
Night actual after still showed a partial-width artwork band despite the
percentage-width source assertion. Replace the residual ratio-dependent frame
with explicit inner-card width and resolved measured/natural artwork height;
keep contain, badges, six-offer budget and preview callbacks. Capture a behavior
RED for that frame contract, then scoped GREEN and repeat native screenshot.

Connected follow-up completed: two additional frame-contract RED failures precede
explicit inner-card width and resolved height. Native after reload shows all six
artwork bands fill card width and complete SELECT/PREMIUM/EXCLUSIVE labels;
weapon-image bounds increased from257px to428px while the card stayed475px wide.
Native Profile shows VP/RP/KC, AP, full name/tag and equipment label. All five
primary screenshots show gray pages and opaque-looking white navigation;
runtime XML contains no primary-tab-backdrop-blur. Normal-font native acceptance
for these captured views is complete; system-font/driver/FPS claims remain separate.
