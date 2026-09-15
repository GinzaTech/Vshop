// ===== CombatSessionScreen.tsx – Màn hình theo dõi trận đang chơi (landscape) =====
// Màn hình duy nhất được phép khóa ngang (AGENTS.md mục 5): vào màn → lock
// landscape, rời màn → trả về portrait. Hiển thị đội mình/đối thủ với rank,
// hiệu suất ranked 5 trận (COMP) hoặc chỉ số trận live (MATCH), poll 10s.
// Dữ liệu: useCombatStore (snapshot live/pregame) + session-insights (intel).

import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CachedImage as Image } from "~/components/CachedImage";
import { useCombatStore } from "~/hooks/useCombatStore";
import { useUserStore } from "~/hooks/useUserStore";
import {
  getAgent,
  getAssets,
  type CompetitiveTierAsset,
  type CompetitiveTierSet,
} from "~/utils/valorant-assets";
import { formatSessionQueueLabel } from "~/utils/valorant-session";
import { lockScreenOrientation } from "~/utils/screen-orientation";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { useRiotScreenSession } from "~/hooks/useRiotScreenSession";
import { useCombatScreenActivity } from "~/features/combat/useCombatScreenActivity";
import { useCombatSessionPolling } from "~/features/combat/useCombatSessionPolling";
import { useCombatPlayerIntel } from "~/features/combat/useCombatPlayerIntel";
import { useCombatMatchPerformance } from "~/features/combat/useCombatMatchPerformance";
import { useCombatSnapshot } from "~/features/combat/useCombatSnapshot";
import { styles, TRACKER_COLORS } from "~/features/combat/combat-session.styles";
import {
  EMPTY_COMPETITIVE_PERFORMANCE,
  EMPTY_INTEL,
  EMPTY_MATCH_PERFORMANCE,
  formatCompetitiveMetric,
  MAX_TEAM_SIZE,
  toTitleCase,
  type SessionPlayer,
  type StatsViewMode,
} from "~/features/combat/session-insights";

/**
 * PregameSessionPlayer – Người chơi ở giai đoạn pregame (select agent):
 * Subject (puuid), TeamID, CharacterID (agent), CompetitiveTier và trạng thái lock.
 */
type PregameSessionPlayer = {
  Subject: string;
  TeamID?: string;
  CharacterID?: string;
  CompetitiveTier?: number;
  CharacterSelectionState?: string;
};

export default function CombatSessionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  // Màn hình "chật" (điện thoại ngang nhỏ) → dùng layout compact.
  const isTight = width < 800 || height < 380;
  const user = useUserStore((state) => state.user);
  const session = useRiotScreenSession(user);
  const assets = getAssets();
  const agents = getAgent().agents;
  // Snapshot phiên trận từ store: state live/pregame/idle + tên theo subject.
  const snapshot = useCombatSnapshot(session);
  const loading = useCombatStore((state) => state.loading);
  const [orientationReady, setOrientationReady] = React.useState(false);
  const [orientationLocked, setOrientationLocked] = React.useState(false);
  // Subject của người chơi đang mở modal chi tiết (null = đóng).
  const [selectedSubject, setSelectedSubject] = React.useState<string | null>(null);
  // Nguồn chỉ số đang hiển thị: "competitive" (5 trận ranked) | "match" (trận live).
  const [statsViewMode, setStatsViewMode] =
    React.useState<StatsViewMode>("competitive");
  const activity = useCombatScreenActivity();
  const loadSnapshot = useCombatSessionPolling(session, snapshot.state === "live", activity);
  const { refreshing, onRefresh } = useAsyncRefresh(loadSnapshot, session);

  // Back hardware khi modal đang mở → chỉ đóng modal, không thoát màn hình.
  React.useEffect(() => {
    if (!selectedSubject) return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setSelectedSubject(null);
      return true;
    });
    return () => subscription.remove();
  }, [selectedSubject]);

  /**
   * tierLookup – Map tier number → asset rank (icon/tên) từ set tier mới nhất
   * của assets.competitiveTiers; set nào có tier max cao hơn sẽ được chọn.
   */
  const tierLookup = React.useMemo(() => {
    const tierSets = Array.isArray(assets.competitiveTiers)
      ? assets.competitiveTiers
      : [];
    const getMaxTier = (tierSet: CompetitiveTierSet) =>
      (Array.isArray(tierSet?.tiers) ? tierSet.tiers : []).reduce(
        (highest, tier) => {
          const tierNumber = Number(tier?.tier);
          return Number.isFinite(tierNumber) ? Math.max(highest, tierNumber) : highest;
        },
        0
      );
    const currentTierSet = tierSets.reduce<CompetitiveTierSet | null>(
      (best, candidate) =>
        !best || getMaxTier(candidate) >= getMaxTier(best) ? candidate : best,
      null
    );
    const map = new Map<number, CompetitiveTierAsset>();
    (currentTierSet?.tiers || []).forEach((tier) => {
      const tierNumber = Number(tier?.tier);
      if (Number.isFinite(tierNumber) && tierNumber > 0) {
        map.set(tierNumber, tier);
      }
    });
    return map;
  }, [assets.competitiveTiers]);

  // Focus effect 1: khóa landscape khi vào màn, trả portrait khi rời màn.
  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      setOrientationReady(false);
      setOrientationLocked(false);
      void lockScreenOrientation("landscape")
        .then((locked) => {
          if (active) {
            setOrientationLocked(locked);
            setOrientationReady(true);
          }
        });

      return () => {
        active = false;
        setOrientationReady(false);
        setOrientationLocked(false);
        void lockScreenOrientation("portrait");
      };
    }, [])
  );

  // Đạo hàm hiển thị: map/queue của trận hiện tại (live ưu tiên, fallback pregame).
  const matchData = snapshot.currentGameMatch;
  const pregameData = snapshot.pregameMatch;
  const activeMapId = matchData?.MapID || pregameData?.MapID;
  const mapInfo = assets.maps?.find((map) => map.mapUrl === activeMapId);
  const mapImage = mapInfo?.listViewIcon || mapInfo?.splash;
  const rawQueueLabel =
    matchData?.MatchmakingData?.QueueID ||
    matchData?.ModeID ||
    pregameData?.QueueID ||
    pregameData?.Mode;
  const queueLabel = formatSessionQueueLabel(rawQueueLabel, t);

  /**
   * teams – Chuẩn hóa roster 2 đội theo snapshot state:
   * - live: từ matchData.Players, đội mình xác định theo TeamID của user.
   * - pregame: từ AllyTeam/EnemyTeam, ready = đã lock agent.
   * Cả hai đều cắt còn MAX_TEAM_SIZE người mỗi đội.
   */
  const teams = React.useMemo(() => {
    if (snapshot.state === "live" && matchData) {
      const current = matchData.Players.find((player) => player.Subject === user.id);
      const currentTeamId = current?.TeamID || "Blue";
      const toSessionPlayer = (player: typeof matchData.Players[number]): SessionPlayer => ({
        subject: player.Subject,
        teamId: player.TeamID,
        agentId: player.CharacterID,
        tier: player.SeasonalBadgeInfo?.Rank,
        level: player.PlayerIdentity?.HideAccountLevel
          ? undefined
          : player.PlayerIdentity?.AccountLevel,
        leaderboardRank: player.SeasonalBadgeInfo?.LeaderboardRank,
        isCoach: player.IsCoach,
        isCurrentUser: player.Subject === user.id,
      });

      return {
        allies: matchData.Players
          .filter((player) => player.TeamID === currentTeamId)
          .slice(0, MAX_TEAM_SIZE)
          .map(toSessionPlayer),
        enemies: matchData.Players
          .filter((player) => player.TeamID && player.TeamID !== currentTeamId)
          .slice(0, MAX_TEAM_SIZE)
          .map(toSessionPlayer),
      };
    }

    if (snapshot.state === "pregame") {
      const toPregamePlayer = (player: PregameSessionPlayer): SessionPlayer => ({
        subject: player.Subject,
        teamId: player.TeamID,
        agentId: player.CharacterID,
        tier: player.CompetitiveTier,
        ready: player.CharacterSelectionState === "locked",
        isCurrentUser: player.Subject === user.id,
      });
      return {
        allies: (pregameData?.AllyTeam?.Players || [])
          .slice(0, MAX_TEAM_SIZE)
          .map(toPregamePlayer),
        enemies: (pregameData?.EnemyTeam?.Players || [])
          .slice(0, MAX_TEAM_SIZE)
          .map(toPregamePlayer),
      };
    }

    return { allies: [] as SessionPlayer[], enemies: [] as SessionPlayer[] };
  }, [matchData, pregameData, snapshot.state, user.id]);

  // allPlayers: danh sách phẳng 10 người; playerSubjectKey: key ổn định
  // (subject sort + join "|") để các effect fetch intel chỉ re-arm khi roster đổi.
  const allPlayers = React.useMemo(
    () => [...teams.allies, ...teams.enemies],
    [teams.allies, teams.enemies]
  );
  const playerSubjectKey = React.useMemo(
    () =>
      Array.from(new Set(allPlayers.map((player) => player.subject.toLocaleLowerCase("en-US"))))
        .sort()
        .join("|"),
    [allPlayers]
  );

  const { playerIntel, competitivePerformance } = useCombatPlayerIntel(
    session, playerSubjectKey, snapshot.matchId, activity
  );
  const matchPerformance = useCombatMatchPerformance(
    session, playerSubjectKey, matchData?.MatchID,
    statsViewMode === "match" && snapshot.state === "live", activity
  );

  /**
   * getPlayerPresentation – Tổng hợp dữ liệu hiển thị của 1 player:
   * agent, intel rank, tên hiển thị (namesBySubject → agent → fallback),
   * tier hiện tại/peak kèm icon và tên đã TitleCase.
   */
  const getPlayerPresentation = React.useCallback(
    (player: SessionPlayer) => {
      const subjectKey = player.subject.toLocaleLowerCase("en-US");
      const agent = agents.find((item) => item.uuid === player.agentId);
      const intel = playerIntel[subjectKey] || EMPTY_INTEL;
      const currentTier = intel.currentTier || player.tier || null;
      const currentTierInfo = currentTier ? tierLookup.get(currentTier) : null;
      const peakTierInfo = intel.peakTier ? tierLookup.get(intel.peakTier) : null;
      const resolvedName = snapshot.namesBySubject[subjectKey];

      return {
        agent,
        intel,
        displayName:
          resolvedName ||
          agent?.displayName ||
          `${t("combat_session_page.player_fallback")} ${player.subject.slice(0, 6)}`,
        currentTier,
        currentName: currentTierInfo?.tierName
          ? toTitleCase(currentTierInfo.tierName)
          : t("combat_session_page.unavailable"),
        currentIcon:
          currentTierInfo?.smallIcon ||
          currentTierInfo?.largeIcon ||
          null,
        peakName: peakTierInfo?.tierName
          ? toTitleCase(peakTierInfo.tierName)
          : t("combat_session_page.unavailable"),
        peakIcon:
          peakTierInfo?.smallIcon ||
          peakTierInfo?.largeIcon ||
          null,
      };
    },
    [agents, playerIntel, snapshot.namesBySubject, t, tierLookup]
  );

  // Người đang mở modal + người dùng hiện tại + chỉ số tương ứng của họ.
  const selectedPlayer = allPlayers.find(
    (player) => player.subject === selectedSubject
  ) || null;
  const selectedPresentation = selectedPlayer
    ? getPlayerPresentation(selectedPlayer)
    : null;
  const selectedSubjectKey = selectedPlayer?.subject.toLocaleLowerCase("en-US");
  const selectedPerformance = selectedSubjectKey
    ? competitivePerformance[selectedSubjectKey] || EMPTY_COMPETITIVE_PERFORMANCE
    : EMPTY_COMPETITIVE_PERFORMANCE;
  const selectedMatchPerformance = selectedSubjectKey
    ? matchPerformance[selectedSubjectKey] || EMPTY_MATCH_PERFORMANCE
    : EMPTY_MATCH_PERFORMANCE;
  const currentPlayer = allPlayers.find((player) => player.isCurrentUser) || null;
  const currentPresentation = currentPlayer
    ? getPlayerPresentation(currentPlayer)
    : null;
  const currentDisplayName =
    currentPresentation?.displayName ||
    (user.TagLine ? `${user.name}#${user.TagLine}` : user.name) ||
    t("combat_session_page.player_fallback");
  // Helper format chỉ số cho modal: "…" khi loading, "—" khi không có data.
  const selectedCompetitiveValue = (
    value: number | null,
    digits: number,
    suffix = ""
  ) =>
    selectedPerformance.status === "loading"
      ? "…"
      : formatCompetitiveMetric(value, digits, suffix);
  // Helper chỉ số trận live trong modal (giống trên nhưng 3 trạng thái).
  const selectedMatchValue = (
    value: number | null,
    digits: number,
    suffix = ""
  ) =>
    selectedMatchPerformance.status === "loading"
      ? "…"
      : selectedMatchPerformance.status === "ready"
        ? formatCompetitiveMetric(value, digits, suffix)
        : "—";
  // Bộ chỉ số hiển thị trong modal theo statsViewMode (KDA/HS/ACS hoặc K/D/WR/ACS/HS).
  const selectedModalStats: [string, string][] =
    statsViewMode === "match"
      ? [
          [
            "KDA",
            selectedMatchPerformance.status === "loading"
              ? "…"
              : selectedMatchPerformance.status === "ready"
                ? `${selectedMatchPerformance.kills ?? 0}/${selectedMatchPerformance.deaths ?? 0}/${selectedMatchPerformance.assists ?? 0}`
                : "—",
          ],
          [
            "HS",
            selectedMatchValue(selectedMatchPerformance.headshotPercent, 0, "%"),
          ],
          ["ACS", selectedMatchValue(selectedMatchPerformance.acs, 0)],
        ]
      : [
          ["K/D", selectedCompetitiveValue(selectedPerformance.kd, 2)],
          ["WR", selectedCompetitiveValue(selectedPerformance.winRate, 0, "%")],
          ["ACS", selectedCompetitiveValue(selectedPerformance.acs, 0)],
          [
            "HS",
            selectedCompetitiveValue(selectedPerformance.headshotPercent, 0, "%"),
          ],
        ];

  /**
   * renderPlayerRow – Hàng một người chơi: avatar agent, tên + badge YOU,
   * tên agent + cấp, rank hiện tại (icon + RR), dải chỉ số theo statsViewMode
   * và khối peak rank + season ở mép phải. Bấm → mở modal chi tiết.
   * @param {SessionPlayer} player - Người chơi cần render.
   * @param {string} accent - Màu nhấn theo đội (cyan/red).
   */
  const renderPlayerRow = (player: SessionPlayer, accent: string) => {
    const presentation = getPlayerPresentation(player);
    const subjectKey = player.subject.toLocaleLowerCase("en-US");
    const performance =
      competitivePerformance[subjectKey] ||
      EMPTY_COMPETITIVE_PERFORMANCE;
    const currentMatchPerformance =
      matchPerformance[subjectKey] || EMPTY_MATCH_PERFORMANCE;
    const rankLoading = presentation.intel.status === "loading";
    const performanceLoading = performance.status === "loading";
    // Helper format trong hàng: "…" khi đang loading, còn lại qua formatCompetitiveMetric.
    const metricValue = (
      value: number | null,
      digits: number,
      suffix = ""
    ) =>
      performanceLoading
        ? "…"
        : formatCompetitiveMetric(value, digits, suffix);
    const matchMetricValue = (
      value: number | null,
      digits: number,
      suffix = ""
    ) =>
      currentMatchPerformance.status === "loading"
        ? "…"
        : currentMatchPerformance.status === "ready"
          ? formatCompetitiveMetric(value, digits, suffix)
          : "—";
    const displayedMetrics =
      statsViewMode === "match"
        ? [
            [
              "KDA",
              currentMatchPerformance.status === "loading"
                ? "…"
                : currentMatchPerformance.status === "ready"
                  ? `${currentMatchPerformance.kills || 0}/${currentMatchPerformance.deaths || 0}/${currentMatchPerformance.assists || 0}`
                  : "—",
            ],
            [
              "HS",
              matchMetricValue(
                currentMatchPerformance.headshotPercent,
                0,
                "%"
              ),
            ],
            ["ACS", matchMetricValue(currentMatchPerformance.acs, 0)],
          ]
        : [
            ["K/D", metricValue(performance.kd, 2)],
            ["WR", metricValue(performance.winRate, 0, "%")],
            ["ACS", metricValue(performance.acs, 0)],
            ["HS", metricValue(performance.headshotPercent, 0, "%")],
          ];

    return (
      <Pressable
        key={player.subject}
        accessibilityRole="button"
        accessibilityLabel={`${t("combat_session_page.player_details", {
          defaultValue: "Player details",
        })}: ${presentation.displayName}`}
        onPress={() => setSelectedSubject(player.subject)}
        style={({ pressed }) => [
          styles.playerRow,
          { borderLeftColor: accent },
          pressed && styles.playerRowPressed,
        ]}
      >
        <View style={[styles.agentAvatar, { borderColor: `${accent}80` }]}>
          {presentation.agent?.displayIcon ? (
            <Image
              cacheId={`agent:${presentation.agent.uuid}:display-icon`}
              source={{ uri: presentation.agent.displayIcon }}
              style={styles.agentImage}
              contentFit="contain"
              cachePolicy="memory-disk"
              priority="low"
              recyclingKey={presentation.agent.displayIcon}
            />
          ) : (
            <Icon name="account-outline" size={18} color={TRACKER_COLORS.muted} />
          )}
        </View>

        <View style={styles.playerIdentity}>
          <View style={styles.playerNameLine}>
            <Text style={styles.playerName} numberOfLines={1}>
              {presentation.displayName}
            </Text>
            {player.isCurrentUser ? (
              <View style={[styles.youBadge, { backgroundColor: accent }]}>
                <Text style={styles.youBadgeText}>
                  {t("combat_session_page.you", { defaultValue: "YOU" })}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.playerMetaLine}>
            <Text style={styles.agentName} numberOfLines={1}>
              {presentation.agent?.displayName ||
                t("combat_session_page.agent_unselected")}
              {player.level ? ` · LV ${player.level}` : ""}
            </Text>
            <View style={styles.currentRankInline}>
              {presentation.currentIcon ? (
                <Image
                  cacheId={`rank:${presentation.currentTier}:${presentation.currentIcon}:current`}
                  source={{ uri: presentation.currentIcon }}
                  style={styles.currentRankIcon}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  priority="low"
                  recyclingKey={presentation.currentIcon}
                />
              ) : (
                <View style={styles.currentRankIconPlaceholder}>
                  {rankLoading ? (
                    <ActivityIndicator
                      size={8}
                      color={TRACKER_COLORS.cyan}
                    />
                  ) : null}
                </View>
              )}
              <Text style={styles.currentRankText} numberOfLines={1}>
                {presentation.currentName}
                {presentation.intel.currentRr !== null
                  ? ` · ${presentation.intel.currentRr} RR`
                  : ""}
              </Text>
            </View>
            <View style={styles.competitiveMetrics}>
              {displayedMetrics.map(([label, value]) => (
                <View key={label} style={styles.competitiveMetric}>
                  <Text style={styles.competitiveMetricLabel}>{label}</Text>
                  <Text
                    style={[
                      styles.competitiveMetricValue,
                      statsViewMode === "match" && styles.matchMetricValue,
                    ]}
                  >
                    {value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.peakRankEnd}>
          <Text style={styles.peakRankLabel}>
            {t("combat_session_page.peak_short", { defaultValue: "Peak" })}
          </Text>
          <View style={styles.peakRankLine}>
            {presentation.peakIcon ? (
              <Image
                cacheId={`rank:${presentation.intel.peakTier}:${presentation.peakIcon}:peak`}
                source={{ uri: presentation.peakIcon }}
                style={styles.peakRankIcon}
                contentFit="contain"
                cachePolicy="memory-disk"
                priority="low"
                recyclingKey={presentation.peakIcon}
              />
            ) : (
              <Icon
                name="chart-timeline-variant-shimmer"
                size={15}
                color={TRACKER_COLORS.faint}
              />
            )}
            <Text style={styles.peakRankName} numberOfLines={1}>
              {presentation.peakName}
            </Text>
          </View>
          <Text style={styles.peakRankSeason} numberOfLines={1}>
            {presentation.intel.peakSeason
              ? presentation.intel.peakSeason
                  .replace("Episode ", "E")
                  .replace(" – Act ", "–A")
              : "—"}
          </Text>
        </View>
      </Pressable>
    );
  };

  /**
   * renderTeam – Panel một đội: header (tên + side + số người), danh sách
   * hàng người chơi, slot trống còn lại hoặc empty roster khi chưa có data.
   * @param {SessionPlayer[]} players - Roster đã chuẩn hóa của đội.
   * @param {string} label - Tên đội hiển thị (đã dịch).
   * @param {string} accent - Màu nhấn chính (viền trên, chấm tên đội).
   * @param {string} accentSoft - Nền nhạt của header.
   * @param {string} sideLabel - Nhãn bên ("TEAM A"/"ALLY"...).
   */
  const renderTeam = (
    players: SessionPlayer[],
    label: string,
    accent: string,
    accentSoft: string,
    sideLabel: string
  ) => {
    const emptySlots = Math.max(0, MAX_TEAM_SIZE - players.length);
    return (
      <View style={[styles.teamPanel, { borderTopColor: accent }]}>
        <View style={[styles.teamHeader, { backgroundColor: accentSoft }]}>
          <View style={styles.teamTitleGroup}>
            <View style={[styles.teamDot, { backgroundColor: accent }]} />
            <Text style={styles.teamTitle}>{label}</Text>
            <Text style={[styles.sideLabel, { color: accent }]}>{sideLabel}</Text>
          </View>
          <Text style={styles.teamCount}>
            {players.length}/{MAX_TEAM_SIZE}
          </Text>
        </View>
        <View style={styles.teamList}>
          {players.map((player) => renderPlayerRow(player, accent))}
          {players.length === 0 ? (
            <View style={styles.emptyRoster}>
              <Icon name="account-group-outline" size={22} color={TRACKER_COLORS.faint} />
              <Text style={styles.emptyRosterText}>
                {t("combat_session_page.roster_empty")}
              </Text>
            </View>
          ) : (
            Array.from({ length: emptySlots }, (_, index) => (
              <View key={`empty-${index}`} style={styles.emptyPlayerSlot} />
            ))
          )}
        </View>
      </View>
    );
  };

  // Kiểm tra khóa orientation trước khi render shell dày đặc: tránh vẽ layout
  // desktop-dense trong 1 frame xoay màn (nguồn của dải trắng giữa màn hình).
  const landscapeViewportReady = !orientationLocked || width >= height;

  if (!orientationReady || !landscapeViewportReady) {
    return (
      <SafeAreaView style={styles.orientationLoading}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color={TRACKER_COLORS.cyan} />
      </SafeAreaView>
    );
  }

  // Nhãn trạng thái phiên: LIVE / PREGAME / IDLE.
  const statusLabel =
    snapshot.state === "live"
      ? t("combat_session_page.session_live")
      : snapshot.state === "pregame"
        ? t("combat_session_page.session_pregame")
        : t("combat_session_page.idle_title");

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar hidden />
      <ScrollView
        style={styles.sessionScroll}
        contentContainerStyle={styles.sessionScrollContent}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.landscapeContent, isTight && styles.landscapeContentTight]}>
        <View style={[styles.trackerHeader, isTight && styles.trackerHeaderTight]}>
          {/* Header tracker: ảnh map nền + scrim + nhóm điều khiển trái/phải */}
          {mapImage ? (
            <Image
              cacheId={`map:${mapInfo?.uuid || activeMapId}:tracker`}
              source={{ uri: mapImage }}
              style={styles.headerMapImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              priority="normal"
              recyclingKey={mapImage}
            />
          ) : null}
          <View style={styles.headerScrim} pointerEvents="none" />

          {/* Khối trái: nút back + avatar/tên người dùng + rank hiện tại */}
          <View style={styles.headerPlayer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("match_ui.actions.back", {
                defaultValue: "Back",
              })}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.headerAction,
                pressed && styles.headerActionPressed,
              ]}
            >
              <Icon name="chevron-left" size={22} color={TRACKER_COLORS.text} />
            </Pressable>
            <View style={styles.headerAvatar}>
              {currentPresentation?.agent?.displayIcon ? (
                <Image
                  cacheId={`agent:${currentPresentation.agent.uuid}:header`}
                  source={{ uri: currentPresentation.agent.displayIcon }}
                  style={styles.headerAvatarImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  priority="normal"
                  recyclingKey={currentPresentation.agent.displayIcon}
                />
              ) : (
                <Icon name="account" size={20} color={TRACKER_COLORS.muted} />
              )}
            </View>
            <View style={styles.headerPlayerText}>
              <Text style={styles.headerPlayerName} numberOfLines={1}>
                {currentDisplayName}
              </Text>
              <Text style={styles.headerPlayerMeta} numberOfLines={1}>
                {currentPresentation?.currentName || t("combat_session_page.unavailable")}
                {user.region ? ` · ${user.region.toLocaleUpperCase("en-US")}` : ""}
              </Text>
            </View>
          </View>

          {/* Khối giữa: tên map + queue */}
          <View style={styles.headerMatch}>
            <Text style={styles.headerMapName} numberOfLines={1}>
              {mapInfo?.displayName || t("combat_session_page.no_map")}
            </Text>
            <Text style={styles.headerQueue} numberOfLines={1}>
              {queueLabel}
            </Text>
          </View>

          {/* Khối phải: toggle COMP/MATCH + trạng thái live + nút refresh */}
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: statsViewMode === "match" }}
              accessibilityLabel={
                statsViewMode === "competitive"
                  ? "Show current match statistics"
                  : "Show recent competitive statistics"
              }
              onPress={() =>
                setStatsViewMode((current) =>
                  current === "competitive" ? "match" : "competitive"
                )
              }
              style={({ pressed }) => [
                styles.statsModeToggle,
                statsViewMode === "match" && styles.statsModeToggleMatch,
                pressed && styles.headerActionPressed,
              ]}
            >
              <Icon
                name={
                  statsViewMode === "match"
                    ? "sword-cross"
                    : "chart-timeline-variant"
                }
                size={13}
                color={
                  statsViewMode === "match"
                    ? TRACKER_COLORS.red
                    : TRACKER_COLORS.cyan
                }
              />
              <Text
                style={[
                  styles.statsModeToggleText,
                  statsViewMode === "match" && styles.statsModeToggleTextMatch,
                ]}
              >
                {statsViewMode === "match"
                  ? t("combat_session_page.stats_match_short", {
                      defaultValue: "MATCH",
                    })
                  : t("combat_session_page.stats_competitive_short", {
                      defaultValue: "COMP",
                    })}
              </Text>
            </Pressable>
            <View style={styles.liveState}>
              <View
                style={[
                  styles.liveDot,
                  {
                    backgroundColor:
                      snapshot.state === "live"
                        ? TRACKER_COLORS.success
                        : TRACKER_COLORS.warning,
                  },
                ]}
              />
              <Text style={styles.liveStateText}>{statusLabel}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("combat_page.actions.refresh", {
                defaultValue: "Refresh",
              })}
              disabled={loading}
              onPress={() => void loadSnapshot()}
              style={({ pressed }) => [
                styles.headerAction,
                pressed && styles.headerActionPressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator size={16} color={TRACKER_COLORS.cyan} />
              ) : (
                <Icon name="refresh" size={19} color={TRACKER_COLORS.text} />
              )}
            </Pressable>
          </View>
        </View>

        {/* Thanh tóm tắt: số người chơi, map, queue, số người có rank data */}
        <View style={[styles.summaryBar, isTight && styles.summaryBarTight]}>
          <View style={styles.summaryItem}>
            <Icon name="account-group-outline" size={14} color={TRACKER_COLORS.cyan} />
            <Text style={styles.summaryValue}>{allPlayers.length}/10</Text>
            <Text style={styles.summaryLabel}>
              {t("combat_session_page.players", { defaultValue: "PLAYERS" })}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Icon name="map-marker-outline" size={14} color={TRACKER_COLORS.muted} />
            <Text style={styles.summaryValue} numberOfLines={1}>
              {mapInfo?.displayName || "—"}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Icon name="sword-cross" size={14} color={TRACKER_COLORS.muted} />
            <Text style={styles.summaryValue} numberOfLines={1}>
              {queueLabel}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Icon name="shield-account-outline" size={14} color={TRACKER_COLORS.muted} />
            <Text style={styles.summaryValue}>
              {playerSubjectKey ? Object.values(playerIntel).filter(
                (intel) => intel.status === "ready"
              ).length : 0}
            </Text>
            <Text style={styles.summaryLabel}>
              {t("combat_session_page.rank_data", { defaultValue: "RANK DATA" })}
            </Text>
          </View>
        </View>

        {/* Idle → empty state; còn lại → bảng 2 đội */}
        {snapshot.state === "idle" ? (
          <View style={styles.emptyState}>
            {loading ? (
              <ActivityIndicator size="large" color={TRACKER_COLORS.cyan} />
            ) : (
              <Icon name="sword-cross" size={38} color={TRACKER_COLORS.faint} />
            )}
            <View style={styles.emptyStateText}>
              <Text style={styles.emptyStateTitle}>
                {loading
                  ? t("combat_page.loading", { defaultValue: "Loading" })
                  : t("combat_session_page.empty_title")}
              </Text>
              <Text style={styles.emptyStateSubtitle} numberOfLines={2}>
                {t("combat_session_page.empty_subtitle")}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.matchBoard}>
            {renderTeam(
              teams.allies,
              t("combat_session_page.ally_team"),
              TRACKER_COLORS.cyan,
              TRACKER_COLORS.cyanSoft,
              snapshot.state === "live" ? "TEAM A" : "ALLY"
            )}
            {renderTeam(
              teams.enemies,
              t("combat_session_page.enemy_team"),
              TRACKER_COLORS.red,
              TRACKER_COLORS.redSoft,
              snapshot.state === "live" ? "TEAM B" : "ENEMY"
            )}
          </View>
        )}
      </View>
      </ScrollView>

      {/* Modal chi tiết người chơi (backdrop bấm để đóng + panel thông tin) */}
      {selectedPlayer && selectedPresentation ? (
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("match_ui.actions.close_details", {
              defaultValue: "Close",
            })}
            onPress={() => setSelectedSubject(null)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.playerModal}>
              {/* Header modal: avatar/tên/agent + switch COMP/MATCH + nút đóng */}
              <View style={styles.modalHeader}>
                <View style={styles.modalIdentity}>
                  <View style={styles.modalAvatar}>
                    {selectedPresentation.agent?.displayIcon ? (
                      <Image
                        cacheId={`agent:${selectedPresentation.agent.uuid}:modal`}
                        source={{ uri: selectedPresentation.agent.displayIcon }}
                        style={styles.modalAvatarImage}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        priority="normal"
                        recyclingKey={selectedPresentation.agent.displayIcon}
                      />
                    ) : (
                      <Icon name="account" size={30} color={TRACKER_COLORS.muted} />
                    )}
                  </View>
                  <View style={styles.modalTitleBlock}>
                    <Text style={styles.modalTitle} numberOfLines={1}>
                      {selectedPresentation.displayName}
                    </Text>
                    <Text style={styles.modalSubtitle} numberOfLines={1}>
                      {selectedPresentation.agent?.displayName ||
                        t("combat_session_page.agent_unselected")}
                      {selectedPlayer.level ? ` · LV ${selectedPlayer.level}` : ""}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalHeaderActions}>
                  <View style={styles.modalModeSwitch}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: statsViewMode === "competitive",
                      }}
                      onPress={() => setStatsViewMode("competitive")}
                      style={({ pressed }) => [
                        styles.modalModeButton,
                        statsViewMode === "competitive" &&
                          styles.modalModeButtonCompetitive,
                        pressed && styles.headerActionPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalModeText,
                          statsViewMode === "competitive" &&
                            styles.modalModeTextCompetitive,
                        ]}
                      >
                        {t("combat_session_page.stats_competitive_short", {
                          defaultValue: "COMP",
                        })}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: statsViewMode === "match" }}
                      onPress={() => setStatsViewMode("match")}
                      style={({ pressed }) => [
                        styles.modalModeButton,
                        statsViewMode === "match" && styles.modalModeButtonMatch,
                        pressed && styles.headerActionPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalModeText,
                          statsViewMode === "match" && styles.modalModeTextMatch,
                        ]}
                      >
                        {t("combat_session_page.stats_match_short", {
                          defaultValue: "MATCH",
                        })}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("match_ui.actions.close_details", {
                      defaultValue: "Close",
                    })}
                    onPress={() => setSelectedSubject(null)}
                    style={({ pressed }) => [
                      styles.modalClose,
                      pressed && styles.headerActionPressed,
                    ]}
                  >
                    <Icon name="close" size={20} color={TRACKER_COLORS.text} />
                  </Pressable>
                </View>
              </View>

              {/* Grid rank: card rank hiện tại + card peak (icon, tên, RR/season) */}
              <View style={styles.modalRankGrid}>
                <View style={styles.modalRankCard}>
                  {selectedPresentation.currentIcon ? (
                    <Image
                      cacheId={`rank:${selectedPresentation.currentTier}:${selectedPresentation.currentIcon}:modal-current`}
                      source={{ uri: selectedPresentation.currentIcon }}
                      style={styles.modalRankIcon}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      priority="normal"
                      recyclingKey={selectedPresentation.currentIcon}
                    />
                  ) : (
                    <Icon name="shield-outline" size={34} color={TRACKER_COLORS.faint} />
                  )}
                  <View>
                    <Text style={styles.modalCardLabel}>
                      {t("profile_page.current_rank")}
                    </Text>
                    <Text style={styles.modalCardValue}>
                      {selectedPresentation.currentName}
                    </Text>
                    <Text style={styles.modalCardMeta}>
                      {selectedPresentation.intel.currentRr !== null
                        ? `${selectedPresentation.intel.currentRr} RR`
                        : "—"}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalRankCard}>
                  {selectedPresentation.peakIcon ? (
                    <Image
                      cacheId={`rank:${selectedPresentation.intel.peakTier}:${selectedPresentation.peakIcon}:modal-peak`}
                      source={{ uri: selectedPresentation.peakIcon }}
                      style={styles.modalRankIcon}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      priority="normal"
                      recyclingKey={selectedPresentation.peakIcon}
                    />
                  ) : (
                    <Icon
                      name="chart-timeline-variant-shimmer"
                      size={34}
                      color={TRACKER_COLORS.faint}
                    />
                  )}
                  <View>
                    <Text style={styles.modalCardLabel}>
                      {t("profile_page.peak_rank")}
                    </Text>
                    <Text style={styles.modalCardValue}>
                      {selectedPresentation.peakName}
                    </Text>
                    <Text style={styles.modalCardMeta}>
                      {selectedPresentation.intel.peakSeason || "—"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Bộ chỉ số theo mode hiện tại (KDA/K-D/WR/ACS/HS) */}
              <View style={styles.modalStats}>
                {selectedModalStats.map(([label, value]) => (
                  <View key={label} style={styles.modalStat}>
                    <Text style={styles.modalStatValue}>{value}</Text>
                    <Text style={styles.modalStatLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* Form gần đây (W/L/D + delta RR) — chỉ khi mode competitive & ready */}
              {statsViewMode === "competitive" &&
              selectedPerformance.status === "ready" ? (
                <View style={styles.modalRecentForm}>
                  <View style={styles.modalRecentInfo}>
                    <Text style={styles.modalRecentLabel}>
                      {t("history_page.summary.matches", {
                        count: selectedPerformance.matches,
                        defaultValue: `${selectedPerformance.matches} matches`,
                      })}
                    </Text>
                    <View style={styles.modalResults}>
                      {selectedPerformance.recentResults.map(
                        ({ matchId, outcome }) => (
                          <View
                            key={matchId}
                            accessibilityLabel={
                              outcome === "win"
                                ? t("history_page.result_victory", {
                                    defaultValue: "Victory",
                                  })
                                : outcome === "loss"
                                  ? t("history_page.result_defeat", {
                                      defaultValue: "Defeat",
                                    })
                                  : t("match_ui.scoreboard.draw", {
                                      defaultValue: "Draw",
                                    })
                            }
                            style={[
                              styles.modalResultBadge,
                              outcome === "win"
                                ? styles.modalResultWin
                                : outcome === "loss"
                                  ? styles.modalResultLoss
                                  : styles.modalResultDraw,
                            ]}
                          >
                            <Text style={styles.modalResultText}>
                              {outcome === "win"
                                ? "W"
                                : outcome === "loss"
                                  ? "L"
                                  : "D"}
                            </Text>
                          </View>
                        )
                      )}
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.modalRrDelta,
                      (selectedPerformance.rrDelta || 0) > 0
                        ? styles.modalRrPositive
                        : (selectedPerformance.rrDelta || 0) < 0
                          ? styles.modalRrNegative
                          : styles.modalRrNeutral,
                    ]}
                  >
                    {selectedPerformance.rrDelta === null
                      ? "— RR"
                      : `${selectedPerformance.rrDelta > 0 ? "+" : ""}${selectedPerformance.rrDelta} RR`}
                  </Text>
                </View>
              ) : null}

              {/* Thông báo loading dữ liệu rank hoặc hồ sơ riêng tư */}
              {selectedPresentation.intel.status === "loading" ||
              (statsViewMode === "competitive"
                ? selectedPerformance.status === "loading"
                : selectedMatchPerformance.status === "loading") ? (
                <View style={styles.privateNotice}>
                  <ActivityIndicator size={13} color={TRACKER_COLORS.cyan} />
                  <Text style={styles.privateNoticeText}>
                    {t("combat_session_page.loading_player_data", {
                      defaultValue: "Loading player rank data…",
                    })}
                  </Text>
                </View>
              ) : selectedPresentation.intel.status === "private" ||
                (statsViewMode === "competitive" &&
                  selectedPerformance.status === "private") ? (
                <View style={styles.privateNotice}>
                  <Icon name="lock-outline" size={15} color={TRACKER_COLORS.warning} />
                  <Text style={styles.privateNoticeText}>
                    {t("combat_session_page.private_profile", {
                      defaultValue:
                        "Detailed competitive data is private or unavailable.",
                    })}
                  </Text>
                </View>
              ) : null}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
