# Approved Bundle and navigation regression repair

Status: implemented after the user's explicit “sửa cả 2 đi” and border/ownership
refinement; source, normal-mode physical checks and reduced-motion collapse have
passed. Reduced tab selection is verified across guarded segments, not one
uninterrupted suite. Broad glass/performance completion is not claimed.

## Approved bounded brief

- Bundle information/item background returns to clean white. Remove the
  duplicated artwork blur causing gray haze, retain subtle glass decoration,
  crisp hero/artwork, ownership fade/check, prices, and compact carousel.
- Hold Settings for 500ms to collapse navigation to a circular button at the
  bottom right. Tap it to expand. Holding/releasing must not navigate Settings.
- Preserve expanded glass geometry/material, existing MorphIcon instance,
  five tabs, active route/scroll state, safe area and Reduce Motion.
- Physical phone45218ba only. Preserve unrelated dirty files, especially
  AppViewport.tsx and AppRefreshControl.web.tsx. No account mutation or release.

## Implementation and evidence

1. Bundle worker owns BundleImage and its focused tests. RED: no decorative
   artwork backdrop, white surface, existing owned overlay/check still present.
   Remove only the Bundle artwork backdrop; do not weaken other cards' glass.
2. Main owns FloatingTabBar, motion tokens and navigation tests. Replace the
   incorrect `onLongPress === undefined` assertion. RED: 500ms threshold,
   collapse/expand semantics, no navigation on release/stale callbacks, stable
   active icon identity, hidden tab hit/a11y gates and Reduce Motion.
3. Keep the expanded content mounted at stable measured width. Animate only
   the capsule frame's width and content opacity on the UI thread. The final
   circular button uses the existing54dp bar height; expanded54dp geometry and
   side margin stay unchanged. No onLayout→React update per animation frame.
   Native page-refraction lens is disabled while collapsed. Cancel animation
   on teardown, snap on Reduce Motion; retain collapsed state across secondary
   routes. Existing RN Pressable is retained; no new competing gesture system.
4. Review the integrated change independently. Run focused tests/coverage,
   `pnpm run check` (includes Android export/budget), Python harness tests and
   `git diff --check`. No native rebuild is required for these JS-only repairs.
5. On physical phone, verify white Bundle, ownership marks, short tap vs500ms
   hold, no route switch on release, expand/repeat, all five tabs, reduced motion,
   and visual icon retention. Record screenshots and diagnostic frame metrics
   outside Git. Static mocks and DEV frame counters are not production FPS.

## Scope rulings

- HEAD's old hold threshold was1000ms; current user explicitly requests500ms.
- Existing source/build success did not cover collapse: a newer test explicitly
  required absence of the handler. Correct that expectation rather than claiming
  the previous green suite proved complete navigation behavior.
- Retain the shared artwork-blur primitive for other approved surfaces; Bundle
  alone opts out because the user requires its white background.

## Ledger

- Brief confirmed; no additional design approval needed for this repair.
- Nav RED:500ms/collapse/expand tests failed before implementation. After test
  isolation cleanup, precisely4 expected failures remained. Initial navigation/
  scene/optics run then passed59 tests. Bundle worker observed4 expected RED
  failures and46 focused GREEN tests; BundleImage scoped coverage100%.
- Main nav scoped coverage before final review fixes:100% lines,93.84% branches.
- Physical initial repair run passed short tap,650ms hold, circular bounds
  [902,2222,1043,2363], route preservation and two collapse/expand cycles. White
  Bundle and owned checks were visually inspected in actual screenshots under
  `C:/Users/kona/AppData/Local/Temp/vshop-glass-repair-phone-20260930-2147/`.
  Input650ms validates holding beyond the configured500ms threshold; it is not
  a measured claim of exactly500ms end-to-end response.
- Independent review found two P2 issues: invisible measurement view blocking
  touches, and old callbacks reviving after hidden→visible. Both have observed
  RED regressions, then were fixed with box-none and hide-generation retirement.
  Keep this test/source evidence separate from the final phone rerun.

## User refinement: visible outlines and all Bundle item ownership

The user explicitly adds stronger borders for the Bundle frame/item tiles and
ownership overlays for player cards and the other item types inside Bundle.
Keep the approved white body,500ms collapse and every prior safety gate.

- Use existing `COLORS.BORDER_STRONG` with a shared1.5dp Bundle border token;
  do not reintroduce the blurred artwork/shadow haze. Preserve compact geometry.
- Existing ownership code fetches only SkinLevel/SkinChroma and intentionally
  rejects every accessory. Extend it for Spray,Flex,PlayerCard,PlayerTitle,Buddy
  through existing read-only `ownedItems` GETs and account/session guards.
- Main owns storefront types/parser/contract tests and border UI/tests. Inventory
  worker owns `utils/bundle-ownership.ts`, `hooks/useBundleOwnership.ts` and their
  focused tests. Main reviews integration before a single final full gate.
- Shared interface: optional `itemTypeId?: string` and
  `entitlementItemIds?: readonly string[]` on SkinShopItem/AccessoryShopItem.
  Parser preserves the actual offer type/ID before asset-root remapping; Buddy
  identities also include its metadata level IDs. Old persisted items remain
  compatible; unknown/untyped accessories fail closed until storefront refresh.
- Matcher stays backward compatible:
  `createBundleOwnershipLookup(ownedSkinIds, ownedByType = {})` where the second
  argument is `Readonly<Record<string, readonly string[]>>`. Legacy IDs prove
  only skins. Accessory positives require a supported exact type and matching
  ID in that type's inventory; collisions across types must never match.
- Seed from the same-account profile cache per category where available. Keep
  prior positive evidence for failed categories, reject stale account/token/
  generation completions and mismatched response subjects/types. No real equip,
  purchase or party writes. A read-only refresh will reparse old cached Bundle
  items before visual validation of newly supported ownership badges.
- Failed-first tests: mixed inventory/types/collisions, Buddy root/level mapping,
  partial failures and account retirement, plus border and non-skin overlay UI.
- Main parser/border RED observed3 failures, then54 focused tests passed. Five
  UI accessory ownership cases separately failed before the new matcher existed.
- Final nav rerun after review fixes passed350ms short press,650ms long holds
  twice, right-anchored circular geometry, route preservation, re-expansion and
  all five tabs. It correctly began from the user's collapsed state. Evidence:
  `C:/Users/kona/AppData/Local/Temp/vshop-glass-repair-phone-20260930-nav-rerun`.
  DEV/instrumented frame counters remain diagnostic only, not smoothness proof.
- Ownership worker:90 scoped tests passed,100% statements/functions/lines and
  98.87% branches. Independent integration review found no actionable issue.
  Same-account historical profile cache category seeds remain trusted as before;
  newly fetched Bundle inventory is provenance-validated.
- Full gate exposed a real architecture budget failure (parser358 lines vs350).
  Moved the ownership identity mapping to `services/riot/storefront-ownership.ts`
  without weakening the budget; parser/architecture regression tests then passed.
- Final integrated source gate passed163 suites /2,320 tests, types/lint/audit
  and Android export (10.43 MiB total /7.96 MiB Hermes). Log:
  `C:/Users/kona/AppData/Local/Temp/vshop-bundle-all-items-check-rerun-20260930.log`.
- Runtime validation detected an old dev-session snapshot: accessory badges and
  stronger border were not yet visibly confirmed. Intentionally stopped only
  the verified VShop Metro PID24580 and started a clean `--clear` dev server
  (session13294). This is a controlled fresh-code validation, not a claim that
  an observation timeout meant the server had terminated. No app data cleared.
- Clean Metro is listening on8081 as PID22068 (session13294). The guarded app
  restart was NOT executed: phone focus had moved to Discord. Requested a new
  VShop foreground window and stopped all device input. Existing VShop PID18550
  remains alive; its previous screenshot is not final evidence for new accessory
  badges/borders. No app data or installed APK was removed/replaced in this step.
- Latest completed gate remains163 suites/2,320 tests with zero failures; export
  temporary directory was cleaned, protected file hashes unchanged. Global
  coverage70.64% lines remains below80%; changed ownership code is100% lines.
- Remaining for the latest refinement: cold open VShop against clean Metro,
  pull-to-refresh read-only storefront/inventory, verify real card/accessory
  overlays and border contrast, and record final screenshots. Native normal-mode
  collapse/expand already passed; OS Reduce Motion is unit-covered but its final
  device rerun remains pending. Do not claim the full broad glass goal finished.

## Latest physical proof after explicit user readiness

- User confirmed ready. Cold-opened the existing same-signer dev installation
  against clean Metro (PID22068/session13294). New VShop PID2032 loaded current
  JS; no APK replacement or app data clear. Read-only Bundle refresh re-parsed
  inventory identities and fetched category ownership.
- Real UI labels and screenshots confirm owned Champions knife/Phantom, Dragon
  card, Frag card, Snake card, spray and Buddy have the overlay/check. Warden
  skin/card/spray/Buddy stay unmarked. Border1.5dp is visibly stronger on the
  outer frame and all tiles; white body/price readability are preserved.
- Evidence directory:
  `C:/Users/kona/AppData/Local/Temp/vshop-bundle-all-items-phone-20260930/`:
  `bundle-owned-items.png`, `bundle-accessories.png`, `ownership-ui.json`,
  `accessory-ui.json`, and `navigation/navigation-report.json`.
- Normal-mode final nav run PASS: all5 selections/geometry,350ms short press,
 650ms long holds twice, circular right-aligned frame and unchanged Bundle route
  after expansion. This validates behavior beyond the configured500ms threshold,
  not precise500ms wall-clock input latency. DEV/instrumented jank counters are
  diagnostic only and do not prove production smoothness.
- Reduced-motion attempt used Android's actual RN preference key,
  `transition_animation_scale=0`; it timed out selecting Bundle before collapse
  checks. This is NOT PASS and its cause has not been established. Finally block
  restored original1.0 and a separate read verified1.0. A subsequent focus check
  found Facebook, so no further input was sent. Do not attribute the earlier
  timeout to that later focus change without evidence.
- Full source gate163 suites/2,320 tests and all15 Python guard/input tests pass;
  export10.43 MiB total/7.96 MiB Hermes. Global coverage70.64% lines is still
  below80%; changed ownership code has100% lines and98.87% branches. No release,
  live account mutation, commit or push occurred.

## Continued physical checks (23:00+ Asia/Bangkok)

- A controlled Reduce Motion probe recorded the selected flags before/after
  setting transition scale0. UIAutomator click and120ms short presses correctly
  selected Bundle/Shop. The earlier selection timeout was not reproduced; its
  original cause remains unestablished. Probe/report:
  `C:/Users/kona/AppData/Local/Temp/vshop-reduced-nav-probe-20260930/probe.json`.
- Unchanged full reduced navigation harness then passed350ms short press and two
  650ms collapse/expand cycles with route preservation, plus Bundle/Shop/Profile.
  It stopped at a foreground-readiness guard before the remaining routes;
  retain its `BLOCKED_DEVICE_NOT_READY` overall status. Evidence:
  `.../vshop-bundle-all-items-phone-20260930/reduced-navigation-rerun/`.
- Separate guarded checks completed Night Market and Settings under scale0:
  `C:/Users/kona/AppData/Local/Temp/vshop-reduced-nav-probe-20260930/remaining-tabs.json`.
  Together these prove the individual reduced tab/collapse criteria, not a
  continuous rapid-flow/performance run. Each finally block restored1.0.
- Actual Profile selector rerun passed all4 open/close checks and unchanged
  displayed equipment. All slots share y1779–2061 and widths233/234px at density420,
  exceeding48dp touch targets. No equip action. Report:
  `C:/Users/kona/AppData/Local/Temp/vshop-final-profile-selectors-20260930/profile-selectors-report.json`.
- Local loadout QA did not reach its explicit marker after the app-specific
  deep link. No fixture taps were sent and no live Party controls were touched.
  Read-only checks found no current Metro inspector target; dev launcher showed
  a recent LAN server URL. Local Metro manifest itself reports SDK57,
  host127.0.0.1:8081 and launchAsset dev=true. These observations do not prove a
  product navigation defect or identify the currently loaded JS source.
- [Expo's development workflow](https://docs.expo.dev/develop/development-builds/development-workflows/)
  requires the project to already be open for app-specific deep links. Next
  setup is to explicitly connect the existing dev client to local Metro before
  retrying the QA route. The Connect action was blocked before input because
  phone focus moved to Zalo; requested a short availability window and stopped.
  VShop remains at its dev launcher behind that app; no app data was cleared.

## Physical isolated loadout QA completed

- In a later ready, open project state, the documented warm app link
  `vshop://ui-qa?demo=1` reached `Local QA (no Riot)` and `ui-qa-transport-stats`.
  Both were observed before running inputs. This establishes a working setup;
  it does not prove that slash count alone caused the earlier failed setup.
- Normal physical fixture run PASS,34344ms:
  `C:/Users/kona/AppData/Local/Temp/vshop-physical-local-qa-20260930-final/local-ui-report.json`.
- Reduced physical fixture run PASS,33000ms:
  `C:/Users/kona/AppData/Local/Temp/vshop-physical-local-qa-reduced-20260930-final/local-ui-report.json`.
- Each run verified4 cells on one row, a second picker open while the first
  synthetic save was inFlight, serialized skin/title changes (`maxInFlight=1`,
  accepted serverVersion4 after3 writes), and failed-field rollback preserving
  the other field. Every fake write deliberately waited5000ms; no real Riot
  mutation or PC apply latency was measured or claimed.
- Finally restored transition scale1.0, verified it again, then used the warm
  `vshop://bundles` link to return to real Bundle. Confirmed Bundle selected and
  the QA marker absent. No app data, credentials, production deployment or
  real equipment changed.
- Remaining broad work: font-scale/device accessibility, continuous interrupted
  motion/video fidelity and controlled performance evidence. These outstanding
  requirements are not replaced by the passed scoped regressions.

## Fresh Bundle confirmation (2026-10-01, physical device)

- After a new explicit readiness confirmation, opened the warm `vshop://bundles`
  route on physical device45218ba. Guarded every observation, screenshot and
  horizontal swipe with awake/unlocked/VShop-foreground checks; screenshot bytes
  were only saved after a second foreground check. No account-changing action.
- Fresh screenshots confirm the white content body, stronger frame/tile borders,
  and ownership veil plus green check on Champions knife, Phantom, player cards,
  spray and Buddy. Current prices remain unobscured. Warden item labels remain
  unmarked. Current live Bundles contain no Flex/PlayerTitle: their source-test
  coverage is not replaced by this device run and must not be called live proof.
- Evidence: `C:/Users/kona/AppData/Local/Temp/vshop-bundle-final-20261001-vuzjedpn/`
  contains `owned-skins-and-cards.png`, `owned-cards-spray-buddy.png` and
  `report.json` with scoped visual PASS. Returned the carousel toward its first
  items and left VShop on Bundle. No font/motion preference was changed.
- An earlier observation in this continuation lost app foreground before the
  screenshot, so it was not used as VShop image evidence; no input was sent to
  the other app. Only the subsequent guarded captures above establish this PASS.
- No product source changed in this confirmation. The previous full source gate
  remains163 suites/2,320 tests plus Android export; `git diff --check` passed
  again. Broad accessibility/motion/performance criteria above remain open.

## Large-font device finding (2026-10-01)

- Ran the existing guarded font probe on45218ba at system fontScale1.5, then
  restored original1.0 in `finally` and independently read back1.0. No density,
  resolution, motion setting or account equipment was changed.
- Evidence: `C:/Users/kona/AppData/Local/Temp/vshop-physical-large-font-20261001-120ibc0y/`
  (`bundle-before.png`, `bundle-font-1_5.png`, `profile-font-1_5.png`, report).
- Bundle heading/price safely stack; fully visible tile prices remain readable.
  Four Profile Flex controls stay on one row at y972..1296, widths233/234px at
  density420, exceeding48dp. This is scoped layout proof, not a TalkBack audit.
- Visual review FAIL for navigation: labels are clipped along the bottom on
  Bundle and Profile. `FloatingTabBar` caps font growth at1.3 but fixes the label
  wrapper height to13dp; the active glyph also has a fixed vertical offset.
- Bounded repair proposed for approval: retain54dp shell/50dp lens, the existing
  1.3 font cap, unscaled default geometry and animations; size label wrappers to
  effective font growth and align the base/clone/active glyph consistently.
  The Markdown reference section47 explicitly allows capped scaling, requires
  one-line labels and forbids growing the bar for a long label. No product
  implementation yet; add failed-first scaling/layout tests after approval and
  retest native normal/large text, active glyph alignment and collapse behavior.

## Profile surface and segment investigation (2026-10-01)

- Physical exploration selected `profile-tab-skins`; a fresh UIAutomator2 tree
  confirms selected=true and real equipped skin cards. Artwork, tier, level and
  names are legible before/after a vertical scroll. Dense cards visibly retain
  their lightweight light material; this does not establish full backdrop
  refraction on each card.
- New rendered/semantic divergence: the segmented control's white indicator
  stays on the first (loadout) slot, while loadout/skins labels are not visible.
  Skin content and selected semantics are correct. The screenshot remained
  wrong in a later settled capture and after vertical scrolling; this is not
  dismissed as a single transition frame. Root cause remains under review.
- Evidence: `C:/Users/kona/AppData/Local/Temp/vshop-glass-surfaces-20261001-yftr1lga/`
  (`profile-skins-before.png`, `profile-skins-settled.png/json`,
  `profile-skins-scrolled.png/json`). No card was pressed or equipped.
- Shop/Profile scroll-retention roundtrip did not complete: the foreground guard
  rejected observation, then a separate read showed Zalo. Its
  `roundtrip-report.json` remains INCOMPLETE, not a retention failure or PASS.
  Stopped all further device input; system font scale remains1.0.
- Corrected stale design-system wording that still allowed a duplicated blurred
  Bundle hero, contrary to the user's later white-body repair. No product code
  changed and the pending nav-label repair has not been implemented.
- Independent read-only diagnosis confirms the source has separate indicator
  transform and label-color animated styles reading the same `segmentProgress`.
  React selection is a separate `activeTab`. The observed combination fits
  Skins label colors with a stale Loadout-position pill; a wholly frozen
  progress=0 alone would not explain it. No root cause is proven yet.
- Distinguishing next probe: inspect the native indicator translation/alpha in
  the broken foreground state. Translation0 with Skins colors points toward
  property/update delivery; translation of one slot with correct visibility but
  wrong pixels points toward drawing/compositing (including RefractionTargetView).
  Expected Skins translation is `(containerWidth - 32) / 3 + 8`. Do not bypass
  full backdrop refraction, add speculative state reconciliation or label this
  fixed without that evidence. Existing mocked/source/JVM tests do not cover
  this settled semantic-to-pixel relationship.
- PID2032's inspected warning buffer had no matching Reanimated/worklet/RenderNode
  exception lines. This limited negative log check does not exclude either
  candidate. Review agent finished and was closed; no diagnostic task remains
  running on the phone.
- Next continuation revalidated the boundary:45218ba is connected and awake,
  but Zalo still owns focus. Metro's local `/json/list` answers HTTP200 with `[]`,
  so there is no current inspector target for the proposed read-only native
  property probe. This is not evidence that Metro terminated or that the
  refraction renderer caused the bug; no process was restarted. Further product
  implementation awaits the pending bounded nav-design approval, and runtime
  diagnosis needs a ready VShop foreground/inspector session.

## Native position evidence and controlled roundtrip (2026-10-01)

- Phone later returned to VShop, awake/unlocked. Continued read-only exploration
  without treating automatic goal continuation as approval for the nav-text edit.
- Metro inspector still returned `[]`, but the installed DEBUGGABLE VShop process
  supports Android's [view hierarchy/property dump](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-15.0.0_r5/core/java/android/view/ViewDebug.java).
  The ignored one-shot helper `.codex-tmp/read-native-view-properties.py` sends
  only DDMS VULW and VURT hierarchy-read commands, filters persisted properties,
  and removes its unique forwarding port in `finally`. No heap dump, VM suspend,
  arbitrary method invocation, property write or account action. Existing helper
  forwarding remained intact. An initial `adb jdwp` listing timed out before a
  forwarding port was created; replaced that precondition with exact-package
  DEBUGGABLE verification, not a process restart.
- Evidence: `C:/Users/kona/AppData/Local/Temp/vshop-native-geometry-20261001-qvh64gd_/`
  contains allowlisted `geometry.json`, contemporaneous `screen.png` and a concise
  `interpretation.json`. Segment indicator node id0x663E, identified by subtree
  order/304x100 geometry, is visible with alpha1 and native translationX0 while
  Skin is selected. Expected Skins translation is325px at density420. Control
  nodes show actual nonzero nav lens377.24997px/clone-377.24997px and scale1.065.
- This narrows the next investigation toward progress/transform delivery rather
  than a purely stale-pixel explanation; the exact writer/failure is still NOT
  VERIFIED. No complete animation matrix was captured. Do not infer styled-text
  colors from TextView mCurTextColor alone or declare native capture fault-free.
- A fresh uninterrupted guarded Profile→Shop→Wishlist→All→Profile roundtrip
  passed selection and scroll retention: Stinger stayed `[42,1158][431,1583]` and
  the Skin segment stayed selected. Wishlist truthfully displayed the empty
  state and returned to All. Night Market now contains real offers; its captured
  visible artwork, names, discounts and prices are legible. No item was tapped.
  Evidence: `C:/Users/kona/AppData/Local/Temp/vshop-roundtrip-20261001-qy5q84go/`
  (`report.json` and named screenshots). This supersedes only the incomplete
  roundtrip checkpoint, not the continuing Profile visual failure.
- Shop screenshot additionally saved at
  `C:/Users/kona/AppData/Local/Temp/vshop-glass-surfaces-20261001-yftr1lga/shop-current.png`.
  Profile remained open after the checks. No font or motion setting changed in
  this continuation; no product source was edited. Full glass/motion/a11y and
  the newly found visual regressions are not declared complete.

## Profile reload and recurrence probe (2026-10-01)

- With VShop foreground, opened the existing Expo Tools menu and used Reload
  once. The Tools node is a content-description, not text; an initial text
  lookup failed without input and was corrected from a fresh native hierarchy.
  No app data, APK or Metro process was removed/restarted. Metro session13294
  remains live and returned new Android bundling output; `/json/list` still `[]`.
- After Reload, choosing Skin rendered all three Profile labels and the pill in
  the correct second slot. Evidence:
  `C:/Users/kona/AppData/Local/Temp/vshop-profile-after-reload-20261001-lw9zqvu3/`.
  Independent native snapshot `.../vshop-native-geometry-20261001-ynxtzhgx/`
  measured324.99997px rather than the earlier erroneous0px.
- Re-ran the original guarded font probe (1.0→1.5→1.0) after resetting Profile
  to Loadout. It restored1.0 and the subsequent Skin selection still rendered
  correctly; `.../vshop-native-geometry-20261001-gtp83mli/` measured324.99997px.
  Font evidence: `.../vshop-physical-large-font-20261001-sz9eaxzv/`. The separate
  nav-label clipping at1.5 remains visibly reproducible. Do not attribute the
  earlier Profile failure to font scaling from this non-reproducing cycle.
- A continuous local Profile cycle Loadout→Skin→Collection→Skin passed semantic
  and native indicator positions0/324.99997/649.99994/324.99997px. Screenshots
  confirm readable selected labels in the recovered session. Report:
  `C:/Users/kona/AppData/Local/Temp/vshop-profile-segment-cycle-20261001-_078mff_/report.json`.
- Classification: Profile visual state recovered after Reload and did not recur
  in the above controlled checks; original failure remains recorded and its
  root cause is unknown. This is not a product-code fix or proof of long-session
  immunity. No speculative renderer/state patch was made. Native probe ports
  were closed and existing Artemis forwarding preserved. Nav-text design still
  awaits human approval; overall completion remains unproven.

## Media viewer and Night Market clearance (2026-10-01)

- Opened the observed Vandal Sang Trọng card with one tap, waited past its220ms
  single/double-tap boundary, and confirmed the image viewer and Close control.
  No double-tap/Wishlist modification, media-option selection or account write.
- Physical tap at the background Profile-tab center dismissed only the backdrop;
  Shop remained selected and Profile stayed unselected. Evidence:
  `C:/Users/kona/AppData/Local/Temp/vshop-modal-touch-20261001-xr6je2d4/`.
  Initial report serialization failed on UIAutomator's Exists object; a separate
  guarded read confirmed the post-input state before further inputs. No duplicate
  background tap was sent. Reopened the viewer once and explicitly closed it;
  all five primary tab controls returned and were enabled/clickable.
- Accessibility isolation is NOT VERIFIED: ARTEMIS's simplified hierarchy shows
  only modal content, but both compressed/uncompressed UIAutomator dumps still
  list background tab controls. Touch blocking passes, but does not prove
  TalkBack isolation. The initial all-or-nothing verifier stopped at this
  mismatch; the continued diagnostic records it as unresolved and separately
  executes dismissal/clearance, never upgrades the overall run to a11y PASS.
- Two native property-dump attempts timed out while reading a DDMS response and
  produced no valid property evidence. Both clients exited with their forwarding
  ports removed; the app was not restarted and existing Artemis forwarding was
  retained. Do not infer app/rendering failure from these probe timeouts.
- Scrolled Night Market to the bottom. Last cards Classic Storm Maw and Ares
  Valiant Hero both end at y1891; prices587/1190 end at y1846, above the bar's
  y2222. Their full labels and prices are visible in the captured pixels.
- Evidence: `C:/Users/kona/AppData/Local/Temp/vshop-popup-clearance-20261001-lthf50pu/`
  contains `report.json`, `media-viewer.png`, `night-market-bottom.png`, and
  `profile-after-viewer.png`. Overall status is deliberately
  PARTIAL_DISMISS_AND_CLEARANCE_PASS_A11Y_UNVERIFIED. Profile's selected Skin
  indicator still renders correctly after these modal/navigation interactions.
- Returned to Profile. Font scale remains1.0; no production source change.
  The pending small nav-text design was presented as an explicit async approval
  question; automated continuation is not taken as human approval.

## Approved navigation text repair

The user explicitly answered "Duyệt, sửa và test luôn". Implement only the
already proposed bounded text-layout repair: shared capped font metrics for the
label wrappers and active glyph vertical position, unchanged54dp/50dp shells,
default font geometry, material, MorphIcon instance and500ms collapse contract.
Use failed-first model/render tests, then scoped coverage, independent review,
full check/export and physical normal/1.5/2.0 font checks with restoration.
Do not modify the protected viewport/refresh files or unrelated modal behavior.

### Source completion and requested GitHub publication (2026-10-01)

- The approved font repair is implemented. Failed-first component tests observed
  required17dp vs actual13dp; the helper and rendering tests then passed45/45.
  A read-only independent review found no actionable issue. Native observer
  wrappers were flattened, so the first post-fix probe stopped before visual
  acceptance; the corrected observer matches label geometry to touch slots.
  Phone45218ba then disconnected. ADB diagnosis/self-heal and matching wireless
  service discovery found no available phone. Post-fix large-font pixels remain
  NOT VERIFIED; no emulator or silent waiver substitutes for them.
- User explicitly requested finish/commit/push, then shutdown after completion.
  Main is12 existing task commits ahead of origin/main (OpenCode worker and
  Bundle work). GitHub's only push workflow performs quality/native build checks,
  not production publishing. Existing protected web edits remain unchanged and
  outside the proposed commit unless the user explicitly includes them.
- The new audit feed found12 Axios advisories in1.19.0. Raised manifest floor and
  lockfile to1.20.0, confirmed with official release/advisory metadata. An initial
  pnpm temp-directory failure was followed by a successful install after the
  task-owned Metro was gracefully stopped (session13294 exited0). No audit
  exception was added; the existing four documented transitive advisories remain.
- Pre-publication review found sensitive-data gaps in response diagnostics and
  a disabled-clear defect. Synthetic tests went RED→GREEN for unknown dictionary
  keys/codes, private display text, numeric signing/capability fields, encoded
  private path parents, disabled clearing/in-flight retirement, and sanitized
  explicit clear failure. Approved catalog fields remain usable under the new
  schema policy; older broad-catalog fixtures now use actual public endpoints.
  Six related suites pass107 tests; two actual-Axios mock-adapter/cancellation
  contracts also pass. No live mutation or deletion of historical host captures.
- Fixed ignore rules that hid authored module source/tests: root prebuild/test
  folders are anchored, module build/.gradle outputs remain ignored, and capture,
  APK/AAB and signing-file patterns are excluded. The source-tracking test failed
  first, then passed against Git's actual ignore rules. A bounded scan found no
  high-confidence secret literals or forbidden artifacts in212 outgoing/current
  files plus the12 outgoing commits; this is not an exhaustive security proof.
- Final completed gate after the security fixes:165 suites/2,354 Jest tests,
  strict types, zero-warning lint, audit policy and Android export all PASS.
  Export10.44MiB total,7.97MiB Hermes,1.25MiB largest asset; its unique temporary
  folder was removed. Global lines70.71% remain below80%; navigation model and
  response-field policy are100% statements/branches/functions/lines, FloatingTabBar
  has100% lines/93.69% branches, redactor100% lines/94.44% branches and logger
  99.11% lines/90.83% branches. Log:
  `C:/Users/kona/AppData/Local/Temp/vshop-publish-security-final-check-20261001.log`.
- All15 Python guard/input tests PASS. Native module Gradle test task succeeds
  with unchanged inputs; its4 geometry and5 lifecycle cached JUnit results have
  zero failures/errors. No production release is requested or performed.
