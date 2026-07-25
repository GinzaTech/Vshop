// 📦 [id].tsx – Màn hình chi tiết trận đấu (Match Details)
// Hiển thị thông tin đầy đủ của một trận đấu: bảng điểm (scoreboard), hiệu suất (performance),
// biểu đồ kinh tế, và cho phép share kết quả

import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  Animated,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { EconomyChart } from "~/components/match-detail/EconomyChart";
import { MatchDetailHeader } from "~/components/match-detail/MatchDetailHeader";
import {
  MatchDetailTabs,
  type MatchDetailTab,
} from "~/components/match-detail/MatchDetailTabs";
import { PerformanceTab } from "~/components/match-detail/PerformanceTab";
import { ScoreboardTable } from "~/components/match-detail/ScoreboardTable";
import { StickyShareBar } from "~/components/match-detail/StickyShareBar";
import {
  MatchDetailSkeleton,
  MatchStatePanel,
} from "~/components/matches/MatchStates";
import {
  MATCH_COLORS,
  MATCH_LAYOUT,
  MATCH_SPACING,
} from "~/constants/MatchTheme";
import { useMatchStore } from "~/hooks/useMatchStore";
import { useUserStore } from "~/hooks/useUserStore";
import { mockMatchDetail } from "~/mocks/match-ui";
import type {
  MatchDetailViewModel,
  MatchDetailsData,
  MatchPlayerIdentity,
} from "~/types/match-ui";
import { buildMatchDetailViewModel } from "~/utils/match-ui";
import { getPlayerNames } from "~/utils/valorant-api";

/**
 * firstParam – Lấy phần tử đầu tiên nếu value là mảng, nếu không thì trả về nguyên value
 * Dùng để xử lý search params có thể là string hoặc string[]
 */
const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * isTruthyParam – Kiểm tra xem param có giá trị truthy ("1" hoặc "true") không
 */
const isTruthyParam = (value: string | string[] | undefined) => {
  const resolved = firstParam(value);
  return resolved === "1" || resolved === "true";
};

/**
 * MatchDetailsScreen – Component chi tiết trận đấu
 * Load dữ liệu match theo ID, hiển thị scoreboard/performance tabs, economy chart, share bar
 */
export default function MatchDetailsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  // Lấy params từ URL: id (matchId), tab (tab mặc định), demo (chế độ demo)
  const params = useLocalSearchParams<{
    id?: string | string[];
    tab?: string | string[];
    demo?: string | string[];
  }>();
  const matchId = firstParam(params.id) ?? "";
  // isDemo: chế độ dùng mock data (chỉ khi DEV mode và có param demo)
  const isDemo = __DEV__ && isTruthyParam(params.demo);
  const requestedTab = firstParam(params.tab);
  // Thông tin user
  const user = useUserStore((state) => state.user);
  // Dữ liệu match từ cache (nếu đã load trước đó)
  const cachedDetails = useMatchStore((state) =>
    matchId ? state.detailsById[matchId] : undefined
  );
  // Hàm fetch chi tiết match từ store
  const fetchMatchDetails = useMatchStore((state) => state.fetchMatchDetails);

  // State: dữ liệu chi tiết trận đấu
  const [details, setDetails] = React.useState<MatchDetailsData | null>(
    cachedDetails ?? null
  );
  // State: trạng thái đang tải
  const [loading, setLoading] = React.useState(!isDemo && !cachedDetails);
  // State: lỗi nếu có
  const [error, setError] = React.useState<string | null>(null);
  // State: tab đang active (scoreboard hoặc performance)
  const [activeTab, setActiveTab] = React.useState<MatchDetailTab>(
    requestedTab === "performance" ? "performance" : "scoreboard"
  );
  // State: ID người chơi đang được chọn (để xem performance)
  const [selectedPlayerId, setSelectedPlayerId] = React.useState("");
  // State: số vòng đấu đang được chọn
  const [selectedRoundNumber, setSelectedRoundNumber] = React.useState<number | null>(null);

  // Ref: tham chiếu đến ScrollView để scroll
  const scrollRef = React.useRef<ScrollView>(null);
  // Ref: giá trị opacity cho animation chuyển tab
  const contentOpacity = React.useRef(new Animated.Value(1)).current;
  // Ref: key của request lấy tên người chơi (tránh gọi lại trùng)
  const requestedNamesKey = React.useRef<string | null>(null);

  /**
   * loadDetails – Tải chi tiết trận đấu từ API (hoặc force refresh)
   * @param force – Nếu true, bỏ qua cache và tải lại
   */
  const loadDetails = React.useCallback(
    async (force = false) => {
      if (isDemo) return;
      if (!matchId) {
        setError(t("match_ui.states.error_body"));
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const response = await fetchMatchDetails(user, matchId, force);
      if (response) {
        setDetails(response);
      } else {
        setError(t("match_ui.states.error_body"));
      }
      setLoading(false);
    },
    [fetchMatchDetails, isDemo, matchId, t, user]
  );

  // Effect: Load chi tiết match khi component mount (hoặc dùng cache)
  React.useEffect(() => {
    if (isDemo) return;
    if (cachedDetails) {
      setDetails(cachedDetails);
      setLoading(false);
      return;
    }
    void loadDetails();
  }, [cachedDetails, isDemo, loadDetails]);

  // Effect: Tự động lấy tên người chơi (gameName) nếu chưa có
  React.useEffect(() => {
    if (
      isDemo ||
      !details ||
      !user.accessToken ||
      !user.entitlementsToken ||
      !user.region
    ) {
      return;
    }
    // Kiểm tra xem tất cả người chơi đã có tên chưa
    const alreadyNamed = details.players.every((player) => Boolean(player.gameName));
    if (alreadyNamed) return;
    const subjects = details.players.map((player) => player.subject).filter(Boolean);
    const requestKey = subjects.slice().sort().join(",");
    if (!requestKey || requestedNamesKey.current === requestKey) return;
    requestedNamesKey.current = requestKey;

    // Gọi API lấy tên người chơi
    void getPlayerNames(
      user.accessToken,
      user.entitlementsToken,
      subjects,
      user.region
    )
      .then((names) => {
        if (names.length === 0) return;
        const identities: MatchPlayerIdentity[] = names.map((name) => ({
          Subject: name.Subject,
          GameName: name.GameName,
          TagLine: name.TagLine,
        }));
        setDetails((current) => {
          if (!current) return current;
          const next: MatchDetailsData = {
            ...current,
            playerIdentities: identities,
          };
          return next;
        });
        // Cập nhật store cache sau khi setDetails
        useMatchStore.setState((state) => ({
          detailsById: {
            ...state.detailsById,
            [matchId]: {
              ...state.detailsById[matchId],
              playerIdentities: identities,
            },
          },
        }));
      })
      .catch((nameError: unknown) => {
        if (__DEV__) console.warn("Failed to resolve match player names", nameError);
      });
  }, [details, isDemo, matchId, user]);

  /**
   * viewModel – Dữ liệu đã được transform để render UI
   * Nếu isDemo thì dùng mockMatchDetail; nếu không thì build từ details
   */
  const viewModel = React.useMemo<MatchDetailViewModel | null>(() => {
    if (isDemo) return mockMatchDetail;
    if (!details) return null;
    return buildMatchDetailViewModel(details, user.id);
  }, [details, isDemo, user.id]);

  // Effect: Khi viewModel thay đổi, cập nhật selectedPlayerId và selectedRoundNumber nếu cần
  React.useEffect(() => {
    if (!viewModel) return;
    // Giữ selectedPlayerId nếu vẫn tồn tại trong danh sách, nếu không thì chọn currentPlayerId
    setSelectedPlayerId((current) =>
      viewModel.players.some((player) => player.playerId === current)
        ? current
        : viewModel.currentPlayerId
    );
    // Giữ selectedRoundNumber nếu vẫn tồn tại, nếu không thì chọn vòng đầu tiên
    setSelectedRoundNumber((current) =>
      viewModel.rounds.some((round) => round.roundNumber === current)
        ? current
        : viewModel.rounds[0]?.roundNumber ?? null
    );
  }, [viewModel]);

  /**
   * changeTab – Chuyển đổi giữa tab scoreboard và performance với animation fade
   * @param tab – Tab đích ("scoreboard" | "performance")
   */
  const changeTab = React.useCallback(
    (tab: MatchDetailTab) => {
      if (tab === activeTab) return;
      // Fade out nhẹ, đổi tab, scroll lên đầu, fade in
      contentOpacity.setValue(0.45);
      setActiveTab(tab);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 190,
        useNativeDriver: true,
      }).start();
    },
    [activeTab, contentOpacity]
  );

  /**
   * selectScoreboardPlayer – Chọn một người chơi từ scoreboard và chuyển sang tab performance
   * @param playerId – ID người chơi được chọn
   */
  const selectScoreboardPlayer = React.useCallback(
    (playerId: string) => {
      setSelectedPlayerId(playerId);
      changeTab("performance");
    },
    [changeTab]
  );

  /**
   * selectRound – Chọn một vòng đấu và scroll xuống vị trí tương ứng
   * @param roundNumber – Số vòng đấu
   */
  const selectRound = React.useCallback((roundNumber: number) => {
    setSelectedRoundNumber(roundNumber);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 430, animated: true });
    });
  }, []);

  /**
   * shareMatch – Chia sẻ kết quả trận đấu qua native Share sheet
   * Tạo message gồm: map, tỉ số, KDA của người chơi, link
   */
  const shareMatch = React.useCallback(async () => {
    if (!viewModel) return;
    const selectedPerformance =
      viewModel.playerPerformance[selectedPlayerId] ??
      viewModel.playerPerformance[viewModel.currentPlayerId];
    const summary = selectedPerformance?.summary;
    const link = Linking.createURL(`/match_details/${viewModel.match.id}`);
    const message = [
      `${viewModel.match.mapName} ${viewModel.match.teamAScore}:${viewModel.match.teamBScore}`,
      summary
        ? `${summary.agentName} ${summary.kills}/${summary.deaths}/${summary.assists}`
        : null,
      link,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");
    await Share.share({ message, title: viewModel.match.mapName });
  }, [selectedPlayerId, viewModel]);

  // Hiển thị skeleton loading khi đang tải
  if (loading && !viewModel) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <MatchDetailSkeleton />
      </SafeAreaView>
    );
  }

  // Hiển thị error state nếu có lỗi hoặc không có viewModel
  if (!viewModel || error) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <MatchStatePanel
          icon="alert-circle-outline"
          title={t("match_ui.states.error_title")}
          body={error || t("match_ui.states.error_body")}
          primaryLabel={t("match_ui.actions.retry")}
          onPrimaryPress={() => void loadDetails(true)}
          secondaryLabel={t("match_ui.actions.back")}
          onSecondaryPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* Header: thông tin match + nút đóng */}
      <MatchDetailHeader
        match={viewModel.match}
        locale={i18n.language || "en"}
        onClose={() => router.back()}
      />
      {/* Tabs: Scoreboard / Performance */}
      <MatchDetailTabs activeTab={activeTab} onChange={changeTab} />
      {/* Nội dung cuộn với animation opacity khi chuyển tab */}
      <Animated.View style={[styles.scrollShell, { opacity: contentOpacity }]}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          directionalLockEnabled
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentWidth}>
            {activeTab === "scoreboard" ? (
              <>
                <EconomyChart points={viewModel.economy} />
                <ScoreboardTable
                  players={viewModel.players}
                  onSelectPlayer={selectScoreboardPlayer}
                />
              </>
            ) : (
              <PerformanceTab
                data={viewModel}
                selectedPlayerId={selectedPlayerId}
                selectedRoundNumber={selectedRoundNumber}
                onSelectPlayer={setSelectedPlayerId}
                onSelectRound={selectRound}
              />
            )}
          </View>
        </ScrollView>
      </Animated.View>
      {/* Thanh share cố định dưới cùng */}
      <StickyShareBar onShare={() => void shareMatch()} />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StyleSheet – Định nghĩa styles cho màn hình Match Details
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // screen – Container SafeAreaView, nền appBackground từ MatchTheme
  screen: {
    flex: 1,
    backgroundColor: MATCH_COLORS.appBackground,
  },
  // scrollShell – View bọc ScrollView, chiếm toàn bộ không gian còn lại
  scrollShell: {
    flex: 1,
  },
  // scroll – ScrollView chính
  scroll: {
    flex: 1,
  },
  // scrollContent – Content container, căn giữa theo chiều ngang
  scrollContent: {
    alignItems: "center",
  },
  // contentWidth – Giới hạn chiều rộng nội dung tối đa, có padding bottom
  contentWidth: {
    width: "100%",
    maxWidth: MATCH_LAYOUT.maxContentWidth,
    paddingBottom: MATCH_SPACING.lg,
  },
});
