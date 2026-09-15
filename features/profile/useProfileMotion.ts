import React from "react";
import { useFocusEffect } from "expo-router";
import { LayoutChangeEvent, ScrollView } from "react-native";
import {
  interpolate, interpolateColor, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming,
  Easing, ReduceMotion,
} from "react-native-reanimated";
import { useMotionPreference as useReducedMotion } from "~/hooks/useMotionPreference";
import { runWhenIdle, type IdleTask } from "~/utils/idle-task";
import { type RankSplitContentMode } from "~/components/profile/RankSplitGroup";
import { useSystemChromeStore } from "~/hooks/useSystemChromeStore";
import { TabKey } from "~/components/GalleryProfile";
import { COLORS } from "~/constants/DesignSystem";
import { MOTION_TIMING } from "~/constants/Motion";
import { getProfileChromeTone, PROFILE_INFO_COLORS } from "~/features/profile/profile-visual-policy";
import { PROFILE_HERO_EXPANDED_FALLBACK_HEIGHT } from "~/features/profile/profile-transition";
import {
  type ProfileDashboardTab,
  useProfileDashboardTabStore,
} from "~/features/profile/useProfileDashboardTabStore";
import type { useProfileSession } from "./useProfileSession";
type ProfileNavContentMode = "profile" | "stats";
const PROFILE_MODE_MORPH_DURATION_MS = 420;
const PROFILE_MODE_INTERACTION_BUFFER_MS = 80;
const PROFILE_STATS_FETCH_DELAY_MS = PROFILE_MODE_MORPH_DURATION_MS + 120;
type Props = Pick<ReturnType<typeof useProfileSession>, "viewportWidth" | "hasAuth" | "fetchMatches" | "user">;

export function useProfileMotion({ viewportWidth, hasAuth, fetchMatches, user }: Props) {

  const [activeTab, setActiveTab] = React.useState<TabKey>("loadout");
  const reduceMotionEnabled = useReducedMotion();
  const setTopInsetTone = useSystemChromeStore(
      (state) => state.setTopInsetTone
  );
  const setPrimaryNavigationTone = useSystemChromeStore(
      (state) => state.setPrimaryNavigationTone
  );
  const [profileNavContentMode, setProfileNavContentMode] =
      React.useState<ProfileNavContentMode>("profile");
  const [statsDashboardMounted, setStatsDashboardMounted] =
      React.useState(false);
  const profilePagerRef =
      React.useRef<React.ElementRef<typeof ScrollView>>(null);
  const skinWhitespacePagerOriginRef = React.useRef(0);
  const segmentProgress = useSharedValue(0); // 0..2: tab pager đang hiển thị
  const segmentLayoutProgress = useSharedValue(0); // 0..1: layout profile→stats
  const statsTabProgress = useSharedValue(
    useProfileDashboardTabStore.getState().activeTab === "details" ? 1 : 0
  ); // 0..1: overview→details
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
  const pageModeProgress = useSharedValue(0);
  const profileExpandedHeroHeight = useSharedValue(
    PROFILE_HERO_EXPANDED_FALLBACK_HEIGHT
  );
  const legacyContentProgress = useSharedValue(1);
  const dashboardProgress = useSharedValue(0);
  const statsExpandedRef = React.useRef(true);
  const lastRegionTapRef = React.useRef(0);
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
  const profileBodyBackgroundAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pageModeProgress.value,
      [0, 1],
      [COLORS.PURE_WHITE, PROFILE_INFO_COLORS.background]
    ),
  }));
  const profilePageBackgroundAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pageModeProgress.value,
      [0, 1],
      [COLORS.PURE_WHITE, PROFILE_INFO_COLORS.background]
    ),
  }));
  const profileHeaderTitleAnimatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      pageModeProgress.value,
      [0, 1],
      [COLORS.TEXT_PRIMARY, PROFILE_INFO_COLORS.textPrimary]
    ),
  }));
  const profileBalancePillAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pageModeProgress.value,
      [0, 1],
      [COLORS.PURE_BLACK, PROFILE_INFO_COLORS.card]
    ),
    borderColor: interpolateColor(
      pageModeProgress.value,
      [0, 1],
      ["transparent", PROFILE_INFO_COLORS.border]
    ),
  }));

  // handleRegionPress: double-tap pill region → mở/thu hàng stats của hero card.
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
          reduceMotion: ReduceMotion.System,
        }
    );
  }, [statsVisibilityProgress]);
  // Rank và nội dung dùng cùng nhịp morph với toàn bộ hero, không timer trung gian.
  const startRankSplitTransition = React.useCallback(
      (showActStats: boolean) => {
        setRankSplitContentMode(showActStats ? "act" : "rank");
        rankSplitProgress.value = withTiming(showActStats ? 1 : 0, {
          duration: PROFILE_MODE_MORPH_DURATION_MS,
          easing: Easing.inOut(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        });
      },
      [rankSplitProgress]
  );
  // toggleHeroMode: đổi hero↔player info; khóa tương tác, chạy animation theo pha.
  const toggleHeroMode = React.useCallback(() => {
    if (profileModeInteractionLockedRef.current) return;

    const nextMode = !isPlayerInfoModeRef.current;
    const interactionLockDuration =
        reduceMotionEnabled
          ? 0
          : PROFILE_MODE_MORPH_DURATION_MS +
            PROFILE_MODE_INTERACTION_BUFFER_MS;

    profileModeInteractionLockedRef.current = true;
    setProfileModeTransitioning(true);
    profileModeInteractionTimerRef.current = setTimeout(() => {
      profileModeInteractionLockedRef.current = false;
      profileModeInteractionTimerRef.current = null;
      setProfileModeTransitioning(false);
    }, interactionLockDuration);

    isPlayerInfoModeRef.current = nextMode;
    const chromeTone = getProfileChromeTone(
      nextMode ? "player-info" : "profile"
    );
    setTopInsetTone(chromeTone.topInset);
    setPrimaryNavigationTone(chromeTone.primaryNavigation);
    setIsPlayerInfoMode(nextMode);
    setProfileNavContentMode(nextMode ? "stats" : "profile");
    startRankSplitTransition(nextMode);

    if (!statsDashboardMounted) {
      dashboardPreloadTaskRef.current?.cancel();
      dashboardPreloadTaskRef.current = null;
      setStatsDashboardMounted(true);
    }

    heroModeProgress.value = withTiming(nextMode ? 1 : 0, {
      duration: PROFILE_MODE_MORPH_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    pageModeProgress.value = withTiming(nextMode ? 1 : 0, {
      duration: PROFILE_MODE_MORPH_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    legacyContentProgress.value = withTiming(nextMode ? 0 : 1, {
      duration: PROFILE_MODE_MORPH_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    dashboardProgress.value = withTiming(nextMode ? 1 : 0, {
      duration: PROFILE_MODE_MORPH_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    segmentLayoutProgress.value = withTiming(nextMode ? 1 : 0, {
      duration: PROFILE_MODE_MORPH_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [
    dashboardProgress,
    heroModeProgress,
    legacyContentProgress,
    pageModeProgress,
    reduceMotionEnabled,
    segmentLayoutProgress,
    setPrimaryNavigationTone,
    setTopInsetTone,
    startRankSplitTransition,
    statsDashboardMounted,
  ]);
  // Focus effect: đồng bộ tone status bar/navigation theo mode, trả giá trị cũ khi rời màn.
  useFocusEffect(
      React.useCallback(() => {
        const chromeTone = getProfileChromeTone(
          isPlayerInfoMode ? "player-info" : "profile"
        );
        setTopInsetTone(chromeTone.topInset);
        setPrimaryNavigationTone(chromeTone.primaryNavigation);

        return () => {
          setTopInsetTone("light");
          setPrimaryNavigationTone("dark");
        };
      }, [isPlayerInfoMode, setPrimaryNavigationTone, setTopInsetTone])
  );
  // handleStatsDashboardTabChange: đổi tab dashboard (overview/details) + chạy indicator.
  const handleStatsDashboardTabChange = React.useCallback(
      (tab: ProfileDashboardTab) => {
      const dashboardTabStore = useProfileDashboardTabStore.getState();
      if (dashboardTabStore.activeTab === tab) return;
      dashboardTabStore.setActiveTab(tab);
      statsTabProgress.value = withTiming(
        tab === "overview" ? 0 : 1,
        MOTION_TIMING.tab
      );
    },
      [statsTabProgress]
  );

  React.useEffect(() => {
    if (!isPlayerInfoMode || !hasAuth) return;

    const fetchTimer = setTimeout(() => {
      void fetchMatches(user);
    }, PROFILE_STATS_FETCH_DELAY_MS);

    return () => clearTimeout(fetchTimer);
  }, [fetchMatches, hasAuth, isPlayerInfoMode, user]);
  return {
    activeTab, setActiveTab, reduceMotionEnabled, profileNavContentMode,
    statsDashboardMounted, profilePagerRef, skinWhitespacePagerOriginRef, handleSegmentContainerLayout,
    handlePagerScroll, segmentIndicatorAnimatedStyle, profileSegmentLayerAnimatedStyle,
    statsSegmentLayerAnimatedStyle, loadoutSegmentLabelAnimatedStyle, skinsSegmentLabelAnimatedStyle,
    collectionSegmentLabelAnimatedStyle, isPlayerInfoMode, profileModeTransitioning,
    profileModeInteractionLockedRef, profileModeInteractionTimerRef, rankSplitContentMode,
    heroModeProgress, rankSplitProgress, statsVisibilityProgress, pageModeProgress,
    statsTabProgress,
    profileExpandedHeroHeight, dashboardPreloadTaskRef, legacyContentAnimatedStyle,
    statsDashboardLayerAnimatedStyle, profileBodyBackgroundAnimatedStyle,
    profilePageBackgroundAnimatedStyle, profileHeaderTitleAnimatedStyle,
    profileBalancePillAnimatedStyle, handleRegionPress,
    toggleHeroMode, handleStatsDashboardTabChange,
  };
}
