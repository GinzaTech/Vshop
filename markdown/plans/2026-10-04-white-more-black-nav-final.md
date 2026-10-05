# White More, fourteen glass cards, black glass nav — source handoff

## Final user requirements

More must remain white; all ten shortcuts and four lower groups must be glass.
Navbar must be black while retaining Liquid Glass. Inspect the nine linked
screens for blurry edges and pressed-state flashes. Finish code and automatic
checks today; physical testing is explicitly deferred to2026-10-05. Shut down
the PC only after code, checks and durable handoff are finished.

## Source implementation

- Original white-on-white pearl image from built-in ImageGen, prompt and
  provenance under assets/generated. No gray procedural backdrop in the active
  More scene. White base, faint wallpaper transmission.
- MoreGlassScene owns one viewport canvas outside Animated.ScrollView. It adds
  grid position to shortcut-local positions exactly once; lower groups use
  common content coordinates. Fourteen native content owners remain mounted.
- SharedValue scroll updates shader coordinates on the UI thread without React
  state per frame. Offscreen content bounds do not enlarge the framebuffer.
- Shader samples the actual generated image at bent coordinates. It does not
  capture arbitrary application text/photos. Labels and switches remain sharp.
- Renderer keyed by source type/value and eligibility retires old image loads;
  committed availability keys reject stale geometry/image callbacks. Native
  shader compilation is cached and scheduled through a cancellable idle task.
- Black navbar keeps native blur/refraction, reflection and input/semantic
  ownership; white labels and a red selected glyph retain contrast.
- ContentCardTouchable keeps media/text opacity and layout stable and draws an
  inset outline. Held feedback clears before actions. Nine-route details are in
  [inner-card plan](2026-10-04-more-inner-card-press.md).

## Final automatic evidence

External directory: `C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/`.

| Gate | Result |
|---|---|
| TypeScript / ESLint max-warnings0 | PASS |
| Complete Jest | 191 suites /2644 tests PASS,49.317s |
| Statement coverage |74.05%, below the80% total target |
| Overall pnpm check | FAIL only at existing braces advisory1240992 production audit |
| Android export | PASS total10.21/12MiB; Hermes7.84/8MiB; largest1.06/1.5MiB; temp removed |
| Diff whitespace | PASS |
| Actual image shader | CanvasKit0.41 compiler/paint PASS,67 floats + image child |
| More scope |71 cases; image decoder retirement assertion included in final full gate |
| Inner content scope |8 suites /90 tests PASS, lint/diff/review PASS |

Logs: final-white-more-black-nav-check.log, final-white-more-black-nav-export.log,
more-white-scene-green.log, more-inner-card-green.log. The older More screenshots
and gray/white-glint versions were rejected/superseded, not final visual proof.

## Tomorrow's physical acceptance (PENDING)

- [ ] White background and visible glass on all fourteen groups; black nav.
- [ ] Top and lower glass remain aligned during fast up/down scrolling.
- [ ] VI→EN→VI, long text and narrower/larger font layouts.
- [ ] Nine shortcut route entries, Update popup open/close; no account writes.
- [ ] Inner cards/images stay sharp during tap/long press, no halo/reveal flash.
- [ ] Reduce Motion/Transparency, rapid navigation/background return and bounded
  warm frame measurements. Source/export success is not physical/FPS proof.

At the original handoff, no more device operations were performed after the user deferred physical tests.
No production APK/OTA, commit or push was requested by this handoff.

## October 4 resumed physical window: white pearl contrast

The user subsequently resumed physical testing and asked for a More background
that makes the glass cards stand out. The white requirement remains in effect.
The shared wallpaperStrength token changed from0.28 to0.72; both wallpaper
fallback and the image shader use this same token. The original generated asset,
single viewport canvas and fourteen sharp native content owners are retained.

Device45218ba, QA packagecom.android.vshop.startupqa4.2.0/code92,1080×2400,
font1.0: fresh Metro reload observed More on the latest source. Top, lower options
and bottom account groups were captured after guarded scrolls. The top hierarchy
contains more-glass-scene-gpu and more-glass-scene-canvas. Native screenshots
show the brighter pearl folds and visible card boundaries on a white base;
text and switches remain legible. A GPU-ready marker is not a frame-rate result.

Artifacts in the existing external directory's white-more-native folder:
04-more-pearl-top.png,05-more-pearl-lower.png,06-more-pearl-bottom.png and
more-pearl-scroll.mp4. No setting/account actions were invoked in this replay.
More scoped tests71/71 PASS; logs more-pearl-contrast-green.log. Final source and
export gate outcomes are recorded in the mobile results report when complete.

Earlier deferred acceptance remains pending for cases not exercised in this
resumed window, including full accessibility traversal and all nine latest
inner-page press states. The earlier one-shot shutdown was fulfilled; it is not
scheduled again during this resumed physical test session.
