# More shortcut optical glass

**Superseded after visual rejection and scope expansion.** Final requirements
and source status are in [white More handoff](2026-10-04-white-more-black-nav-final.md).

## Approved brief and ownership

Only the ten upper More feature shortcuts become optical glass. Wrap their
existing TouchableOpacity contents in the shared static GlassCard glass
variant. The outer button retains its testID, role, label, callbacks, width
48%, minHeight 112 and bottom margin. Its background becomes transparent,
with no border or padding. Keep padding 14 on the inner content wrapper.

Shortcut glass keeps the existing frost and rim, but overrides shadow
opacity/radius/offset, elevation and boxShadow to zero/none at this callsite.
Use no native blur, assets or new animations. Preserve all four lower flat
groups and existing permissions, switches, dialogs and Update behavior.

Owned files: Settings source, the existing more-flat-cards regression, and
this plan. Main owns device, Metro, build, full gates and other documentation.
No shared primitive changes are authorized without notifying main first.

## Acceptance criteria

- [x] RED on actual Settings: ten shortcut glass wrappers are required; each
  has one static optical decoration and no shadow/halo contribution.
- [x] Outer buttons retain geometry/accessibility and do not duplicate the
  inner padding or border. Decoration remains inert to touch/accessibility.
- [x] All nine route callbacks and the Update action remain intact.
- [x] Four lower groups remain flat, opaque, without optical decoration.
- [x] Existing switch/link/account/confirmation guards stay green.
- [x] Scoped GREEN and ESLint/diff review pass, then freeze for main.
- [x] Native appearance observed in main's post-GREEN physical capture; user can
  review `more-glass-shortcuts-final.png`. No user aesthetic approval is inferred.

## Validation scope

Use the actual Settings and GlassCard components in Jest. Run this owned
test file and lint the owned code only. Save RED/GREEN output to the existing
external mobile-full artifacts directory. Source validation does not prove
physical appearance. No device, Metro, export/build or full checks here.

## Execution evidence and freeze

Plan written before the regression or source edit. RED ran the new glass
case against the old actual Settings: expected ten glass wrappers, received
zero (one failure, four other cases filtered by testNamePattern).
Log: `C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/more-glass-shortcuts-red.log`.

Implementation adds one static GlassCard inside each existing shortcut
button, with padding 14 on content, and removes the outer padding/background
and border. Shadows are overridden only in `styles.shortcutGlass`. Existing
lower flat groups and the shared translation bridge import are preserved.
No shared primitive was edited.

```powershell
pnpm exec jest --runInBand --runTestsByPath __tests__/more-flat-cards.test.tsx
```

Final result: **5 tests passed, zero failed/skipped**, Jest time 8.586 s.
Actual GlassCard rendering pins ten glass / four flat groups, surface
material, shadow suppression, transparent outer geometry, inert decoration,
no BlurView, nine routes, Update popup behavior and settings permissions.
Log: `C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/more-glass-shortcuts-green.log`.

Scoped ESLint with `--max-warnings=0` passed for Settings and the owned test.
Scoped source diff review and `git diff --check` passed. No warnings were
suppressed and no tests were disabled. Source frozen after this GREEN for
main's physical capture. The source worker did not operate the device.

## Main physical and final-gate evidence

Phone45218ba / QA4.2.0(92), JS `metro-more-glass-handoff.log`:
`more-glass-shortcut-native.json` records all nine route entries and the Update
popup opened/dismissed without applying an update. These are navigation entries,
not full functional acceptance for those screens. Main inspected the screenshot
for glass reflections, crisp edges and the retained lower flat groups.

Final source without temporary timing logs: `more-glass-language-final.json`
confirms VI→EN and EN→VI on the glass design; passive screenshots at host elapsed
2.081/1.602s show complete translated More. Restored vi, confirmed complete
Profile rank names, then left the More design visible.

Full source187 suites /2570 tests PASS, type/lint PASS, diff check PASS.
Android export9.13MiB total /7.82MiB Hermes PASS and temporary output removed.
Overall check remains FAIL solely at existing braces audit1240992; statement
coverage73.88% remains below80%. No native release, production delivery or FPS claim.
