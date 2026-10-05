# Unified More-standard glass and compact item cards

## Accepted user brief

**Superseded in presentation after physical review:** see
2026-10-04-restore-original-pages.md. User retains compact card dimensions but
returns Profile/Store/Bundle/Night materials to their prior presentation and
removes the decorative wallpaper from every runtime page. Evidence below is
historical for the rejected unified material, not current acceptance.

Apply More's actual patterned-white image-refraction material to all other
Liquid Glass cards, explicitly Bundle, Store, Night Market, Profile and loadout
skin selection. User chose about50% less card area, rather than half both axes;
keep text readable. This supersedes the preceding flat-content design for these
named cards. More remains the visual material reference; navbar geometry and
its black tint remain independent from item-card sizing.

## Shared material architecture

- One bounded viewport Canvas behind sharp native contents per page/modal,
  not one Canvas/BlurView per card. Same original More wallpaper, palette,
  refraction, bevel and magnification. Reuse its cache/resource ownership.
- `components/ui/refractive-glass/` exports RefractiveGlassViewport,
  RefractiveGlassCard, GlassScrollView, GlassFlatList and GlassClip.
- Cards register stable animated refs. UI-thread measurement/scroll signals
  project native card and clip coordinates into the viewport. One shader has a
  fixed32 visible-card budget; native lists remain virtualized. No JS setState
  per scroll frame. Unmeasured/overflow cards have an honest light material
  fallback, not invisible borders.
- Nested horizontal lists and Bundle reveal require measured clip boundaries
  and UI-thread reveal heights. Clip child materials to their parent and scroll
  viewport; prioritize smaller nested card shapes over enclosing summary cards.
- Focus/background/Reduce Transparency disable Canvas. Static material still
  works with Reduce Motion. Keep mounted item/control owners and stale-source/
  callback cleanup. Web uses the same wallpaper and a lightweight glass fallback.
- Shared native visuals reuse the More card surface; retain rarity/selected/
  owned/disabled semantics without whole-card scale or press fading.

## Compact layout targets

- Store/Night: two-column phone grids become three compact columns when width
  and font size permit. Two columns on narrow/large-font screens. Shrink art,
  padding and secondary typography rather than scaling the entire subtree.
- Bundle: compact summary/hero plus initially closed compact item carousel.
  Keep accessible disclosure, slide reveal, actual price/discount/ownership and
  horizontal item position; fit long numbers without ellipsis.
- Profile/loadout: denser native rows/grids and smaller artwork. Skin picker
  targets three columns on normal phones, two with large fonts/narrow width.
  Keep selected skin/chroma, preparatory tasks, save/busy/disabled guards and
  account identity. No equip, purchase or queue actions on the live account.
- Representative normal-font card areas target0.45–0.60 of previous area;
  48dp interactive targets and responsive text may increase area where needed.

## Execution and evidence

1. Typed shared stubs and behavioral RED before core implementation.
2. Independent owned page integration/layout tests and Profile/picker tests.
3. Shared geometry/shader/clip/lifetime tests; same-source caching preserved.
4. Scoped GREEN, review, full pnpm check and Android export after writes freeze.
5. Connected45218ba native material, compact layout, reveal/scroll/press/refresh,
   long text, large font, focus/background and bounded frame measurements.
   Source/export success cannot replace native first-paint or FPS evidence.

Preserve existing worktree changes, existing More/nav fixes, all domain/API
logic and credentials. No production release, commit, push or shutdown.

## Source integration evidence

- Commerce owned routes/leafs110 tests PASS, zero-warning lint/typecheck; actual
  sizing-model area ratios0.45–0.60 at360/390/430dp. Summary96×80 hero and long-
  price stacking; initial closed disclosure, same reveal height/clip, owner and
  scroll retention. Logs unified-commerce-red/green and freeze manifest external.
- Profile/loadout303 tests PASS across32 suites; selected leaf/geometry coverage
  95.54% statements,86.58% branches. Skin row/grid/picker sample areas≈0.50–0.51.
  Five hidden-panel clips are materialOnly to preserve native morph measurement.
  Picker uses app viewport dimensions and stays within900-line budget.
- Core typed stubs preceded behavioral projection RED; geometry/surface contracts
  now cover finite coordinates, clip zero height, all3 rounded masks, bounded32
  visible/256 registered/6 clip depth, focus/preferences, stable native owners,
  cleanup and materialOnly versus actual native clip height. Source cache ownership
  remains qualified; More's original14-shape renderer remains intact.
- CPU CanvasKit compiler accepted the actual shared shader,780 uniform floats,
  13 uniforms. This is shader compilation, not Android driver/first-paint proof.
- Gallery's shared SkinShowcaseCard consumer also gains a viewport and compact
  virtualized list; filters/wishlist/refresh retain their original behavior.
- Portal modal passes the caller-owned masked visibility as routeFocused so no
  focus hook is invoked outside its Navigator context. Normal pages still use
  actual route focus and enabled cannot bypass it.

45218ba was initially connected but dropped before joint native reload. Diagnose
restarted ADB and confirmed no device; user reconnect requested. No native glass,
area, nested scroll or FPS PASS is claimed for this new unified design yet.

## Final automatic gate

Current source: TypeScript/lint zero warnings PASS;203 suites/2824 tests PASS
(49.502s), coverage74.66% statements remains below80%. Overallcheck stops at
the existing unallowlisted braces advisory1240992. Independent Android export
PASS: total10.68/12MiB, Hermes7.88/8MiB, largest1.49/1.5MiB; temporary output
removed. Diff check PASS. Four prior integration failures were structural test
boundary mocks and a direct viewport import; corrected without changing their
callback/route assertions or lowering guards. Modal scene's41-case focus/core
regression passes. New UI source is frozen; native replay awaits USB reconnect.
