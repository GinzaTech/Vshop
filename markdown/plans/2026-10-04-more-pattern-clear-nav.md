# More patterned white backdrop and clear black navigation

## Latest user brief

User requests more visible pattern/detail in More's background and rejects the
current navbar as insufficiently transparent. Prior constraints still apply:
More stays white, all14 cards remain glass, navbar retains black-tinted Liquid
Glass. The Team icon-only native test continues separately via a labeled DEV
fixture because the live roster is empty.

User expanded this pass: scan remaining UI halos throughout the app; make
primary route changes immediate and smooth; reduce Bundle item details and
show the expanded details only after an explicit tap, sliding below the summary.
Read-only source audit runs separately. Bundle gets a bounded implementation
plan before edits; existing data/price/ownership/purchase rules are preserved.

## Bounded implementation

- Generate an original white-on-white pearl texture with layered embossed
  contour ribbons and fine curved lines. Keep quiet text zones and white as
  the dominant color, with no dark/colored backdrop or labels in the bitmap.
  Preserve prompt/provenance and review the original asset on a real screen.
- Replace the canonical More wallpaper; one viewport image-refraction shader
  and all14 sharp card owners stay in place. Use shared material tokens.
- Native Android expo-blur supplies a separate tint overlay in addition to
  the React veil. Inspect its implementation and reduce combined opaque layers
  so content remains visible through a subtle black tint. Keep reflection,
  rim and native refraction; respect unavailable-target/a11y fallbacks.
- For accepted native presses, configure only the small lens worklet with the
  installed runOnUISync API, then dispatch the route in the same JS handler.
  Remove the extra UI→RN acknowledgement wait for this native press path.
  Preserve existing asynchronous move/default/web fallback and its generation
  guards; never run React, router or data work on the UI runtime. Measure the
  matched native sequence and do not assume synchronous kick guarantees60fps.
- Revisit measurement: p95 improves97→38ms, but jank32.17→34.39% in bounded
  DEV windows. Source shows the renderer remounts on eligibility and starts
  useImage/program-idle preparation again. Keep the ownership key, but retain
  one source-qualified decoded wallpaper and initialize the program from its
  existing cache. Prepare the public image during idle preload; inactive/
  invalid geometry still must draw no Canvas. No unbounded image cache or
  changed card/motion/user-data ownership. RED/GREEN native-renderer mocks
  verify decode calls and source qualification; repeat actual warm captures.
- Add rendered regression for low black veil/lens alpha and clear native tint;
  prove navigation/semantics via existing suites. Avoid account-changing tests.

## Acceptance

- [ ] More original detailed white asset, prompt/provenance and bounded size.
- [ ] Native More top/lower captures and scroll alignment on generated texture.
- [ ] Navbar content visibly transmits through material over More and a
  contrasting primary scene; crisp icons/labels and rapid forward/back.
- [ ] Actual Team fixture icon-only geometry/ready-local test and live empty
  state report with explicit fixture classification.
- [ ] TypeScript, zero-warning lint, scoped tests, full check, Android export,
  diff check and report exact outcomes. Do not equate source with native proof.

## Recorded outcomes

Pattern original841×1870,1566857bytes; prompt/provenance preserved. Native top
and lower More screenshots show white patterned backing and visible transmission
through clear black-tinted nav. Body Bundle opens below summary, swipes, closes
and reopens retaining position (three final native cases; initial fresh default
collapse separately observed). Actual Team fixture tests seven cases including
320dp/font1.3; all device settings restored. Live Riot Team currently empty;
fixture classification is explicit, not live-member proof.

Source scopes: navigation98, More+cache75, Bundle75, route/agent99,
Profile+architecture81 and Store/Night29 PASS. Inventory207 source files,14
ordinary content GlassCard call sites flattened. Independent reviews approved
bounded source/cache ownership. Full final197 suites2748 tests PASS; TS/lint
PASS; overallcheck blocked by existing braces1240992; coverage74.58% below80%.
Android export10.64/12MiB total,7.84/8MiB Hermes,1.49/1.5MiB asset PASS.

Before/after seven-route DEV windows: jank32.17→34.39%, p95 97→38ms, p99
200→133ms. No smooth60fps or causal improvement claim. Single decoded wallpaper
and cached program added after this measurement to avoid revisit setup;75 More
tests PASS and source review no blocker. Phone disconnected at final-cache
reload guard; diagnosis restarted ADB but no device. User reconnect requested.
Exact cache-version native replay, affected-route visual/press sweep and final
motion acceptance remain pending; plan is not marked fully complete.
