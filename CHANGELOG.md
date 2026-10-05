# Changelog

All notable changes to VShop are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic app versions with independent Android and iOS build numbers.

## [Unreleased]

No unreleased changes.

## [4.2.1] - 2026-10-05

### Changed

- Redesign commerce skin preview as a centered, bounded white popup for Store,
  Bundle and Night Market: image-first hero, real rarity icon, opt-in Video,
  red level selector and catalog variant swatches. Preserve decoder lifetimes,
  Back/close, legacy generic previews and existing wishlist/ownership behavior.
- Make weapon cells inside an opened Bundle previewable while accessories remain
  read-only. Clamp vertical overscroll for all three Profile tabs without removing
  pull-to-refresh or the floating-navigation clearance.
- Reduce the visible Profile equipment-mode pill to144x36dp at normal Vietnamese
  text while retaining a48dp native hit target and adaptive long-label fitting.
- Restore white Liquid Glass navigation after the opaque-white change removed
  its effect: translucent capsule underlay, light page-only blur and white native
  refraction tint, with sharp dark labels and retained lens/glyph motion.
  Respect shared Reduce Transparency and retire backdrop blur when hidden or
  collapsed. Preserve white fallbacks without reintroducing outer rim/shadow.
- Remove the account-level footer under the equipped Profile card's motto.
  Place the motto lower with an8dp minimum gap and separate rank headings from
  their values by4dp, preserving the one-third artwork, image level badge and
  all picker owners.
- Restore the equipped Profile player-card artwork to120dp height and expand
  its width to one third of the identity card after the clarified request, retaining title,
  motto, level, cached art and picker owners. Make Bundle previews50% taller
  at unchanged width (3.2 aspect ratio instead of4.8).
- Resolve both Night Market artwork dimensions explicitly: the native measured
  frame still narrowed under the former percentage-width/aspect-ratio layout.
  Main Expo after screenshots now show full-width art and complete tier labels.
- The earlier opaque-white navigation is superseded by restored white glass.
  Set shared page and source splash backgrounds to neutral gray #eceef0, with
  a matching plain More sampling texture. Approved launcher artwork stays separate.
- Fill Night Market artwork frames across the complete card width while keeping
  the six-card fit budget and contained weapon images. Allocate complete Profile
  region text and a responsive two-line equipment/info label with space reserved
  for both slider endpoints. Before screenshots were saved on the PC before the
  phone was unplugged; native after-render verification remains pending.
- Use gray page backgrounds throughout; retire the decorative pearl wallpaper.
  Enlarge the four daily Store cards into a two-by-two phone grid. Show a wider
  Bundle preview banner with ending time below and budget Night Market's six
  offers into a measured two-column/three-row layout on normal phones.
- Grow graffiti/Flex picker artwork and representative card area by20%; warm
  at most12 public Profile collection thumbnails with the matching managed cache
  keys and visible-image priority, canceling stale queued work.
- Show only the current saved account inline in More. The accessible account
  count opens a gray selection popup for other accounts, reusing existing switch
  and removal-confirmation owners. Mask and dismiss the popup on route blur.
- Remove white navigation borders and its outer shadow; retain lens motion and
  existing glyph animations under the latest white glass material.
- Retain unchanged Profile presentation and More content/rim owners on focus
  updates, with complete data/callback dependencies and fresh locale/account
  updates. Expo device measurements distinguish React commit from first paint.
- Adopt the approved sculpted startup cart as the application launcher icon.
  Prepare an opaque1024px common icon and a padded transparent Android adaptive
  foreground from the same high-resolution source, with the startup background.
  Installed launcher changes require a new native build.
- Restore the previous Profile, Store, Night Market and Bundle content materials
  after device review. Keep their reduced responsive card sizes and readable
  native text; remove the decorative patterned wallpaper from all runtime pages.
  More retains glass cards on the shared gray page background.
- Reduce representative normal-phone item-card areas to about45–60% of their
  previous size. Use responsive three-column compact grids, two columns with
  narrow/large-font layouts, and a smaller Bundle summary/disclosed carousel.
  Preserve real prices, rarity/ownership, selected states and48dp interaction.
- Keep source-qualified image ownership and compiled glass program reuse for
  More's neutral material; earlier patterned artwork is retained as a historical
  source asset and is no longer displayed as the application background.
- Make navigation's black tint more transparent with18-intensity native blur,
  an18% black veil and12% lens tint. Dark labels stay readable over the clear
  light-page material; the opaque fallback retains light labels.
- Collapse Bundle item details initially. Tap the accessible summary control
  to reveal a compact horizontal carousel below; tap again to close. Retain
  item instances, scroll position, prices/ownership and live Reduce Motion.
- Consolidate Combat members into one flat Team panel with smaller portraits,
  rank icons, labels and spacing. Keep all roster members and metadata, with
  the self-only ready switch inline and its48dp minimum touch target retained.
  Show rank as an icon at the right edge; retain rank/RR as screen-reader text.
- Render all fourteen More cards over an original white pearl wallpaper through
  one viewport-sized image-refraction canvas. Keep More pure white; update lens
  positions on the UI thread while scrolling and retire hidden/image owners.
  Keep native labels and controls sharp above the material, with opaque
  Reduce Transparency and lightweight web fallbacks.
  Increase white pearl wallpaper transmission to make glass card boundaries
  visible while retaining the white More background.
- Use black Liquid Glass for the navbar, with native backdrop blur, reflection,
  white labels, a red selected glyph and the existing magnification/navigation.
- Replace normal startup with an original sculpted VShop cart mark, app name,
  localized status and progress based on actual completed bootstrap stages.
  Match the native and React mark and background. Animate entrance and stage
  changes with shared motion tokens and live Reduce Motion; preserve retry,
  cached-data and update controls for actual recovery states.
- Fade the startup overlay after the requested route commits, release its input
  and accessibility interception immediately, and settle instantly with live
  Reduce Motion. Optional startup-cache metadata persistence no longer delays
  core synchronization; session and queued-write guards remain in place.
- Add original launch and connection-recovery illustrations with generation
  provenance. Native splash changes require a new APK.

### Fixed

- Make the OpenCode worker tests portable across Windows and Linux and align
  Expo SDK patch versions. Include authored local native modules in EAS source
  packaging while excluding top-level prebuild outputs.
- Start the tiny lens worklet synchronously on supported native runtimes before
  immediate route dispatch. Preserve guarded async web/error fallback and
  reject older queued lens commands; avoid replay on a confirmed reduced-motion
  destination.
- Flatten remaining ordinary About/Contracts/Upgrades/Setup/Reauth cards and
  repeated agent-picker tiles. Remove Profile identity/skin/expression optical
  edges, whole-content press fades and picker image reveals; retain local busy
  indicators and permissions. Keep the breakdown table sharp when its tab changes.
  Item-card material in the five named commerce/profile areas is superseded by
  the unified More-standard glass above; ordinary form/info surfaces remain flat.
- Keep Shop and Night Market content geometry/artwork stable on press, with
  local border feedback and no repeated optical blur or whole-card fading.
- Configure the navbar lens on the UI thread before routing via a guarded RN
  acknowledgement; retire stale intents at authoritative layout commits.
- Stop blending primary page contents during tab changes; retain mounted scene
  state while committing one opaque destination. Commit settled MorphIcon paths
  as React SVG props so native paint cannot retain the old declared glyph.
- Dismiss retained Profile pickers on focus loss without resetting account,
  collection, pager or queued loadout work.
- Reduce Profile rank names to 13sp with two-line fitting; match the Level pill's
  light gray material across the three balance and two rank cards.
- Remove whole-content press fades/scales and outer halos from affected
  More-linked equipment, accessories, gallery, agent, history, crosshair,
  leaderboard and friend content. Use inset feedback; retain tap/long-press,
  media identity, account permissions and the existing flat Combat content.
  Clear held feedback before navigation callbacks. The language picker stays flat.
- Prioritize closing the language picker and share the language subscription.
  Update the visible tab first; retained hidden tabs adopt the current locale
  on focus without remounting or losing their state. Commit locale snapshots
  only after completed renders, including interrupted transitions.
- Remove optical rims and card shadows from Night Market and repeated Combat
  sections. Increase Combat friend-card width to 96dp and give status two lines.
- Refresh friend art when the public card catalog becomes ready, normalize known
  card identities and preserve an honest placeholder when presence has no card.
  Combat excludes offline, away, do-not-disturb and validated idle friends; main list policy and
  invite permissions remain unchanged.

- Harden Profile cache ownership and stale request cleanup, picker focus and
  accessibility, viewport restoration and collection exports beyond 48 items.
- Preserve navigation intent and live motion preferences, cached match details
  on refresh failure, account ownership in upgrades and season ownership in
  leaderboards; isolate media callbacks by preview lifetime and restore explicit
  retry paths. Detailed findings are in `markdown/ui-quality/UI_BUG_REPORT.md`.

### Development

- Add opt-in DEV roster/presence response capture for player-card diagnostics:
  `EXPO_PUBLIC_VSHOP_CARD_RESPONSE_DEBUG=1`. Preserve ordinary response fields
  and card UUIDs while stripping credentials; no auth-stream or chat-message
  capture. Keep logs outside Git and disable the flag after diagnostics.

- Add an opt-in `VSHOP_NATIVE_QA=1` native identity for side-by-side physical
  testing when the installed application's signer differs. It uses isolated
  package/storage and disables OTA; default builds retain the VShop identity.
  QA builds and debug frame samples are not production release evidence.

### Security

- Patch `braces@3.0.3` to bound nested patterns and AST traversal for
  GHSA-vfj7-8cjw-p6xm. Production audit verifies the reviewed patch on every
  reported dependency path before accepting that specific advisory.

## [4.2.0] - 2026-10-01

### Security

- Replace the pentest spawn environment denylist with a conservative
  allowlist: only known system variables and `EXPO_PUBLIC_*` values reach the
  Expo/Metro process, so `*_KEY`/`*_PASSWD`-style secrets can no longer leak
  into the served web bundle.
- Validate the mobile-vault `stateSnapshot` shape and size on the desktop side
  (shops/balances/progress objects, match and season maps, profile-cache count,
  wishlist cap) before applying a transfer; malformed envelopes now reject with
  `TRANSFERRED_SNAPSHOT_REJECTED` instead of crashing stores on first persist.
- Harden the pentest companion: reserve the vault claim synchronously before
  reading the body (double-claim TOCTOU fixed), strip the `Authorization`
  header when a redirect crosses upstream host kinds, and cap global client
  sessions (16), live auth browsers (4) and pending vaults (8) with explicit
  429 error codes.
- Pick explicit Riot cookie fields when building handoff envelopes instead of
  spreading unknown cookie properties.
- Map mobile-mirror failures to distinct localized messages (needs re-auth,
  expired, superseded, generic) instead of one generic error string.

### Fixed

- Restore the saved-account list when a phone-vault import fails after
  `clearSavedAccounts`, run transfer activation inside the shared session
  operation queue/mutex so it cannot interleave with account switches, keep a
  cancel during "activating" from resurrecting a ready state, and invalidate
  resource caches/startup markers on transfer start and rollback.
- Chat init failures no longer clobber a newer connection's state (orphan
  sockets are disconnected) and token renewals keep roster revision state so
  friends refreshes survive reconnects.
- Gate the Android liquid-glass refraction lens on Reduce Transparency (capture
  and refraction fall back to the static tint) and document the lens rules
  (no opacity on active glass ancestors, no glass-on-glass, lens needs dynamic
  content behind it).
- Consolidate duplicated helpers: `mapWithConcurrency` into `utils/network`,
  `getCompetitiveQueueSkill` into `utils/profile-rank`, single
  `API_DEBUG_LOGGING` flag, renamed the rank title-case helper; guard the last
  unguarded dev console warnings and drop two weak `@ts-ignore`s.
- Remove the unused `@expo/vector-icons` dependency and the iOS-only
  `@callstack/liquid-glass` package (peer requires an unshipped RN patch).

### Fixed

- Repair the Android handoff deep link: `adb shell` joined argv into the
  device shell where `&` parsed as a background operator, truncating the
  `vshop://session_handoff` URI (every vault creation failed with
  DEVICE_LAUNCH_FAILED). The remote command is now a single argument with the
  URI single-quoted.
- Load the Valorant asset catalog memory-only on web: `FileSystem.cacheDirectory`
  is null there, so cache reads could reject and the post-fetch write always
  threw before the in-memory assignment, leaving every screen without images.
  Native keeps the 24h file cache; web assigns in memory first and treats the
  disk write as best-effort.
- Fail chat XMPP fast on web (raw TLS sockets are unavailable) without
  scheduling reconnect retries, and keep friends/messages across token
  renewals instead of wiping the chat store.
- Restore web UI parity: stateful MorphIcons remount on identity change
  (react-native-web silently drops SVG path mutations), pull-to-refresh
  screens show a top progress bar while refreshing (react-native-web drops
  the refreshControl prop), and synthetic safe-area insets keep content off
  the frame edge — including fixing the refresh-control wrapper regression
  that blanked pull-to-refresh screens on web.

### Changed

- Reserve the scaled navigation label line and align its active icon at large
  system text sizes while preserving the54dp capsule,50dp lens,1.3 text cap,
  default geometry, icon animations and500ms collapse gesture.
- Raise Axios to1.20.0 to resolve newly reported runtime-option, redirect,
  prototype-pollution and HTTP-adapter advisories without weakening audit policy.
- Harden opt-in API-response diagnostics: restrict retained keys/text/enums,
  redact numeric capability/signing fields and encoded private URL segments,
  and allow explicit log clearing after capture is disabled. Keep API responses
  unchanged for callers and exclude captures, packages and signing files from Git.
- Track authored Android module source/tests while keeping root Expo prebuild
  and native build output ignored, so a fresh checkout contains the glass module.

- Restore Settings hold-to-collapse at 500ms and tap-to-expand for the glass
  navigation bar, preserving the active MorphIcon and route. Retire late
  gestures across collapse/hide and keep the empty collapsed area touch-through.
- Keep Bundle information and item-section backgrounds white instead of
  duplicating the hero as a blurred gray backdrop. Preserve owned-item fading,
  green checks, compact item cards and real prices.
- Strengthen the Bundle frame and item outlines with shared white-surface border
  tokens. Extend owned-item overlays to player cards/titles, sprays, flex and gun
  buddies using type-scoped inventory evidence and preserved offer/level IDs.

- Extend shared light liquid-glass layers across weapon, bundle, collection,
  accessory, Profile and Party cards. Prominent finite artwork surfaces opt into
  bounded native blur; dense lists and unsupported/accessibility modes retain a
  lightweight fallback, clear artwork/text and existing touch behavior.
- Replace the primary bar with the specified floating five-slot capsule,
  traveling magnifying lens and delayed opacity-only scene crossfade. Preserve
  the existing mounted MorphIcon, history and rapid retarget behavior. Native
  fidelity/performance verification is tracked separately in the completion plan.
- Add the reference's three-stop lens highlight, motion-bounded chromatic edge
  and subtle optical offset without changing approved geometry/material opacity.
  Preserve SVG gradient alpha explicitly with `stopOpacity`: the installed native
  serializer otherwise turns transparent rgba stops into opaque paint. These
  optical layers are not claimed as full page-background refraction.
- Add an Android API 33+ native backdrop-refraction candidate: a page-only
  retained RenderNode feeds a padded lens-sized AGSL effect, without screenshots,
  JS pixel transfer or changing the existing MorphIcon. Old binaries and
  unsupported/accessibility/background states retain the material fallback.
  Requires a new native development build; device fidelity remains NOT VERIFIED.
- Make Profile equipment selection nonblocking with per-owner serialized,
  latest-field-wins writes, raw server ACK authority, scoped rollback and
  credential-retirement barriers. Keep four compact expression slots together.
  Invalidate legacy optimistic loadout caches without deleting rank/ownership.
- Prevent invalidated force reads and ordinary cached reads from becoming false
  reconciliation proof after a lost PUT receipt. Regression tests cover both
  v2 full-payload overwrite risk and v3 versioned writes.
- Preserve a same-session pending Profile choice during cache hydration even
  when its registry queue is absent; clear that fallback on account, region,
  credential, generation or authentication changes. Extend behavioral tests for
  cold/warm fetch scheduling, teardown, partial failures and stats lifecycle.
- Add an isolated DEV native QA fixture and explicit-device executable
  interaction harness. Synthetic ownership/price/write latency is labelled;
  the fixture cannot read the real session or persist Profile cache and its
  payload module is excluded from production.
- Permit Debug Gradle configuration without release secrets while failing actual
  release packaging explicitly if production signing variables are absent.
  Production never falls back to the debug signing key.
- Redesign the Party code section into a compact white panel with a prominent
  selectable real code, adjacent Copy/Share icon controls, contextual Generate
  placement and a separated quiet Join/Invite row. Empty Generate stays beside
  the placeholder; existing-code Generate stays in the header. Long codes scroll
  without truncation; narrow/large-font actions stack using the app viewport
  hook. Native Android Share opens with the current code; dismissal is safe.
- Replace default Combat agents/role browsing with a compact white Party sheet,
  real members, online-only friend cards, queue/privacy controls and an agent
  popup only when a new pregame match is detected. Successful lock opens the
  match tracker; teammates/enemies and scores use actual API data, never a
  fabricated 0–0 fallback. Focused foreground polling uses 3-second settled
  waves with cleanup and stale session/party/match guards.
- Finish accepted Party mutations before background reconciliation. Ready
  toggles immediately with scoped display-only optimistic state, rollback on
  rejection and confirmed-data-only Start permissions. Add explicit code
  generation, copy/native sharing, validated join-by-code and Name#Tag invite
  forms; compact typography/padding retains 48dp touch targets. Friend cards
  read the current nested Valorant presence fields, with honest placeholders
  when metadata is unavailable. No native release or automatic account actions.
- Patch production-audit transitive Joi, fast-uri and brace-expansion versions
  through compatible overrides; preserve the existing documented audit policy
  instead of adding exceptions for new advisories.
- Refine Bundle cards against the Champions reference with a wider hero using
  the alternate banner, smaller unified item tiles, stacked VP prices and
  current-account purchased-skin overlays. Ownership comes from inventory IDs
  joined to skin/level/chroma assets; prices retain Riot's actual values. Remove
  the bundle estimate note as requested.
- Add opt-in native DEV HTTP response diagnostics for Riot/public clients.
  Sanitized JSONL bodies retain asset data for analysis while omitting auth
  secrets, identify partial/omitted captures, and remain outside source control.
  Document API data capabilities separately from observed runtime responses.
- Reshape the Bundles screen into a white, reference-aligned bundle detail
  card. Each bundle renders its hero artwork, title, real Riot base and
  discounted VP totals (the struck old price only appears when the base price
  is higher), a full countdown with item count and a
  horizontal, non-wrapping item preview that peeks at the next card. The dark
  blur/modal bundle-detail flow is removed because all items are now inline,
  the page canvas and balance pill use light design tokens, and the storefront
  parser retains both original and discounted bundle/item prices without
  inventing ownership. UI-only change; no version or native release bump.
- Add a local, guarded Codex-to-OpenCode implementation workflow. A
  project-local `codex-worker` receives approved task packets only in clean
  managed worktrees; the Node runner enforces exact GLM 5.3 selection,
  path/command permissions, stable-write and scope audits, sanitized evidence,
  and a final Codex review boundary. The workflow is developer tooling only and
  is not included in the VShop runtime or release bundle.
- Add a DEV-only desktop pentest companion for Expo Web. Riot login opens in an
  isolated Edge/Chrome context, callback completion reuses the existing
  state/nonce/session guards, and authenticated Riot HTTP reads use a
  capability-bound `127.0.0.1` gateway instead of browser-direct CORS requests.
  The gateway is read-only by default, rejects arbitrary targets/headers and is
  excluded from production/native bundles; XMPP and native cookie restoration
  remain unsupported on web.
- Make normal-browser login the recommended desktop fallback when Riot rejects
  a controlled browser. The user copies the final PlayValorant callback URL
  into a masked localhost-only field; VShop clears the field before strict
  state/nonce validation and never reads clipboard, logs or persists the value.
  The automatic callback browser remains available as an explicitly labelled
  experimental secondary action.
- Advance the local native release candidate to `4.1.10` (Android `91`, iOS
  `43`). Android primary scenes remain attached after preload, secondary scenes
  freeze while inactive, Profile dashboard warmup waits for focus/transition/
  idle, and duplicate system-chrome writes are ignored.
- Make the floating primary-tab indicator adopt the latest accepted destination
  icon immediately while preserving one mounted MorphIcon and rolling back
  prevented navigation.
- Add startup-safe update recovery to LoadingScreen and ErrorBoundary with OTA
  first, trusted native-release fallback, accessible progress, duplicate-press
  suppression and a persisted same-update startup-failure guard.
- Route all application icons through the typed `AppIcon` semantic boundary.
  Every definition, including Valorant-specific weapon, rank and role glyphs,
  now reaches `MorphIcon`; `AppIcon` has no MaterialCommunityIcons fallback.
  Stateful controls keep one mounted icon, the wishlist selected state
  deliberately reuses the Heart path with a fill change, and every morph
  follows the user's Reduce Motion setting.
- Pin `lucide` at `1.47.0`, isolate its runtime deep ESM icon imports in
  `components/ui/app-icon-lucide.ts`, and keep the Valorant pistol as a local
  `IconNode` so the AppIcon path avoids the Lucide CommonJS barrel and no longer
  needs a vector-font fallback. Jest now transforms `.mjs` through the Expo
  transformer. Expo's export still contains a transitive
  `MaterialCommunityIcons.ttf` asset; it remains included in the measured asset
  budget and is not claimed as removed by this migration.
- Run the Android export gate with Expo's optimized module graph and tree
  shaking. The development, preview and production EAS profiles carry the same
  environment; `production-store` inherits it from production. The
  `@hyeon004/vshop` EAS production environment is also set and verified with
  both optimizer values as plaintext variables for future
  `eas update --environment production` runs.
- Advance the source/native candidate to `4.1.9` (Android `90`, iOS `42`). The
  added `react-native-svg` runtime requires a rebuilt binary, so this source
  must not be delivered to the existing 4.1.8 runtime by OTA.
- Treat a 403 from the exact trusted Riot Name Service endpoint as an authentication failure while leaving other gameplay 403 responses unchanged. Startup now renews or reauthenticates instead of looping on an unavailable-services screen; probable maintenance/network failures can offer the latest complete same-account snapshot, including stale snapshots, with the last successful sync time and explicit stale-data warning.
- Start Profile Act history from an immutable per-account local baseline. The current Act resets to zero and counts only post-baseline Competitive matches; legacy Act rows remain recoverable but are hidden and ignored, future Acts stay selectable, and the start Act cannot fall back to Riot's full-Act MMR totals.
- Render match-economy and Profile RR trend lines on a shared native Skia canvas instead of creating one rotated React Native view per segment. Web keeps a lightweight view fallback and does not load CanvasKit.
- Keep the Profile mode morph on compositor-friendly `transform`/`opacity` layers, move the segmented control with the same shared progress, use the standard 220 ms motion token, skip per-label reveals and hidden rank/stat subtree animation during the morph, and update full-screen backgrounds once instead of repainting them every frame.
- Add a repository UI/UX workflow, reusable implementation-plan template, current quality roadmap and generated-asset brief/provenance workspace. User-scoped Codex skills remain advisory; VShop design/motion tokens and repository quality gates stay authoritative.
- Fix the multi-Act selector's blocked hit area by letting empty space in the transformed Profile header pass touches through, releasing undecided manual gestures on touch-up/cancel, and disabling the outer collapse pan while the interactive player-data dashboard is visible. Stage a cold dashboard mount one frame before starting its visible morph.
- Allow an explicit DEV-only Profile demo deep link to replace an early root bootstrap snapshot and keep that demo offline, so gesture and visual testing does not depend on a valid Riot session or emit public-API error overlays.
- Localize Profile statistics and the audited Equipment, Agent, Item Upgrades and About copy; add tablist/state semantics, Android media-modal background isolation, stable Match Detail selectors, accessible economy markers and announced scoreboard sort direction.

### Fixed

- Keep the production Profile fixture alias callable while stripping all demo
  payloads. The first 4.1.9 production APK exposed a Profile preload
  `TypeError` because Metro replaced `~/mocks/profile-ui` with an empty module
  while `useProfileSession` still called `getProfileDemoSeasonData()`. The new
  immutable `profile-ui.production.js` contract returns only empty/null data and
  is pinned by a production resolver test.

### Validation

- The white Bundle detail card passes 32 targeted tests and the full gate at
  119 suites / 1,397 tests, production audit policy and Android export budgets
  of 10.22/12 MiB total, 7.74/8 MiB Hermes and 1.25/1.50 MiB largest asset. On
  device `45218ba`, the Champions card matches the approved white adaptation of
  the reference hierarchy; horizontal item swipe, vertical bundle scrolling
  and ARTEMIS accessibility parity pass with zero negative/off-screen bounds.
- The guarded OpenCode worker passes 108 focused tests with 95.02% statements,
  84.57% branches, 92.04% functions and 96.06% lines. A live
  `zai-coding-plan/glm-5.3` run in a disposable worktree changed exactly one
  allowlisted proof file, reached a stable post-exit fingerprint, produced no
  scope violation or secret-scan finding, and was archived without merging the
  proof. The final repository gate passes strict TypeScript, zero-warning
  ESLint, 116 suites / 1,367 tests, production audit policy and Android export
  budgets at 10.17/12 MiB total, 7.70/8 MiB Hermes and 1.25/1.50 MiB largest
  asset.
- Desktop companion source gates pass strict TypeScript, zero-warning ESLint,
  102 Jest suites / 1,181 tests and the production audit policy. The fake
  vertical integration verifies one-time callback consumption, an authenticated
  read, mutation blocking and secret-canary redaction. Expo Web export passes
  45 routes with a 5.4 MiB bundle and contains no Node server, `playwright-core`,
  mutation flag or unsupported-WebView fallback. Optimized Android export stays
  within the existing budget at 10.18/12 MiB total, 7.71/8 MiB Hermes and
  1.25/1.50 MiB largest asset. Edge `about:blank` preflight passes. A local
  `pnpm run web:pentest` session served `/setup`, rendered an enabled desktop
  login action with read-only status, produced no browser console errors and
  left no startup process or 8081 listener after Ctrl+C. Real Riot login and
  live data reads remain **NOT VERIFIED** until the account owner completes
  login/MFA.
- Normal-browser callback handoff passes targeted security/UI coverage and a
  fresh 45-route static web export. The masked callback field is present while
  Node server, `playwright-core`, mutation flag and unsupported-WebView fallback
  remain absent from the bundle.
- The 4.1.10 full gate passes strict TypeScript, zero-warning ESLint, 91 Jest
  suites / 961 tests, production audit policy and Android export budgets:
  10.18/12 MiB total, 7.71/8 MiB Hermes, 1.25/1.50 MiB largest asset.
- Local Gradle `assembleRelease` completed 1,455 tasks in 20m26s and produced
  `VShop-4.1.10-production-91.apk` (180,798,308 bytes; SHA-256
  `76A6F8DA4BBC73FB2A7B2628EB45E44A9906B4733F90297B63B041C0CA5E44B8`).
  Its certificate matches the authorized 4.1.9 production signer, APK Signature
  Scheme v2 verifies, 16 KiB zip alignment passes and no Dev Launcher activity
  is present. Device install and final performance evidence remain pending due
  to ADB disconnect.
- The first full `pnpm run check` attempt passed strict TypeScript,
  zero-warning ESLint, the production dependency-audit policy and 87 Jest
  suites / 909 tests, then failed the unchanged Hermes budget at
  8.79/8.00 MiB. The invocation is not reported as a full-check pass.
- Isolating only the Lucide deep ESM imports reduced Hermes to 8.26 MiB, still
  above budget. With Expo optimized graph/tree shaking enabled, the final
  Android export gate passes at 10.16/12 MiB total, 7.69/8 MiB JS/Hermes and
  1.25/1.50 MiB for the largest asset.
- After deleting the last unused vendor-glyph return surface, the final full
  `pnpm run check` passes 87 Jest suites / 910 tests, the production audit
  policy and the same optimized Android export budgets.
- After the device-discovered production fixture fix, the new final full gate
  passes 88 Jest suites / 911 tests, the production audit policy and the same
  10.16/12 MiB total, 7.69/8 MiB Hermes and 1.25/1.50 MiB asset budgets.
- Final AppIcon policy tests enforce zero MaterialCommunityIcons runtime
  imports, keep the sole Morphicons import in `AppIcon.tsx`, and allow Lucide
  runtime deep imports only in `app-icon-lucide.ts`. They also keep decorative
  icons silent, expose one label for icon-only use and require
  `reducedMotion="user"` across state changes.
- Documentation validation parses all 21 Mermaid diagrams, resolves 138 local
  documentation links and passes `git diff --check`.
- `pnpm dlx expo-doctor` passes 20/21 checks. Its only failure is the existing
  Expo SDK patch-alignment warning: `@expo/metro-runtime`, `expo`,
  `expo-constants`, `expo-notifications`, `expo-router` and `expo-updates` are
  each one patch behind Doctor's current SDK 57 recommendation. This migration
  does not hide or auto-upgrade that separate dependency set.
- EAS development build `a20dfc19-bcbd-4e6f-9eac-c66d81dd5033` and initial
  production build `da222966-d25f-41a2-9827-23043c5c426f` both finished for
  4.1.9 (90). The development APK installed successfully; the initial
  production APK also installed, then physical device `45218ba` exposed the
  Profile preload TypeError above. That production artifact is rejected and a
  fixed production rebuild/install is still pending. TalkBack/VoiceOver,
  complete UI flows and frame metrics remain **NOT VERIFIED**.
- A fixed production rebuild was attempted from `e7f17e5` but EAS rejected it
  before creating a build because the account's monthly Android Free quota was
  exhausted. No local debug-signed APK was substituted. Instead, production OTA
  group `5ba85a7f-a273-45a0-8ccc-90c13c1fc97a` was published and verified for
  runtime `4.1.9` only; 4.1.8 binaries cannot receive it.
- Device `45218ba` downloaded the verified Android update
  `01a0d2e9-c3ea-79e6-8958-1d05d9cc2c8c`. On the next cold start the production
  app remained foreground with no Profile TypeError, FATAL, ANR or SIGSEGV.
  Hardware smoke tests passed Profile equipment → player data, Overview ↔
  Details, the reverse player-data → equipment transition and all five primary
  tabs. A two-transition frame sample recorded 79 frames, 14 janky frames by the
  current metric (17.72%), P95 25 ms and P99 31 ms. Manual TalkBack and broader
  flow coverage remain **NOT VERIFIED** because a phone call interrupted the
  session.
- Android development client `4.1.8 (89)` reproduced the Name Service 403 startup loop, then verified the fix: silent renewal completed, `syncAllData` finished in 3,131 ms and Profile rendered without FATAL/ANR/SIGSEGV. A real Riot maintenance outage was not induced; maintenance copy, stale same-account fallback and hostile/lookalike URL rejection are covered by source tests.
- `pnpm run check` passed: strict TypeScript, zero-warning ESLint, 79 Jest suites / 828 tests, production dependency-audit policy, and Android export/budget (10.46 MiB total; 7.99 MiB JS/Hermes). Critical `season-actions.ts` branch coverage is 80.82%.
- DEV-only Match/Profile fixture payloads and flow tracing now resolve to tiny fail-closed production facades, preserving the full development harness while keeping the unchanged 8 MiB Hermes budget and excluding trace/storage instrumentation from release bundles.
- Development client `4.1.8 (89)` on Android device `45218ba` verified current/middle/old-Episode season taps, selected semantics, metric changes and Overview/Details state; the final sampled flow produced no package FATAL, ANR or SIGSEGV. Full 38-Act swipe on a live Riot session and manual TalkBack traversal remain **NOT VERIFIED**.
- An eight-Act offline fixture verified selector overflow on hardware: left/right horizontal swipes changed visible chip bounds, first/middle/final Act taps selected correctly, and a vertical swipe beginning on the selector still scrolled the dashboard.
- The reset-from-now one-season deep link and live Riot-account migration are **NOT VERIFIED** because the Android device disconnected from ADB before this final pass; source/component tests are not presented as device proof.
- The demo forward morph improved from 89.47% jank/P95 117 ms to a five-run median 66.67%/38 ms; reverse measured 75%/46 ms after adding the static-rank fast path. The 220 ms interaction is materially shorter, but the ≤5%/≤32 ms roadmap target is not met and remains open.

### Build metadata

- Source/app runtime candidate: `4.1.10`; Android version code: `91`; iOS build
  number: `43`.
- Distribution: locally signed production APK exists under ignored
  `.codex-tmp/builds/`; it is not committed or published. Device installation
  remains required before approving it for distribution.
- Distribution: the first 4.1.9 production artifact is not approved as a
  standalone/offline release because its embedded bundle has the Profile stub
  defect. The installed production binary is verified only after applying OTA
  group `5ba85a7f-a273-45a0-8ccc-90c13c1fc97a` for runtime 4.1.9. A fresh
  production APK embedding `e7f17e5` still requires restored EAS build quota.

## [4.1.8] - 2026-09-16

### Changed

- Completed Profile's player-data dark canvas through the status-bar/header area, moved data cards to the shared charcoal palette, compacted the horizontal 38-Act selector while preserving 44 dp touch targets, and kept Overview/Details panels pre-rendered on hardware-backed layers.
- Advanced the source/runtime candidate to `4.1.8` (Android `89`, iOS `41`) because the new `expo-sqlite` native module requires a rebuilt binary and must not be delivered to the `4.1.7` runtime by OTA.
- Aligned the Expo SDK 57 package set to its compatible patch releases, including React Native `0.86.3`; Expo Doctor now passes all 21 checks and the frozen lockfile passes the workspace supply-chain policy.

### Fixed

- Load historical competitive records across Valorant year/Episode/Act labels. The selected Act now crawls updates beyond the former 600-match ceiling, falls back to retained match history for full combat details, then uses Riot's per-season MMR totals when old details have expired; unavailable combat metrics render as `--` rather than false zeroes.
- Added a durable, account-scoped match archive: native builds merge observed Competitive summaries and per-Act statistics into SQLite, while web/test builds use the existing storage adapter. Archived rows are deduplicated by Match ID, isolated by account + Act, retain up to the newest 1,000 records per Act independently of the 200-record working cache, and never persist Riot credentials or full match-detail payloads.
- Validate an observed archive record before reading its queue/season fields, so malformed persisted or adapter data is ignored instead of aborting the full archive batch.
- Isolate the Profile dashboard-tab state from the full Profile screen and animate the already-rendered panel layers on the UI thread, removing the visible Overview/Details hitch.
- Latch the launch route used by root bootstrap so navigating to Store, Settings or another authenticated route cannot cancel/restart startup and redirect back to Profile seconds later.

### Validation

- Full `pnpm run check` passed after dependency alignment: strict TypeScript, zero-warning ESLint, 73 Jest suites / 770 tests, production dependency-audit policy, and Android export/budget (9.91 MiB total; 7.44 MiB JS/Hermes).
- Match archive services reached 95.94% statements, 86.71% branches and 100% functions/lines in the full run; the archive core reached 95.65% statements, 86.52% branches and 100% functions/lines. Full-run season-action coverage reached 94.24% statements, 82.32% branches, 100% functions and 98.50% lines.
- A locally rebuilt `4.1.8` / Android `89` development client on Android 15 confirmed 38 selectable Acts, full dark Overview/Details surfaces, V26 Act IV rank totals (323 matches) and Episode 5 Act III rank totals (51 matches); combat metrics unavailable from retained Riot data render as `--` instead of fabricated values.
- Native SQLite inspection confirmed three account-scoped Act rows after the device flow: a complete current-Act snapshot with retained match records plus rank-only snapshots for V26 Act IV and Episode 5 Act III. No credentials or full match-detail payloads were written.
- Twenty alternating Overview/Details taps rendered 588 frames at P50 9 ms, P90 11 ms, P95 11 ms and P99 13 ms; the current gfxinfo jank metric reported 2.04% (the legacy high-refresh metric reported 51.36%) with zero missed VSync. No package-scoped crash, ANR, JavaScript exception or SQLite error appeared in the sampled logcat.
- After navigating from Profile to Store and waiting 12 seconds, Store remained foreground, confirming the root bootstrap no longer redirects the active route back to Profile.
- Mermaid 12 parsed all 20 diagram blocks and all 109 local links in `markdown/` resolved.

### Build metadata

- App/runtime version: `4.1.8`; Android version code: `89`; iOS build number: `41`.
- EAS production build [`6e0a0273-9bac-46c5-b1d8-66c230b24557`](https://expo.dev/accounts/hyeon004/projects/vshop/builds/6e0a0273-9bac-46c5-b1d8-66c230b24557) reached `FINISHED` on channel `production` from source commit `7e42d64a3e8013d9ab59ba8e6eb88a57cf9cfa73` and produced a signed APK for `com.android.vshop`.
- Release asset: [`VShop-4.1.8-production-89.apk`](https://github.com/GinzaTech/Vshop/releases/download/v4.1.8/VShop-4.1.8-production-89.apk), 131,262,994 bytes, SHA-256 `554AE2715CE64639413CD98F5318B26E23D6803A66B1CFD4303749F737157224`; APK Signature Scheme v2 verification passed with one signer.
- Static APK verification passed for package/version/SDK/signature. No ADB device was connected after the production artifact completed, so production installation/runtime is **NOT VERIFIED**; the UI evidence above belongs to the development client built from the same 4.1.8 native version.
- This follow-up documentation commit does not change the native or JavaScript payload built from `7e42d64`.

## [4.1.7] - 2026-09-15

### Changed

- Refined Profile's player-data mode with a dark readable canvas, consistent numeric hierarchy, an on-demand multi-Act selector, localized detail labels, and floating-navigation-safe spacing. Removed the compact-card slogan and synchronized the hero, segment, body background, and first data section on one reversible UI-thread transition.

### Fixed

- Restore match/profile data alongside user/cookie state when account switching fails; clear domain caches and invalidate pending writes on logout.
- Scope Riot caches and background sync to credentials and session generation, preserve successful profile components on partial failure, and recheck startup eligibility after asynchronous storage reads.
- Distinguish win, loss, draw, cancelled and unknown match outcomes in history and statistics; exclude cancelled/unknown results from the win-rate denominator.
- Stop stale account responses from updating About, Contracts and Leaderboard; pause Combat polling outside an active screen and clean up refresh callbacks.
- Disable flow tracing and persistent API logs unless explicitly enabled in development; redact credentials/identifiers and bind interactive OAuth callbacks to per-attempt random state and nonce.
- Only stamp the background match-sync TTL when the match store reports a successful refresh, so transient failures remain immediately retryable.
- Scope shop/balance and Combat in-flight requests to the credentials that created them, allowing the first request after token renewal to run instead of joining an expired request.
- Reference-count overlapping full-sync guards per account so one completed request cannot expose another full sync that is still running.

### Maintenance

- Extract match store, match transforms and dashboard logic into focused modules while retaining compatibility entry points. Add regression tests for stale writes, cache clearing, partial failures and rendered result labels.
- Include Android export and bundle-budget verification in `pnpm run check`, with automatic cleanup; CI now uses that same command without duplicate export steps.
- Key GitHub's Gradle dependency cache from tracked Expo configuration and lockfile; generated native Gradle files do not exist at the Java setup step.
- Move the ignored, obsolete npm lockfile to a recoverable local backup; pnpm remains the only package manager.
- Exclude the local ECC checkout and private OpenCode configuration from EAS upload archives.
- Split Profile into cohesive state, fetching, derived data, picker, mutation and motion hooks. Add 17 architecture diagram types under `markdown/` with code references.
- Raise remediated-domain coverage floors to 80% per metric without removing app UI from the full coverage report; global 80% coverage remains outstanding.

### Build metadata

- App/runtime version: `4.1.7`; Android version code: `88`; iOS build number: `40`.
- Target: EAS Android profile/channel `production`, signed APK. No OTA publication is included in this release preparation.
- EAS build request: [`ac5a743b-f822-47aa-a965-82ab78957873`](https://expo.dev/accounts/hyeon004/projects/vshop/builds/ac5a743b-f822-47aa-a965-82ab78957873), app source commit `21c34db`; status at this note: `IN_PROGRESS`. A following CI/docs-only fix does not change the app payload.
- A production artifact is available only when EAS reports `FINISHED` with an artifact URL. See [audit verification](LOGIC_AUDIT.md) for source/device evidence and limitations.

### Validation

- Full `pnpm run check` passed: strict typecheck, zero-warning lint, 66 suites / 728 tests, dependency audit policy and Android export/budget (9.77 MiB total; 7.30 MiB JS/Hermes).
- Full-app coverage: 44.50% lines, 38.66% branches/functions, 44.65% statements. Selected remediated domains pass 80% floors; the whole app does not meet 80%.
- The audit policy accepts eight known transitive advisories; this is not a zero-vulnerability result.
- Real-device UI testing of this source remains **NOT VERIFIED** after the USB device disconnected. Component/hook tests and export are not a substitute for the Profile transition, historical-Act and navigation checks on hardware.

## [4.1.6] - 2026-09-13

### Fixed — logic audit

Completed a full logic-layer audit (8 high, 15 medium, 16 low findings; all fixed, UI untouched). Highlights:

- **Startup duplicate fetches eliminated.** Profile warm cache now records rank schema version even for unranked accounts, so the profile screen stops re-fetching loadout, ownership and MMR on every cold start. `getRiotClientConfig` gained a 5-minute cache and in-flight dedup shared by data-sync and chat service. A full-sync registry prevents background shop refreshes from racing the startup sync, and shop/balances TTLs are stamped as soon as that data lands instead of at the end of the sync.
- **Session writes are token-safe.** `refreshShopAndBalances` verifies the access token before writing the store, so a slow shop response can no longer overwrite freshly renewed credentials with an expired token.
- **Bounded recovery loop.** Persistent recovery failures now back off exponentially (15s → 10 min) and suspend after 5 consecutive attempts, waiting for a foreground or network-restored event. Recovery skips the full sync when all data sources are still within TTL, and a 60-second grace period after startup prevents a second full sync right after bootstrap. `reauthRequested` resets after successful recovery so later session losses can navigate to /reauth again.
- **Match history integrity.** Delta sync no longer stamps the cache fresh on failure, retries matches whose details failed (replacing instead of duplicating), and honors forced pull-to-refresh by waiting for an in-flight delta before running the full fetch. Persisted history is capped at 200 records. Season stats tolerate partial detail failures, cache failures for 15 minutes, and use the correct inclusive page index.
- **Chat survives token renewal.** Disconnecting the XMPP socket keeps friends and messages when only tokens changed; the store is only wiped on account switch or sign-out. Chat init shares its in-flight promise, roster name resolution retries actually reschedule, reconnection is network-aware and capped, outgoing duplicate messages are no longer swallowed, and party messages are timestamp-sorted and capped.
- **Correct-by-construction screen effects.** Profile fetches read session data through refs so background `setUser` calls no longer re-arm full profile fetches; pull-to-refresh bypasses the in-flight guard. Match details merge player identities through an LRU-aware store action instead of raw `setState`, fixing a crash path from evicted cache entries. Leaderboard keeps its list on transient errors and re-inits only when credentials appear. Combat session polls only while focused; shop/night-market countdowns no longer drift on re-render.
- **Misc hardening.** `buildAuthenticatedUser` no longer discards fresh entitlements tokens when a single shop/progress/balances call fails; public asset failures can't block Riot syncs. Partial ownership failures merge with the previous cache instead of persisting empty lists. Wishlist background task guards concurrent runs, skips "no hit" notifications while foregrounded, and silent reauth errors no longer notify. Bootstrap re-runs can no longer leave the app stuck under the loading screen; the warm-cache map is evicted and cleared on sign-out. Auth keys are normalized (lowercase) everywhere; removed a hardcoded developer handle from the night-market header.

### Maintenance

- Removed five unreferenced helpers/UI primitives and the unused Stripe SDK/provider integration. Existing installed binaries retain the SDK until rebuilt; no native release was produced.
- Consolidated cookie implementation behind native/default entry points while preserving the web fallback, and made navigation tests exercise the same tab-motion factory used by the app.
- Removed Quokka's obsolete `src/**/*.ts` preload glob and removed obsolete design-system/payment documentation. Vexo configuration remains unchanged.
- Removed four unreferenced legacy images, stale manual Riot API artifacts and two completed one-off audit/test reports from the tracked repository.

### Fixed

- Staggered primary-tab preloads, added short secondary-page fades and consistent root-stack motion, and applied live OS Reduce Motion preferences across navigation, profile, gallery and loading feedback.
- Made shared button touch targets stable during press animation, added disabled/loading semantics, and removed global list layout animation and interaction-blocking skeleton loops.

- Accepted localized Riot OAuth callbacks such as `/vi-vn/opt_in/`, observed on Android after successful sign-in. Tracking-only cookie jars no longer overwrite saved Riot login cookies after process death or cancelled login.
- Redesigned primary tab transitions with a bounded horizontal shift, subtle 220 ms incoming fade, synchronized indicator and UI-thread press feedback. Outgoing content is hidden to prevent double images. New tab selections interrupt ongoing movement; Reduce Motion disables it.
- Prevented indicator restarts on route confirmation and paused staggered preload mounts throughout tab transitions, including interrupted and batched navigation.
- Enabled Android clipping for Profile's pager/lists and the Bundle/More/Shop scroll containers to reduce offscreen native drawing while preserving mounted React state.
- Moved primary-scene backgrounds into the focus-hidden content host to prevent outgoing empty surfaces washing out the incoming page. Enabled native scene detachment after transition; real-device performance remains below the target and is not considered fully resolved.

- Serialized Riot cookie operations and shared concurrent token renewals across startup, foreground recovery and wishlist checks. Persisted refreshed credentials immediately and rejected results superseded by account switching, interactive login or logout.
- Kept session/cache on network failures, malformed upstream responses and native cookie failures. Startup no longer redirects to login after three unrelated data errors; delayed 401 responses from older tokens no longer renew the current session.
- Preserved Riot cookies when WebView login completion fails and added a retry action. Restricted token callbacks to the configured Riot redirect and restored the previous cookie jar when account switching fails.
- Retained rotated cookies after partial renewal failures, retried revoked saved tokens once, and only marked daily wishlist checks complete after success for the same account.
- Made loadout confirmation bypass cached PUT data and prevented a GET started before a mutation from overwriting its result. Core synchronization also preserves current credentials and account ownership.
- Corrected the fallback release URL and the visualizer/workspace documentation. Validation and device testing for this unreleased source are reported separately from historical release results.

### Validation

- Motion pass (2026-09-11): TypeScript, zero-warning ESLint, 37 suites / 244 tests and Android export passed (9.64 MiB total / 7.16 MiB Hermes; budget passed). Full `check` remains blocked by production audit advisories 1193726 and 1193727 for transitive `js-yaml`. No connected Android device was available for FPS/gesture verification.

- `pnpm run check`: TypeScript, zero-warning ESLint, 38 Jest suites / 254 tests and the production audit policy passed with eight documented transitive advisories.
- Android production export passed with 38 assets. The temporary verification export was deleted after completion.
- Live Android testing confirmed localized login completion and successful silent renewal with identity preservation and concurrent-call deduplication. Verification of all four supplied accounts remains incomplete after USB disconnected; the old development binary also exhibited Hermes SIGSEGV crashes while DevTools was used. The redesigned tab animation has not yet been visually verified on a device.

### Build metadata

- App/runtime version: `4.1.6`
- Android version code: `87`
- iOS build number: `39`
- EAS production build: `5fd89b69-62e1-4e09-8218-de29a167e713` (`FINISHED`)
- Android artifact: production APK, channel `production`

## [4.1.5 OTA 2] - 2026-09-04

### Security

- Bound every silent Riot renewal to the expected saved-account PUUID so a global cookie from another account cannot replace the active identity.
- Raised the transitive `qs` and `@xmldom/xmldom` overrides to patched releases after new production advisories.

### Fixed

- Persisted native Riot cookie snapshots per saved account in the existing encrypted session store, restored the selected account before renewal and preserved the previous cookie jar for cancellation or failed-switch rollback.
- Allowed expired saved accounts to renew silently when their own Riot cookie is still valid, and made background wishlist checks use the active account's scoped session instead of the ambient global cookie.

### Validation

- `pnpm run check` — TypeScript and ESLint passed; 30/30 Jest suites and 185/185 tests passed; the production audit policy passed with four documented Expo/Metro constraints.
- Android production export bundled 2,685 modules and 38 assets successfully.

### Build metadata

- App/runtime version: `4.1.5`
- Distribution: EAS Update channel `production`; no native metadata change and no new APK.

## [4.1.5 OTA 1] - 2026-09-02

### Fixed

- Locked Combat Session to landscape for its entire focused lifetime and separated the orientation lifecycle from Combat data refreshes, preventing session updates from briefly restoring portrait.
- Locked every non-Combat route to upright portrait and re-applied the route-specific lock whenever the app returns from the background, including on Android devices that discard an Activity orientation request while suspended.

### Validation

- `pnpm run check` — TypeScript and ESLint passed; 28/28 Jest suites and 173/173 tests passed; the production audit policy passed with four documented Expo/Metro constraints.
- Android production export bundled 2,687 modules and 38 assets successfully.

### Build metadata

- App/runtime version: `4.1.5`
- Distribution: EAS Update channel `production`; no native metadata change and no new APK.

## [4.1.5] - 2026-09-02

### Security

- Overrode Expo Router's transitive `decode-uri-component` dependency to patched version 0.5.0, removing the malformed percent-encoding denial-of-service advisory from the production graph.

### Changed

- Removed the Party Chat pager from Combat so the module stays focused on party management and agent selection. Friends and direct Riot chat remain available.
- Replaced the generic direct-chat connection label with the selected friend's actual `Online` or `Offline` presence state.
- Localized the remaining Combat, direct-chat, Crosshair and Leaderboard labels in English and Vietnamese and added missing roles, labels and selected states for interactive controls.

### Fixed

- Corrected the floating navigation indicator geometry so every icon stays centered in its selected circle without accumulating horizontal rounding error toward More.
- Kept full-width opaque tab transitions aligned to the live viewport after display-size changes and made both the indicator and collapsed navigation respect Reduce Motion.
- Added safe bottom spacing to Bundle, Store, Profile and More content so the floating navigation no longer obscures the final controls or cards.
- Hid background navigation and content from accessibility while the Bundle detail modal is active, while keeping the media viewer above the bundle sheet.
- Raised undersized match, Profile statistic and skin-card labels to a readable minimum size and made Profile's typewriter text stop animating when Reduce Motion is enabled.

### Validation

- `pnpm run check` — TypeScript and ESLint passed; 27/27 Jest suites and 161/161 tests passed; the production audit policy passed with four documented Expo/Metro constraints.
- Android production export bundled 2,687 modules and 38 assets. The 9.75 MB total export, 7.28 MB Hermes bundle and 1.25 MB largest asset all stayed inside their enforced budgets. The EAS production APK build is validated before GitHub publication.
- Bundle, Combat and direct-chat Online/Offline behavior verified on the connected Redmi K60 development build without fatal Android or React Native runtime errors.

### Build metadata

- App/runtime version: `4.1.5`
- Android version code: `86`
- iOS build number: `38`
- Distribution: EAS production APK and GitHub Release asset `vshop-4.1.5.apk`.

## [4.1.4 OTA 1] - 2026-08-29

### Fixed

- Reworked primary tabs into a 360 ms full-width opaque left/right transition synchronized with the floating indicator. Android keeps preloaded primary scenes attached and unfrozen so the navigator no longer mounts or reattaches a heavy page while its native transform is running.
- Blocked repeated tab presses until the current transition completes and preserved an instant transition when the operating system enables Reduce Motion.

### Validation

- `pnpm run check` — TypeScript and ESLint passed; 26/26 Jest suites and 159/159 tests passed; the documented transitive production-advisory policy passed.
- Android production export — 2,686 modules and 38 assets bundled successfully.
- Warmed Bundle, Store, Profile and More navigation on a connected Redmi K60 development build measured 11 ms at the 50th percentile and 15 ms at the 90th percentile, with 7.72% janky frames and no missed vsync. The full-width transition was also frame-reviewed without opacity ghosts.

### Build metadata

- App/runtime version: `4.1.4`
- Android version code: `85`
- iOS build number: `37`
- Distribution: EAS Update channel `production`; no native metadata change.

## [4.1.4] - 2026-08-28

### Security

- Migrated Riot session and saved-account persistence from plaintext AsyncStorage/localStorage to AES-256 MMKV on native, with its key protected by Android Keystore/iOS Keychain and automatic migration of existing sessions. Web sessions now use tab-scoped `sessionStorage`.
- Enabled XMPP certificate-chain validation, restricted chat hosts to Riot-owned domains and restricted OAuth WebView top-level navigation to Riot/PlayValorant HTTPS origins.
- Disabled Android cloud backup for app data, removed the overlay permission and limited MediaLibrary access to photos instead of requesting video/audio access that VShop does not use.
- Removed the direct Android battery-optimization exemption permission. The wishlist warning now opens the system's general battery settings and fails safely when that settings activity is unavailable.
- Updated Axios to 1.19.0 and its production `form-data` dependency to 4.0.6.
- Moved pnpm settings to `pnpm-workspace.yaml`, upgraded the pinned package manager to pnpm 11.24.0 and overrode all compatible patched transitive dependency versions. The remaining production audit entries are Expo/Metro tooling constraints: `image-size` currently has no patched release, while forcing major versions of `fast-xml-parser` or `uuid` would violate their parent package contracts.

### Reliability

- Deduplicated concurrent party-chat joins, reused authenticated Riot XMPP rooms and added the Riot local party-chat fallback so repeated Combat refreshes cannot create overlapping MUC requests. Stale presence data is no longer used when the authoritative Combat snapshot confirms that the account is not in a party.
- Made Combat refresh account-scoped and request-owned: concurrent refreshes are deduplicated, stale responses cannot overwrite a newly selected account, and transient failures keep the last usable snapshot.
- Bounded the OAuth WebView cookie-banner polling loop and cleaned up transient copy-feedback timers when Combat or Crosshair unmounts.
- Updated all Expo SDK 57 packages to their compatible patch releases and enabled OTA checks on normal production launches.
- Classified Riot rate limits and upstream 5xx responses as recoverable, prevented permanent startup failures from retrying forever and required initial match synchronization to report a usable result.
- Preserved large in-flight Riot XMPP roster stanzas instead of trimming them mid-response, so Friends can recover and load accounts with large friend lists after launch or foreground reconnects.
- Added explicit Sentry release/environment metadata and render-error capture without collecting default PII.
- Added a production `app.start_to_interactive` distribution metric for the first usable route without including account identifiers.
- Added explicit startup recovery controls after transient Riot failures: retry immediately, or enter with a recent account-matched cache only after a previous complete core sync. Cache-marker persistence is best-effort and cannot block a successful startup.

### Fixed

- Replaced the abrupt primary-tab swap with a 220 ms fade-through transition over the solid app background, synchronized the floating active indicator and preserved an atomic fallback for Reduce Motion.
- Made the Profile hero, player-information card and otherwise empty content areas drive the same collapsible header gesture, while horizontal skin and collection gestures remain available.
- Centered the skin media viewer above Bundle details, separated upgrade-level and chroma selectors, and classified CDN media explicitly so image URLs no longer depend on file extensions.
- Removed the duplicated in-page title from Leaderboard while keeping the navigation header and all season/search controls unchanged.
- Reused the Store skin-card renderer in the Skin Gallery and aligned Equipment cards to the same visual hierarchy, while preserving preview, wishlist and equipment-category behavior.
- Made Gallery search treat regular-expression characters as plain text and tolerate skins without level metadata instead of crashing or indexing a missing level.
- Restored the four Equipment category tabs on Android, prevented saved Gallery cards from vibrating merely because they mounted and made shared card motion respect the system Reduce Motion setting.

### Tooling

- Split the legacy Riot API implementation into request-context, account, loadout, match, combat and progression services while retaining `utils/valorant-api.ts` as a compatibility facade. Split Profile's account picker, equipment/expression sections and segmented navigation out of `ProfileScreen`, with size budgets preventing either monolith from returning.
- Removed unsafe application-level `any` usage from the audited navigation, profile cache, equipment, API logging/tracing and XMPP paths; centralized repeated Profile dark-surface colors in the design system.
- Pinned every GitHub Action to an immutable commit and added an independent Android native prebuild/Gradle compile job in addition to the existing JS bundle export gate.
- Fixed GitHub Actions pnpm/Node setup, added Expo Doctor and an Android production export gate, expanded critical-helper coverage, and added a `production-store` AAB profile while preserving the existing production APK profile.
- Added `rn-flow-visualizer` to the pnpm workspace, removed its stale npm lockfile and runtime logs, aligned its React peer versions and verified its production build independently.
- Converted Profile and Combat Session routes into thin feature entry points; extracted their styles, loadout comparison rules, combat insight calculations, Riot response types and Storefront parser into independently testable modules with enforced size budgets.
- Added truthful app-wide coverage reporting and a ratcheted baseline alongside higher thresholds for critical domain modules. CI now rejects any new production advisory unless its exact ID and transitive Expo/Metro constraint are documented.
- Added stable automation selectors to primary navigation and the Store, Profile, Friends, Equipment and Gallery journeys. CI now enforces Android export budgets for total payload, Hermes bytecode and the largest packaged asset.
- `react-native-tcp-socket` remains the required raw Riot XMPP transport. Expo Doctor's directory-metadata warning is explicitly excluded; TLS chat must remain in the native release smoke checklist until the package publishes New Architecture metadata.

### Validation

- Local Android native prebuild and arm64 debug compilation completed successfully with New Architecture, Hermes, SecureStore, MMKV/Nitro, Riot TCP chat and Expo Updates autolinked.
- `pnpm run check` passed TypeScript, ESLint and 26/26 Jest suites (158/158 tests). App-wide coverage is reported from all routes, components, features, hooks, services and utilities; Expo Doctor previously passed 21/21 checks. The current Android export bundled 2,686 modules and 38 assets successfully.
- Installed the signed development APK on a Redmi K60 and verified Bundle layering, Store filters/timer, Profile tabs, every read-only More route, Friends search, direct-chat keyboard behavior and API/XMPP recovery after backgrounding. No fatal Android or React Native runtime error was observed.
- Re-verified the warmed Bundle, Store, Profile and More transition loop on the connected Redmi: the fade-through started with the moving active indicator and measured 12 ms at the 50th percentile and 22 ms at the 90th percentile in the development build.
- Full automated, device and release validation results are recorded by the release workflow before production publication.

### Build metadata

- App/runtime version: `4.1.4`
- Android version code: `85`
- iOS build number: `37`
- Distribution targets: EAS development APK, production OTA, production APK and `production-store` AAB.

## [4.1.3] - 2026-08-25

### Added

- Added saved Riot accounts under More, including an explicit signed-in account list, add-account flow, safe session switching, reauthentication for expired sessions and account removal.
- Added local Riot ID search to Friends while preserving the latest cached roster during temporary network failures.
- Added regression coverage for account-session switching, saved-account normalization, friend filtering, authenticated navigation, match RR derivation and media-popup portal ordering.

### Fixed

- Mounted the global skin media portal only while it is open so skin videos selected inside Bundle's “show all skins” sheet render above that sheet on Android.
- Anchored the direct-chat composer to the bottom edge, moved it with the software keyboard and restored a high-contrast black send button.
- Refreshed the Riot friends roster and chat connection whenever Friends is opened, including retry behavior after background network loss.
- Prevented repeated taps on Profile's Loadout/Player Info control until its current animation has completed.
- Corrected the floating navigation's selected circular icon contrast for both dark and light navigation tones.
- Made competitive match history fetch and retain Riot RR updates for initial, delta and load-more requests; cards now show only a compact per-match RR gain or loss.
- Kept the newest authenticated account snapshot when startup recovery or account switching finishes, preventing stale asynchronous data from overwriting the selected account.

### Validation

- `pnpm run check` — typecheck and lint passing; 13/13 suites and 96/96 tests passing with 100% measured coverage.
- Android production export — 2,671 modules and 38 assets bundled successfully.

### Build metadata

- App/runtime version: `4.1.3`
- Android version code: `84`
- iOS build number: `36`
- Distribution: EAS Update channel `production`, EAS production APK and GitHub Release asset `vshop.apk`.

## [4.1.2] - 2026-08-25

### Fixed

- Removed the authenticated-tab cross-fade that composited the previous screen under the next one and made Android card elevation appear as a blurred grey ghost.
- Anchored the direct-chat composer to a flexing message list, added keyboard-safe list interaction, and changed Android's native keyboard mode from pan to resize.
- Deferred Match Session content until its landscape lock has completed and the viewport has settled, preventing the transient white band during rotation.
- Reworked the launch hand-off: a branded VShop native splash now leads directly into a matching app shell with inline progress and a profile-shaped skeleton; the native image no longer remains while bootstrap work runs.
- Replaced the red launcher treatment with a slate-grey, enlarged VShop cart mark; raised Android `versionCode` to 83 and iOS `buildNumber` to 35 for the required native release.
- Startup and foreground recovery now wait for the complete authenticated snapshot (client config, shop, balances, profile warm cache and match history) before presenting the app, and re-open Riot chat after session recovery.
- Reworked startup into a cache-first flow with a matching light native splash and an immediate app-shell skeleton instead of blocking navigation on the initial Riot sync.
- Prevented the authenticated bottom navigation from covering scroll content, reduced its shadow/selected target and kept modal interactions above it.
- Rebuilt the skin media viewer as an accessible bottom sheet with a stronger backdrop, fixed-size loading state, image crossfade and horizontally scrolling variant controls.
- Corrected duplicated top safe-area padding in Chat, Match Detail and History, and kept the Chat composer above the keyboard and bottom inset.
- Match-history cards now preserve and show the RR after each competitive match together with the exact RR gain or loss returned by Riot.
- The Profile navigation now keeps the Loadout view dark with light icons, switches to a light bar with dark icons in Player Info, and leaves the area beneath it transparent.
- The Friends screen now requests a fresh Riot roster every time it is opened, retries broken chat sockets, preserves cached friends during transient failures, and exposes an explicit retry state.
- The Store countdown now shares the same row, height and vertical alignment as the All Skins and Wishlist filters.
- Standardized Profile, Shop, Utilities, Friends and Equipment density, card hierarchy, touch targets and narrow-screen overflow behavior.

### Changed

- Added shared spacing, typography, layout, status-color and elevation tokens; ordinary cards now use a lightweight tonal surface instead of per-card blur.

### Validation

- `pnpm run check` — typecheck and lint passing; 9/9 suites and 84/84 tests passing with 100% measured coverage.
- Android production export — 2,667 modules and 38 assets bundled successfully.
- EAS Update production group `83d9d6db-3ac0-4bde-a2ec-dcb544f2d411` published for runtime `4.1.1` before the native runtime bump.

### Build metadata

- App/runtime version: `4.1.2`
- Android version code: `83`
- iOS build number: `35`
- Distribution: EAS production APK and GitHub Release asset `vshop.apk`.

## [4.1.1 OTA 2] - 2026-08-22

### Changed

- Primary tabs now mount on first use, freeze while inactive and detach their native views to reduce startup work and off-screen rendering.
- More shortcuts and the accessory search field now expose stable Android automation IDs and accessibility labels.
- Accessory cards that do not perform an action are rendered as non-interactive views.

### Validation

- `pnpm run check` — typecheck and lint passing; 9/9 suites and 83/83 tests passing with 100% measured coverage.
- `pnpm run test:api` — 13/13 read-only public API checks passing.
- Android production export — 2,667 modules and 38 assets bundled successfully; Hermes bundle approximately 7.5 MB.
- Physical-device smoke test on 2026-08-22 — `NOT VERIFIED` because ADB reported no connected device after restarting the daemon.

### Build metadata

- App/runtime version: `4.1.1`
- Android version code: `81`
- iOS build number: `33`
- Distribution: EAS Update channel `production` for Android and iOS; no native metadata change.

## [4.1.1] - 2026-08-13

### Added

- Added regression coverage for Bundle, Shop and More tab navigation, including the collapsed navigation state.

### Fixed

- Fixed Bundle, Shop and More tabs not responding on Android by mounting only the active navigation interaction layer.
- Fixed tab navigation dropping route parameters.
- Fixed web static rendering failing when the Profile collection exporter loaded native media-library code.

### Validation

- `pnpm run check` — 75 tests passing
- `pnpm run test:api` — 13 public API endpoints passing
- Android Metro production export — 2,664 modules bundled successfully

### Build metadata

- App version: `4.1.1`
- Android version code: `80`
- iOS build number: `33`
- Production artifact: APK from EAS profile `production`

## [4.1.0] - 2026-08-13

### Added

- Added typed Riot endpoint registry, isolated HTTP clients and a public VALORANT API facade.
- Added endpoint contract tests, public API smoke tests and match/leaderboard helper tests.
- Added all-season leaderboard selection with Episode/Act labels and stale-request protection.
- Added application-wide pull-to-refresh for authenticated screens, Match Session and direct chat.
- Added shared `AppRefreshControl` and `useAsyncRefresh` primitives with duplicate-request protection.
- Added centralized motion timing/spring tokens with system Reduce Motion support.
- Added `AGENTS.md` and `BUILD_DESIGN_SYSTEM.md` as coding, design and production-build policy.

### Changed

- Upgraded the application to Expo SDK 57, React Native 0.86, React 19, Reanimated 4 and Zustand 5.
- Restructured API ownership into `services/http`, `services/riot` and `services/valorant` while retaining compatible domain facades.
- Updated session recovery, API error classification and cache-first background synchronization.
- Standardized screen transitions, press feedback and high-frequency animations on Reanimated UI-thread primitives.
- Empty states now remain inside their list/scroll containers so refresh gestures continue to work.
- Updated Android plugins, native package compatibility and release metadata.

### Fixed

- Fixed Expo Blur warnings by using `blurTarget` and the supported `blurMethod` API.
- Fixed pull-to-refresh being unavailable on empty or filtered lists.
- Fixed older leaderboard responses overwriting a newly selected season.
- Fixed leaderboard season discovery being limited to only the active Act.
- Fixed several API URLs, parameter encodings, timeouts and shared Axios side effects.
- Fixed animation cleanup, unnecessary render churn and image/cache instability across core screens.

### Validation

- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run test:ci` — 71 tests passing
- Android Metro production export — 2,664 modules bundled successfully

### Build metadata

- App version: `4.1.0`
- Android version code: `79`
- iOS build number: `32`
- Production artifact: APK from EAS profile `production`

## [4.0.4] - 2026-07-29

### Added

- Added an animated **Player Information** mode to the Profile header:
  - VP, RP and KC retract before the new player metrics are typed.
  - Current Rank and Peak Rank cards retract, split into two surfaces, then reveal Act statistics.
  - The left cards show Act wins and losses.
  - The right cards show KAST and win rate.
- Added reusable type/delete text animation and split-rank card components.
- Added a Collection download button that:
  - exports a shareable account and skin overview image;
  - includes only weapon skins at Rare tier or higher;
  - sorts entries by weapon type and rarity;
  - keeps the rest of the UI interactive while the export is generated;
  - saves the generated image through the device media library.
- Added a landscape Match Session experience with:
  - current rank and in-game K/D near each agent;
  - Competitive win rate, ACS and HS;
  - a toggle between season summary and in-match KDA, HS and ACS;
  - round-by-round performance, economy and combat events;
  - weapon performance with full weapon artwork;
  - a compact opponent matchup table;
  - Spike artwork for plant and defuse events.
- Added a silent leave-party action to agent select.
- Added explicit screen-orientation control so only Match Session can rotate to landscape.
- Added response logging behind the development-only `EXPO_PUBLIC_LOG_VALORANT_RESPONSES=1` flag for match-stat research.

### Changed

- Profile Act wins now use Riot's placement-inclusive seasonal win count.
- Profile win rate now uses every Competitive game in the Act, including draw/remake results in the denominator.
- HS is calculated as the average of per-match headshot percentages instead of pooling every hit across the retained sample.
- HS, K/D, KAST and win-rate display values are truncated to one decimal place rather than rounded.
- K/D continues to use aggregate kills divided by aggregate deaths.
- Act statistic cache versions were increased so older calculations are invalidated automatically.
- Rank resolution now uses season-aware tier data and corrected fallback logic for Ascendant, Immortal and Radiant.
- Match detail weapon flow was mirrored to read from left to right.
- Match detail weapon cards now preserve complete weapon artwork.
- Opponent matchup cards were reduced in size to leave more room for primary match information.
- Profile picker and loadout-update work no longer block unrelated screen interactions while requests are pending.
- Collection and Skin cards hide the upgrade-level label for skins that only have one level.
- Flex and graffiti selection sheets retain their original background while loading.
- Match Session can render directly in landscape without showing a rotate-device interstitial.
- All 18 locale files include the new Profile, match-session and combat labels.

### Fixed

- Fixed Collection tab state resets and scroll jumps when switching between Profile tabs.
- Fixed account avatar and rank image flashes when moving from Skin to Collection.
- Fixed Collection exports including lower-tier or all owned skins.
- Fixed slow Collection export preparation and blocking overlay behavior.
- Fixed direct messages failing to send from the Friends screen.
- Improved XMPP recovery after `Broken pipe`, stream restart and reconnect events.
- Fixed incorrect teammate/enemy peak ranks caused by tier fallback and rank-icon mapping.
- Fixed the Ascendant rank image incorrectly displaying an Immortal asset.
- Fixed agent-detail panels opening outside the visible landscape viewport.
- Fixed Match Session orientation leaking into other screens.
- Fixed the Profile region card failing to collapse after the second double-tap.
- Removed Party Code from the Combat Match Session section while retaining party controls where needed.
- Removed the confirmation toast from leave-party.

### Performance and reliability

- Added request deduplication and short-lived caches for profile loadout, competitive MMR and player-name lookups.
- Added profile warm-cache reuse and explicit force-refresh behavior.
- Added season-stat cache versioning, retry handling and controlled detail-request pacing.
- Reduced repeated array scans while computing season outcomes and KAST.
- Kept collection image generation isolated so normal Profile actions remain usable.

### Data notes

- Full-Act wins, total games and win rate use Riot MMR seasonal aggregates.
- HS, K/D, ACS, ADR and KAST require detailed match/round payloads. Riot retains only a limited Competitive update/detail window, so these metrics represent the detailed matches that remain available to the account.
- For the verified account sample, the display rules produce:
  - `13.24%` HS → `13.2%`;
  - `0.972...` K/D → `0.9`;
  - `105 / 230` wins → `45.6%` win rate.

### Build metadata

- App version: `4.0.4`
- Android version code: `76`
- iOS build number: `30`
- Production profile: `eas build --profile production --platform android`

[Unreleased]: https://github.com/GinzaTech/Vshop/compare/v4.1.8...HEAD
[4.1.8]: https://github.com/GinzaTech/Vshop/compare/v4.1.7...v4.1.8
[4.1.7]: https://github.com/GinzaTech/Vshop/compare/v4.1.6...v4.1.7
[4.1.6]: https://github.com/GinzaTech/Vshop/compare/v4.1.5...v4.1.6
[4.1.5]: https://github.com/GinzaTech/Vshop/compare/v4.1.4...v4.1.5
[4.1.4]: https://github.com/GinzaTech/Vshop/compare/v4.1.3...v4.1.4
[4.1.3]: https://github.com/GinzaTech/Vshop/compare/v4.1.2...v4.1.3
[4.1.2]: https://github.com/GinzaTech/Vshop/compare/v4.1.1...v4.1.2
[4.1.1]: https://github.com/GinzaTech/Vshop/compare/v4.1.0...v4.1.1
[4.1.0]: https://github.com/GinzaTech/Vshop/compare/v4.0.4...v4.1.0
[4.0.4]: https://github.com/GinzaTech/Vshop/compare/V4.0.3...v4.0.4
