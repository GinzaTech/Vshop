# UI inventory — 2026-10-03

Baseline `8f13dc7`; branch `codex/ui-quality-audit-20261003`. Inventory is source evidence; it does not confer runtime PASS.

## Denominator and stack

26 screen routes + 2 layout routes; 90 UI implementation TSX files (69 components + 21 feature UI files). Platform alternatives are counted as implementation files, not duplicate product screens. Hooks, domain helpers and styles are enumerated separately below. React 19.2.3, RN 0.86.3, Expo 57.0.23/Router 57.0.21, Reanimated 4.5.1, RNGH 2.32.0, Skia 2.6.2, Paper 5.15.3, Zustand 5.0.14; resolved lockfile retained.

## Route/control/state map

| Route | Source | Entry | Existing test group | States/interactions |
|---|---|---|---|---|
| / | [source](../../app/index.tsx) | Bootstrap redirect/loading | startup-cache, root-bootstrap-route | cold/resume/auth/cache |
| /setup | [source](../../app/setup.tsx) | First run or logout | login-recovery | welcome→region→login, footer/keyboard |
| /reauth | [source](../../app/reauth.tsx) | Expired/add/switch account | riot-interactive-login, login-webview | idle/loading/error/retry; authentication is human |
| /language | [source](../../app/language.tsx) | Settings→language | phase3-visible-copy-i18n | radio→locale→Back, long translations |
| /session_handoff | [source](../../app/session_handoff.tsx) | Explicit handoff URL | mobile-handoff-screen | send/loading/error; real transfer blocked |
| /ui-qa?demo=1 | [source](../../app/ui-qa.tsx) | DEV explicit deep link | ui-qa, ui-qa-boundary | local picker/search/mutation/failure/reset/glass |
| /bundles | [source](../../app/(authenticated)/bundles.tsx) | Primary tab 1 | bundle-card, bundle-ownership | offers/loading/empty/error/cache/refresh |
| /shop | [source](../../app/(authenticated)/shop.tsx) | Primary tab 2 | glass-shop-gallery-cards, wishlist-recovery | daily offers/refresh/wishlist/media popup |
| /night_market | [source](../../app/(authenticated)/night_market.tsx) | Primary tab 3 | night-market-glass-clearance | empty/revealed offer/cards/countdown/refresh |
| /profile | [source](../../app/(authenticated)/profile.tsx) | Primary tab 4; bootstrap | profile-fetch-hook, ui-qa, player-info-view | loadout/skins/collection→picker/chroma; hero→Overview/Details→Act |
| /settings | [source](../../app/(authenticated)/settings.tsx) | Primary tab 5 | account-session, recovery-update-ui | account menu/options/recovery/menu→secondary |
| /equip | [source](../../app/(authenticated)/equip.tsx) | Settings→equipment | account-info-screens | search/weapon/skin selection preview |
| /accessories | [source](../../app/(authenticated)/accessories.tsx) | Settings→accessories | account-info-screens | offer list/empty/refresh |
| /gallery | [source](../../app/(authenticated)/gallery.tsx) | Settings→gallery | gallery-filter, account-info-screens | search/filter/grid/preview |
| /agent | [source](../../app/(authenticated)/agent.tsx) | Settings→agents | account-info-screens | role filters/grid/details |
| /crosshair | [source](../../app/(authenticated)/crosshair.tsx) | Settings→crosshair | account-info-screens | search/code/copy/preview; clipboard external action |
| /leaderboard | [source](../../app/(authenticated)/leaderboard.tsx) | Settings→leaderboard | leaderboard-screen-lifecycle | Act/search/loading/refresh/stale request |
| /combat | [source](../../app/(authenticated)/combat.tsx) | Settings→combat | combat-screen-lifecycle, party-screen | no-game/party/pregame/loading; real mutations excluded |
| /combat_session | [source](../../app/(authenticated)/combat_session.tsx) | Combat→current match | combat-store, screen-orientation | landscape/live data/intel; no active match available |
| /friends | [source](../../app/(authenticated)/friends.tsx) | Settings/Combat→friends | friend-search, friend-presence | search/presence/row→chat; real invites excluded |
| /chat/[friendId] | [source](../../app/chat/[friendId].tsx) | Friends→chat row | xmpp-buffer | message list/input/TLS; real send excluded |
| /history | [source](../../app/(authenticated)/history.tsx) | Settings→history; DEV demo | match-archive, match-card | loading/empty/error/refresh/pagination→match |
| /match_details/[id] | [source](../../app/(authenticated)/match_details/[id].tsx) | History→match; DEV fixture | match-details-screen, match-detail-accessibility | scoreboard/performance/rounds/media/Back |
| /contracts | [source](../../app/(authenticated)/contracts.tsx) | Registered secondary; no in-app entry found | account-info-screens | progress/missions/loading/empty |
| /item_upgrades | [source](../../app/(authenticated)/item_upgrades.tsx) | Registered secondary; no in-app entry found | account-info-screens | search/expand/level/chroma; real upgrade excluded |
| /about | [source](../../app/(authenticated)/about.tsx) | Registered secondary; no in-app entry found | account-info-screens | config/status/link/overrides |

## Shared surfaces and overlays

- Primary retained navigation: LiquidNavigationShell, FloatingTabBar, lens/material, collapse/expand (long press Settings), fixed tab timing, history and delayed scene touch gates.
- Profile: hero header, equipment pager, card/title/weapon/spray/flex pickers, nested chroma, collection export, Act chips, Overview/Details, graph/agent/map breakdown. Export permissions/capture are mocked in regression; real photo save is excluded.
- Party: selectors, friend rail, member cards, agent select modal, invite form, chat panel; mutations tested via controlled mocks.
- MediaPopup: video/preview/overlay/dismiss/share with fixture media where possible. Paper Portal globally hosts modal content.
- UpdatePopup, LoadingScreen, ErrorBoundary, RecoveryUpdateActions, BatteryOptimizationWarning; recovery controls have source tests, live update application is outside this run.
- Shared button, press feedback, empty card, PageIntro, refresh control, image cache, grids, glass decoration/backdrop, GPU charts, semantic icons; token sources are DesignSystem, Motion, MatchTheme.
- Forms: onboarding region/login, picker queries, equipment/gallery/crosshair search, leaderboard/filter, friends/chat/invite, account switch and language selection.
- States: initial/loading/partial/cache/success/empty/error/retry/refresh/saving/disabled/offline/expired, with account and generation guards. Unsupported combinations stay N/A with reason in matrix.

## Actual implementation modules (90)

| File | Domain |
|---|---|
| [components/AppWarmup.tsx](../../components/AppWarmup.tsx) | components |
| [components/BatteryOptimizationWarning.tsx](../../components/BatteryOptimizationWarning.tsx) | components |
| [components/BundleImage.tsx](../../components/BundleImage.tsx) | components |
| [components/BundleItem.tsx](../../components/BundleItem.tsx) | components |
| [components/CachedImage.tsx](../../components/CachedImage.tsx) | components |
| [components/Combat.tsx](../../components/Combat.tsx) | components |
| [components/Countdown.tsx](../../components/Countdown.tsx) | components |
| [components/CurrencyIcon.tsx](../../components/CurrencyIcon.tsx) | components |
| [components/ErrorBoundary.tsx](../../components/ErrorBoundary.tsx) | components |
| [components/GalleryAgent.tsx](../../components/GalleryAgent.tsx) | components |
| [components/GalleryEquip.tsx](../../components/GalleryEquip.tsx) | components |
| [components/GalleryProfile.tsx](../../components/GalleryProfile.tsx) | components |
| [components/GalleryWeapon.tsx](../../components/GalleryWeapon.tsx) | components |
| [components/Loading.tsx](../../components/Loading.tsx) | components |
| [components/LoadingScreen.tsx](../../components/LoadingScreen.tsx) | components |
| [components/LoginWebView.tsx](../../components/LoginWebView.tsx) | components |
| [components/LoginWebView.web.tsx](../../components/LoginWebView.web.tsx) | components |
| [components/match-detail/EconomyChart.tsx](../../components/match-detail/EconomyChart.tsx) | components/match-detail |
| [components/match-detail/MatchDetailHeader.tsx](../../components/match-detail/MatchDetailHeader.tsx) | components/match-detail |
| [components/match-detail/MatchDetailTabs.tsx](../../components/match-detail/MatchDetailTabs.tsx) | components/match-detail |
| [components/match-detail/PerformanceStats.tsx](../../components/match-detail/PerformanceStats.tsx) | components/match-detail |
| [components/match-detail/PerformanceTab.tsx](../../components/match-detail/PerformanceTab.tsx) | components/match-detail |
| [components/match-detail/PlayerPerformanceSummary.tsx](../../components/match-detail/PlayerPerformanceSummary.tsx) | components/match-detail |
| [components/match-detail/RoundTimeline.tsx](../../components/match-detail/RoundTimeline.tsx) | components/match-detail |
| [components/match-detail/ScoreboardTable.tsx](../../components/match-detail/ScoreboardTable.tsx) | components/match-detail |
| [components/match-detail/StickyShareBar.tsx](../../components/match-detail/StickyShareBar.tsx) | components/match-detail |
| [components/match-detail/TeamAgentStrip.tsx](../../components/match-detail/TeamAgentStrip.tsx) | components/match-detail |
| [components/matches/DailyMatchSummaryCard.tsx](../../components/matches/DailyMatchSummaryCard.tsx) | components/matches |
| [components/matches/MatchCard.tsx](../../components/matches/MatchCard.tsx) | components/matches |
| [components/matches/MatchHistoryHeader.tsx](../../components/matches/MatchHistoryHeader.tsx) | components/matches |
| [components/matches/MatchImage.tsx](../../components/matches/MatchImage.tsx) | components/matches |
| [components/matches/MatchStates.tsx](../../components/matches/MatchStates.tsx) | components/matches |
| [components/MobileAccountMirrorPanel.tsx](../../components/MobileAccountMirrorPanel.tsx) | components |
| [components/MobileAccountMirrorPanel.web.tsx](../../components/MobileAccountMirrorPanel.web.tsx) | components |
| [components/NightMarketItem.tsx](../../components/NightMarketItem.tsx) | components |
| [components/PlausibleProvider.tsx](../../components/PlausibleProvider.tsx) | components |
| [components/popups/equipHelpers.tsx](../../components/popups/equipHelpers.tsx) | components/popups |
| [components/popups/MediaPopup.tsx](../../components/popups/MediaPopup.tsx) | components/popups |
| [components/popups/UpdatePopup.tsx](../../components/popups/UpdatePopup.tsx) | components/popups |
| [components/profile/CollectionCheckerExport.tsx](../../components/profile/CollectionCheckerExport.tsx) | components/profile |
| [components/profile/CollectionCheckerExport.web.tsx](../../components/profile/CollectionCheckerExport.web.tsx) | components/profile |
| [components/profile/CompactPlayerProfileCard.tsx](../../components/profile/CompactPlayerProfileCard.tsx) | components/profile |
| [components/profile/PlayerInfoView.tsx](../../components/profile/PlayerInfoView.tsx) | components/profile |
| [components/profile/PlayerStatsDashboard.tsx](../../components/profile/PlayerStatsDashboard.tsx) | components/profile |
| [components/profile/RankSplitGroup.tsx](../../components/profile/RankSplitGroup.tsx) | components/profile |
| [components/profile/TypewriterSwapText.tsx](../../components/profile/TypewriterSwapText.tsx) | components/profile |
| [components/ShopAccessoryItem.tsx](../../components/ShopAccessoryItem.tsx) | components |
| [components/ShopItem.tsx](../../components/ShopItem.tsx) | components |
| [components/SkinShowcaseCard.tsx](../../components/SkinShowcaseCard.tsx) | components |
| [components/ui/AppIcon.tsx](../../components/ui/AppIcon.tsx) | components/ui |
| [components/ui/AppIcon.web.tsx](../../components/ui/AppIcon.web.tsx) | components/ui |
| [components/ui/AppRefreshControl.tsx](../../components/ui/AppRefreshControl.tsx) | components/ui |
| [components/ui/AppRefreshControl.web.tsx](../../components/ui/AppRefreshControl.web.tsx) | components/ui |
| [components/ui/AppViewport.tsx](../../components/ui/AppViewport.tsx) | components/ui |
| [components/ui/EmptyStateCard.tsx](../../components/ui/EmptyStateCard.tsx) | components/ui |
| [components/ui/GlassCard.tsx](../../components/ui/GlassCard.tsx) | components/ui |
| [components/ui/GpuLineChartCanvas.tsx](../../components/ui/GpuLineChartCanvas.tsx) | components/ui |
| [components/ui/GpuLineChartCanvas.web.tsx](../../components/ui/GpuLineChartCanvas.web.tsx) | components/ui |
| [components/ui/InfoPill.tsx](../../components/ui/InfoPill.tsx) | components/ui |
| [components/ui/LiquidGlassBackdrop.tsx](../../components/ui/LiquidGlassBackdrop.tsx) | components/ui |
| [components/ui/LiquidGlassSurface.tsx](../../components/ui/LiquidGlassSurface.tsx) | components/ui |
| [components/ui/PageIntro.tsx](../../components/ui/PageIntro.tsx) | components/ui |
| [components/ui/PaperIcon.tsx](../../components/ui/PaperIcon.tsx) | components/ui |
| [components/ui/PressFeedback.tsx](../../components/ui/PressFeedback.tsx) | components/ui |
| [components/ui/PrimaryTabScene.tsx](../../components/ui/PrimaryTabScene.tsx) | components/ui |
| [components/ui/RecoveryUpdateActions.tsx](../../components/ui/RecoveryUpdateActions.tsx) | components/ui |
| [components/ui/SecondaryTabScene.tsx](../../components/ui/SecondaryTabScene.tsx) | components/ui |
| [components/ui/TwoColumnGrid.tsx](../../components/ui/TwoColumnGrid.tsx) | components/ui |
| [components/ui/ValorantButton.tsx](../../components/ui/ValorantButton.tsx) | components/ui |
| [features/combat/CombatSessionScreen.tsx](../../features/combat/CombatSessionScreen.tsx) | features/combat |
| [features/navigation/FloatingTabBar.tsx](../../features/navigation/FloatingTabBar.tsx) | features/navigation |
| [features/navigation/LiquidNavigationShell.tsx](../../features/navigation/LiquidNavigationShell.tsx) | features/navigation |
| [features/navigation/NativeRefraction.android.tsx](../../features/navigation/NativeRefraction.android.tsx) | features/navigation |
| [features/navigation/NativeRefraction.tsx](../../features/navigation/NativeRefraction.tsx) | features/navigation |
| [features/navigation/NavigationBarBackdrop.tsx](../../features/navigation/NavigationBarBackdrop.tsx) | features/navigation |
| [features/navigation/NavigationLensMaterial.tsx](../../features/navigation/NavigationLensMaterial.tsx) | features/navigation |
| [features/party/AgentSelectModal.tsx](../../features/party/AgentSelectModal.tsx) | features/party |
| [features/party/PartyChatPanel.tsx](../../features/party/PartyChatPanel.tsx) | features/party |
| [features/party/PartyFriendRail.tsx](../../features/party/PartyFriendRail.tsx) | features/party |
| [features/party/PartyInviteControls.tsx](../../features/party/PartyInviteControls.tsx) | features/party |
| [features/party/PartyMemberCard.tsx](../../features/party/PartyMemberCard.tsx) | features/party |
| [features/party/PartyScreen.tsx](../../features/party/PartyScreen.tsx) | features/party |
| [features/party/PartySelectors.tsx](../../features/party/PartySelectors.tsx) | features/party |
| [features/profile/CompactProfileSkinCard.tsx](../../features/profile/CompactProfileSkinCard.tsx) | features/profile |
| [features/profile/ProfileEquipmentSections.tsx](../../features/profile/ProfileEquipmentSections.tsx) | features/profile |
| [features/profile/ProfileHeroCard.tsx](../../features/profile/ProfileHeroCard.tsx) | features/profile |
| [features/profile/ProfileIdentitySection.tsx](../../features/profile/ProfileIdentitySection.tsx) | features/profile |
| [features/profile/ProfilePickerModal.tsx](../../features/profile/ProfilePickerModal.tsx) | features/profile |
| [features/profile/ProfileScreen.tsx](../../features/profile/ProfileScreen.tsx) | features/profile |
| [features/profile/ProfileSegmentedControl.tsx](../../features/profile/ProfileSegmentedControl.tsx) | features/profile |

## UI hooks, state and helper modules

- [components/LoginWebView.types.ts](../../components/LoginWebView.types.ts)
- [components/profile/player-stats-data.ts](../../components/profile/player-stats-data.ts)
- [components/ui/app-icon-lucide.ts](../../components/ui/app-icon-lucide.ts)
- [components/ui/app-icon-registry.ts](../../components/ui/app-icon-registry.ts)
- [components/ui/app-icon-types.ts](../../components/ui/app-icon-types.ts)
- [components/ui/GpuLineChartCanvas.types.ts](../../components/ui/GpuLineChartCanvas.types.ts)
- [components/ui/liquid-glass-native-policy.ts](../../components/ui/liquid-glass-native-policy.ts)
- [features/combat/combat-session.styles.ts](../../features/combat/combat-session.styles.ts)
- [features/combat/match-score.ts](../../features/combat/match-score.ts)
- [features/combat/session-insights.ts](../../features/combat/session-insights.ts)
- [features/combat/useCombatMatchPerformance.ts](../../features/combat/useCombatMatchPerformance.ts)
- [features/combat/useCombatPlayerIntel.ts](../../features/combat/useCombatPlayerIntel.ts)
- [features/combat/useCombatPoll.ts](../../features/combat/useCombatPoll.ts)
- [features/combat/useCombatScreenActivity.ts](../../features/combat/useCombatScreenActivity.ts)
- [features/combat/useCombatSessionPolling.ts](../../features/combat/useCombatSessionPolling.ts)
- [features/combat/useCombatSnapshot.ts](../../features/combat/useCombatSnapshot.ts)
- [features/matches/cache-policy.ts](../../features/matches/cache-policy.ts)
- [features/matches/detail-actions.ts](../../features/matches/detail-actions.ts)
- [features/matches/history-actions.ts](../../features/matches/history-actions.ts)
- [features/matches/hydrate-batch.ts](../../features/matches/hydrate-batch.ts)
- [features/matches/recording-state.ts](../../features/matches/recording-state.ts)
- [features/matches/request-runtime.ts](../../features/matches/request-runtime.ts)
- [features/matches/season-actions.ts](../../features/matches/season-actions.ts)
- [features/matches/season-mmr-summary.ts](../../features/matches/season-mmr-summary.ts)
- [features/matches/season-summary.ts](../../features/matches/season-summary.ts)
- [features/matches/store-types.ts](../../features/matches/store-types.ts)
- [features/navigation/native-refraction-policy.ts](../../features/navigation/native-refraction-policy.ts)
- [features/navigation/native-refraction.types.ts](../../features/navigation/native-refraction.types.ts)
- [features/navigation/navigation-model.ts](../../features/navigation/navigation-model.ts)
- [features/navigation/navigation-optics.ts](../../features/navigation/navigation-optics.ts)
- [features/navigation/NavigationSceneContext.ts](../../features/navigation/NavigationSceneContext.ts)
- [features/navigation/useLiquidLens.ts](../../features/navigation/useLiquidLens.ts)
- [features/navigation/useNavigationCollapse.ts](../../features/navigation/useNavigationCollapse.ts)
- [features/party/party-model.ts](../../features/party/party-model.ts)
- [features/party/party-presence.ts](../../features/party/party-presence.ts)
- [features/party/party-types.ts](../../features/party/party-types.ts)
- [features/party/party.styles.ts](../../features/party/party.styles.ts)
- [features/party/usePartyController.ts](../../features/party/usePartyController.ts)
- [features/party/usePregameAgentFlow.ts](../../features/party/usePregameAgentFlow.ts)
- [features/profile/confirm-loadout.ts](../../features/profile/confirm-loadout.ts)
- [features/profile/profile-derived-data.ts](../../features/profile/profile-derived-data.ts)
- [features/profile/profile-expression.styles.ts](../../features/profile/profile-expression.styles.ts)
- [features/profile/profile-loadout-queue-registry.ts](../../features/profile/profile-loadout-queue-registry.ts)
- [features/profile/profile-loadout-queue.ts](../../features/profile/profile-loadout-queue.ts)
- [features/profile/profile-loadout.ts](../../features/profile/profile-loadout.ts)
- [features/profile/profile-refresh-data.ts](../../features/profile/profile-refresh-data.ts)
- [features/profile/profile-screen.styles.ts](../../features/profile/profile-screen.styles.ts)
- [features/profile/profile-season-data.ts](../../features/profile/profile-season-data.ts)
- [features/profile/profile-transition.ts](../../features/profile/profile-transition.ts)
- [features/profile/profile-visual-policy.ts](../../features/profile/profile-visual-policy.ts)
- [features/profile/useProfileCollapsibleHeader.ts](../../features/profile/useProfileCollapsibleHeader.ts)
- [features/profile/useProfileCollection.ts](../../features/profile/useProfileCollection.ts)
- [features/profile/useProfileDashboardTabStore.ts](../../features/profile/useProfileDashboardTabStore.ts)
- [features/profile/useProfileFetch.ts](../../features/profile/useProfileFetch.ts)
- [features/profile/useProfileHeroData.ts](../../features/profile/useProfileHeroData.ts)
- [features/profile/useProfileLoadoutData.ts](../../features/profile/useProfileLoadoutData.ts)
- [features/profile/useProfileMotion.ts](../../features/profile/useProfileMotion.ts)
- [features/profile/useProfileMutations.ts](../../features/profile/useProfileMutations.ts)
- [features/profile/useProfilePager.ts](../../features/profile/useProfilePager.ts)
- [features/profile/useProfilePickerOptions.ts](../../features/profile/useProfilePickerOptions.ts)
- [features/profile/useProfilePickers.ts](../../features/profile/useProfilePickers.ts)
- [features/profile/useProfileSession.ts](../../features/profile/useProfileSession.ts)
- [features/profile/useProfileState.ts](../../features/profile/useProfileState.ts)
- [hooks/useAboutScreenData.ts](../../hooks/useAboutScreenData.ts)
- [hooks/useAccountScreenData.ts](../../hooks/useAccountScreenData.ts)
- [hooks/useAccountStore.ts](../../hooks/useAccountStore.ts)
- [hooks/useAsyncRefresh.ts](../../hooks/useAsyncRefresh.ts)
- [hooks/useBundleOwnership.ts](../../hooks/useBundleOwnership.ts)
- [hooks/useCombatStore.ts](../../hooks/useCombatStore.ts)
- [hooks/useContractsScreenData.ts](../../hooks/useContractsScreenData.ts)
- [hooks/useFeatureStore.ts](../../hooks/useFeatureStore.ts)
- [hooks/useLeaderboardData.ts](../../hooks/useLeaderboardData.ts)
- [hooks/useMatchDetailsData.ts](../../hooks/useMatchDetailsData.ts)
- [hooks/useMatchStore.ts](../../hooks/useMatchStore.ts)
- [hooks/useMobileAccountMirror.ts](../../hooks/useMobileAccountMirror.ts)
- [hooks/useMobileMirrorStore.ts](../../hooks/useMobileMirrorStore.ts)
- [hooks/useMotionPreference.ts](../../hooks/useMotionPreference.ts)
- [hooks/usePrimaryTabPreload.ts](../../hooks/usePrimaryTabPreload.ts)
- [hooks/useProfileCacheStore.ts](../../hooks/useProfileCacheStore.ts)
- [hooks/useRecoveryUpdate.ts](../../hooks/useRecoveryUpdate.ts)
- [hooks/useRiotInteractiveLogin.ts](../../hooks/useRiotInteractiveLogin.ts)
- [hooks/useRiotScreenSession.ts](../../hooks/useRiotScreenSession.ts)
- [hooks/useRiotWebAuthBroker.ts](../../hooks/useRiotWebAuthBroker.ts)
- [hooks/useStartupRecoveryWatchdog.ts](../../hooks/useStartupRecoveryWatchdog.ts)
- [hooks/useSystemChromeStore.ts](../../hooks/useSystemChromeStore.ts)
- [hooks/useUserStore.ts](../../hooks/useUserStore.ts)
- [hooks/useWishlistStore.ts](../../hooks/useWishlistStore.ts)

## Access/verification gaps

Three registered routes (contracts/item_upgrades/about) have no discovered in-app entry; inventory gaps do not prove removed functionality. Chat/export live paths, real account mutations, native lens module parity, TalkBack, high font scaling and comparable frame tests require environment/evidence listed in results. No new theme, portrait/landscape support, glass material or assets were introduced.
