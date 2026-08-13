# Changelog

All notable changes to VShop are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic app versions with independent Android and iOS build numbers.

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

[4.1.0]: https://github.com/GinzaTech/Vshop/compare/v4.0.4...v4.1.0
[4.0.4]: https://github.com/GinzaTech/Vshop/compare/V4.0.3...v4.0.4
