# More-linked content card and press quality — Implementation Plan

**Trạng thái:** active — SOURCE COMPLETE/FROZEN; physical verification deferred to tomorrow by user.

**Mục tiêu:** Remove outer edge halos and whole-content press fade/blink from affected content cards in equip, accessories, gallery, agent, combat, history, crosshair, leaderboard and friends, while preserving real actions, current data and accessibility.

**Phạm vi:** The nine linked-page content callsites, their focused UI/card/touch components, and scoped regression tests. Shared content wrappers may be added/changed only where the affected callsites require them.

**Ngoài phạm vi:** Main's Settings/14-card real-glass More engine, white More backdrop/source images, black liquid-glass Navbar, backend/domain/private APIs, Profile changes, device/ADB/Metro/build/full gate and shutdown orchestration. Default glass and CachedImage transition are not changed globally.

**Nguồn chuẩn:** Latest user report: inner content edges halo and whole cards blink/fade on press. User explicitly requests opaque/sharp content with inset border/background feedback, contextual flat/zero-shadow material, complete code work/checks today and physical verification tomorrow.

## Acceptance criteria

- [x] Each of the nine routes has an audit matrix with actual affected source callsites or a recorded no-change reason.
- [x] Affected repeated content cards use existing contextual flat material and no outer shadow, without changing main's glass/Nav defaults.
- [x] Press feedback preserves media/text opacity, identity and stable layout; feedback is confined to an inset border/background.
- [x] Tap/long-press/navigation, disabled/loading state and accessibility roles/labels remain valid in source/host tests; no account permission or mutation semantics change.
- [x] Explicit catalog image transition replay is disabled only at equip/accessory/gallery callsites; no global CachedImage change.
- [x] Scoped failing regression -> minimal source fix -> scoped GREEN evidence and lint/diff checks.
- [ ] Physical screenshots/interactions are pending tomorrow; source tests do not substitute for native paint proof.

## Initial ownership / route audit

| Route | Source entry | Initial responsibility |
|---|---|---|
| equip | app/(authenticated)/equip.tsx | inspect item/card wrappers and press |
| accessories | app/(authenticated)/accessories.tsx | inspect accessory item/media wrappers |
| gallery | app/(authenticated)/gallery.tsx | inspect gallery cards/media wrappers |
| agent | app/(authenticated)/agent.tsx | inspect grid/detail press |
| combat | features/party/PartyScreen.tsx and app/(authenticated)/combat.tsx | inspect content controls only, preserve main rail/style changes |
| history | app/(authenticated)/history.tsx | inspect match cards/press |
| crosshair | app/(authenticated)/crosshair.tsx | inspect preview/import controls |
| leaderboard | app/(authenticated)/leaderboard.tsx | inspect row/card press |
| friends | app/(authenticated)/friends.tsx | inspect row/media press, preserve current roster/presence/card logic |

### Concrete audit findings before implementation

| Route | Actual affected callsites | Cause / selected fix |
|---|---|---|
| equip | GalleryEquip.tsx; equip.tsx filter chips | optical card/rim + 140ms image reveal; native TouchableOpacity chip fade. Contextual flat card and zero reveal at this repeated catalog callsite; opaque border-only touch wrapper for chips |
| accessories | ShopAccessoryItem.tsx; accessories empty state | optical card/rim + explicit 120ms reveal; cards are non-interactive (no invented tap). Flat content material / no reveal; empty state flat |
| gallery | SkinShowcaseCard gallery variant; gallery.tsx chips | whole-card 0.97 scale and decoration, explicit 120ms reveal; contextual gallery-only flat and inset/outline feedback, other Store/Bundle variants unchanged |
| agent | GalleryAgent.tsx grid/ability touch; agent.tsx filters | optical card/rim and activeOpacity=.85; flat grid and opaque native touch with border-only feedback |
| combat | PartyScreen/PartyMemberCard/party.styles; PartyChatPanel touch buttons | existing main content already flat, no wholesale material/style change; chat utility TouchableOpacity .75 fade can use contextual opaque wrapper, no network/permission edits |
| history | matches/MatchCard.tsx | whole-media 0.97 scale resamples images/text; keep existing opaque material and use border/background press feedback instead |
| crosshair | crosshair.tsx card/chips | default glass surface and .85/default whole-content fade; variant flat and opaque native touch |
| leaderboard | leaderboard.tsx season/clear controls and empty card | native default TouchableOpacity fade; player rows already non-interactive/opaque. Contextual opaque controls / flat empty card |
| friends | friends.tsx friendRowPressed/empty card | explicit whole-row opacity=.72; background/border feedback and flat empty state, roster/presence policy unchanged |

**Shared wrapper ownership notice:** add components/ui/ContentCardTouchable.tsx only for these content callsites, retaining the native TouchableOpacity/event/ref interface with activeOpacity=1 and a separate inset border feedback layer. Do not change the shared Nav PressFeedback, default GlassCard or CachedImage module.

## Task sequence

- [x] Audit existing dirty source, actual card/touch callsites and image-key/transition behavior; update the matrix before modifying a callsite.
- [x] Write focused RED tests for opaque content during pressed state, flat no-shadow material, preserved actions/disabled/a11y and stable media identity.
- [x] Apply the minimum contextual source fix, reusing design tokens/primitives and keeping main-owned defaults unchanged.
- [x] Run scoped Jest, scoped ESLint and scoped git diff --check; save logs externally under C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/.
- [x] Self-review changes and freeze source for main's integration/code checks. Independent read-only review requested; no noncritical style churn during freeze.

## Scoped source evidence

- Material RED: `more-inner-material-red.log` — 8 failed / 15 passed, pinning equipment/accessory/agent optical layers and Gallery press shrink.
- History RED: `more-inner-history-press-red.log` — actual whole-card spring 0.97 requested on press.
- Retired-press RED: `content-press-retire-red.log` — interrupted press-out lost callback result/held feedback lifetime.
- Final GREEN: `more-inner-card-green.log` — **8 suites / 90 tests passed**. Includes wrapper feedback/disabled/long-press, catalog material/art/price/preview, history action/geometry, shared default glass, friends cards, agent modal accessibility, accessories countdown, leaderboard lifecycle.
- Scoped lint PASS: `more-inner-card-lint.log`; scoped diff check PASS.
- Main owns full integration/typecheck/Jest/export and shutdown. This slice did not run those or native/device commands. Native paint, tomorrow's interactions and frame metrics remain unverified.

## Final owned file set

Source:

- `components/ui/ContentCardTouchable.tsx` — new content-context wrapper; main may reuse it in Settings without altering Nav.
- `components/GalleryEquip.tsx`, `components/ShopAccessoryItem.tsx`, `components/GalleryAgent.tsx` — flat repeated content; targeted explicit image reveal removed for equip/accessories.
- `components/SkinShowcaseCard.tsx` — Gallery variant only: flat, no whole-card shrink, stable art, border feedback and zero reveal. Store/Bundle behavior remains unchanged.
- `components/matches/MatchCard.tsx` — remove whole-card scale, use opaque background press feedback; same match action/accessibility/content.
- `app/(authenticated)/equip.tsx`, `gallery.tsx`, `agent.tsx`, `crosshair.tsx`, `leaderboard.tsx` — contextual opaque touch controls; flat chip/card/empty surfaces where affected.
- `app/(authenticated)/accessories.tsx`, `friends.tsx` — flat empty state; Friends row feedback background replaces opacity, data/session/presence logic untouched.
- `features/party/PartyChatPanel.tsx` — only native touch import points to content wrapper; existing send/join/permissions handlers unchanged.

Tests:

- `__tests__/content-card-touchable.test.tsx` — new 6-case interaction/refinement suite.
- `__tests__/more-inner-history-press.test.tsx` — new history media/action regression.
- `__tests__/glass-shop-gallery-cards.test.tsx` — context-correct material/press assertions; unchanged Store/Bundle/Night data contracts retained.

No edits to main's Settings/More engine/background imagery/Nav, Party rail styles/sizing, backend/domain/private APIs, global CachedImage or default GlassCard/PressFeedback. InfoPill/Combat cards/history helper surfaces were already opaque and were not needlessly restyled. Loading skeleton shimmer is a loading-state effect, not a pressed-card fade, and remains unchanged.

## Evidence and completion

Main owns automatic final integration checks and the final PC shutdown after all source owners finish. Known production audit braces failure is recorded by main separately. No shutdown is performed by this slice while other owners are still working. Native testing is intentionally deferred and this plan remains active until tomorrow's physical acceptance evidence is available.
