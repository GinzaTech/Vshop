# Changelog

All notable changes to VShop are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic app versions with independent Android and iOS build numbers.

## [Unreleased]

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
- The final EAS production build and GitHub Release asset are pending this source commit. Completed candidate build `ebcdfbea-913a-4b67-84d1-9b00c2a81382` is superseded because it predates the malformed-archive guard and Expo SDK 57 patch alignment; it is not the 4.1.8 release artifact.
- Final build ID, artifact URL, SHA-256 and signature evidence will be recorded in a follow-up documentation commit after verification.

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
