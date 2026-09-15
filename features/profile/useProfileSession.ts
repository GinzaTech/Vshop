import React from "react";
import { useLocalSearchParams } from "expo-router";
import { useWindowDimensions } from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { useMatchStore } from "~/hooks/useMatchStore";
import { useUserStore } from "~/hooks/useUserStore";
import { getSessionAuthKey, hasValidCompetitiveRankCache, hasValidProfileLoadoutCache } from "~/utils/profile-cache";
import {
  PROFILE_DEMO_CURRENT_MATCHES, PROFILE_DEMO_CURRENT_STATS, PROFILE_DEMO_MATCHES_BY_SEASON,
  PROFILE_DEMO_SEASON_OPTIONS, PROFILE_DEMO_STATS_BY_SEASON, PROFILE_DEMO_USER,
} from "~/mocks/profile-ui";
import { isDevelopmentDemoRoute } from "~/utils/demo-mode";



export function useProfileSession() {

  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: viewportWidth } = useWindowDimensions();
  const { demo } = useLocalSearchParams<{ demo?: string | string[] }>();
  const persistedUser = useUserStore((state) => state.user);
  const isProfileDemo = isDevelopmentDemoRoute({
    demo,
    isDev: __DEV__,
    pathname: "/profile",
  });
  const user = isProfileDemo ? PROFILE_DEMO_USER : persistedUser;
  const setUser = useUserStore((state) => state.setUser);
  const matchAuthKey = useMatchStore((state) => state.authKey);
  const recentMatches = useMatchStore((state) => state.matches);
  const matchHistoryLoading = useMatchStore((state) => state.loading);
  const seasonStatsLoading = useMatchStore((state) => state.seasonStatsLoading);
  const seasonPerformanceStats = useMatchStore((state) => state.seasonStats);
  const seasonStatsById = useMatchStore((state) => state.seasonStatsById);
  const seasonMatchesById = useMatchStore((state) => state.seasonMatchesById);
  const seasonOptions = useMatchStore((state) => state.seasonOptions);
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
    void fetchSeasonStats(user); // Fetch season stats khi có auth (payload player info).
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
  const dashboardMatches = React.useMemo( // matches chỉ khi store khớp session (authKey)
      () =>
        isProfileDemo
          ? PROFILE_DEMO_CURRENT_MATCHES
          : matchAuthKey === authKey
            ? recentMatches
            : [],
      [authKey, isProfileDemo, matchAuthKey, recentMatches]
  );
  const dashboardSeasonStats =
      isProfileDemo
        ? PROFILE_DEMO_CURRENT_STATS
        : matchAuthKey === authKey
          ? seasonPerformanceStats
          : null;
  const dashboardSeasonStatsById =
      isProfileDemo
        ? PROFILE_DEMO_STATS_BY_SEASON
        : matchAuthKey === authKey
          ? seasonStatsById
          : {};
  const dashboardSeasonMatchesById =
      isProfileDemo
        ? PROFILE_DEMO_MATCHES_BY_SEASON
        : matchAuthKey === authKey
          ? seasonMatchesById
          : {};
  const dashboardSeasonOptions = isProfileDemo
    ? PROFILE_DEMO_SEASON_OPTIONS
    : matchAuthKey === authKey
      ? seasonOptions
      : [];
  return {
    insets, colors, t, viewportWidth, isProfileDemo, user, setUser, matchHistoryLoading,
    seasonStatsLoading, fetchMatches, fetchSeasonStats, setProfileCache, profileGridColumns,
    profileGridCardWidth, profileSkinRowCardWidth, hasAuth, authKey, cachedProfile, cachedCompetitiveRank,
    cachedLoadoutSnapshot, dashboardMatches, dashboardSeasonStats, dashboardSeasonStatsById,
    dashboardSeasonMatchesById, dashboardSeasonOptions,
  };
}
