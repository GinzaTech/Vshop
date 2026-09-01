// 📄 app/(authenticated)/profile.tsx — Màn hình Profile chính (trang cá nhân)
// Đây là màn hình phức tạp nhất của app, quản lý:
//   - Thông tin người chơi (hero card, rank, balances).
//   - Loadout vũ khí, skin, spray, flex, player card, player title.
//   - Trang bị (equip) và thay đổi skin/spray/identity.
//   - Collection (bộ sưu tập skin đã sở hữu).
//   - Picker modal để chọn skin/spray/card/title.

import React from "react";
import { useFocusEffect } from "expo-router";
import { GestureDetector } from "react-native-gesture-handler";
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Easing,
  ReduceMotion,
} from "react-native-reanimated";
import { ActivityIndicator, Searchbar, useTheme } from "react-native-paper";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "react-i18next";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { runWhenIdle, type IdleTask } from "~/utils/idle-task";
import CurrencyIcon from "~/components/CurrencyIcon";
import RankSplitGroup, {
  type RankSplitContentMode,
  type RankSplitStat,
} from "~/components/profile/RankSplitGroup";
import PlayerStatsDashboard, {
  type StatsDashboardTab,
} from "~/components/profile/PlayerStatsDashboard";
import TypewriterSwapText from "~/components/profile/TypewriterSwapText";
import {
  CollectionCheckerExport,
  CollectionCheckerExportProvider,
  type CollectionCheckerProfile,
} from "~/components/profile/CollectionCheckerExport";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { useMatchStore } from "~/hooks/useMatchStore";
import { useUserStore } from "~/hooks/useUserStore";
import { useSystemChromeStore } from "~/hooks/useSystemChromeStore";
import {
  extractOwnedItemIds,
  ownedItems,
  playerLoadout,
  PlayerLoadoutExpression,
  PlayerLoadoutResponse,
  updatePlayerLoadout,
  updatePlayerLoadoutV3,
  updatePlayerLoadoutV3First,
} from "~/utils/valorant-api";
import {
  CompetitiveRankSummary,
  fetchCompetitiveRankSummary,
  getSessionAuthKey,
  hasValidCompetitiveRankCache,
  hasValidProfileLoadoutCache,
  isProfileCacheFresh,
  PROFILE_LOADOUT_CACHE_VERSION,
  PROFILE_RANK_CACHE_VERSION,
} from "~/utils/profile-cache";
import { getAssets } from "~/utils/valorant-assets";
import {
  CATEGORY_ORDER,
  TabKey,
  PlayerLoadoutGun,
  PlayerLoadoutSpray,
  PlayerLoadoutIdentity,
  WeaponMetadata,
  WeaponMetadataMap,
  EquippedWeapon,
  OwnedWeaponCollectionItem,
  EquippedSpray,
  IdentityDetails,
  resolveCategory,
} from "~/components/GalleryProfile";
import { COLORS } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";
import { VItemTypes } from "~/utils/misc";
import { getPublicWeapons } from "~/services/valorant/public-api";
import { getPrimaryTabContentBottomPadding } from "~/constants/Layout";
import { styles } from "~/features/profile/profile-screen.styles";
import { CompactProfileSkinCard } from "~/features/profile/CompactProfileSkinCard";
import { ProfilePickerModal } from "~/features/profile/ProfilePickerModal";
import { ProfileSegmentedControl } from "~/features/profile/ProfileSegmentedControl";
import {
  PROFILE_STICKY_SEGMENT_HEIGHT,
  useProfileCollapsibleHeader,
} from "~/features/profile/useProfileCollapsibleHeader";
import {
  ProfileExpressionSection,
  ProfileIdentitySection,
} from "~/features/profile/ProfileEquipmentSections";
import {
  delay,
  formatOneDecimal,
  formatPercentage,
  getProfileWeaponOrderIndex,
  loadoutsMatch,
  normalizeProfileWeaponCategory,
  normalizeVariantLabel,
  normalizeWeaponKey,
  PROFILE_TAB_KEYS,
  sameOptionalId,
  type EquippedExpression,
  type ExpressionKind,
  type OwnedExpressionOption,
  type OwnedPlayerCardOption,
  type OwnedPlayerTitleOption,
  type OwnedSkinOption,
  type OwnedSprayOption,
  type PendingLoadoutUpdate,
  type PickerState,
} from "~/features/profile/profile-loadout";

type ProfileListRow =
    | { key: "identity"; kind: "identity" }
    | { key: "expressions"; kind: "expressions" }
    | { key: string; kind: "skin-category"; category: string }
    | {
      key: string;
      kind: "collection-row";
      items: OwnedWeaponCollectionItem[];
    }
    | { key: string; kind: "loading" }
    | {
      key: string;
      kind: "message";
      message: string;
      tone: "error" | "empty";
    };

const RANK_TEXT_RETRACT_DURATION_MS = 520;
const RANK_SPLIT_DURATION_MS = 420;
const HERO_SUBTITLE_TYPING_SPEED_MS = 36;
const HERO_SUBTITLE_DELETING_SPEED_MS = 22;
const HERO_SUBTITLE_INITIAL_DELAY_MS = 60;
const HERO_SUBTITLE_COLLAPSE_DURATION_MS = 180;
const HERO_SUBTITLE_EXPAND_DURATION_MS = 240;
const PROFILE_BODY_FADE_DURATION_MS = 260;
const PROFILE_NAV_RETRACT_DURATION_MS = 420;
const PROFILE_SEGMENT_LAYOUT_DURATION_MS = 340;
const PROFILE_DASHBOARD_GROW_DURATION_MS = 480;
const PROFILE_BACKGROUND_DURATION_MS = 420;
const PROFILE_STATS_FETCH_DELAY_MS = PROFILE_DASHBOARD_GROW_DURATION_MS + 120;
const PROFILE_MODE_INTERACTION_BUFFER_MS = 80;
type ProfileNavContentMode = "profile" | "blank" | "stats";

/**
 * Profile — Component chính của màn hình Profile.
 *
 * ─── State & Refs ─────────────────────────────────────────────────────────────
 *
 * Derived values:
 * - viewportWidth: Chiều rộng màn hình hiện tại.
 * - user (useUserStore): Thông tin user (accessToken, balances, progress, ...).
 * - setUser (useUserStore): Cập nhật user state.
 * - setProfileCache (useProfileCacheStore): Cập nhật profile cache.
 * - profileGridColumns: Số cột grid (4 nếu >=700, 2 nếu <350, 3 nếu còn lại).
 * - profileGridCardWidth: Chiều rộng card trong grid collection.
 * - profileSkinRowCardWidth: Chiều rộng card trong row skin (min 128, max 168).
 * - hasAuth: User có đầy đủ auth tokens?
 * - authKey (useMemo): Key định danh session để cache.
 * - cachedProfile (useProfileCacheStore): Profile đã cache theo authKey.
 * - cachedCompetitiveRank: Rank competitive từ cache (nếu còn valid).
 * - cachedLoadoutSnapshot: Loadout snapshot từ cache (nếu còn valid).
 *
 * State:
 * - activeTab: Tab hiện tại ("loadout" | "skins" | "collection").
 * - loading: Đang fetch dữ liệu lần đầu?
 * - refreshing: Đang pull-to-refresh?
 * - error: Lỗi tổng quan (nếu có).
 * - pickerError: Lỗi trong picker modal.
 * - pickerLoading: Picker đang tải options?
 * - updatingLoadout: Đang cập nhật loadout lên server?
 * - rawGuns: Dữ liệu Guns gốc từ API.
 * - rawSprays: Dữ liệu Sprays gốc từ API.
 * - rawActiveExpressions: Dữ liệu ActiveExpressions gốc.
 * - identity: Identity (PlayerCardID, PlayerTitleID, AccountLevel).
 * - loadoutSnapshot: Toàn bộ response loadout hiện tại.
 * - ownedSkinItemIds: Danh sách ID skin đã sở hữu.
 * - ownedSprayItemIds: Danh sách ID spray đã sở hữu.
 * - ownedFlexItemIds: Danh sách ID flex đã sở hữu.
 * - ownedPlayerCardItemIds: Danh sách ID player card đã sở hữu.
 * - ownedPlayerTitleItemIds: Danh sách ID player title đã sở hữu.
 * - competitiveRank: Thông tin rank competitive.
 * - weaponMetadata: Map weapon UUID → metadata (từ valorant-api.com).
 * - searchQuery: Input tìm kiếm trong collection tab.
 * - collectionWeaponFilter: Bộ lọc vũ khí trong collection ("all" hoặc tên).
 * - pickerState: State hiện tại của picker modal (null = đóng).
 * - identityPickerQuery: Input tìm kiếm trong identity picker.
 * - activeWeaponChroma: Chroma panel đang mở cho weapon/skin nào.
 *
 * Refs:
 * - pickerTaskRef: Tác vụ idle cho picker (hủy được).
 * - loadoutSnapshotRef: Luôn giữ loadout mới nhất (dùng trong async).
 * - loadoutMutationVersionRef: Version tăng dần khi mutate loadout.
 * - pendingLoadoutRef: Bản cập nhật loadout đang chờ xác nhận.
 * - initialFetchTaskRef: Task fetch ban đầu.
 * - initialFetchTimeoutRef: Timeout cho fetch ban đầu.
 * - rankRefreshAuthKeyRef: Auth key của lần refresh rank gần nhất.
 * - fetchLoadoutInFlightRef: Đang có fetch loadout đang chạy?
 * @returns {JSX.Element} Màn hình Profile.
 */
function Profile() {
  const insets = useSafeAreaInsets(); const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: viewportWidth } = useWindowDimensions();
  const user = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);
  const matchAuthKey = useMatchStore((state) => state.authKey);
  const recentMatches = useMatchStore((state) => state.matches);
  const totalMatches = useMatchStore((state) => state.totalMatches);
  const matchHistoryLoading = useMatchStore((state) => state.loading);
  const seasonStatsLoading = useMatchStore((state) => state.seasonStatsLoading);
  const seasonPerformanceStats = useMatchStore((state) => state.seasonStats);
  const fetchMatches = useMatchStore((state) => state.fetchMatches);
  const fetchSeasonStats = useMatchStore((state) => state.fetchSeasonStats);
  const setProfileCache = useProfileCacheStore((state) => state.setProfileCache);
  const profileGridColumns = viewportWidth >= 700 ? 4 : viewportWidth < 350 ? 2 : 3;
  const profileGridCardWidth = Math.floor(
      (viewportWidth - 32 - 8 * (profileGridColumns - 1)) / profileGridColumns
  );
  const profileSkinRowCardWidth = Math.min(
      168,
      Math.max(128, Math.floor(viewportWidth * 0.36))
  );

  const hasAuth = Boolean(
      user.accessToken &&
      user.entitlementsToken &&
      user.region &&
      user.id
  );
  const authKey = React.useMemo(() => getSessionAuthKey(user), [user]);
  React.useEffect(() => {
    if (!hasAuth) return;
    void fetchSeasonStats(user);
  }, [fetchSeasonStats, hasAuth, user]);
  const cachedProfile = useProfileCacheStore(
      (state) => state.cacheByAuth[authKey] ?? null
  );
  const cachedCompetitiveRank = hasValidCompetitiveRankCache(cachedProfile)
      ? cachedProfile?.competitiveRank ?? null
      : null;
  const cachedLoadoutSnapshot = hasValidProfileLoadoutCache(cachedProfile)
      ? cachedProfile?.loadoutSnapshot ?? null
      : null;
  const dashboardMatches = React.useMemo(
      () => (matchAuthKey === authKey ? recentMatches : []),
      [authKey, matchAuthKey, recentMatches]
  );
  const dashboardSeasonStats =
      matchAuthKey === authKey ? seasonPerformanceStats : null;
  const [activeTab, setActiveTab] = React.useState<TabKey>("loadout");
  const reduceMotionEnabled = useReducedMotion();
  const setTopInsetTone = useSystemChromeStore(
      (state) => state.setTopInsetTone
  );
  const setPrimaryNavigationTone = useSystemChromeStore(
      (state) => state.setPrimaryNavigationTone
  );
  const [statsDashboardTab, setStatsDashboardTab] =
      React.useState<StatsDashboardTab>("overview");
  const [profileNavContentMode, setProfileNavContentMode] =
      React.useState<ProfileNavContentMode>("profile");
  const [statsDashboardMounted, setStatsDashboardMounted] =
      React.useState(false);
  const profilePagerRef =
      React.useRef<React.ElementRef<typeof ScrollView>>(null);
  const skinWhitespacePagerOriginRef = React.useRef(0);
  const segmentProgress = useSharedValue(0);
  const segmentLayoutProgress = useSharedValue(0);
  const statsTabProgress = useSharedValue(0);
  const segmentContainerWidth = useSharedValue(
      Math.max(0, viewportWidth - 32)
  );
  React.useEffect(() => {
    segmentContainerWidth.value = Math.max(0, viewportWidth - 32);
  }, [segmentContainerWidth, viewportWidth]);
  const handleSegmentContainerLayout = React.useCallback(
      (event: LayoutChangeEvent) => {
        segmentContainerWidth.value = event.nativeEvent.layout.width;
      },
      [segmentContainerWidth]
  );
  const handlePagerScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      segmentProgress.value = Math.max(
          0,
          Math.min(2, event.contentOffset.x / Math.max(1, viewportWidth))
      );
    },
  });
  const segmentIndicatorAnimatedStyle = useAnimatedStyle(
      () => {
        const contentWidth = Math.max(0, segmentContainerWidth.value - 16);
        const profileSegmentTabWidth = Math.max(0, (contentWidth - 16) / 3);
        const statsSegmentTabWidth = Math.max(0, (contentWidth - 8) / 2);

        return {
          width: interpolate(
            segmentLayoutProgress.value,
            [0, 1],
            [profileSegmentTabWidth, statsSegmentTabWidth]
          ),
          transform: [
            {
              translateX: interpolate(
                segmentLayoutProgress.value,
                [0, 1],
                [
                  segmentProgress.value * (profileSegmentTabWidth + 8),
                  statsTabProgress.value * (statsSegmentTabWidth + 8),
                ]
              ),
            },
          ],
        };
      }
  );
  const profileSegmentLayerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
        segmentLayoutProgress.value,
        [0, 0.44, 1],
        [1, 0, 0]
    ),
  }));
  const statsSegmentLayerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
        segmentLayoutProgress.value,
        [0, 0.56, 1],
        [0, 0, 1]
    ),
  }));
  const loadoutSegmentLabelAnimatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
        Math.min(1, Math.abs(segmentProgress.value)),
        [0, 1],
        ["#11181c", "rgba(255,255,255,0.6)"]
    ),
  }));
  const skinsSegmentLabelAnimatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
        Math.min(1, Math.abs(segmentProgress.value - 1)),
        [0, 1],
        ["#11181c", "rgba(255,255,255,0.6)"]
    ),
  }));
  const collectionSegmentLabelAnimatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
        Math.min(1, Math.abs(segmentProgress.value - 2)),
        [0, 1],
        ["#11181c", "rgba(255,255,255,0.6)"]
    ),
  }));
  const [loading, setLoading] = React.useState(!cachedLoadoutSnapshot);
  const [refreshing, setRefreshing] = React.useState(false);
  const [statsRefreshing, setStatsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerError, setPickerError] = React.useState<string | null>(null);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const [updatingLoadout, setUpdatingLoadout] = React.useState(false);
  const [rawGuns, setRawGuns] = React.useState<PlayerLoadoutGun[]>(
      cachedLoadoutSnapshot?.Guns ?? []
  );
  const [rawSprays, setRawSprays] = React.useState<PlayerLoadoutSpray[]>(
      cachedLoadoutSnapshot?.Sprays ?? []
  );
  const [rawActiveExpressions, setRawActiveExpressions] = React.useState<
      PlayerLoadoutExpression[]
  >(
      cachedLoadoutSnapshot?.ActiveExpressions ?? []
  );
  const [identity, setIdentity] = React.useState<PlayerLoadoutIdentity | null>(
      cachedLoadoutSnapshot?.Identity ?? null
  );
  const [loadoutSnapshot, setLoadoutSnapshot] =
      React.useState<PlayerLoadoutResponse | null>(cachedLoadoutSnapshot);
  const [ownedSkinItemIds, setOwnedSkinItemIds] = React.useState<string[]>(
      cachedProfile?.ownedSkinItemIds?.length
          ? cachedProfile.ownedSkinItemIds
          : user.ownedSkinIds ?? []
  );
  const [ownedSprayItemIds, setOwnedSprayItemIds] = React.useState<string[]>(
      cachedProfile?.ownedSprayItemIds ?? []
  );
  const [ownedFlexItemIds, setOwnedFlexItemIds] = React.useState<string[]>(
      cachedProfile?.ownedFlexItemIds ?? []
  );
  const [ownedPlayerCardItemIds, setOwnedPlayerCardItemIds] = React.useState<
      string[]
  >(cachedProfile?.ownedPlayerCardItemIds ?? []);
  const [ownedPlayerTitleItemIds, setOwnedPlayerTitleItemIds] = React.useState<
      string[]
  >(cachedProfile?.ownedPlayerTitleItemIds ?? []);
  const [competitiveRank, setCompetitiveRank] =
      React.useState<CompetitiveRankSummary | null>(cachedCompetitiveRank);
  const [weaponMetadata, setWeaponMetadata] = React.useState<WeaponMetadataMap>({});
  const [searchQuery, setSearchQuery] = React.useState("");               // Search trong collection tab
  const [collectionWeaponFilter, setCollectionWeaponFilter] = React.useState("all");
  const [pickerState, setPickerState] = React.useState<PickerState | null>(null);
  const [identityPickerQuery, setIdentityPickerQuery] = React.useState(""); // Search trong identity picker
  const [activeWeaponChroma, setActiveWeaponChroma] = React.useState<{
    weapon: EquippedWeapon;
    option: OwnedSkinOption;
  } | null>(null);
  const pickerTaskRef = React.useRef<IdleTask | null>(null);
  const loadoutSnapshotRef = React.useRef<PlayerLoadoutResponse | null>(
      cachedLoadoutSnapshot
  );
  const loadoutMutationVersionRef = React.useRef(0);          // Tăng sau mỗi mutation
  const pendingLoadoutRef = React.useRef<PendingLoadoutUpdate | null>(null);
  const initialFetchTaskRef = React.useRef<IdleTask | null>(null);
  const initialFetchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null
  );
  const rankRefreshAuthKeyRef = React.useRef<string | null>(null);
  const fetchLoadoutInFlightRef = React.useRef(false);

  // ─── Palette màu (tính toán từ theme) ─────────────────────────────────────
  const palette = React.useMemo(
      () => {
        const accent = colors?.primary ?? COLORS.PURE_BLACK;

        return {
          accent,
          background: colors?.background ?? COLORS.BACKGROUND,
          card: COLORS.SURFACE,
          cardBorder: COLORS.BORDER,
          chipBackground: COLORS.SURFACE_MUTED,
          textPrimary: colors?.onSurface ?? COLORS.TEXT_PRIMARY,
          textSecondary: COLORS.TEXT_SECONDARY,
        };
      },
      [colors]
  );
  const regionLabel = user.region ? user.region.toUpperCase() : "VAL";
  const heroSubtitleText = t("profile_page.hero_subtitle");
  const [heroSubtitleTargetText, setHeroSubtitleTargetText] =
      React.useState(heroSubtitleText);

  // ─── Chuyển đổi giữa hồ sơ trang bị và thông tin người chơi ─────────────
  const [isPlayerInfoMode, setIsPlayerInfoMode] = React.useState(false);
  const [profileModeTransitioning, setProfileModeTransitioning] =
      React.useState(false);
  const isPlayerInfoModeRef = React.useRef(false);
  const profileModeInteractionLockedRef = React.useRef(false);
  const profileModeInteractionTimerRef = React.useRef<
      ReturnType<typeof setTimeout> | null
  >(null);
  const [rankSplitContentMode, setRankSplitContentMode] =
      React.useState<RankSplitContentMode>("rank");
  const heroModeProgress = useSharedValue(0);
  const rankSplitProgress = useSharedValue(0);
  const statsVisibilityProgress = useSharedValue(1);
  const heroSubtitleVisibilityProgress = useSharedValue(1);
  const pageModeProgress = useSharedValue(0);
  const legacyContentProgress = useSharedValue(1);
  const dashboardProgress = useSharedValue(0);
  const statsExpandedRef = React.useRef(true);
  const lastRegionTapRef = React.useRef(0);
  const heroSubtitleCollapseTimerRef = React.useRef<
      ReturnType<typeof setTimeout> | null
  >(null);
  const rankTransitionTimersRef = React.useRef<
      ReturnType<typeof setTimeout>[]
  >([]);
  const profileModeTimersRef = React.useRef<
      ReturnType<typeof setTimeout>[]
  >([]);
  const dashboardPreloadTaskRef = React.useRef<IdleTask | null>(null);

  React.useEffect(() => {
    const preloadTask = runWhenIdle(() => {
      dashboardPreloadTaskRef.current = null;
      setStatsDashboardMounted(true);
    });
    dashboardPreloadTaskRef.current = preloadTask;

    return () => {
      preloadTask.cancel();
      if (dashboardPreloadTaskRef.current === preloadTask) {
        dashboardPreloadTaskRef.current = null;
      }
    };
  }, []);

  const topHeaderTitleAnimatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
        pageModeProgress.value,
        [0, 1],
        [COLORS.TEXT_PRIMARY, "#F1F1F1"]
    ),
  }));

  const topAvatarAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
        pageModeProgress.value,
        [0, 1],
        [COLORS.SURFACE_MUTED, "#141414"]
    ),
    borderColor: interpolateColor(
        pageModeProgress.value,
        [0, 1],
        [COLORS.BORDER, "#2A2A2A"]
    ),
  }));

  const pageBackgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pageModeProgress.value,
  }));

  const topBalancePillAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
        pageModeProgress.value,
        [0, 1],
        [COLORS.PURE_BLACK, "#141414"]
    ),
    borderColor: interpolateColor(
        pageModeProgress.value,
        [0, 1],
        ["rgba(42,42,42,0)", "#2A2A2A"]
    ),
  }));

  const legacyContentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: legacyContentProgress.value,
  }));

  const statsDashboardLayerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: dashboardProgress.value,
    transform: [
      {
        translateY: interpolate(dashboardProgress.value, [0, 1], [8, 0]),
      },
    ],
  }));

  const heroModeToggleAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
        heroModeProgress.value,
        [0, 1],
        ["rgba(48, 164, 108, 0.18)", "rgba(255, 70, 85, 0.22)"]
    ),
  }));

  const heroModeThumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(heroModeProgress.value, [0, 1], [0, 86]),
      },
    ],
  }));

  const heroModeLabelAnimatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
        heroModeProgress.value,
        [0, 1],
        ["#30a46c", "#ff4655"]
    ),
    transform: [
      {
        translateX: interpolate(heroModeProgress.value, [0, 1], [7, -7]),
      },
    ],
  }));

  const heroSubtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroSubtitleVisibilityProgress.value,
    maxHeight: interpolate(
        heroSubtitleVisibilityProgress.value,
        [0, 1],
        [0, 44]
    ),
    marginTop: interpolate(
        heroSubtitleVisibilityProgress.value,
        [0, 1],
        [0, 4]
    ),
  }));

  const balanceStatsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroModeProgress.value, [0, 0.46, 1], [1, 0, 0]),
    transform: [
      {
        translateX: interpolate(heroModeProgress.value, [0, 1], [0, -5]),
      },
    ],
  }));

  const playerStatsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroModeProgress.value, [0, 0.54, 1], [0, 0, 1]),
    transform: [
      {
        translateX: interpolate(heroModeProgress.value, [0, 1], [5, 0]),
      },
    ],
  }));

  const heroStatCardAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
        heroModeProgress.value,
        [0, 1],
        ["rgba(255,255,255,0.06)", "rgba(255,70,85,0.08)"]
    ),
    borderColor: interpolateColor(
        heroModeProgress.value,
        [0, 1],
        ["rgba(255,255,255,0)", "rgba(255,70,85,0.16)"]
    ),
  }));

  const statsVisibilityAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(statsVisibilityProgress.value, [0, 1], [0, 64]),
    marginTop: interpolate(statsVisibilityProgress.value, [0, 1], [0, 12]),
    opacity: statsVisibilityProgress.value,
    overflow: "hidden" as const,
  }));

  const handleRegionPress = React.useCallback(() => {
    const now = Date.now();
    const isDoubleTap =
        lastRegionTapRef.current > 0 && now - lastRegionTapRef.current < 500;

    if (!isDoubleTap) {
      lastRegionTapRef.current = now;
      return;
    }

    lastRegionTapRef.current = 0;
    statsExpandedRef.current = !statsExpandedRef.current;
    statsVisibilityProgress.value = withTiming(
        statsExpandedRef.current ? 1 : 0,
        {
          duration: statsExpandedRef.current ? 420 : 300,
          easing: Easing.out(Easing.cubic),
        }
    );
  }, [statsVisibilityProgress]);

  const startRankSplitTransition = React.useCallback(
      (showActStats: boolean) => {
        rankTransitionTimersRef.current.forEach(clearTimeout);
        rankTransitionTimersRef.current = [];
        setRankSplitContentMode("blank");

        const splitTimer = setTimeout(() => {
          rankSplitProgress.value = withTiming(showActStats ? 1 : 0, {
            duration: RANK_SPLIT_DURATION_MS,
            easing: Easing.inOut(Easing.cubic),
            reduceMotion: ReduceMotion.System,
          });
        }, RANK_TEXT_RETRACT_DURATION_MS);

        const revealTimer = setTimeout(() => {
          setRankSplitContentMode(showActStats ? "act" : "rank");
          rankTransitionTimersRef.current = [];
        }, RANK_TEXT_RETRACT_DURATION_MS + RANK_SPLIT_DURATION_MS);

        rankTransitionTimersRef.current = [splitTimer, revealTimer];
      },
      [rankSplitProgress]
  );

  const toggleHeroMode = React.useCallback(() => {
    if (profileModeInteractionLockedRef.current) return;

    const nextMode = !isPlayerInfoModeRef.current;
    const subtitleTransitionDuration = nextMode
        ? heroSubtitleText.length * HERO_SUBTITLE_DELETING_SPEED_MS +
          40 +
          HERO_SUBTITLE_COLLAPSE_DURATION_MS
        : HERO_SUBTITLE_EXPAND_DURATION_MS +
          HERO_SUBTITLE_INITIAL_DELAY_MS +
          heroSubtitleText.length * HERO_SUBTITLE_TYPING_SPEED_MS;
    const interactionLockDuration =
        Math.max(
            RANK_TEXT_RETRACT_DURATION_MS + RANK_SPLIT_DURATION_MS,
            PROFILE_NAV_RETRACT_DURATION_MS +
              PROFILE_SEGMENT_LAYOUT_DURATION_MS,
            subtitleTransitionDuration
        ) + PROFILE_MODE_INTERACTION_BUFFER_MS;

    profileModeInteractionLockedRef.current = true;
    setProfileModeTransitioning(true);
    profileModeInteractionTimerRef.current = setTimeout(() => {
      profileModeInteractionLockedRef.current = false;
      profileModeInteractionTimerRef.current = null;
      setProfileModeTransitioning(false);
    }, interactionLockDuration);

    if (heroSubtitleCollapseTimerRef.current) {
      clearTimeout(heroSubtitleCollapseTimerRef.current);
      heroSubtitleCollapseTimerRef.current = null;
    }
    profileModeTimersRef.current.forEach(clearTimeout);
    profileModeTimersRef.current = [];

    isPlayerInfoModeRef.current = nextMode;
    setTopInsetTone(nextMode ? "dark" : "light");
    setPrimaryNavigationTone(nextMode ? "light" : "dark");
    setIsPlayerInfoMode(nextMode);
    setProfileNavContentMode("blank");
    startRankSplitTransition(nextMode);

    if (!statsDashboardMounted) {
      dashboardPreloadTaskRef.current?.cancel();
      dashboardPreloadTaskRef.current = null;
      setStatsDashboardMounted(true);
    }

    heroModeProgress.value = withTiming(nextMode ? 1 : 0, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    });
    pageModeProgress.value = withTiming(nextMode ? 1 : 0, {
      duration: PROFILE_BACKGROUND_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
    });
    legacyContentProgress.value = withTiming(nextMode ? 0 : 1, {
      duration: PROFILE_BODY_FADE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    dashboardProgress.value = withTiming(nextMode ? 1 : 0, {
      duration: PROFILE_DASHBOARD_GROW_DURATION_MS,
      easing: nextMode ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });

    const reshapeSegmentTimer = setTimeout(() => {
      segmentLayoutProgress.value = withTiming(nextMode ? 1 : 0, {
        duration: PROFILE_SEGMENT_LAYOUT_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
      });
    }, PROFILE_NAV_RETRACT_DURATION_MS);
    const revealSegmentTextTimer = setTimeout(() => {
      setProfileNavContentMode(nextMode ? "stats" : "profile");
      profileModeTimersRef.current = [];
    }, PROFILE_NAV_RETRACT_DURATION_MS + PROFILE_SEGMENT_LAYOUT_DURATION_MS);
    profileModeTimersRef.current = [
      reshapeSegmentTimer,
      revealSegmentTextTimer,
    ];

    if (nextMode) {
      setHeroSubtitleTargetText("");
      const deleteDuration =
          heroSubtitleText.length * HERO_SUBTITLE_DELETING_SPEED_MS + 40;
      heroSubtitleCollapseTimerRef.current = setTimeout(() => {
        heroSubtitleVisibilityProgress.value = withTiming(0, {
          duration: HERO_SUBTITLE_COLLAPSE_DURATION_MS,
          easing: Easing.out(Easing.cubic),
        });
        heroSubtitleCollapseTimerRef.current = null;
      }, deleteDuration);
    } else {
      setHeroSubtitleTargetText("");
      heroSubtitleVisibilityProgress.value = withTiming(1, {
        duration: HERO_SUBTITLE_EXPAND_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      });
      heroSubtitleCollapseTimerRef.current = setTimeout(() => {
        setHeroSubtitleTargetText(heroSubtitleText);
        heroSubtitleCollapseTimerRef.current = null;
      }, HERO_SUBTITLE_EXPAND_DURATION_MS);
    }
  }, [
    dashboardProgress,
    heroModeProgress,
    heroSubtitleText,
    heroSubtitleVisibilityProgress,
    legacyContentProgress,
    pageModeProgress,
    segmentLayoutProgress,
    setPrimaryNavigationTone,
    setTopInsetTone,
    startRankSplitTransition,
    statsDashboardMounted,
  ]);

  useFocusEffect(
      React.useCallback(() => {
        setTopInsetTone(isPlayerInfoMode ? "dark" : "light");
        setPrimaryNavigationTone(isPlayerInfoMode ? "light" : "dark");

        return () => {
          setTopInsetTone("light");
          setPrimaryNavigationTone("dark");
        };
      }, [isPlayerInfoMode, setPrimaryNavigationTone, setTopInsetTone])
  );

  const handleStatsDashboardTabChange = React.useCallback(
      (tab: StatsDashboardTab) => {
        setStatsDashboardTab(tab);
        statsTabProgress.value = withTiming(tab === "overview" ? 0 : 1, {
          duration: 260,
          easing: Easing.out(Easing.cubic),
        });
      },
      [statsTabProgress]
  );

  const handleRequestStatsDetails = React.useCallback(() => {
    handleStatsDashboardTabChange("details");
  }, [handleStatsDashboardTabChange]);

  React.useEffect(() => {
    if (!isPlayerInfoMode || !hasAuth) return;

    const fetchTimer = setTimeout(() => {
      void fetchMatches(user);
    }, PROFILE_STATS_FETCH_DELAY_MS);

    return () => clearTimeout(fetchTimer);
  }, [fetchMatches, hasAuth, isPlayerInfoMode, user]);

  // ─── profileStats: các thông số hiển thị trong hero card ─────────────────
  const profileStats = React.useMemo(
      () => [
        { key: "vp", label: t("vp"), value: user.balances.vp, icon: "vp" as const },
        { key: "rad", label: t("rad"), value: user.balances.rad, icon: "rad" as const },
        { key: "kc", label: t("kc"), value: user.balances.kc, icon: "kc" as const },
      ],
      [t, user.balances.kc, user.balances.rad, user.balances.vp]
  );

  const playerPerformanceStats = React.useMemo(() => {
    const seasonStats =
        matchAuthKey === authKey ? seasonPerformanceStats : null;

    if (!seasonStats || seasonStats.matchCount === 0) {
      return [
        { key: "hs", label: "HS TB", value: "--", icon: "target-account" as const },
        { key: "kd", label: "K/D TB", value: "--", icon: "sword-cross" as const },
        { key: "acs", label: "ACS TB", value: "--", icon: "speedometer" as const },
      ];
    }

    const averageHeadshot =
        seasonStats.headshotPercent !== null
            ? formatPercentage(seasonStats.headshotPercent)
            : "--";
    const averageKd =
        seasonStats.kd !== null
            ? formatOneDecimal(seasonStats.kd)
            : "--";
    const averageAcs =
        seasonStats.acs !== null ? Math.round(seasonStats.acs).toString() : "--";

    return [
      {
        key: "hs",
        label: "HS TB",
        value: averageHeadshot,
        icon: "target-account" as const,
      },
      {
        key: "kd",
        label: "K/D TB",
        value: averageKd,
        icon: "sword-cross" as const,
      },
      {
        key: "acs",
        label: "ACS TB",
        value: averageAcs,
        icon: "speedometer" as const,
      },
    ];
  }, [authKey, matchAuthKey, seasonPerformanceStats]);

  const actRankSummaryStats = React.useMemo(() => {
    const seasonStats =
        matchAuthKey === authKey ? seasonPerformanceStats : null;
    const hasPerformanceStats = Boolean(
        seasonStats &&
        seasonStats.calculationVersion >= 6 &&
        seasonStats.matchCount > 0
    );
    const hasActRecord = Boolean(
        competitiveRank?.actWins !== null &&
        competitiveRank?.actWins !== undefined &&
        competitiveRank?.actLosses !== null &&
        competitiveRank?.actLosses !== undefined &&
        competitiveRank?.actGames
    );
    const actWinRate =
        hasActRecord && competitiveRank?.actGames
        ? ((competitiveRank?.actWins ?? 0) /
            competitiveRank.actGames) *
          100
        : null;
    const left: [RankSplitStat, RankSplitStat] = [
      {
        key: "wins",
        label: t("profile_page.act_wins", { defaultValue: "Thắng" }),
        value: hasActRecord ? String(competitiveRank?.actWins ?? 0) : "--",
        icon: "trophy-outline",
      },
      {
        key: "losses",
        label: t("profile_page.act_losses", { defaultValue: "Thua" }),
        value: hasActRecord ? String(competitiveRank?.actLosses ?? 0) : "--",
        icon: "close-octagon-outline",
      },
    ];
    const right: [RankSplitStat, RankSplitStat] = [
      {
        key: "kast",
        label: "KAST",
        value:
            hasPerformanceStats && seasonStats?.kast !== null
                ? formatPercentage(seasonStats?.kast ?? 0)
                : "--",
        icon: "shield-check-outline",
      },
      {
        key: "win-rate",
        label: t("profile_page.act_win_rate", {
          defaultValue: "Tỉ lệ thắng",
        }),
        value:
            actWinRate !== null
                ? formatPercentage(actWinRate)
                : "--",
        icon: "percent-outline",
      },
    ];

    return { left, right };
  }, [authKey, competitiveRank, matchAuthKey, seasonPerformanceStats, t]);

  // ─── tabItems: các tab cho segmented control ──────────────────────────────
  const tabItems = React.useMemo(
      () => [
        { value: "loadout" as const, label: t("equip_page.tabs.loadout") },
        { value: "skins" as const, label: t("equip_page.tabs.skins") },
        { value: "collection" as const, label: t("equip_page.tabs.collection") },
      ],
      [t]
  );

  // ─── categoryLabels: map category → tên đã dịch ──────────────────────────
  const categoryLabels = React.useMemo(
      () =>
          CATEGORY_ORDER.reduce<Record<string, string>>((labels, category) => {
            const translationKey = `equip_page.categories.${category}`;
            const translated = t(translationKey);
            labels[category] = translated !== translationKey ? translated : category;
            return labels;
          }, {}),
      [t]
  );

  /**
   * formatCategoryLabel — Lấy tên hiển thị cho category vũ khí (đã dịch).
   * Nếu không có bản dịch, tự động format camelCase/snake_case thành text thường.
   */
  const formatCategoryLabel = React.useCallback(
      (category: string) => {
        if (categoryLabels[category]) {
          return categoryLabels[category];
        }

        const translationKey = `equip_page.categories.${category}`;
        const translated = t(translationKey);
        if (translated !== translationKey) {
          return translated;
        }

        return category
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
      },
      [categoryLabels, t]
  );

  /**
   * syncLoadoutState — Đồng bộ toàn bộ state loadout từ response API.
   * Cập nhật: loadoutSnapshotRef, loadoutSnapshot, rawGuns, rawSprays,
   * rawActiveExpressions, identity.
   */
  const syncLoadoutState = React.useCallback((response: PlayerLoadoutResponse) => {
    loadoutSnapshotRef.current = response;
    setLoadoutSnapshot(response);
    setRawGuns(response.Guns || []);
    setRawSprays(response.Sprays || []);
    setRawActiveExpressions(response.ActiveExpressions || []);
    setIdentity(response.Identity || null);
  }, []);

  // ── Effect: Khôi phục dữ liệu từ cache ────────────────────────────────────
  React.useEffect(() => {
    if (!hasAuth || !cachedLoadoutSnapshot) {
      return;
    }

    // Đồng bộ loadout từ cache vào state
    syncLoadoutState(cachedLoadoutSnapshot);
    // Đồng bộ danh sách sở hữu
    setOwnedSkinItemIds(
        cachedProfile.ownedSkinItemIds?.length
            ? cachedProfile.ownedSkinItemIds
            : user.ownedSkinIds ?? []
    );
    setOwnedSprayItemIds(cachedProfile.ownedSprayItemIds ?? []);
    setOwnedFlexItemIds(cachedProfile.ownedFlexItemIds ?? []);
    setOwnedPlayerCardItemIds(cachedProfile.ownedPlayerCardItemIds ?? []);
    setOwnedPlayerTitleItemIds(cachedProfile.ownedPlayerTitleItemIds ?? []);
    setCompetitiveRank(cachedCompetitiveRank);
    setError(null);
    setLoading(false);
  }, [cachedCompetitiveRank, cachedLoadoutSnapshot, cachedProfile, hasAuth, syncLoadoutState, user.ownedSkinIds]);

  /**
   * fetchLoadoutData — Hàm chính để fetch toàn bộ dữ liệu profile từ API.
   *
   * Quy trình:
   * 1. Gọi playerLoadout() để lấy loadout hiện tại.
   * 2. Đồng bộ loadout ngay (render ngay khi có response).
   * 3. Song song fetch: ownedItems (6 loại) + competitive rank.
   * 4. Xử lý kết quả ownership, cập nhật danh sách sở hữu.
   * 5. Lưu vào profile cache.
   *
   * Có cơ chế optimistic update: nếu có pendingLoadout, ưu tiên hiển thị
   * loadout đã chỉnh sửa thay vì loadout từ server.
   *
   * @param {boolean} [showSpinner=true] - Hiển thị spinner loading?
   * @param {boolean} [forceRefresh=false] - Bỏ qua cache kết quả đã resolve?
   */
  const fetchLoadoutData = React.useCallback(
      async (showSpinner = true, forceRefresh = false) => {
        if (!hasAuth) return;
        if (fetchLoadoutInFlightRef.current) return;

        fetchLoadoutInFlightRef.current = true;

        if (showSpinner) {
          setLoading(true);
        }
        setError(null);

        try {
          const mutationVersionAtRequest = loadoutMutationVersionRef.current;
          const response = await playerLoadout(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              { force: forceRefresh }
          );

          if (!response) {
            if (loadoutSnapshotRef.current) {
              syncLoadoutState(loadoutSnapshotRef.current);
            }
            setCompetitiveRank(
                competitiveRank ?? cachedCompetitiveRank
            );
            return;
          }

          const resolveLoadoutForDisplay = () => {
            if (
                loadoutMutationVersionRef.current !== mutationVersionAtRequest
            ) {
              return loadoutSnapshotRef.current ?? response;
            }

            const pendingLoadout = pendingLoadoutRef.current;
            if (!pendingLoadout) {
              return response;
            }

            const matchesPending = loadoutsMatch(
                response,
                pendingLoadout.loadout
            );
            const isPendingFresh =
                Date.now() - pendingLoadout.updatedAt < 8000;

            if (matchesPending || !isPendingFresh) {
              pendingLoadoutRef.current = null;
              return response;
            }

            return pendingLoadout.loadout;
          };

          // The loadout can render as soon as v3 responds. Ownership and rank
          // continue loading without holding the Profile screen spinner.
          syncLoadoutState(resolveLoadoutForDisplay());
          if (showSpinner) {
            setLoading(false);
          }

          const [ownershipResults, nextCompetitiveRank] = await Promise.all([
            Promise.allSettled([
              ownedItems(
                  user.accessToken,
                  user.entitlementsToken,
                  user.region,
                  user.id,
                  VItemTypes.SkinLevel
              ),
              ownedItems(
                  user.accessToken,
                  user.entitlementsToken,
                  user.region,
                  user.id,
                  VItemTypes.SkinChroma
              ),
              ownedItems(
                  user.accessToken,
                  user.entitlementsToken,
                  user.region,
                  user.id,
                  VItemTypes.Spray
              ),
              ownedItems(
                  user.accessToken,
                  user.entitlementsToken,
                  user.region,
                  user.id,
                  VItemTypes.Flex
              ),
              ownedItems(
                  user.accessToken,
                  user.entitlementsToken,
                  user.region,
                  user.id,
                  VItemTypes.PlayerCard
              ),
              ownedItems(
                  user.accessToken,
                  user.entitlementsToken,
                  user.region,
                  user.id,
                  VItemTypes.PlayerTitle
              ),
            ]),
            fetchCompetitiveRankSummary(user, { force: forceRefresh }).catch((err) => {
              if (__DEV__) {
                console.warn("[profile] competitive rank unavailable", err);
              }
              return null;
            }),
          ]);

          const resolvedLoadout = resolveLoadoutForDisplay();
          syncLoadoutState(resolvedLoadout);

          const currentUser = useUserStore.getState().user;
          const nextOwnedSkinIds = new Set<string>(currentUser.ownedSkinIds ?? []);
          const nextOwnedSprayIds = new Set<string>();
          const nextOwnedFlexIds = new Set<string>();
          const nextOwnedPlayerCardIds = new Set<string>();
          const nextOwnedPlayerTitleIds = new Set<string>();

          ownershipResults.forEach((result, index) => {
            if (result.status !== "fulfilled") {
              return;
            }

            let extractedIds: string[] = [];
            try {
              extractedIds = extractOwnedItemIds(result.value);
            } catch {
              extractedIds = [];
            }

            extractedIds.forEach((itemId) => {
              if (index === 2) {
                nextOwnedSprayIds.add(itemId);
                return;
              }
              if (index === 3) {
                nextOwnedFlexIds.add(itemId);
                return;
              }
              if (index === 4) {
                nextOwnedPlayerCardIds.add(itemId);
                return;
              }
              if (index === 5) {
                nextOwnedPlayerTitleIds.add(itemId);
                return;
              }

              nextOwnedSkinIds.add(itemId);
            });
          });

          const nextOwnedSkinList = Array.from(nextOwnedSkinIds);
          const nextOwnedSprayList = Array.from(nextOwnedSprayIds);
          const nextOwnedFlexList = Array.from(nextOwnedFlexIds);
          const nextOwnedPlayerCardList = Array.from(nextOwnedPlayerCardIds);
          const nextOwnedPlayerTitleList = Array.from(nextOwnedPlayerTitleIds);

          setOwnedSkinItemIds(nextOwnedSkinList);
          setOwnedSprayItemIds(nextOwnedSprayList);
          setOwnedFlexItemIds(nextOwnedFlexList);
          setOwnedPlayerCardItemIds(nextOwnedPlayerCardList);
          setOwnedPlayerTitleItemIds(nextOwnedPlayerTitleList);

          if (nextOwnedSkinIds.size > 0) {
            const currentOwnedSkinSet = new Set(currentUser.ownedSkinIds ?? []);
            const ownedSkinListChanged =
                nextOwnedSkinList.length !== currentOwnedSkinSet.size ||
                nextOwnedSkinList.some((itemId) => !currentOwnedSkinSet.has(itemId));

            if (ownedSkinListChanged) {
              setUser({
                ...currentUser,
                ownedSkinIds: nextOwnedSkinList,
              });
            }
          }

          const resolvedCompetitiveRank =
              nextCompetitiveRank ?? competitiveRank ?? cachedCompetitiveRank;

          setCompetitiveRank(resolvedCompetitiveRank);
          setProfileCache({
            authKey,
            loadoutSnapshot: resolvedLoadout,
            loadoutCacheVersion: PROFILE_LOADOUT_CACHE_VERSION,
            ownedSkinItemIds: nextOwnedSkinList,
            ownedSprayItemIds: nextOwnedSprayList,
            ownedFlexItemIds: nextOwnedFlexList,
            ownedPlayerCardItemIds: nextOwnedPlayerCardList,
            ownedPlayerTitleItemIds: nextOwnedPlayerTitleList,
            competitiveRank: resolvedCompetitiveRank,
            rankCacheVersion: nextCompetitiveRank
                ? PROFILE_RANK_CACHE_VERSION
                : cachedCompetitiveRank
                    ? cachedProfile?.rankCacheVersion
                    : undefined,
            updatedAt: Date.now(),
          });
        } catch (err) {
          if (__DEV__) {
            console.warn("[profile] fetchLoadoutData failed", err);
          }
        } finally {
          fetchLoadoutInFlightRef.current = false;
          if (showSpinner) {
            setLoading(false);
          }
        }
      },
      [
        authKey,
        cachedCompetitiveRank,
        cachedProfile,
        competitiveRank,
        hasAuth,
        syncLoadoutState,
        setProfileCache,
        setUser,
        user,
      ]
  );

  // ── Effect: Fetch weapon metadata từ valorant-api.com ──────────────────────
  React.useEffect(() => {
    let isMounted = true;

    getPublicWeapons()
        .then((weapons) => {
          if (!isMounted) return;
          const map: WeaponMetadataMap = {};
          weapons.forEach((weapon) => {
            map[weapon.uuid] = weapon as WeaponMetadata;
          });
          setWeaponMetadata(map);
        })
        .catch((err) => {
          if (__DEV__) console.error(err);
        });

    return () => {
      isMounted = false;
    };
  }, []);

  // ── Effect cleanup: Hủy các task và timeout khi unmount ─────────────────
  React.useEffect(
      () => () => {
        pickerTaskRef.current?.cancel();
        initialFetchTaskRef.current?.cancel();
        if (initialFetchTimeoutRef.current) {
          clearTimeout(initialFetchTimeoutRef.current);
          initialFetchTimeoutRef.current = null;
        }
        rankTransitionTimersRef.current.forEach(clearTimeout);
        rankTransitionTimersRef.current = [];
        profileModeTimersRef.current.forEach(clearTimeout);
        profileModeTimersRef.current = [];
        dashboardPreloadTaskRef.current?.cancel();
        dashboardPreloadTaskRef.current = null;
        if (heroSubtitleCollapseTimerRef.current) {
          clearTimeout(heroSubtitleCollapseTimerRef.current);
          heroSubtitleCollapseTimerRef.current = null;
        }
        if (profileModeInteractionTimerRef.current) {
          clearTimeout(profileModeInteractionTimerRef.current);
          profileModeInteractionTimerRef.current = null;
        }
        profileModeInteractionLockedRef.current = false;
      },
      []
  );

  // ── Effect chính: Fetch dữ liệu profile ─────────────────────────────────────
  // Logic:
  // - Nếu không có auth → reset state, hiển thị lỗi.
  // - Nếu cache còn fresh và có loadout cache + rank cache → không fetch.
  // - Nếu cache fresh nhưng thiếu rank → refresh rank (chỉ 1 lần).
  // - Nếu cache stale hoặc không có → fetch đầy đủ khi JS runtime rảnh.
  // - Delay: 120ms nếu có cache, 260ms nếu không (để animation mượt).
  React.useEffect(() => {
    if (!hasAuth) {
      // Reset toàn bộ state khi không có auth
      setLoadoutSnapshot(null);
      setRawGuns([]);
      setRawSprays([]);
      setRawActiveExpressions([]);
      setIdentity(null);
      setOwnedSkinItemIds([]);
      setOwnedSprayItemIds([]);
      setOwnedFlexItemIds([]);
      setOwnedPlayerCardItemIds([]);
      setOwnedPlayerTitleItemIds([]);
      setCompetitiveRank(null);
      setPickerState(null);
      setIdentityPickerQuery("");
      setPickerLoading(false);
      setPickerError(null);
      setError(t("equip_page.missing_auth"));
      setLoading(!cachedLoadoutSnapshot);
      return;
    }

    const hasRankCache = hasValidCompetitiveRankCache(cachedProfile);
    const hasLoadoutCache = Boolean(cachedLoadoutSnapshot);

    if (isProfileCacheFresh(cachedProfile) && hasLoadoutCache) {
      if (hasRankCache) {
        rankRefreshAuthKeyRef.current = null;
        return; // Cache hoàn toàn fresh → không cần fetch
      }

      // Cache fresh nhưng thiếu rank → chỉ refresh rank 1 lần
      if (rankRefreshAuthKeyRef.current === authKey) {
        return;
      }

      rankRefreshAuthKeyRef.current = authKey;
    }

    // Hủy task cũ trước khi tạo mới
    initialFetchTaskRef.current?.cancel();
    if (initialFetchTimeoutRef.current) {
      clearTimeout(initialFetchTimeoutRef.current);
      initialFetchTimeoutRef.current = null;
    }

    initialFetchTaskRef.current = runWhenIdle(() => {
      initialFetchTimeoutRef.current = setTimeout(() => {
        initialFetchTimeoutRef.current = null;
        void fetchLoadoutData(!cachedLoadoutSnapshot);
      }, cachedLoadoutSnapshot ? 120 : 260);
    });

    return () => {
      initialFetchTaskRef.current?.cancel();
      initialFetchTaskRef.current = null;
      if (initialFetchTimeoutRef.current) {
        clearTimeout(initialFetchTimeoutRef.current);
        initialFetchTimeoutRef.current = null;
      }
    };
  }, [authKey, cachedLoadoutSnapshot, cachedProfile, fetchLoadoutData, hasAuth, t]);

  // ─── loadoutDetails: Map rawGuns → EquippedWeapon[] với đầy đủ metadata ──
  // Kết hợp dữ liệu từ weaponMetadata và assets để tạo object hiển thị.
  const loadoutDetails = React.useMemo<EquippedWeapon[]>(() => {
    const assets = getAssets();

    return rawGuns.map((gun) => {
      const metadata = weaponMetadata[gun.ID];
      const category = normalizeProfileWeaponCategory(resolveCategory(metadata));

      const skin =
          assets.skins.find((item) => item.uuid === gun.SkinID) ||
          assets.skins.find((item) =>
              item.levels.some((level) => level.uuid === gun.SkinLevelID)
          );

      const chroma = skin?.chromas.find((item) => item.uuid === gun.ChromaID);
      const level = skin?.levels.find((item) => item.uuid === gun.SkinLevelID);
      const upgradeLevelIndex = skin?.levels.findIndex(
          (item) => item.uuid === gun.SkinLevelID
      );
      const tierVisual = getContentTierVisual(skin?.contentTierUuid);

      const buddy = assets.buddies.find(
          (item) =>
              item.uuid === gun.CharmID ||
              item.levels.some((level) => level.uuid === gun.CharmLevelID)
      );

      const buddyLevel =
          buddy?.levels.find((level) => level.uuid === gun.CharmLevelID) ||
          buddy?.levels?.[0];

      const weaponName = metadata?.displayName || skin?.displayName || gun.ID;

      return {
        weaponId: gun.ID,
        weaponName,
        category,
        skinId: gun.SkinID,
        skinLevelId: gun.SkinLevelID,
        chromaId: gun.ChromaID,
        charmInstanceId: gun.CharmInstanceID,
        charmId: gun.CharmID,
        charmLevelId: gun.CharmLevelID,
        skinName: skin?.displayName || t("equip_page.unknown_skin"),
        skinLevelName: level?.displayName,
        chromaName: chroma?.displayName,
        image:
            chroma?.displayIcon ||
            level?.displayIcon ||
            skin?.displayIcon ||
            chroma?.fullRender,
        buddyName: buddyLevel?.displayName || buddy?.displayName,
        buddyIcon: buddyLevel?.displayIcon,
        contentTierUuid: skin?.contentTierUuid,
        contentTierName: tierVisual.label,
        upgradeLevel:
            typeof upgradeLevelIndex === "number" && upgradeLevelIndex >= 0
                ? upgradeLevelIndex + 1
                : undefined,
        maxUpgradeLevel: skin?.levels.length,
      };
    });
  }, [rawGuns, t, weaponMetadata]);

  // ─── loadoutSorted: Sắp xếp loadout theo category → weapon order → tên ──
  const loadoutSorted = React.useMemo(() => {
    const categoryWeight = (category: string) => {
      const index = CATEGORY_ORDER.indexOf(
          category as (typeof CATEGORY_ORDER)[number]
      );
      return index === -1 ? CATEGORY_ORDER.length : index;
    };

    return [...loadoutDetails].sort((a, b) => {
      const diff = categoryWeight(a.category) - categoryWeight(b.category);
      if (diff !== 0) return diff;

      const weaponDiff =
          getProfileWeaponOrderIndex(a.weaponName) -
          getProfileWeaponOrderIndex(b.weaponName);
      if (weaponDiff !== 0) return weaponDiff;

      return a.weaponName.localeCompare(b.weaponName);
    });
  }, [loadoutDetails]);

  // ─── loadoutByCategory: Nhóm loadout theo category ─────────────────────────
  const loadoutByCategory = React.useMemo(
      () =>
          loadoutSorted.reduce<Record<string, EquippedWeapon[]>>((groups, weapon) => {
            const category = weapon.category || "Other";
            (groups[category] ??= []).push(weapon);
            return groups;
          }, {}),
      [loadoutSorted]
  );

  // ─── orderedLoadoutCategories: Danh sách category đã sắp xếp ──────────────
  // Categories biết trước (trong CATEGORY_ORDER) + các category lạ.
  const orderedLoadoutCategories = React.useMemo(() => {
    const knownCategories = CATEGORY_ORDER.filter(
        (category) => loadoutByCategory[category]?.length
    );
    const customCategories = Object.keys(loadoutByCategory).filter(
        (category) =>
            !CATEGORY_ORDER.includes(category as (typeof CATEGORY_ORDER)[number])
    );

    return [...knownCategories, ...customCategories];
  }, [loadoutByCategory]);

  // ─── sprayDetails: Map rawSprays → EquippedSpray[] ────────────────────────
  const sprayDetails = React.useMemo<EquippedSpray[]>(() => {
    const assets = getAssets();

    return rawSprays
        .map((spray) => {
          const sprayAsset = assets.sprays.find(
              (item) => item.uuid === spray.SprayID
          );

          if (!sprayAsset) return null;

          return {
            id: spray.SprayID,
            slot: spray.EquipSlotID,
            sprayLevelId: spray.SprayLevelID,
            name: sprayAsset.displayName,
            icon: sprayAsset.displayIcon,
          };
        })
        .filter(Boolean) as EquippedSpray[];
  }, [rawSprays]);

  // ─── expressionDetails: Map rawActiveExpressions → EquippedExpression[] ──
  const expressionDetails = React.useMemo<EquippedExpression[]>(() => {
    const assets = getAssets();

    return rawActiveExpressions
        .map((expression, slotIndex) => {
          const typeId = expression.TypeID.toLowerCase();

          if (typeId === VItemTypes.Spray.toLowerCase()) {
            const spray = assets.sprays.find(
                (item) =>
                    item.uuid === expression.AssetID ||
                    item.levels.some((level) => level.uuid === expression.AssetID)
            );

            return {
              slotIndex,
              kind: "spray" as const,
              id: expression.AssetID,
              name: spray?.displayName || "Graffiti",
              icon:
                  spray?.fullTransparentIcon ||
                  spray?.displayIcon ||
                  spray?.fullIcon,
            };
          }

          if (typeId === VItemTypes.Flex.toLowerCase()) {
            const flex = assets.flex.find(
                (item) => item.uuid === expression.AssetID
            );

            return {
              slotIndex,
              kind: "flex" as const,
              id: expression.AssetID,
              name: flex?.displayName || "Flex",
              icon: flex?.displayIcon,
            };
          }

          return null;
        })
        .filter(Boolean) as EquippedExpression[];
  }, [rawActiveExpressions]);

  // ─── identityDetails: Thông tin identity đã enrich từ assets ──────────────
  const identityDetails = React.useMemo<IdentityDetails | null>(() => {
    if (!identity) return null;

    const assets = getAssets();
    const card = assets.cards.find((item) => item.uuid === identity.PlayerCardID);
    const title = assets.titles.find((item) => item.uuid === identity.PlayerTitleID);
    const accountLevel =
        identity.AccountLevel > 0 ? identity.AccountLevel : user.progress.level;

    return {
      cardId: identity.PlayerCardID,
      cardArt: card?.displayIcon || card?.largeArt || card?.wideArt,
      cardName: card?.displayName,
      titleName: title?.titleText || title?.displayName,
      level: accountLevel,
      hideLevel: identity.HideAccountLevel,
    };
  }, [identity, user.progress.level]);

  const collectionCheckerProfile = React.useMemo<CollectionCheckerProfile>(
      () => ({
        gameName: user.name,
        tagLine: user.TagLine,
        region: regionLabel,
        level: identityDetails?.level ?? user.progress.level,
        avatarUri: identityDetails?.cardArt,
        avatarCacheId: identityDetails?.cardId
            ? `player-card:${identityDetails.cardId}:avatar`
            : undefined,
        rank: competitiveRank,
        balances: {
          vp: user.balances.vp,
          rad: user.balances.rad,
          kc: user.balances.kc,
        },
      }),
      [
        competitiveRank,
        identityDetails?.cardArt,
        identityDetails?.cardId,
        identityDetails?.level,
        regionLabel,
        user.TagLine,
        user.balances.kc,
        user.balances.rad,
        user.balances.vp,
        user.name,
        user.progress.level,
      ]
  );

  // ─── ownedSkinIdSet/Spray/Flex/Card/Title: Set từ danh sách ID sở hữu ──
  // Dùng để kiểm tra nhanh "có sở hữu item này không?" (O(1)).
  const ownedSkinIdSet = React.useMemo(
      () => new Set(ownedSkinItemIds),
      [ownedSkinItemIds]
  );

  const ownedSprayIdSet = React.useMemo(
      () => new Set(ownedSprayItemIds),
      [ownedSprayItemIds]
  );

  const ownedFlexIdSet = React.useMemo(
      () => new Set(ownedFlexItemIds),
      [ownedFlexItemIds]
  );

  const ownedPlayerCardIdSet = React.useMemo(
      () => new Set(ownedPlayerCardItemIds.map((itemId) => itemId.toLowerCase())),
      [ownedPlayerCardItemIds]
  );

  const ownedPlayerTitleIdSet = React.useMemo(
      () => new Set(ownedPlayerTitleItemIds.map((itemId) => itemId.toLowerCase())),
      [ownedPlayerTitleItemIds]
  );

  const ownedPlayerCardOptions = React.useMemo<OwnedPlayerCardOption[]>(() => {
    const currentCardId = identity?.PlayerCardID?.toLowerCase();
    const options: OwnedPlayerCardOption[] = getAssets()
        .cards.filter(
            (card) =>
                card.uuid.toLowerCase() === currentCardId ||
                ownedPlayerCardIdSet.has(card.uuid.toLowerCase())
        )
        .map((card) => ({
          id: card.uuid,
          name: card.displayName,
          image: card.displayIcon || card.smallArt || card.largeArt,
          selected: card.uuid.toLowerCase() === currentCardId,
        }));

    if (identity?.PlayerCardID && !options.some((option) => option.selected)) {
      options.push({
        id: identity.PlayerCardID,
        name:
            identityDetails?.cardName ||
            t("equip_page.identity.card_fallback"),
        image: identityDetails?.cardArt,
        selected: true,
      });
    }

    return options.sort((left, right) => {
      if (left.selected !== right.selected) {
        return left.selected ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "vi");
    });
  }, [identity?.PlayerCardID, identityDetails, ownedPlayerCardIdSet, t]);

  const ownedPlayerTitleOptions = React.useMemo<OwnedPlayerTitleOption[]>(() => {
    const currentTitleId = identity?.PlayerTitleID?.toLowerCase();
    const options = getAssets()
        .titles.filter(
            (title) =>
                title.uuid.toLowerCase() === currentTitleId ||
                ownedPlayerTitleIdSet.has(title.uuid.toLowerCase())
        )
        .map((title) => ({
          id: title.uuid,
          name:
              title.titleText?.trim() ||
              title.displayName ||
              t("equip_page.identity.title_fallback"),
          selected: title.uuid.toLowerCase() === currentTitleId,
        }));

    if (identity?.PlayerTitleID && !options.some((option) => option.selected)) {
      options.push({
        id: identity.PlayerTitleID,
        name:
            identityDetails?.titleName ||
            t("equip_page.identity.title_fallback"),
        selected: true,
      });
    }

    return options.sort((left, right) => {
      if (left.selected !== right.selected) {
        return left.selected ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "vi");
    });
  }, [identity?.PlayerTitleID, identityDetails, ownedPlayerTitleIdSet, t]);

  const equippedExpressionIdSet = React.useMemo(
      () => new Set(rawActiveExpressions.map((expression) => expression.AssetID)),
      [rawActiveExpressions]
  );

  // ─── skinWeaponMetadata: Map skinUUID → weapon metadata ──────────────────
  // Tra ngược: từ skin UUID tìm weapon cha.
  const skinWeaponMetadata = React.useMemo(() => {
    const map = new Map<string, WeaponMetadata>();

    Object.values(weaponMetadata).forEach((weapon) => {
      weapon.skins?.forEach((skin) => {
        map.set(skin.uuid, weapon);
      });
    });

    return map;
  }, [weaponMetadata]);

  /**
   * buildOwnedSkinOptions — Xây dựng danh sách OwnedSkinOption cho một vũ khí.
   * Lọc các skin mà user sở hữu, kèm chroma options, tier, upgrade level.
   */
  const buildOwnedSkinOptions = React.useCallback(
      (weapon: EquippedWeapon): OwnedSkinOption[] => {
        const assets = getAssets();
        const metadata = weaponMetadata[weapon.weaponId];
        const weaponSkinIds = new Set((metadata?.skins ?? []).map((skin) => skin.uuid));
        const normalizedWeaponName = normalizeWeaponKey(weapon.weaponName);
        const candidateSkins = assets.skins.filter((skin) => {
          if (weaponSkinIds.size > 0) {
            return weaponSkinIds.has(skin.uuid) || skin.uuid === weapon.skinId;
          }

          if (skin.uuid === weapon.skinId) {
            return true;
          }

          if (!normalizedWeaponName) {
            return false;
          }

          const skinName = normalizeWeaponKey(skin.displayName);
          const levelNames = (skin.levels ?? []).map((level) =>
              normalizeWeaponKey(level.displayName)
          );

          return (
              skinName.includes(normalizedWeaponName) ||
              levelNames.some((levelName) => levelName.includes(normalizedWeaponName))
          );
        });

        const options = candidateSkins
            .filter(
                (skin) =>
                    skin.uuid === weapon.skinId ||
                    ownedSkinIdSet.has(skin.uuid) ||
                    skin.levels.some((level) => ownedSkinIdSet.has(level.uuid)) ||
                    skin.chromas.some((chroma) => ownedSkinIdSet.has(chroma.uuid))
            )
            .filter(
                (skin, index, list) =>
                    list.findIndex((item) => item.uuid === skin.uuid) === index
            )
            .map((skin) => {
              const currentLevel = skin.levels.find(
                  (level) => level.uuid === weapon.skinLevelId
              );
              const ownedLevels = skin.levels.filter((level) =>
                  ownedSkinIdSet.has(level.uuid)
              );
              const selectedLevel =
                  currentLevel ||
                  ownedLevels[ownedLevels.length - 1] ||
                  skin.levels[0];

              const levelIndex = skin.levels.findIndex(
                  (level) => level.uuid === selectedLevel?.uuid
              );
              const tier = getContentTierVisual(skin.contentTierUuid);
              const chromaOptions = skin.chromas
                  .filter(Boolean)
                  .filter(
                      (chroma, index, list) =>
                          list.findIndex((item) => item.uuid === chroma.uuid) === index
                  );
              const previewChroma =
                  chromaOptions.find((chroma) => chroma.uuid === weapon.chromaId) ||
                  chromaOptions[0];

              return {
                id: skin.uuid,
                skinId: skin.uuid,
                skinLevelId: selectedLevel?.uuid || weapon.skinLevelId,
                chromaId: previewChroma?.uuid || weapon.chromaId,
                name: skin.displayName,
                chromaName:
                    normalizeVariantLabel(skin.displayName, previewChroma?.displayName) ||
                    undefined,
                image:
                    previewChroma?.displayIcon ||
                    selectedLevel?.displayIcon ||
                    skin.displayIcon ||
                    previewChroma?.fullRender,
                contentTierUuid: skin.contentTierUuid,
                contentTierName: tier.label,
                upgradeLevel: levelIndex >= 0 ? levelIndex + 1 : undefined,
                maxUpgradeLevel: skin.levels.length || undefined,
                chromas: chromaOptions.map((chroma) => ({
                  id: chroma.uuid,
                  name:
                      normalizeVariantLabel(skin.displayName, chroma.displayName) ||
                      "Default",
                  swatch: chroma.swatch,
                  image: chroma.displayIcon || chroma.fullRender,
                  selected: chroma.uuid === weapon.chromaId,
                })),
                selected:
                    skin.uuid === weapon.skinId &&
                    (selectedLevel?.uuid || weapon.skinLevelId) === weapon.skinLevelId &&
                    (previewChroma?.uuid || weapon.chromaId) === weapon.chromaId,
              };
            })
            .sort((a, b) => {
              const selectedDiff = Number(b.selected) - Number(a.selected);
              if (selectedDiff !== 0) {
                return selectedDiff;
              }

              const nameDiff = a.name.localeCompare(b.name);
              if (nameDiff !== 0) {
                return nameDiff;
              }

              return (a.chromaName || "").localeCompare(b.chromaName || "");
            });

        return options;
      },
      [ownedSkinIdSet, weaponMetadata]
  );

  /**
   * buildOwnedSprayOptions — Xây dựng danh sách OwnedSprayOption.
   */
  const buildOwnedSprayOptions = React.useCallback(
      (spray: EquippedSpray): OwnedSprayOption[] => {
        const assets = getAssets();

        return assets.sprays
            .filter(
                (sprayAsset) =>
                    sprayAsset.uuid === spray.id ||
                    ownedSprayIdSet.has(sprayAsset.uuid) ||
                    sprayAsset.levels.some((level) => ownedSprayIdSet.has(level.uuid))
            )
            .map((sprayAsset) => ({
              id: sprayAsset.uuid,
              sprayId: sprayAsset.uuid,
              sprayLevelId: sprayAsset.levels[0]?.uuid ?? null,
              name: sprayAsset.displayName,
              icon:
                  sprayAsset.fullTransparentIcon ||
                  sprayAsset.displayIcon ||
                  sprayAsset.fullIcon,
              selected: sprayAsset.uuid === spray.id,
            }))
            .sort((a, b) => {
              const selectedDiff = Number(b.selected) - Number(a.selected);
              if (selectedDiff !== 0) {
                return selectedDiff;
              }

              return a.name.localeCompare(b.name);
            });
      },
      [ownedSprayIdSet]
  );

  /**
   * buildOwnedExpressionOptions — Xây dựng danh sách OwnedExpressionOption.
   * Hỗ trợ cả spray và flex.
   */
  const buildOwnedExpressionOptions = React.useCallback(
      (
          expression: EquippedExpression,
          kind: ExpressionKind
      ): OwnedExpressionOption[] => {
        const assets = getAssets();
        const options =
            kind === "spray"
                ? assets.sprays
                    .filter(
                        (spray) =>
                            equippedExpressionIdSet.has(spray.uuid) ||
                            ownedSprayIdSet.has(spray.uuid) ||
                            spray.levels.some(
                                (level) =>
                                    equippedExpressionIdSet.has(level.uuid) ||
                                    ownedSprayIdSet.has(level.uuid)
                            )
                    )
                    .map((spray) => ({
                      id: spray.uuid,
                      kind: "spray" as const,
                      assetId: spray.uuid,
                      name: spray.displayName,
                      icon:
                          spray.fullTransparentIcon ||
                          spray.displayIcon ||
                          spray.fullIcon,
                      selected:
                          expression.kind === "spray" &&
                          spray.uuid === expression.id,
                    }))
                : assets.flex
                    .filter(
                        (flex) =>
                            equippedExpressionIdSet.has(flex.uuid) ||
                            ownedFlexIdSet.has(flex.uuid)
                    )
                    .map((flex) => ({
                      id: flex.uuid,
                      kind: "flex" as const,
                      assetId: flex.uuid,
                      name: flex.displayName,
                      icon: flex.displayIcon,
                      selected:
                          expression.kind === "flex" && flex.uuid === expression.id,
                    }));

        return options.sort((left, right) => {
          const selectedDiff = Number(right.selected) - Number(left.selected);
          return selectedDiff || left.name.localeCompare(right.name);
        });
      },
      [equippedExpressionIdSet, ownedFlexIdSet, ownedSprayIdSet]
  );

  // ─── ownedCollection: Bộ sưu tập skin đã sở hữu ─────────────────────────────
  const ownedCollection = React.useMemo<OwnedWeaponCollectionItem[]>(() => {
    const assets = getAssets();
    const equippedBySkinId = new Map(
        loadoutDetails.map((weapon) => [weapon.skinId, weapon] as const)
    );

    const categoryWeight = (category: string) => {
      const index = CATEGORY_ORDER.indexOf(
          category as (typeof CATEGORY_ORDER)[number]
      );
      return index === -1 ? CATEGORY_ORDER.length : index;
    };

    const ownedSkins = assets.skins
        .filter((skin) => {
          if (!skin.contentTierUuid) {
            return false;
          }

          return (
              ownedSkinIdSet.has(skin.uuid) ||
              skin.levels.some((level) => ownedSkinIdSet.has(level.uuid)) ||
              skin.chromas.some((chroma) => ownedSkinIdSet.has(chroma.uuid))
          );
        })
        .map((skin) => {
          const weapon = skinWeaponMetadata.get(skin.uuid);
          const equippedWeapon = equippedBySkinId.get(skin.uuid);
          const category = normalizeProfileWeaponCategory(resolveCategory(weapon));
          const weaponName = weapon?.displayName || equippedWeapon?.weaponName || "Unknown";
          const ownedLevels = skin.levels.filter((level) =>
              ownedSkinIdSet.has(level.uuid)
          );
          const ownedChromas = skin.chromas.filter((chroma) =>
              ownedSkinIdSet.has(chroma.uuid)
          );
          const selectedLevel =
              ownedLevels[ownedLevels.length - 1] ||
              skin.levels[skin.levels.length - 1] ||
              skin.levels[0];
          const selectedChroma =
              ownedChromas[0] ||
              skin.chromas[0];
          const upgradeLevelIndex = skin.levels.findIndex(
              (level) => level.uuid === selectedLevel?.uuid
          );
          const tierVisual = getContentTierVisual(skin.contentTierUuid);

          return {
            collectionId: skin.uuid,
            weaponId: weapon?.uuid || equippedWeapon?.weaponId || skin.uuid,
            weaponName,
            category,
            skinId: skin.uuid,
            skinLevelId: selectedLevel?.uuid || equippedWeapon?.skinLevelId || "",
            chromaId: selectedChroma?.uuid || equippedWeapon?.chromaId || "",
            charmInstanceId: equippedWeapon?.charmInstanceId,
            charmId: equippedWeapon?.charmId,
            charmLevelId: equippedWeapon?.charmLevelId,
            skinName: skin.displayName,
            skinLevelName: selectedLevel?.displayName,
            chromaName: selectedChroma?.displayName,
            image:
                selectedChroma?.displayIcon ||
                selectedLevel?.displayIcon ||
                skin.displayIcon ||
                selectedChroma?.fullRender,
            buddyName: equippedWeapon?.buddyName,
            buddyIcon: equippedWeapon?.buddyIcon,
            contentTierUuid: skin.contentTierUuid,
            contentTierName: tierVisual.label,
            upgradeLevel:
                upgradeLevelIndex >= 0 ? upgradeLevelIndex + 1 : undefined,
            maxUpgradeLevel: skin.levels.length || undefined,
          };
        })
        .sort((a, b) => {
          const categoryDiff = categoryWeight(a.category) - categoryWeight(b.category);
          if (categoryDiff !== 0) {
            return categoryDiff;
          }

          const weaponDiff =
              getProfileWeaponOrderIndex(a.weaponName) -
              getProfileWeaponOrderIndex(b.weaponName);
          if (weaponDiff !== 0) {
            return weaponDiff;
          }

          const weaponNameDiff = a.weaponName.localeCompare(b.weaponName);
          if (weaponNameDiff !== 0) {
            return weaponNameDiff;
          }

          return a.skinName.localeCompare(b.skinName);
        });

    if (ownedSkins.length > 0) {
      return ownedSkins;
    }

    return loadoutSorted.map((weapon) => ({
      ...weapon,
      collectionId: weapon.skinId || weapon.weaponId,
    }));
  }, [loadoutDetails, loadoutSorted, ownedSkinIdSet, skinWeaponMetadata]);

  // ─── collectionWeaponTabs: Danh sách tab lọc vũ khí trong collection ──────
  const collectionWeaponTabs = React.useMemo(() => {
    const uniqueWeaponNames = Array.from(
        new Set(
            ownedCollection
                .map((item) => item.weaponName)
                .filter((weaponName) => weaponName?.trim().length)
        )
    );

    uniqueWeaponNames.sort((left, right) => {
      const orderDiff =
          getProfileWeaponOrderIndex(left) - getProfileWeaponOrderIndex(right);
      if (orderDiff !== 0) {
        return orderDiff;
      }

      return left.localeCompare(right);
    });

    return ["all", ...uniqueWeaponNames];
  }, [ownedCollection]);

  React.useEffect(() => {
    if (
        collectionWeaponFilter !== "all" &&
        !collectionWeaponTabs.includes(collectionWeaponFilter)
    ) {
      setCollectionWeaponFilter("all");
    }
  }, [collectionWeaponFilter, collectionWeaponTabs]);

  // ─── filteredCollection: Collection đã lọc theo tab weapon + search query ─
  const filteredCollection = React.useMemo(() => {
    const normalizedFilter = normalizeWeaponKey(collectionWeaponFilter);
    const scopedCollection =
        collectionWeaponFilter === "all"
            ? ownedCollection
            : ownedCollection.filter(
                (item) =>
                    normalizeWeaponKey(item.weaponName) === normalizedFilter
            );

    if (!searchQuery.trim()) return scopedCollection;

    const query = searchQuery.trim().toLowerCase();
    return scopedCollection.filter(
        (item) =>
            item.skinName.toLowerCase().includes(query) ||
            item.weaponName.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
    );
  }, [collectionWeaponFilter, ownedCollection, searchQuery]);

  const profileListRowsByTab = React.useMemo<Record<TabKey, ProfileListRow[]>>(() => {
    if (loading) {
      const rows: ProfileListRow[] = [
        { key: "status-loading", kind: "loading" },
      ];
      return { loadout: rows, skins: rows, collection: rows };
    }

    if (error) {
      const rows: ProfileListRow[] = [
        {
          key: "status-error",
          kind: "message",
          message: error,
          tone: "error",
        },
      ];
      return { loadout: rows, skins: rows, collection: rows };
    }

    const loadoutRows: ProfileListRow[] = [
      { key: "identity", kind: "identity" },
      { key: "expressions", kind: "expressions" },
    ];

    if (loadoutSorted.length === 0) {
      const emptyRows: ProfileListRow[] = [
        {
          key: "status-empty-loadout",
          kind: "message",
          message: t("equip_page.empty"),
          tone: "empty",
        },
      ];
      return {
        loadout: loadoutRows,
        skins: emptyRows,
        collection: emptyRows,
      };
    }

    const skinRows: ProfileListRow[] = orderedLoadoutCategories.map(
        (category) => ({
        key: `skin-category:${category}`,
        kind: "skin-category" as const,
        category,
      })
    );

    let collectionRows: ProfileListRow[];
    if (filteredCollection.length === 0) {
      collectionRows = [
        {
          key: "status-empty-collection",
          kind: "message",
          message: t("equip_page.empty"),
          tone: "empty",
        },
      ];
    } else {
      collectionRows = [];
      for (
        let index = 0;
        index < filteredCollection.length;
        index += profileGridColumns
      ) {
        const items = filteredCollection.slice(index, index + profileGridColumns);
        collectionRows.push({
          key: `collection-row:${items[0].collectionId}`,
          kind: "collection-row",
          items,
        });
      }
    }

    return {
      loadout: loadoutRows,
      skins: skinRows,
      collection: collectionRows,
    };
  }, [
    error,
    filteredCollection,
    loading,
    loadoutSorted.length,
    orderedLoadoutCategories,
    profileGridColumns,
    t,
  ]);

  /**
   * handleRefresh — Pull-to-refresh: gọi fetchLoadoutData không spinner.
   */
  const handleRefresh = React.useCallback(async () => {
    if (!hasAuth) return;

    setRefreshing(true);
    await fetchLoadoutData(false, true);
    setRefreshing(false);
  }, [fetchLoadoutData, hasAuth]);

  const handleStatsRefresh = React.useCallback(async () => {
    if (!hasAuth) return;

    setStatsRefreshing(true);
    try {
      await Promise.all([
        fetchMatches(user, true),
        fetchSeasonStats(user, true),
      ]);
    } finally {
      setStatsRefreshing(false);
    }
  }, [fetchMatches, fetchSeasonStats, hasAuth, user]);

  /**
   * handleDismissPicker — Đóng picker modal và reset state liên quan.
   */
  const handleDismissPicker = React.useCallback(() => {
    pickerTaskRef.current?.cancel();
    pickerTaskRef.current = null;
    setPickerLoading(false);
    setActiveWeaponChroma(null);
    setPickerState(null);
    setIdentityPickerQuery("");
    setPickerError(null);
  }, []);

  const showLoadoutUpdateError = React.useCallback(() => {
    Toast.show({
      type: "error",
      text1: t("equip_page.error_loading"),
    });
  }, [t]);

  const handleTabChange = React.useCallback(
    (tab: TabKey) => {
      handleDismissPicker();
      const nextIndex = PROFILE_TAB_KEYS.indexOf(tab);

      if (nextIndex < 0) return;

      profilePagerRef.current?.scrollTo({
        x: nextIndex * viewportWidth,
        y: 0,
        animated: !reduceMotionEnabled,
      });

      if (reduceMotionEnabled) {
        setActiveTab(tab);
      }
    },
    [
      handleDismissPicker,
      profilePagerRef,
      reduceMotionEnabled,
      viewportWidth,
    ]
  );
  const setPagerGestureEnabled = React.useCallback((enabled: boolean) => {
    profilePagerRef.current?.setNativeProps({ scrollEnabled: enabled });
  }, [profilePagerRef]);
  const {
    bodyAnimatedStyle: collapsibleBodyAnimatedStyle,
    contentPanGesture: profileContentPanGesture,
    handleContentScroll: handleProfileContentScroll,
    handleHeaderLayout,
    headerAnimatedStyle: collapsibleHeaderAnimatedStyle,
    headerHeight: collapsibleHeaderHeight,
    panGesture: profileHeaderPanGesture,
  } = useProfileCollapsibleHeader();
  const skinWhitespacePagerPanResponder = React.useMemo(
      () =>
          PanResponder.create({
            onMoveShouldSetPanResponder: (_event, gestureState) => {
              const horizontalDistance = Math.abs(gestureState.dx);
              const verticalDistance = Math.abs(gestureState.dy);

              return (
                  horizontalDistance > 8 &&
                  horizontalDistance > verticalDistance * 1.15
              );
            },
            onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
              const horizontalDistance = Math.abs(gestureState.dx);
              const verticalDistance = Math.abs(gestureState.dy);

              return (
                  horizontalDistance > 8 &&
                  horizontalDistance > verticalDistance * 1.15
              );
            },
            onPanResponderGrant: () => {
              const currentIndex = PROFILE_TAB_KEYS.indexOf(activeTab);
              skinWhitespacePagerOriginRef.current =
                  currentIndex * viewportWidth;
              setPagerGestureEnabled(false);
            },
            onPanResponderMove: (_event, gestureState) => {
              const nextOffset = Math.max(
                  0,
                  Math.min(
                      (PROFILE_TAB_KEYS.length - 1) * viewportWidth,
                      skinWhitespacePagerOriginRef.current - gestureState.dx
                  )
              );

              profilePagerRef.current?.scrollTo({
                x: nextOffset,
                y: 0,
                animated: false,
              });
            },
            onPanResponderRelease: (_event, gestureState) => {
              const currentIndex = PROFILE_TAB_KEYS.indexOf(activeTab);
              const shouldChangePage =
                  Math.abs(gestureState.dx) > viewportWidth * 0.16 ||
                  Math.abs(gestureState.vx) > 0.35;
              const direction = gestureState.dx < 0 ? 1 : -1;
              const nextIndex = shouldChangePage
                  ? Math.max(
                      0,
                      Math.min(
                          PROFILE_TAB_KEYS.length - 1,
                          currentIndex + direction
                      )
                  )
                  : currentIndex;

              setPagerGestureEnabled(true);
              handleTabChange(PROFILE_TAB_KEYS[nextIndex]);
            },
            onPanResponderTerminate: () => {
              setPagerGestureEnabled(true);
              handleTabChange(activeTab);
            },
            onPanResponderTerminationRequest: () => false,
          }),
      [
        activeTab,
        handleTabChange,
        setPagerGestureEnabled,
        viewportWidth,
      ]
  );

  const handlePagerMomentumEnd = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.max(
          0,
          Math.min(
              PROFILE_TAB_KEYS.length - 1,
              Math.round(event.nativeEvent.contentOffset.x / Math.max(1, viewportWidth))
          )
      );
      setActiveTab(PROFILE_TAB_KEYS[nextIndex]);
    },
    [viewportWidth]
  );

  /**
   * handleOpenWeaponPicker — Mở picker chọn skin cho vũ khí.
   * Load options bất đồng bộ khi JS runtime rảnh.
   */
  const handleOpenWeaponPicker = React.useCallback(
      (weapon: EquippedWeapon) => {
        pickerTaskRef.current?.cancel();
        setPickerError(null);
        setPickerLoading(true);
        setActiveWeaponChroma(null);

        pickerTaskRef.current = runWhenIdle(() => {
          const options = buildOwnedSkinOptions(weapon);
          React.startTransition(() => {
            setPickerState({
              type: "weapon",
              weapon,
              options,
            });
          });
          setPickerLoading(false);
          pickerTaskRef.current = null;
        });
      },
      [buildOwnedSkinOptions]
  );

  const handleOpenSprayPicker = React.useCallback(
      (spray: EquippedSpray) => {
        pickerTaskRef.current?.cancel();
        setPickerError(null);
        setPickerLoading(true);

        pickerTaskRef.current = runWhenIdle(() => {
          const options = buildOwnedSprayOptions(spray);
          React.startTransition(() => {
            setPickerState({
              type: "spray",
              spray,
              options,
            });
          });
          setPickerLoading(false);
          pickerTaskRef.current = null;
        });
      },
      [buildOwnedSprayOptions]
  );

  const handleOpenExpressionPicker = React.useCallback(
      (expression: EquippedExpression, mode: ExpressionKind = expression.kind) => {
        pickerTaskRef.current?.cancel();
        setPickerError(null);
        setPickerLoading(true);

        pickerTaskRef.current = runWhenIdle(() => {
          const options = buildOwnedExpressionOptions(expression, mode);
          React.startTransition(() => {
            setPickerState({
              type: "expression",
              expression,
              mode,
              options,
            });
          });
          setPickerLoading(false);
          pickerTaskRef.current = null;
        });
      },
      [buildOwnedExpressionOptions]
  );

  const handleOpenIdentityPicker = React.useCallback(
      (type: "player-card" | "player-title") => {
        pickerTaskRef.current?.cancel();
        pickerTaskRef.current = null;
        setPickerLoading(false);
        setPickerError(null);
        setActiveWeaponChroma(null);
        setIdentityPickerQuery("");
        setPickerState(
            type === "player-card"
                ? { type: "player-card", options: ownedPlayerCardOptions }
                : { type: "player-title", options: ownedPlayerTitleOptions }
        );
      },
      [ownedPlayerCardOptions, ownedPlayerTitleOptions]
  );

  const persistLoadoutCache = React.useCallback(
      (nextLoadout: PlayerLoadoutResponse) => {
        const resolvedRank = competitiveRank ?? cachedCompetitiveRank;

        setProfileCache({
          authKey,
          loadoutSnapshot: nextLoadout,
          loadoutCacheVersion: PROFILE_LOADOUT_CACHE_VERSION,
          ownedSkinItemIds,
          ownedSprayItemIds,
          ownedFlexItemIds,
          ownedPlayerCardItemIds,
          ownedPlayerTitleItemIds,
          competitiveRank: resolvedRank,
          rankCacheVersion: resolvedRank
              ? PROFILE_RANK_CACHE_VERSION
              : cachedProfile?.rankCacheVersion,
          updatedAt: Date.now(),
        });
      },
      [
        authKey,
        cachedCompetitiveRank,
        cachedProfile?.rankCacheVersion,
        competitiveRank,
        ownedFlexItemIds,
        ownedPlayerCardItemIds,
        ownedPlayerTitleItemIds,
        ownedSkinItemIds,
        ownedSprayItemIds,
        setProfileCache,
      ]
  );

  const applyOptimisticLoadout = React.useCallback(
      (nextLoadout: PlayerLoadoutResponse) => {
        const pendingUpdate: PendingLoadoutUpdate = {
          loadout: nextLoadout,
          updatedAt: Date.now(),
        };

        pendingLoadoutRef.current = pendingUpdate;
        loadoutMutationVersionRef.current += 1;
        syncLoadoutState(nextLoadout);
        persistLoadoutCache(nextLoadout);
        return pendingUpdate;
      },
      [persistLoadoutCache, syncLoadoutState]
  );

  const rollbackOptimisticLoadout = React.useCallback(
      (
          previousLoadout: PlayerLoadoutResponse,
          pendingUpdate: PendingLoadoutUpdate
      ) => {
        if (pendingLoadoutRef.current !== pendingUpdate) {
          return;
        }

        pendingLoadoutRef.current = null;
        loadoutMutationVersionRef.current += 1;
        syncLoadoutState(previousLoadout);
        persistLoadoutCache(previousLoadout);
      },
      [persistLoadoutCache, syncLoadoutState]
  );

  const confirmLoadoutUpdate = React.useCallback(
      async (
          expectedLoadout: PlayerLoadoutResponse,
          pendingUpdate: PendingLoadoutUpdate,
          matchesExpected: (
              latest: PlayerLoadoutResponse,
              expected: PlayerLoadoutResponse
          ) => boolean = loadoutsMatch
      ) => {
        await delay(650);

        const latestLoadout = await playerLoadout(
            user.accessToken,
            user.entitlementsToken,
            user.region,
            user.id
        ).catch(() => null);

        if (
            !latestLoadout ||
            pendingLoadoutRef.current !== pendingUpdate
        ) {
          return;
        }

        const matches = matchesExpected(latestLoadout, expectedLoadout);
        if (__DEV__) {
          console.log("[profile] background loadout confirmation", { matches });
        }

        if (!matches) {
          return;
        }

        pendingLoadoutRef.current = null;
        syncLoadoutState(latestLoadout);
        persistLoadoutCache(latestLoadout);
      },
      [
        persistLoadoutCache,
        syncLoadoutState,
        user.accessToken,
        user.entitlementsToken,
        user.id,
        user.region,
      ]
  );

  const handleEquipIdentity = React.useCallback(
      async (type: "player-card" | "player-title", optionId: string) => {
        if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
          return;
        }

        const identityField =
            type === "player-card" ? "PlayerCardID" : "PlayerTitleID";
        const currentLoadout = loadoutSnapshotRef.current ?? loadoutSnapshot;

        if (currentLoadout.Identity?.[identityField] === optionId) {
          setPickerState(null);
          setIdentityPickerQuery("");
          setPickerError(null);
          return;
        }

        const buildNextLoadout = (source: PlayerLoadoutResponse) => ({
          ...source,
          Identity: {
            ...source.Identity,
            [identityField]: optionId,
          },
        });

        const nextLoadout = buildNextLoadout(currentLoadout);
        const pendingUpdate = applyOptimisticLoadout(nextLoadout);
        setUpdatingLoadout(true);
        setPickerError(null);
        handleDismissPicker();

        try {
          if (__DEV__) {
            console.log("[profile] equip identity request", {
              type,
              optionId,
            });
          }

          const response = await updatePlayerLoadoutV3First(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              nextLoadout
          );
          const putResponse: PlayerLoadoutResponse = {
            ...response,
            Identity: {
              ...response.Identity,
              [identityField]: optionId,
            },
          };

          pendingUpdate.loadout = putResponse;
          pendingUpdate.updatedAt = Date.now();
          if (pendingLoadoutRef.current === pendingUpdate) {
            syncLoadoutState(putResponse);
            persistLoadoutCache(putResponse);
          }
          void confirmLoadoutUpdate(
              putResponse,
              pendingUpdate,
              (latestLoadout) =>
                  latestLoadout.Identity?.[identityField] === optionId
          );
        } catch (err) {
          if (__DEV__) {
            console.error("[profile] equip identity failed", err);
          }
          rollbackOptimisticLoadout(currentLoadout, pendingUpdate);
          showLoadoutUpdateError();
        } finally {
          setUpdatingLoadout(false);
        }
      },
      [
        applyOptimisticLoadout,
        confirmLoadoutUpdate,
        handleDismissPicker,
        hasAuth,
        loadoutSnapshot,
        persistLoadoutCache,
        rollbackOptimisticLoadout,
        showLoadoutUpdateError,
        syncLoadoutState,
        updatingLoadout,
        user.accessToken,
        user.entitlementsToken,
        user.id,
        user.region,
      ]
  );

  const handleEquipWeapon = React.useCallback(
      async (weapon: EquippedWeapon, option: OwnedSkinOption) => {
        if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
          return;
        }

        const buildNextLoadout = (source: PlayerLoadoutResponse) => {
          let weaponFound = false;
          const guns = (source.Guns || []).map((gun) => {
            if (gun.ID !== weapon.weaponId) {
              return gun;
            }

            weaponFound = true;
            return {
              ...gun,
              SkinID: option.skinId,
              SkinLevelID: option.skinLevelId,
              ChromaID: option.chromaId,
            };
          });

          return weaponFound ? { ...source, Guns: guns } : null;
        };

        const currentLoadout = loadoutSnapshotRef.current ?? loadoutSnapshot;
        const nextLoadout = buildNextLoadout(currentLoadout);
        if (!nextLoadout) {
          setPickerError(t("equip_page.error_loading"));
          return;
        }

        const pendingUpdate = applyOptimisticLoadout(nextLoadout);
        setUpdatingLoadout(true);
        setPickerError(null);
        handleDismissPicker();

        try {
          if (__DEV__) {
            console.log("[profile] equip skin request", {
              weaponId: weapon.weaponId,
              weaponName: weapon.weaponName,
              fromSkinId: weapon.skinId,
              toSkinId: option.skinId,
              toSkinLevelId: option.skinLevelId,
              toChromaId: option.chromaId,
            });
          }

          const response = await updatePlayerLoadoutV3First(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              nextLoadout
          );
          const putResponse: PlayerLoadoutResponse = {
            ...nextLoadout,
            ...response,
            Guns: (response.Guns?.length ? response.Guns : nextLoadout.Guns).map(
                (gun) =>
                    gun.ID === weapon.weaponId
                        ? {
                          ...gun,
                          SkinID: option.skinId,
                          SkinLevelID: option.skinLevelId,
                          ChromaID: option.chromaId,
                        }
                        : gun
            ),
          };

          if (__DEV__) {
            const updatedGun = (putResponse.Guns || []).find(
                (gun) => gun.ID === weapon.weaponId
            );
            console.log("[profile] equip skin put response", {
              weaponId: weapon.weaponId,
              responseSkinId: updatedGun?.SkinID,
              responseSkinLevelId: updatedGun?.SkinLevelID,
              responseChromaId: updatedGun?.ChromaID,
            });
          }

          pendingUpdate.loadout = putResponse;
          pendingUpdate.updatedAt = Date.now();
          if (pendingLoadoutRef.current === pendingUpdate) {
            syncLoadoutState(putResponse);
            persistLoadoutCache(putResponse);
          }
          void confirmLoadoutUpdate(
              putResponse,
              pendingUpdate,
              (latestLoadout) => {
                const latestGun = (latestLoadout.Guns || []).find(
                    (gun) => gun.ID === weapon.weaponId
                );

                return Boolean(
                    latestGun &&
                    latestGun.SkinID === option.skinId &&
                    latestGun.SkinLevelID === option.skinLevelId &&
                    latestGun.ChromaID === option.chromaId
                );
              }
          );
        } catch (err) {
          if (__DEV__) console.error(err);
          rollbackOptimisticLoadout(currentLoadout, pendingUpdate);
          showLoadoutUpdateError();
        } finally {
          setUpdatingLoadout(false);
        }
      },
      [
        applyOptimisticLoadout,
        confirmLoadoutUpdate,
        handleDismissPicker,
        hasAuth,
        loadoutSnapshot,
        persistLoadoutCache,
        rollbackOptimisticLoadout,
        showLoadoutUpdateError,
        syncLoadoutState,
        t,
        updatingLoadout,
        user.accessToken,
        user.entitlementsToken,
        user.id,
        user.region,
      ]
  );

  const handleEquipCollectionSkin = React.useCallback(
      (item: OwnedWeaponCollectionItem) => {
        const equippedWeapon = loadoutDetails.find(
            (weapon) => weapon.weaponId === item.weaponId
        );
        if (!equippedWeapon) {
          return;
        }

        if (updatingLoadout) {
          handleOpenWeaponPicker(equippedWeapon);
          return;
        }

        const options = buildOwnedSkinOptions(equippedWeapon);
        const option = options.find(
            (candidate) => candidate.skinId === item.skinId
        );

        if (!option || option.selected) {
          handleOpenWeaponPicker(equippedWeapon);
          return;
        }

        setPickerLoading(false);
        setPickerError(null);
        setActiveWeaponChroma(null);
        setPickerState({
          type: "weapon",
          weapon: equippedWeapon,
          options,
        });
        void handleEquipWeapon(equippedWeapon, option);
      },
      [
        buildOwnedSkinOptions,
        handleEquipWeapon,
        handleOpenWeaponPicker,
        loadoutDetails,
        updatingLoadout,
      ]
  );

  const handleEquipSpray = React.useCallback(
      async (spray: EquippedSpray, option: OwnedSprayOption) => {
        if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
          return;
        }

        const currentLoadout = loadoutSnapshotRef.current ?? loadoutSnapshot;
        const nextLoadout: PlayerLoadoutResponse = {
          ...currentLoadout,
          Sprays: (currentLoadout.Sprays || []).map((item) =>
              item.EquipSlotID === spray.slot
                  ? {
                    ...item,
                    SprayID: option.sprayId,
                    SprayLevelID: option.sprayLevelId,
                  }
                  : item
          ),
        };
        const pendingUpdate = applyOptimisticLoadout(nextLoadout);
        setUpdatingLoadout(true);
        setPickerError(null);
        handleDismissPicker();

        try {
          if (__DEV__) {
            console.log("[profile] equip spray request", {
              slot: spray.slot,
              fromSprayId: spray.id,
              toSprayId: option.sprayId,
              toSprayLevelId: option.sprayLevelId,
            });
          }

          // This path only renders when v3 is unavailable and Riot still
          // returns the legacy Sprays slots.
          const response = await updatePlayerLoadout(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              nextLoadout
          );
          const putResponse: PlayerLoadoutResponse = {
            ...nextLoadout,
            ...response,
            Sprays: (response.Sprays?.length
                    ? response.Sprays
                    : nextLoadout.Sprays
            ).map((item) =>
                item.EquipSlotID === spray.slot
                    ? {
                      ...item,
                      SprayID: option.sprayId,
                      SprayLevelID: option.sprayLevelId,
                    }
                    : item
            ),
          };

          if (__DEV__) {
            const updatedSpray = (putResponse.Sprays || []).find(
                (item) => item.EquipSlotID === spray.slot
            );
            console.log("[profile] equip spray put response", {
              slot: spray.slot,
              responseSprayId: updatedSpray?.SprayID,
              responseSprayLevelId: updatedSpray?.SprayLevelID,
            });
          }

          pendingUpdate.loadout = putResponse;
          pendingUpdate.updatedAt = Date.now();
          if (pendingLoadoutRef.current === pendingUpdate) {
            syncLoadoutState(putResponse);
            persistLoadoutCache(putResponse);
          }
          void confirmLoadoutUpdate(
              putResponse,
              pendingUpdate,
              (latestLoadout) =>
                  latestLoadout.Sprays?.some(
                      (item) =>
                          item.EquipSlotID === spray.slot &&
                          item.SprayID === option.sprayId &&
                          sameOptionalId(item.SprayLevelID, option.sprayLevelId)
                  ) ?? false
          );
        } catch (err) {
          if (__DEV__) console.error(err);
          rollbackOptimisticLoadout(currentLoadout, pendingUpdate);
          showLoadoutUpdateError();
        } finally {
          setUpdatingLoadout(false);
        }
      },
      [
        applyOptimisticLoadout,
        confirmLoadoutUpdate,
        handleDismissPicker,
        hasAuth,
        loadoutSnapshot,
        persistLoadoutCache,
        rollbackOptimisticLoadout,
        showLoadoutUpdateError,
        syncLoadoutState,
        updatingLoadout,
        user.accessToken,
        user.entitlementsToken,
        user.id,
        user.region,
      ]
  );

  const handleEquipExpression = React.useCallback(
      async (
          expression: EquippedExpression,
          option: OwnedExpressionOption
      ) => {
        if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
          return;
        }

        const currentLoadout = loadoutSnapshotRef.current ?? loadoutSnapshot;
        const activeExpressions = currentLoadout.ActiveExpressions ?? [];
        if (!activeExpressions[expression.slotIndex]) {
          setPickerError(t("equip_page.error_loading"));
          return;
        }

        const nextExpressions = [...activeExpressions];
        nextExpressions[expression.slotIndex] = {
          TypeID:
              option.kind === "flex" ? VItemTypes.Flex : VItemTypes.Spray,
          AssetID: option.assetId,
        };
        const nextLoadout: PlayerLoadoutResponse = {
          ...currentLoadout,
          ActiveExpressions: nextExpressions,
        };
        const pendingUpdate = applyOptimisticLoadout(nextLoadout);
        setUpdatingLoadout(true);
        setPickerError(null);
        handleDismissPicker();

        try {
          if (__DEV__) {
            console.log("[profile] equip expression request", {
              slotIndex: expression.slotIndex,
              fromKind: expression.kind,
              fromAssetId: expression.id,
              toKind: option.kind,
              toAssetId: option.assetId,
            });
          }

          const response = await updatePlayerLoadoutV3(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              nextLoadout
          );
          const responseExpressions = response.ActiveExpressions?.length
              ? [...response.ActiveExpressions]
              : [...nextExpressions];
          responseExpressions[expression.slotIndex] =
              nextExpressions[expression.slotIndex];
          const putResponse: PlayerLoadoutResponse = {
            ...nextLoadout,
            ...response,
            ActiveExpressions: responseExpressions,
          };

          pendingUpdate.loadout = putResponse;
          pendingUpdate.updatedAt = Date.now();
          if (pendingLoadoutRef.current === pendingUpdate) {
            syncLoadoutState(putResponse);
            persistLoadoutCache(putResponse);
          }
          void confirmLoadoutUpdate(
              putResponse,
              pendingUpdate,
              (latestLoadout) => {
                const latestExpression =
                    latestLoadout.ActiveExpressions?.[expression.slotIndex];
                return Boolean(
                    latestExpression &&
                    latestExpression.TypeID.toLowerCase() ===
                    nextExpressions[expression.slotIndex].TypeID.toLowerCase() &&
                    latestExpression.AssetID === option.assetId
                );
              }
          );
        } catch (err) {
          if (__DEV__) console.error(err);
          rollbackOptimisticLoadout(currentLoadout, pendingUpdate);
          showLoadoutUpdateError();
        } finally {
          setUpdatingLoadout(false);
        }
      },
      [
        applyOptimisticLoadout,
        confirmLoadoutUpdate,
        handleDismissPicker,
        hasAuth,
        loadoutSnapshot,
        persistLoadoutCache,
        rollbackOptimisticLoadout,
        showLoadoutUpdateError,
        syncLoadoutState,
        t,
        updatingLoadout,
        user.accessToken,
        user.entitlementsToken,
        user.id,
        user.region,
      ]
  );

  const renderProfileHero = () => (
      <View style={[styles.heroCard, { backgroundColor: "#1a1d24" }]}>
        <View style={styles.heroTopRow}>
          <Animated.View
              style={[styles.heroModeToggle, heroModeToggleAnimatedStyle]}
          >
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isPlayerInfoMode
                      ? t("profile_page.hero_badge")
                      : t("profile_page.player_info", {
                        defaultValue: "Thông tin người chơi",
                      })
                }
                accessibilityHint={t("profile_page.switch_info_hint", {
                  defaultValue: "Chuyển nhóm chỉ số đang hiển thị",
                })}
                accessibilityState={{
                  selected: isPlayerInfoMode,
                  disabled: profileModeTransitioning,
                  busy: profileModeTransitioning,
                }}
                disabled={profileModeTransitioning}
                onPress={toggleHeroMode}
                style={({ pressed }) => [
                  styles.heroModePressTarget,
                  pressed && !profileModeTransitioning && styles.heroModePressed,
                ]}
            >
              <Animated.View
                  pointerEvents="none"
                  style={[styles.heroModeThumb, heroModeThumbAnimatedStyle]}
              >
                <Icon
                    name={
                      isPlayerInfoMode
                          ? "chart-box-outline"
                          : "shield-account-outline"
                    }
                    size={14}
                    color={COLORS.PURE_WHITE}
                />
              </Animated.View>
              <View pointerEvents="none" style={styles.heroModeLabelViewport}>
                <TypewriterSwapText
                    text={
                      isPlayerInfoMode
                          ? t("profile_page.player_info", {
                            defaultValue: "Thông tin",
                          })
                          : t("profile_page.hero_badge")
                    }
                    charactersPerStep={1}
                    style={[styles.heroModeLabel, heroModeLabelAnimatedStyle]}
                />
              </View>
            </Pressable>
          </Animated.View>
          <Pressable
              accessibilityRole="button"
              accessibilityLabel={regionLabel}
              onPress={handleRegionPress}
              style={({ pressed }) => [
                styles.heroRegionPill,
                { backgroundColor: "rgba(255,255,255,0.1)" },
                pressed && styles.heroModePressed,
              ]}
          >
            <Icon name="web" size={13} color={COLORS.PURE_WHITE} />
            <Text style={styles.heroRegionText}>{regionLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.heroNameRow}>
          <Text style={styles.heroTitle}>
            {user.name || t("profile_page.agent_fallback")}
          </Text>
          {user.TagLine ? (
              <View style={[styles.heroTagPill, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
                <Text style={styles.heroTagText}>#{user.TagLine}</Text>
              </View>
          ) : null}
        </View>
        <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden={isPlayerInfoMode}
            importantForAccessibility={
              isPlayerInfoMode ? "no-hide-descendants" : "auto"
            }
            style={[styles.heroSubtitleViewport, heroSubtitleAnimatedStyle]}
        >
          <TypewriterSwapText
              text={heroSubtitleTargetText}
              charactersPerStep={1}
              showCursor={false}
              typingSpeed={HERO_SUBTITLE_TYPING_SPEED_MS}
              deletingSpeed={HERO_SUBTITLE_DELETING_SPEED_MS}
              initialDelay={HERO_SUBTITLE_INITIAL_DELAY_MS}
              style={styles.heroSubtitle}
          />
        </Animated.View>

        <View style={styles.heroMetaRow}>
          <View style={[styles.heroMetaPill, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
            <Icon name="star-circle-outline" size={13} color="rgba(255,255,255,0.7)" />
            <Text style={[styles.heroMetaText, { color: "rgba(255,255,255,0.7)" }]}>
              {t("profile_page.level", {
                level: identityDetails?.level ?? user.progress.level,
              })}
            </Text>
          </View>
          <View style={[styles.heroMetaPill, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
            <Icon
                name={hasAuth ? "check-decagram-outline" : "alert-circle-outline"}
                size={13}
                color="rgba(255,255,255,0.7)"
            />
            <Text style={[styles.heroMetaText, { color: "rgba(255,255,255,0.7)" }]}>
              {hasAuth
                  ? t("profile_page.account_synced")
                  : t("profile_page.sign_in_required")}
            </Text>
          </View>
        </View>

        <Animated.View
            style={[styles.heroStatsViewport, statsVisibilityAnimatedStyle]}
        >
          <View style={styles.heroStatsRow}>
            {profileStats.map((balanceStat, index) => {
              const playerStat = playerPerformanceStats[index];
              const visibleStat =
                  isPlayerInfoMode && playerStat ? playerStat : balanceStat;

              return (
                <Animated.View
                    key={balanceStat.key}
                    style={[styles.heroStatCard, heroStatCardAnimatedStyle]}
                >
                  <View style={styles.heroStatLabelRow}>
                    <View style={styles.heroStatIconViewport}>
                      <Animated.View
                          style={[
                            styles.heroStatIconLayer,
                            balanceStatsAnimatedStyle,
                          ]}
                      >
                        <CurrencyIcon
                            icon={balanceStat.icon}
                            style={styles.heroStatIcon}
                        />
                      </Animated.View>
                      <Animated.View
                          style={[
                            styles.heroStatIconLayer,
                            playerStatsAnimatedStyle,
                          ]}
                      >
                        <Icon
                            name={playerStat?.icon ?? "chart-box-outline"}
                            size={15}
                            color="#ff4655"
                        />
                      </Animated.View>
                    </View>
                    <TypewriterSwapText
                        text={visibleStat.label}
                        showCursor={false}
                        typingSpeed={36}
                        deletingSpeed={22}
                        initialDelay={60}
                        style={[
                          styles.heroStatLabel,
                          isPlayerInfoMode && styles.playerStatLabel,
                        ]}
                    />
                  </View>
                  <TypewriterSwapText
                      text={String(visibleStat.value)}
                      showCursor={false}
                      typingSpeed={34}
                      deletingSpeed={20}
                      initialDelay={60}
                      style={styles.heroStatValue}
                  />
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        <View style={styles.heroRankRow}>
          <RankSplitGroup
              splitProgress={rankSplitProgress}
              contentMode={rankSplitContentMode}
              rankLabel={t("profile_page.current_rank")}
              rankValue={
                competitiveRank?.currentName || t("profile_page.unrated")
              }
              rankIconUrl={competitiveRank?.currentIcon}
              rankIconCacheId={
                competitiveRank?.currentTier
                    ? `rank:${competitiveRank.currentTier}:icon`
                    : undefined
              }
              stats={actRankSummaryStats.left}
          />
          <RankSplitGroup
              splitProgress={rankSplitProgress}
              contentMode={rankSplitContentMode}
              rankLabel={t("profile_page.peak_rank")}
              rankValue={competitiveRank?.peakName || t("profile_page.unrated")}
              rankIconUrl={competitiveRank?.peakIcon}
              rankIconCacheId={
                competitiveRank?.peakTier
                    ? `rank:${competitiveRank.peakTier}:icon`
                    : undefined
              }
              stats={actRankSummaryStats.right}
          />
        </View>
      </View>
  );

  const renderIdentitySection = () => (
      <ProfileIdentitySection
          identityDetails={identityDetails}
          onOpenIdentityPicker={handleOpenIdentityPicker}
          t={t}
      />
  );

  const renderSpraySection = () => (
      <ProfileExpressionSection
          expressionDetails={expressionDetails}
          onOpenExpressionPicker={handleOpenExpressionPicker}
          onOpenSprayPicker={handleOpenSprayPicker}
          sprayDetails={sprayDetails}
          t={t}
      />
  );

  const renderSkinGridCard = React.useCallback(
      (weapon: EquippedWeapon) => (
          <CompactProfileSkinCard
              key={weapon.weaponId}
              weapon={weapon}
              width={profileSkinRowCardWidth}
              onPress={() => handleOpenWeaponPicker(weapon)}
          />
      ),
      [handleOpenWeaponPicker, profileSkinRowCardWidth]
  );

  const renderSkinListItem = React.useCallback(
      ({ item }: { item: EquippedWeapon }) => renderSkinGridCard(item),
      [renderSkinGridCard]
  );

  const renderPageHeader = () => (
      <GestureDetector gesture={profileHeaderPanGesture}>
        <Animated.View
            onLayout={handleHeaderLayout}
            style={[styles.profilePageHeader, collapsibleHeaderAnimatedStyle]}
        >
        <View style={styles.topHeaderRow}>
          <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("equip_page.identity.card_picker_title", {
                defaultValue: "Ch\u1ecdn \u1ea3nh \u0111\u1ea1i di\u1ec7n",
              })}
              activeOpacity={0.82}
              disabled={!identityDetails}
              onPress={() => handleOpenIdentityPicker("player-card")}
              style={styles.topAvatarButton}
          >
            <Animated.View style={[styles.topAvatar, topAvatarAnimatedStyle]}>
              {identityDetails?.cardArt ? (
                  <Image
                      cacheId={`player-card:${identityDetails.cardId}:avatar`}
                      source={{ uri: identityDetails.cardArt }}
                      style={styles.topAvatarImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      priority="high"
                      recyclingKey={identityDetails.cardArt}
                  />
              ) : (
                  <Text style={styles.topAvatarText}>
                    {(user.name || "V").slice(0, 1).toUpperCase()}
                  </Text>
              )}
            </Animated.View>
            {identityDetails ? (
                <View style={styles.topAvatarEditBadge}>
                  <Icon name="pencil" size={8} color={COLORS.PURE_WHITE} />
                </View>
            ) : null}
          </TouchableOpacity>
          <Animated.Text
              style={[styles.topHeaderTitle, topHeaderTitleAnimatedStyle]}
          >
            Vshop
          </Animated.Text>
          <Animated.View
              style={[styles.topBalancePill, topBalancePillAnimatedStyle]}
          >
            <Text style={styles.topBalanceText}>{user.balances.vp} {t("vp")}</Text>
          </Animated.View>
        </View>
        {renderProfileHero()}
        <ProfileSegmentedControl
        activeTab={activeTab}
        collectionSegmentLabelAnimatedStyle={collectionSegmentLabelAnimatedStyle}
        handleSegmentContainerLayout={handleSegmentContainerLayout}
        handleStatsDashboardTabChange={handleStatsDashboardTabChange}
        handleTabChange={handleTabChange}
        loadoutSegmentLabelAnimatedStyle={loadoutSegmentLabelAnimatedStyle}
        profileNavContentMode={profileNavContentMode}
        profileSegmentLayerAnimatedStyle={profileSegmentLayerAnimatedStyle}
        segmentIndicatorAnimatedStyle={segmentIndicatorAnimatedStyle}
        skinsSegmentLabelAnimatedStyle={skinsSegmentLabelAnimatedStyle}
        statsDashboardTab={statsDashboardTab}
        statsSegmentLayerAnimatedStyle={statsSegmentLayerAnimatedStyle}
        tabItems={tabItems}
      />
        </Animated.View>
      </GestureDetector>
  );

  const renderCollectionControls = () => (
      <>
        <View style={styles.collectionSearchRow}>
          <Searchbar
              placeholder={t("equip_page.search_placeholder")}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[
                styles.searchBar,
                { backgroundColor: palette.card, borderColor: palette.cardBorder },
              ]}
              inputStyle={{ color: palette.textPrimary }}
              iconColor={palette.textSecondary}
          />
          <CollectionCheckerExport />
        </View>
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.collectionFilterRow}
            onTouchStart={() => setPagerGestureEnabled(false)}
            onTouchEnd={() => setPagerGestureEnabled(true)}
            onTouchCancel={() => setPagerGestureEnabled(true)}
        >
          {collectionWeaponTabs.map((weaponName) => {
            const active = collectionWeaponFilter === weaponName;
            const label = weaponName === "all" ? t("gallery_page.filters.all") : weaponName;

            return (
                <TouchableOpacity
                    key={weaponName}
                    activeOpacity={0.85}
                    onPress={() => setCollectionWeaponFilter(weaponName)}
                    style={[
                      styles.collectionFilterChip,
                      active && styles.collectionFilterChipActive,
                    ]}
                >
                  <Text
                      style={[
                        styles.collectionFilterChipText,
                        active && styles.collectionFilterChipTextActive,
                      ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
            );
          })}
        </ScrollView>
      </>
  );

  const renderCollectionCard = React.useCallback(
      (item: OwnedWeaponCollectionItem) => (
          <CompactProfileSkinCard
              key={item.collectionId}
              weapon={item}
              width={profileGridCardWidth}
              onPress={() => handleEquipCollectionSkin(item)}
          />
      ),
      [handleEquipCollectionSkin, profileGridCardWidth]
  );

  const renderProfileListRow = ({ item }: { item: ProfileListRow }) => {
    switch (item.kind) {
      case "loading":
        return (
            <View style={styles.pageStatus}>
              <ActivityIndicator animating color={palette.accent} />
            </View>
        );
      case "message":
        return (
            <View style={styles.pageStatus}>
              <Text
                  style={[
                    item.tone === "error" ? styles.errorText : styles.emptyText,
                    { color: palette.textSecondary },
                  ]}
              >
                {item.message}
              </Text>
            </View>
        );
      case "identity":
        return (
            <View style={styles.pageBody}>
              {renderIdentitySection()}
            </View>
        );
      case "expressions":
        return <View style={styles.pageBody}>{renderSpraySection()}</View>;
      case "skin-category": {
        const categoryWeapons = loadoutByCategory[item.category];
        const availableRowWidth = viewportWidth - 32;
        const skinListWidth = Math.min(
            availableRowWidth,
            categoryWeapons.length * profileSkinRowCardWidth +
            Math.max(0, categoryWeapons.length - 1) * 8 +
            8
        );

        return (
            <View style={styles.profileSkinCategoryRow}>
              <View
                  style={styles.profileSkinCategoryTitleSwipeSurface}
                  {...skinWhitespacePagerPanResponder.panHandlers}
              >
                <Text
                    style={[
                      styles.profileSkinCategoryTitle,
                      { color: palette.textPrimary },
                    ]}
                >
                  {formatCategoryLabel(item.category)}
                </Text>
              </View>
              <View style={styles.profileSkinCardLane}>
                <FlatList
                    horizontal
                    style={{ width: skinListWidth, flexGrow: 0 }}
                    data={categoryWeapons}
                    keyExtractor={(weapon) => weapon.weaponId}
                    renderItem={renderSkinListItem}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.profileSkinRow}
                    onTouchStart={() => setPagerGestureEnabled(false)}
                    onTouchEnd={() => setPagerGestureEnabled(true)}
                    onTouchCancel={() => setPagerGestureEnabled(true)}
                    removeClippedSubviews
                    initialNumToRender={2}
                    maxToRenderPerBatch={2}
                    windowSize={3}
                    updateCellsBatchingPeriod={48}
                />
                {skinListWidth < availableRowWidth ? (
                    <View
                        collapsable={false}
                        style={styles.profileSkinRowWhitespace}
                        {...skinWhitespacePagerPanResponder.panHandlers}
                    />
                ) : null}
              </View>
              <View
                  collapsable={false}
                  style={styles.profileSkinCategorySpacer}
                  {...skinWhitespacePagerPanResponder.panHandlers}
              />
            </View>
        );
      }
      case "collection-row":
        return (
            <View style={styles.collectionRow}>
              {item.items.map(renderCollectionCard)}
            </View>
        );
      default:
        return null;
    }
  };

  const renderProfileListHeader = (tab: TabKey) => (
      <>
        {tab === "collection" &&
        !loading &&
        !error &&
        loadoutSorted.length > 0
            ? renderCollectionControls()
            : null}
      </>
  );

  const renderProfileTabPage = (tab: TabKey) => (
      <View
          key={tab}
          style={[styles.profileTabPage, { width: viewportWidth }]}
      >
        {tab === "skins" ? (
            <View
                collapsable={false}
                style={styles.profilePageSwipeZone}
                {...skinWhitespacePagerPanResponder.panHandlers}
            />
        ) : (
            <View style={styles.profilePageSwipeZone} />
        )}
        <Animated.FlatList
            style={styles.pageScroll}
            data={profileListRowsByTab[tab]}
            keyExtractor={(item) => item.key}
            renderItem={renderProfileListRow}
            contentContainerStyle={[styles.pageScrollContent, { paddingBottom: getPrimaryTabContentBottomPadding(insets.bottom) }]}
            onScroll={handleProfileContentScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={palette.accent}
                  colors={[palette.accent]}
              />
            }
            ListHeaderComponent={renderProfileListHeader(tab)}
            removeClippedSubviews={false}
            initialNumToRender={1}
            maxToRenderPerBatch={1}
            windowSize={5}
            updateCellsBatchingPeriod={48}
        />
      </View>
  );

  return (
    <CollectionCheckerExportProvider
        items={ownedCollection}
        profile={collectionCheckerProfile}
        disabled={refreshing}
    >
      <View style={styles.container}>
        <Animated.View
            pointerEvents="none"
            style={[styles.statsBackground, pageBackgroundAnimatedStyle]}
        />
        {renderPageHeader()}
        <GestureDetector gesture={profileContentPanGesture}>
          <Animated.View
            style={[
              styles.profileBodyStack,
              collapsibleHeaderHeight > 0 && styles.profileBodyStackCollapsible,
              collapsibleHeaderHeight > 0 && {
                top: PROFILE_STICKY_SEGMENT_HEIGHT,
              },
              collapsibleHeaderHeight > 0 && collapsibleBodyAnimatedStyle,
            ]}
        >
          <Animated.View
              pointerEvents={isPlayerInfoMode ? "none" : "auto"}
              accessibilityElementsHidden={isPlayerInfoMode}
              importantForAccessibility={
                isPlayerInfoMode ? "no-hide-descendants" : "auto"
              }
              style={[styles.profileBodyLayer, legacyContentAnimatedStyle]}
          >
            <Animated.ScrollView
                key={`profile-pager:${Math.round(viewportWidth)}`}
                ref={profilePagerRef}
                horizontal
                pagingEnabled
                bounces={false}
                disableIntervalMomentum
                directionalLockEnabled
                nestedScrollEnabled
                style={styles.profilePager}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                onScroll={handlePagerScroll}
                onMomentumScrollEnd={handlePagerMomentumEnd}
                scrollEventThrottle={16}
            >
              {PROFILE_TAB_KEYS.map(renderProfileTabPage)}
            </Animated.ScrollView>
          </Animated.View>
          {statsDashboardMounted ? (
              <Animated.View
                  pointerEvents={isPlayerInfoMode ? "auto" : "none"}
                  accessibilityElementsHidden={!isPlayerInfoMode}
                  importantForAccessibility={
                    isPlayerInfoMode ? "auto" : "no-hide-descendants"
                  }
                  style={[
                    styles.profileBodyLayer,
                    statsDashboardLayerAnimatedStyle,
                  ]}
              >
                <PlayerStatsDashboard
                    activeTab={statsDashboardTab}
                    competitiveRank={competitiveRank}
                    loading={matchHistoryLoading || seasonStatsLoading}
                    matches={dashboardMatches}
                    onRefresh={handleStatsRefresh}
                    onRequestDetails={handleRequestStatsDetails}
                    refreshing={statsRefreshing}
                    seasonStats={dashboardSeasonStats}
                    totalMatches={matchAuthKey === authKey ? totalMatches : 0}
                />
              </Animated.View>
          ) : null}
          </Animated.View>
        </GestureDetector>
        <ProfilePickerModal
          activeWeaponChroma={activeWeaponChroma}
          handleDismissPicker={handleDismissPicker}
          handleEquipExpression={handleEquipExpression}
          handleEquipIdentity={handleEquipIdentity}
          handleEquipSpray={handleEquipSpray}
          handleEquipWeapon={handleEquipWeapon}
          handleOpenExpressionPicker={handleOpenExpressionPicker}
          identityDetails={identityDetails}
          identityPickerQuery={identityPickerQuery}
          palette={palette}
          pickerError={pickerError}
          pickerLoading={pickerLoading}
          pickerState={pickerState}
          setActiveWeaponChroma={setActiveWeaponChroma}
          setIdentityPickerQuery={setIdentityPickerQuery}
          updatingLoadout={updatingLoadout}
        />
      </View>
    </CollectionCheckerExportProvider>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
// Ghi chú: Các style được đặt tên theo mục đích sử dụng.
// Các style cho picker modal bắt đầu bằng "picker", cho hero card bắt đầu bằng "hero",
// cho collection bắt đầu bằng "collection", cho skin/profile bắt đầu bằng "profileSkin",
// cho identity bắt đầu bằng "identity", cho spray bắt đầu bằng "spray",
// cho chroma panel bắt đầu bằng "chroma", cho segment control bắt đầu bằng "segment".
export default Profile;

