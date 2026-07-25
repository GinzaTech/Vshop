# Vshop - Directory Structure & Data Flow

## Tổng quan

**Vshop** là ứng dụng companion cho VALORANT (Expo React Native), cho phép xem shop daily, night market, bundles, quản lý loadout/trang bị, xem match history, competitive rank, chat XMPP với bạn bè, và quản lý combat session.

### Tech Stack
- **Framework**: React Native (Expo SDK 51)
- **Routing**: Expo Router (file-based routing)
- **State Management**: Zustand + persist (AsyncStorage)
- **UI Library**: React Native Paper
- **API**: Axios → Riot Games API (Valorant)
- **Chat**: XMPP (WebSocket TCP) qua `react-native-tcp-socket`
- **i18n**: i18next + react-i18next (18 ngôn ngữ)
- **Analytics**: Plausible
- **Payments**: Stripe
- **Background**: `expo-background-fetch` (wishlist notifications)

---

## CÂY THƯ MỤC CHI TIẾT

```
Vshop/
│
├── app.json                          # Expo config
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config (alias ~/)
├── babel.config.js                   # Babel config
├── metro.config.js                   # Metro bundler config
├── eas.json                          # EAS Build config
├── index.ts                          # Entry point + background fetch headless task
├── index.js                          # Fallback entry
│
├── app/                              # ═══ ROUTES (Expo Router file-based) ═══
│   ├── _layout.tsx                   # Root layout: polyfills, i18n, providers, session restore
│   ├── index.tsx                     # Loading splash (redirect internal)
│   ├── language.tsx                  # Language picker (RadioButton list)
│   ├── reauth.tsx                    # Re-authentication screen
│   ├── setup.tsx                     # 3-page onboarding: welcome → region → login
│   │
│   ├── (authenticated)/              # ═══ AUTH-REQUIRED ROUTES ═══
│   │   ├── _layout.tsx               # Tab navigator (floating tab bar) + AppWarmup + MediaPopup
│   │   ├── shop.tsx                  # Daily shop: skin grid, search, wishlist filter, countdown
│   │   ├── bundles.tsx               # Featured & accessory bundles
│   │   ├── night_market.tsx          # Night market items (discounts)
│   │   ├── accessories.tsx           # Accessory shop (buddies, cards, sprays, titles)
│   │   ├── profile.tsx               # Full profile: loadout, skins, collection, picker modal
│   │   ├── gallery.tsx               # Weapon skin gallery (all skins, search, wishlist)
│   │   ├── equip.tsx                 # Equipment browser (weapons, buddies, sprays, cards, titles)
│   │   ├── agent.tsx                 # Agent gallery (role filter, ability detail)
│   │   ├── combat.tsx                # Combat session: party, lock agent, chat, invite
│   │   ├── combat_session.tsx        # Combat session detail (scoreboard, rounds)
│   │   ├── friends.tsx               # Friends list (XMPP presence, status)
│   │   ├── history.tsx               # Match history (KDA, RR, rank ring, scoreboard)
│   │   ├── match_details/[id].tsx    # Single match detail (players, rounds, economy)
│   │   ├── contracts.tsx             # Battle pass & event pass progress
│   │   ├── leaderboard.tsx           # Competitive leaderboard (search, season filter)
│   │   ├── item_upgrades.tsx         # Skin upgrades (Radianite levels & chromas)
│   │   ├── crosshair.tsx             # Crosshair code browser & editor
│   │   ├── settings.tsx              # Settings: notification, screenshot, update, logout
│   │   └── about.tsx                 # Account info (PUUID, email, region, season)
│   │
│   └── chat/
│       └── [friendId].tsx            # XMPP chat screen (friend messaging)
│
├── components/                       # ═══ REUSABLE COMPONENTS ═══
│   ├── ui/                           # Design system primitives
│   │   ├── GlassCard.tsx             # Glass morphism card (border + shadow + bg)
│   │   ├── AnimatedEntrance.tsx      # Fade + scale entrance animation
│   │   ├── ScreenEntrance.tsx        # Container wrapper with entrance animation
│   │   ├── EmptyStateCard.tsx        # Empty state placeholder
│   │   ├── InfoPill.tsx              # Badge/pill component
│   │   ├── PageIntro.tsx             # Page title + subtitle
│   │   ├── SectionHeader.tsx         # Section title + meta + optional action
│   │   ├── TwoColumnGrid.tsx         # 2-column flexWrap grid
│   │   └── ValorantButton.tsx        # Valorant-styled button
│   │
│   ├── ShopItem.tsx                  # Daily shop skin card (price, tier badge, wishlist)
│   ├── ShopAccessoryItem.tsx         # Accessory shop item card
│   ├── BundleImage.tsx               # Bundle hero image with overlay
│   ├── BundleItem.tsx                # Item inside bundle card
│   ├── NightMarketItem.tsx           # Night market discount card
│   ├── SkinShowcaseCard.tsx          # Full skin render showcase
│   ├── AccessoryShowcaseCard.tsx     # Accessory display card
│   ├── GalleryWeapon.tsx             # Weapon skin card in gallery (wishlist toggle)
│   ├── GalleryAgent.tsx              # Agent grid + modal (role filter, ability detail)
│   ├── GalleryEquip.tsx              # Equipment card (equip popup + animation)
│   ├── GalleryProfile.tsx            # Profile tab: loadout categories, weapon, spray, identity
│   ├── Countdown.tsx                 # Countdown timer (shop rotation)
│   ├── CurrencyIcon.tsx              # Currency icons (VP, RAD, FAG, KC)
│   ├── LoginWebView.tsx              # Riot OAuth WebView (buildAuthenticatedUser)
│   ├── Loading.tsx                   # Loading spinner
│   ├── AppWarmup.tsx                 # Warmup: preload images & assets on mount
│   ├── BatteryOptimizationWarning.tsx # Warning to disable battery optimization
│   ├── PlausibleProvider.tsx         # Analytics pageview provider
│   ├── Combat.tsx                    # Hook: useCombat (party, lock agent, session)
│   │
│   ├── popups/
│   │   ├── MediaPopup.tsx            # Full-screen media viewer (skin image/video)
│   │   ├── UpdatePopup.tsx           # App update dialog (OTA/native)
│   │   └── equipHelpers.tsx          # Helper: EQUIPMENT_SECTIONS, filter, sort, build
│   │
│   └── providers/
│       ├── StripeProvider.tsx         # Stripe payment wrapper (detect platform)
│       ├── StripeProvider.native.tsx  # Native StripeProvider
│       └── StripeProvider.web.tsx    # Web StripeProvider
│
├── hooks/                            # ═══ ZUSTAND STORES ═══
│   ├── useUserStore.ts               # User session: auth, shop, balances, progress
│   ├── useWishlistStore.ts           # Wishlist: skinIds, notification toggle
│   ├── useMatchStore.ts              # Match history: matches, details, fetch + persist
│   ├── useCombatStore.ts             # Combat session: party, pregame, live match
│   ├── useProfileCacheStore.ts       # Profile warm cache: loadout, owned, rank
│   └── useFeatureStore.ts            # Feature flags: screenshot mode
│
├── utils/                            # ═══ CORE LOGIC ═══
│   ├── valorant-api.ts              # ⭐ ALL Valorant API endpoints (1553 lines)
│   ├── valorant-assets.ts           # Asset loader: skins, agents, buddies, maps, tiers
│   ├── auth-session.ts              # Session resume + buildAuthenticatedUser
│   ├── session-invalidator.ts       # Auth failure detection + handler
│   ├── api-logger.ts                # Axios request/response/error logging
│   ├── chat-service.ts              # XMPP service: init, connect, roster, party chat
│   ├── chat-store.ts                # Zustand store: chat state, friends, messages
│   ├── chat-auth.ts                 # PAS token + chat affinity helpers
│   ├── xmpp-client.ts              # XMPPClient class (WebSocket → XMPP)
│   ├── content-tier.ts             # ContentTier visual definitions + priority
│   ├── profile-cache.ts            # Profile warm cache: loadout, owned, competitive rank
│   ├── preload.ts                  # Image preloader (batch, cache policy, warmup)
│   ├── misc.ts                     # Constants (VCurrencies, VItemTypes, regions), URI parsers
│   ├── localization.ts             # i18next init (18 languages), VAPILang getter
│   ├── storage.ts                  # App storage abstraction (AsyncStorage/localStorage)
│   ├── background-fetch.ts         # Platform-aware background fetch wrapper
│   ├── background-fetch.native.ts  # Native background fetch
│   ├── background-fetch.web.ts     # Web background fetch stub
│   ├── wishlist.ts                 # Background task: wishlist check + notification
│   ├── plausible.ts                # Plausible analytics capture
│   ├── app-update.ts               # GitHub release check + OTA update
│   ├── cookies.ts                  # Cookie manager (clear all)
│   ├── cookies.native.ts           # Native cookie clear
│   ├── cookies.web.ts              # Web cookie clear
│   ├── polyfills.ts                # Promise.allSettled polyfill for Hermes
│   ├── runtime.ts                  # isExpoGo detection
│   ├── riot-local-chat.ts          # Riot client local API chat
│   ├── valorant-session.ts         # Session helpers: queue labels, party capacity
│   └── vshop-api.ts                # (empty) Future VShop backend API
│
├── types/                           # ═══ TYPE DEFINITIONS ═══
│   ├── App.d.ts                     # App-level interfaces (shop items, gallery, etc.)
│   ├── valorant-api.d.ts            # Valorant API response types
│   ├── valorant-assets.d.ts         # Valorant asset types (skins, agents, etc.)
│   ├── vshop-api.d.ts               # (empty) VShop API types
│   ├── theme.d.ts                   # React Native Paper theme augmentation
│   └── https-browserify.d.ts        # HTTPS module type declaration
│
├── constants/                       # ═══ DESIGN CONSTANTS ═══
│   ├── Colors.ts                    # Color palette
│   └── DesignSystem.ts              # COLORS, RADIUS, GLOBAL_STYLES
│
├── assets/                          # ═══ STATIC ASSETS ═══
│   ├── images/                      # Duelist.png, Controller.png, Initiator.png, Sentinel.png,
│   │                                # mockup.png, noimage.png, vp.png, rad.png, kc.png, icon.png, etc.
│   └── i18n/                        # Translation JSON (18 languages: ar, de, en, es, fr, it,
│                                    # jp, ko, no, pl, pt, ru, th, tr, uk, vi, zh-Hans, zh-Hant)
│
├── AGENTS.md                        # AI agent instructions
├── README.md                        # Project README
├── LICENSE                          # License file
│
├── android/                         # Native Android project (EAS Build)
├── dist/                            # Expo web build output
├── test/                            # Test files
└── .eslintrc.js                     # ESLint config
```

---

## LUỒNG DỮ LIỆU CHI TIẾT

### 1. Khởi động App

```
index.ts (registerHeadlessTask)
    │
    ▼
app/_layout.tsx
    │
    ├── polyfills.ts (Promise.allSettled)
    ├── localization.ts (i18n init 18 languages)
    ├── GestureHandlerRootView + PaperProvider + ThemeProvider
    ├── PlausibleProvider (pageview tracking)
    ├── StripeProvider
    ├── SplashScreen.preventAutoHideAsync()
    │
    ├── [HYDRATED?] ──NO──► SplashScreen.hideAsync() → /setup
    │
    └── [HYDRATED] ──YES──► canResumeUserSession()?
              │
              ├── YES: buildAuthenticatedUser()
              │   ├── loadAssets() + loadAgent() (cache file system)
              │   ├── getEntitlementsToken() + getUserId()
              │   ├── getUsername() + getShop() + getProgress() + getBalances()
              │   ├── parseShop() (main, bundles, nightMarket, accessory)
              │   ├── useUserStore.setUser(full user)
              │   ├── fetch matches → useMatchStore
              │   ├── fetch combat session → useCombatStore
              │   ├── fetch profile warm cache → useProfileCacheStore
              │   └── SplashScreen.hideAsync() → /(authenticated)/
              │
              └── NO: SplashScreen.hideAsync() → /reauth
```

### 2. Setup / Auth Flow

```
/setup (3 horizontal pages)
    │
    ├── Page 1: Welcome (mockup image + promotional text)
    ├── Page 2: Region select (RadioButton: eu/na/ap/kr)
    │            └── lưu region vào AsyncStorage
    └── Page 3: LoginWebView.tsx
                └── WebView → auth.riotgames.com OAuth 2.0
                    └── parse callback URI → access_token + id_token
                        └── buildAuthenticatedUser() → setUser()
                            └── redirect → /(authenticated)/
```

### 3. Authenticated Tab Flow

```
/(authenticated)/_layout.tsx
    │
    ├── FloatingTabBar (5 tabs)
    │   ├── bundles     → /bundles
    │   ├── shop        → /shop
    │   ├── profile     → /profile
    │   ├── night_market → /night_market
    │   └── settings    → /settings
    │
    ├── Secondary routes (hidden from tab bar, href: null)
    │   ├── accessories, agent, combat, combat_session
    │   ├── crosshair, equip, gallery, history
    │   ├── contracts, leaderboard, item_upgrades
    │   ├── friends, about
    │   └── match_details/[id]
    │
    └── AppWarmup (preload catalog images)
    └── MediaPopup (full-screen media viewer)
```

### 4. Shop Flow

```
/shop
    ├── Lấy user.shops.main từ useUserStore
    ├── Search (filter by name)
    ├── Filter: all / wishlist
    ├── Sort by contentTierPriority (Ultra > Exclusive > Premium > Deluxe > Select)
    ├── Countdown timer (remaining seconds)
    ├── Balance display (VP)
    └── TwoColumnGrid → ShopItem → wishlist toggle
```

### 5. Profile / Loadout Flow

```
/profile
    ├── Hero section: name, tagline, level, region, rank
    ├── Balance cards: VP, RAD, KC
    ├── 3 tabs: Loadout | Skins | Collection
    │
    ├── LOADOUT TAB
    │   ├── Hiển thị tất cả vũ khí đang equip (skin, chroma, buddy, level)
    │   ├── Identity card (player card, title)
    │   ├── Sprays equipped
    │   └── Tap → Open picker → chọn skin/chroma/spray → updatePlayerLoadout()
    │
    ├── SKINS TAB
    │   ├── Danh sách skin đã sở hữu (từ ownedSkinItemIds)
    │   ├── Filter by weapon
    │   └── Search
    │
    └── COLLECTION TAB
        ├── Tất cả skin sở hữu, grouped by category
        ├── Filter by weapon
        └── Search
```

### 6. Chat / XMPP Flow

```
/friends → initChatService()
    │
    ├── getPASToken(accessToken)
    ├── resolveChatHost() → host (e.g. na2.chat.si.riotgames.com)
    ├── XMPPClient.connect() (WebSocket TCP port 5223)
    │   ├── sendInitialStream()
    │   ├── authenticate() (X-Riot-RSO-PAS)
    │   ├── bindResource() → startSession() → bootstrapSession()
    │   ├── setPresence() + requestRoster()
    │   └── processBuffer() (SASL, roster, messages, presence)
    │
    ├── onRoster → handleRoster() → resolveRosterNames() → setFriends()
    ├── onPresence → updateFriendPresence()
    ├── onMessage → addMessage()
    └── onGroupMessage → addPartyMessage()
```

### 7. Combat Session Flow

```
/combat
    ├── useCombat() hook
    │   ├── fetchSession() → getPartyPlayer + getPreGamePlayer + getCurrentGamePlayer
    │   ├── Nếu có party → getParty()
    │   ├── Nếu pregame → getPreGameMatch() + lock/select agent
    │   ├── Nếu live → getCurrentGameMatch()
    │   └── resolve player names → getPlayerNames()
    │
    ├── Role selector (Duelist/Controller/Initiator/Sentinel)
    ├── Agent grid → select agent → lock agent
    ├── Party code generate/join
    ├── Ready toggle
    └── Party chat (XMPP MUC)
```

### 8. Match History Flow

```
/history
    ├── useMatchStore.fetchMatches(user)
    │   ├── playerMatchHistory() → 20 competitive matches
    │   ├── getCompetitiveUpdates() → RR changes
    │   ├── fetchMatchDetails() per match
    │   │   ├── matchDetails() → players, teams, rounds
    │   │   ├── Tính KDA, ACS, headshot %, rounds won/lost
    │   │   ├── Agent info từ getAgent()
    │   │   ├── Map info từ getAssets().maps
    │   │   └── Rank info từ competitiveUpdates
    │   └── preloadImageUrls() (agent icons, map images, rank icons)
    │
    └── FlatList → MatchItem (RankProgressRing, banner, KDA, ACS)
```

### 9. Wishlist / Background Fetch Flow

```
/background-fetch (mỗi 15 phút)
    │
    ├── rehydrate useWishlistStore + useUserStore
    ├── getShop() → parseShop() → main shop
    ├── So sánh skinIds trong wishlist vs shop items
    ├── Nếu match → local notification
    └── Cập nhật lastChecked
```

### 10. State Persistence

```
Zustand persist stores:
    │
    ├── "user-session"        → useUserStore (user object)
    ├── "wishlist"            → useWishlistStore (skinIds, notificationEnabled)
    ├── "match-history-cache" → useMatchStore (matches, lastUpdated)
    └── "profile-warm-cache"  → useProfileCacheStore (cacheByAuth)

File system cache:
    ├── cacheDirectory/valorant_assets.json (skins, buddies, sprays, cards, titles, maps, tiers)
    └── cacheDirectory/valorant_agent.json (agents)

AsyncStorage keys:
    ├── "region"              → region override
    └── "language"            → i18n language
```

---

## API ENDPOINTS MAP (utils/valorant-api.ts)

| Function | Method | Endpoint | Purpose |
|----------|--------|----------|---------|
| getEntitlementsToken | POST | entitlements.auth.riotgames.com | Lấy entitlements JWT |
| getUserId | - | jwtDecode | Lấy sub (PUUID) từ access token |
| getUsername | PUT | pd.{region}.a.pvp.net/name-service | Lấy GameName + TagLine |
| getShop | POST | pd.{region}.a.pvp.net/storefront | Lấy storefront data |
| getBalances | GET | pd.{region}.a.pvp.net/wallet | Lấy VP, RAD, FAG, KC |
| getProgress | GET | pd.{region}.a.pvp.net/playerxp | Lấy account level + XP |
| reAuth | POST | auth.riotgames.com/api/v1/authorization | Riot OAuth re-auth |
| getMatchID | GET | glz-{region}-1.{region}.a.pvp.net/pregame | Lấy pregame match ID |
| lockAgent | POST | glz-{region}-1.{region}.a.pvp.net/pregame/lock | Lock agent |
| playerLoadout | GET | pd.{region}.a.pvp.net/playerloadout | Get current loadout |
| updatePlayerLoadout | PUT | pd.{region}.a.pvp.net/playerloadout | Update loadout |
| ownedItems | GET | pd.{region}.a.pvp.net/entitlements | Get owned items |
| playerMatchHistory | GET | pd.{region}.a.pvp.net/match-history | Get match list |
| matchDetails | GET | pd.{region}.a.pvp.net/match-details | Get match detail |
| getCompetitiveMMR | GET | pd.{region}.a.pvp.net/mmr | Get rank data |
| getCompetitiveUpdates | GET | pd.{region}.a.pvp.net/competitiveupdates | Get RR changes |
| getParty | GET | glz-{region}-1/parties | Get party info |
| getPartyPlayer | GET | glz-{region}-1/parties/players | Get player's party |
| getPreGamePlayer | GET | glz-{region}-1/pregame | Get pregame status |
| getPreGameMatch | GET | glz-{region}-1/pregame/match | Get pregame details |
| getCurrentGamePlayer | GET | glz-{region}-1/core-game | Get live game status |
| getCurrentGameMatch | GET | glz-{region}-1/core-game/match | Get live game details |
| getContracts | GET | pd.{region}.a.pvp.net/contracts | Get contract progress |
| getItemUpgrades | GET | pd.{region}.a.pvp.net/item-upgrades | Get skin upgrades |
| getContent | GET | shared.{region}.a.pvp.net/content | Get seasons/acts |
| getLeaderboard | GET | pd.{region}.a.pvp.net/leaderboards | Get leaderboard |
| getPlayerInfo | GET | auth.riotgames.com/userinfo | Get Riot account info |
| getRiotGeo | PUT | riot-geo.pas.si.riotgames.com | Get region affinity |
| getPASToken | GET | riot-geo.pas.si.riotgames.com/pas/chat | Get chat PAS token |
| getRiotClientConfig | GET | clientconfig.rpg.riotgames.com | Get client config |
| getPartyMucToken | GET | glz-{region}-1/parties/muctoken | Get MUC chat token |
| setPartyReady | POST | glz-{region}-1/parties/setReady | Set party ready state |
| generatePartyInviteCode | POST | glz-{region}-1/parties/invitecode | Generate invite code |
| joinPartyByCode | POST | glz-{region}-1/parties/joinbycode | Join party via code |
| enterMatchmakingQueue | POST | glz-{region}-1/parties/matchmaking/join | Enter queue |
| leaveMatchmakingQueue | POST | glz-{region}-1/parties/matchmaking/leave | Leave queue |
| removeFromParty | DELETE | glz-{region}-1/parties/players | Leave party |
| quitPreGameLobby | POST | glz-{region}-1/pregame/quit | Quit pregame |
| quitCurrentGame | POST | glz-{region}-1/core-game/quit | Quit live game |
| getPlayerNames | PUT | name-service | Resolve PUUID → name |

---

## STYLE CONVENTIONS

- **Layout**: ScrollView + padding 20px là pattern chung
- **Cards**: GlassCard → `GLOBAL_STYLES.glassContainer` + `RADIUS.card` (24)
- **Background**: `COLORS.BACKGROUND` (#f4f6f9)
- **Surface**: `COLORS.SURFACE` (#ffffff)
- **Text**: `COLORS.TEXT_PRIMARY` (#11181c) / `COLORS.TEXT_SECONDARY` (#687076)
- **Chips/Pills**: `RADIUS.chip` (999)
- **Buttons**: `RADIUS.button` (22)
- **Glass morphism**: `GLASS_WHITE` (rgba 255,255,255,0.85) + `GLASS_BORDER` (rgba 0,0,0,0.06)
- **Shadow**: `GLOBAL_STYLES.shadow` (cross-platform shadow)
- **Content tiers**: Select/Deluxe/Premium/Exclusive/Ultra → mỗi tier có palette riêng
- **Animations**: AnimatedEntrance (fade + scale) + ScreenEntrance
- **Grid**: TwoColumnGrid (flexWrap 2 cột, gap 12)
- **Bottom padding**: 140px cho tất cả ScrollView (tránh floating tab bar che)
