# Bundle, Profile, Night Market and account-switch UI refinements

## Accepted brief

- Keep the previous restored materials, all gray page backgrounds and the
  measured focus-render navigation optimization.
- Bundle preview artwork becomes a wider horizontal banner; place ending
  time below it. Preserve initially closed press-to-slide detail and retained
  carousel owners/scroll.
- Grow graffiti/Flex selection cards approximately20%; clarify whether the
  equipped launcher slots are also included. Optimize Profile collection
  thumbnail delivery with bounded prefetch/cache reuse and visible priorities.
- Night Market:2 columns by3 rows, all6 cards visible on the connected normal-
  font phone without vertical scrolling. Adapt art height/spacing to measured
  viewport/header/navigation clearance; avoid clipping text or controls.
- Logged-in accounts: only the active account appears inline. The account-count
  badge opens an accessible selection popup for other saved accounts. Reuse the
  existing account-switch owner and confirmation/permission flows.
- Remove the white left rim/edge from navigation while retaining its black
  transparent glass and existing lens/glyph motion.

## Ownership and verification

- Commerce worker: BundleImage/NightMarketItem/route layout and owned tests.
- Profile worker: graffiti picker geometry and collection image delivery; no
  controller/session/mutation rewrites or loss of86-dependency presentation memo.
- Account worker: bounded account selector component, Settings account group
  integration and callbacks/permissions regression tests.
- Main: navbar edge, gray page audit, integration/source gates and Expo replay
  on the actual main com.android.vshop installation, device45218ba.

Use valid behavioral RED then GREEN, independent review, pnpm check and Android
export. Physical screenshots: wide Bundle/time/disclosure, all6 Night cards,
selection popup, active account/count chooser and nav edge. Test open/dismiss
without buying/equipping/queue/party/chat actions. Preserve current account.
Record each source/build/runtime result separately and qualify frame metrics.

## Frozen source evidence

- Commerce: Bundle89tests/5suites and Night73tests/5suitesPASS; owned lint and
  strict scoped typesPASS. BundleDisclosure function retained unchanged; normal
  Night row budget comes from actual viewport/header/footer/navigation measures.
- Profile:149tests/15suitesPASS, lint/typesPASS. Enlargement applies to the
  popup choices (the user's "cards shown for choosing"); equipped launcher
  slots remain unchanged pending the optional scope answer. Artwork grows62→
  74.4dp and72→86.4dp; added vertical padding preserves approximately20% area.
- Accounts:17tests/4suitesPASS; native/web popup receives only public string
  display records. Parent handlers remain AST-identical; a thin navigator host
  applies first-blur visibility masking and closes state without re-rendering
  the entire Settings root for focus-only changes.
- Navbar:105tests/4suitesPASS after removing white strokes and outer shadow;
  the optical reflection is inset from the outer edge. Original glyph morph
  and lens dynamics remain.

External artifacts: C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/
app-test-20261004/ and ui-refinements-commerce-20261005/. Source review is not
physical appearance proof. Device45218ba disconnected before this latest
combined Expo reload. Diagnostic auto-fix restarted ADB but found no device;
USB reconnect requested. Native appearance/fit/popup/cache-delivery replay for
this refinement remains pending rather than inferred from unit tests.

Final combined source gates: TypeScript and ESLint zero warnings PASS;
211suites/2,922testsPASS in56.297s. Overall pnpm check stops at the existing
unallowlisted braces advisory1240992. Full coverage75.31% statements remains
below the repository80% goal. Independent Android export PASS9.17/12MiB total,
7.86/8MiB Hermes,0.92/1.5MiB largest; unique temporary output removed.
Diff check PASS. Latest main Expo server is prepared from this frozen source;
no production release, push, account switch/delete/equip or shutdown occurred.
