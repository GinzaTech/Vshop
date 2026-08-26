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
  getCompetitiveMMR,
  getContent,
  matchDetails,
} from "~/utils/valorant-api";
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
import { styles, TRACKER_COLORS } from "~/features/combat/combat-session.styles";
import {
  buildMatchPerformanceBySubject,
  buildPlayerIntel,
  EMPTY_COMPETITIVE_PERFORMANCE,
  EMPTY_INTEL,
  EMPTY_MATCH_PERFORMANCE,
  fetchCompetitivePerformanceBatch,
  formatCompetitiveMetric,
  MAX_TEAM_SIZE,
  toTitleCase,
  type CompetitivePerformance,
  type ContentSeason,
  type MatchPerformance,
  type PlayerIntel,
  type SessionPlayer,
  type StatsViewMode,
} from "~/features/combat/session-insights";

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
  const isTight = width < 800 || height < 380;
  const user = useUserStore((state) => state.user);
  const assets = getAssets();
  const agents = getAgent().agents;
  const snapshot = useCombatStore((state) => state.snapshot);
  const loading = useCombatStore((state) => state.loading);
  const fetchSession = useCombatStore((state) => state.fetchSession);
  const [orientationReady, setOrientationReady] = React.useState(false);
  const [orientationLocked, setOrientationLocked] = React.useState(false);
  const [selectedSubject, setSelectedSubject] = React.useState<string | null>(null);
  const [statsViewMode, setStatsViewMode] =
    React.useState<StatsViewMode>("competitive");
  const [playerIntel, setPlayerIntel] = React.useState<Record<string, PlayerIntel>>({});
  const [competitivePerformance, setCompetitivePerformance] = React.useState<
    Record<string, CompetitivePerformance>
  >({});
  const [matchPerformance, setMatchPerformance] = React.useState<
    Record<string, MatchPerformance>
  >({});

  React.useEffect(() => {
    if (!selectedSubject) return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setSelectedSubject(null);
      return true;
    });
    return () => subscription.remove();
  }, [selectedSubject]);

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

  const loadSnapshot = React.useCallback(async () => {
    await fetchSession(user);
  }, [fetchSession, user]);
  const { refreshing, onRefresh } = useAsyncRefresh(loadSnapshot);

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
      void loadSnapshot();

      return () => {
        active = false;
        setOrientationReady(false);
        setOrientationLocked(false);
        void lockScreenOrientation("portrait");
      };
    }, [loadSnapshot])
  );

  React.useEffect(() => {
    if (snapshot.state !== "live") return;
    const interval = setInterval(() => {
      void loadSnapshot();
    }, 10_000);
    return () => clearInterval(interval);
  }, [loadSnapshot, snapshot.state]);

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

  React.useEffect(() => {
    const subjects = playerSubjectKey ? playerSubjectKey.split("|") : [];
    if (
      subjects.length === 0 ||
      !user.accessToken ||
      !user.entitlementsToken ||
      !user.region
    ) {
      return;
    }

    let cancelled = false;
    setPlayerIntel((current) => {
      const next = { ...current };
      subjects.forEach((subject) => {
        next[subject] = current[subject] || EMPTY_INTEL;
      });
      return next;
    });

    const fetchRanks = async () => {
      const content = await getContent(
        user.accessToken,
        user.entitlementsToken,
        user.region
      ).catch(() => null);
      const seasons = (content?.Seasons || []) as ContentSeason[];
      const results = await Promise.allSettled(
        subjects.map(async (subject) => {
          const mmr = await getCompetitiveMMR(
            user.accessToken,
            user.entitlementsToken,
            user.region,
            subject
          );
          return [subject, buildPlayerIntel(mmr, seasons)] as const;
        })
      );
      if (cancelled) return;

      setPlayerIntel((current) => {
        const next = { ...current };
        results.forEach((result, index) => {
          const subject = subjects[index];
          next[subject] =
            result.status === "fulfilled"
              ? result.value[1]
              : { ...EMPTY_INTEL, status: "private" };
        });
        return next;
      });
    };

    void fetchRanks();
    return () => {
      cancelled = true;
    };
  }, [
    playerSubjectKey,
    user.accessToken,
    user.entitlementsToken,
    user.region,
  ]);

  React.useEffect(() => {
    const subjects = playerSubjectKey ? playerSubjectKey.split("|") : [];
    if (
      subjects.length === 0 ||
      !user.accessToken ||
      !user.entitlementsToken ||
      !user.region
    ) {
      return;
    }

    let cancelled = false;
    setCompetitivePerformance((current) => {
      const next = { ...current };
      subjects.forEach((subject) => {
        next[subject] =
          current[subject] || EMPTY_COMPETITIVE_PERFORMANCE;
      });
      return next;
    });

    void fetchCompetitivePerformanceBatch(
      {
        accessToken: user.accessToken,
        entitlementsToken: user.entitlementsToken,
        region: user.region,
      },
      subjects
    )
      .then((performanceBySubject) => {
        if (!cancelled) {
          setCompetitivePerformance((current) => ({
            ...current,
            ...performanceBySubject,
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompetitivePerformance((current) => {
            const next = { ...current };
            subjects.forEach((subject) => {
              next[subject] = {
                ...EMPTY_COMPETITIVE_PERFORMANCE,
                status: "private",
              };
            });
            return next;
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    playerSubjectKey,
    user.accessToken,
    user.entitlementsToken,
    user.region,
  ]);

  React.useEffect(() => {
    if (statsViewMode !== "match") return;

    const subjects = playerSubjectKey ? playerSubjectKey.split("|") : [];
    const matchId = matchData?.MatchID;
    if (
      snapshot.state !== "live" ||
      subjects.length === 0 ||
      !matchId ||
      !user.accessToken ||
      !user.entitlementsToken ||
      !user.region
    ) {
      setMatchPerformance(
        subjects.reduce<Record<string, MatchPerformance>>((next, subject) => {
          next[subject] = EMPTY_MATCH_PERFORMANCE;
          return next;
        }, {})
      );
      return;
    }

    let cancelled = false;
    setMatchPerformance((current) =>
      subjects.reduce<Record<string, MatchPerformance>>((next, subject) => {
        next[subject] =
          current[subject]?.status === "ready"
            ? current[subject]
            : { ...EMPTY_MATCH_PERFORMANCE, status: "loading" };
        return next;
      }, {})
    );

    const fetchMatchPerformance = async () => {
      const details = await matchDetails(
        user.accessToken,
        user.entitlementsToken,
        user.region,
        matchId
      ).catch(() => null);
      if (cancelled) return;

      setMatchPerformance(
        details
          ? buildMatchPerformanceBySubject(details, subjects)
          : subjects.reduce<Record<string, MatchPerformance>>(
              (next, subject) => {
                next[subject] = EMPTY_MATCH_PERFORMANCE;
                return next;
              },
              {}
            )
      );
    };

    void fetchMatchPerformance();
    const interval = setInterval(() => {
      void fetchMatchPerformance();
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    matchData?.MatchID,
    playerSubjectKey,
    snapshot.state,
    statsViewMode,
    user.accessToken,
    user.entitlementsToken,
    user.region,
  ]);

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
  const selectedCompetitiveValue = (
    value: number | null,
    digits: number,
    suffix = ""
  ) =>
    selectedPerformance.status === "loading"
      ? "…"
      : formatCompetitiveMetric(value, digits, suffix);
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

  // Keep the session shell mounted until the native landscape lock has
  // actually produced landscape dimensions. Rendering the dense desktop-like
  // layout during that one-frame rotation was the source of the white band.
  const landscapeViewportReady = !orientationLocked || width >= height;

  if (!orientationReady || !landscapeViewportReady) {
    return (
      <SafeAreaView style={styles.orientationLoading}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color={TRACKER_COLORS.cyan} />
      </SafeAreaView>
    );
  }

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

          <View style={styles.headerMatch}>
            <Text style={styles.headerMapName} numberOfLines={1}>
              {mapInfo?.displayName || t("combat_session_page.no_map")}
            </Text>
            <Text style={styles.headerQueue} numberOfLines={1}>
              {queueLabel}
            </Text>
          </View>

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

              <View style={styles.modalStats}>
                {selectedModalStats.map(([label, value]) => (
                  <View key={label} style={styles.modalStat}>
                    <Text style={styles.modalStatValue}>{value}</Text>
                    <Text style={styles.modalStatLabel}>{label}</Text>
                  </View>
                ))}
              </View>

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
