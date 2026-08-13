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
  CompetitiveMMRResponse,
  getCompetitiveMMR,
  getCompetitiveUpdates,
  getContent,
  matchDetails,
} from "~/utils/valorant-api";
import { getAgent, getAssets } from "~/utils/valorant-assets";
import { formatSessionQueueLabel } from "~/utils/valorant-session";
import { lockScreenOrientation } from "~/utils/screen-orientation";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";

const TRACKER_COLORS = {
  background: "#07101D",
  panel: "#0C1828",
  panelStrong: "#101F32",
  border: "#20344A",
  borderSoft: "rgba(111, 143, 174, 0.2)",
  text: "#F2F7FC",
  muted: "#8496AA",
  faint: "#51657A",
  cyan: "#36D5ED",
  cyanSoft: "rgba(54, 213, 237, 0.12)",
  red: "#FF5E69",
  redSoft: "rgba(255, 94, 105, 0.12)",
  success: "#52D99B",
  warning: "#F5C66A",
};

const MAX_TEAM_SIZE = 5;
const RECENT_COMPETITIVE_MATCH_LIMIT = 5;
const COMPETITIVE_STATS_CACHE_TTL_MS = 5 * 60 * 1000;

type SessionPlayer = {
  subject: string;
  teamId?: string;
  agentId?: string;
  tier?: number;
  ready?: boolean;
  level?: number;
  leaderboardRank?: number;
  isCoach?: boolean;
  isCurrentUser?: boolean;
};

type PlayerIntel = {
  status: "loading" | "ready" | "private";
  currentTier: number | null;
  currentRr: number | null;
  peakTier: number | null;
  peakSeason: string | null;
};

type CompetitivePerformance = {
  status: "loading" | "ready" | "private";
  kd: number | null;
  winRate: number | null;
  acs: number | null;
  headshotPercent: number | null;
  matches: number;
  recentResults: {
    matchId: string;
    outcome: "win" | "loss" | "draw";
  }[];
  rrDelta: number | null;
};

type StatsViewMode = "competitive" | "match";

type MatchPerformance = {
  status: "loading" | "ready" | "unavailable";
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  acs: number | null;
  headshotPercent: number | null;
  rounds: number;
};

type ContentSeason = {
  ID: string;
  Name: string;
  Type: "episode" | "act";
  StartTime: string;
  EndTime: string;
  IsActive: boolean;
};

const EMPTY_INTEL: PlayerIntel = {
  status: "loading",
  currentTier: null,
  currentRr: null,
  peakTier: null,
  peakSeason: null,
};

const EMPTY_COMPETITIVE_PERFORMANCE: CompetitivePerformance = {
  status: "loading",
  kd: null,
  winRate: null,
  acs: null,
  headshotPercent: null,
  matches: 0,
  recentResults: [],
  rrDelta: null,
};

const EMPTY_MATCH_PERFORMANCE: MatchPerformance = {
  status: "unavailable",
  kills: null,
  deaths: null,
  assists: null,
  acs: null,
  headshotPercent: null,
  rounds: 0,
};

type MatchDetailsData = Awaited<ReturnType<typeof matchDetails>>;

const competitivePerformanceCache = new Map<
  string,
  { value: CompetitivePerformance; expiresAt: number }
>();
const matchDetailsCache = new Map<string, Promise<MatchDetailsData | null>>();

const toTier = (value: unknown) => {
  const tier = Number(value ?? 0);
  return Number.isFinite(tier) && tier > 0 ? tier : null;
};

const getHighestWinningTier = (winsByTier: unknown) => {
  if (!winsByTier || typeof winsByTier !== "object" || Array.isArray(winsByTier)) {
    return 0;
  }

  return Object.entries(winsByTier as Record<string, unknown>).reduce(
    (highestTier, [tierId, winCount]) => {
      const tier = toTier(tierId) || 0;
      const wins = Number(winCount);
      return Number.isFinite(wins) && wins > 0 ? Math.max(highestTier, tier) : highestTier;
    },
    0
  );
};

const toTitleCase = (value?: string | null) =>
  (value || "")
    .replace(/_/g, " ")
    .toLocaleLowerCase("en-US")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US"));

const romanToNumber = (value: string) => {
  const romanValues: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
  };
  const normalized = value.toLocaleUpperCase("en-US");
  let total = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    const current = romanValues[normalized[index]] || 0;
    const next = romanValues[normalized[index + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total > 0 ? String(total) : null;
};

const extractSeasonNumber = (value: string) => {
  const numericMatch = value.match(/\d+/);
  if (numericMatch?.[0]) return numericMatch[0];

  const romanMatch = value.match(/\b([IVXLC]+)\b/i);
  return romanMatch?.[1] ? romanToNumber(romanMatch[1]) : null;
};

const formatPeakSeason = (
  seasonId: string | null,
  seasons: ContentSeason[]
) => {
  if (!seasonId) return null;

  const act = seasons.find(
    (season) => season.ID.toLocaleLowerCase("en-US") === seasonId.toLocaleLowerCase("en-US")
  );
  if (!act) return null;

  const actStart = new Date(act.StartTime).getTime();
  const episode = seasons.find((season) => {
    if (season.Type !== "episode") return false;
    const start = new Date(season.StartTime).getTime();
    const end = new Date(season.EndTime).getTime();
    return Number.isFinite(actStart) && actStart >= start && actStart < end;
  });
  const episodeNumber = episode ? extractSeasonNumber(episode.Name) : null;
  const actNumber = extractSeasonNumber(act.Name);

  if (episodeNumber && actNumber) {
    return `Episode ${episodeNumber} – Act ${actNumber}`;
  }
  return act.Name || episode?.Name || null;
};

const buildPlayerIntel = (
  result: CompetitiveMMRResponse | Record<string, never>,
  seasons: ContentSeason[]
): PlayerIntel => {
  const mmr = result as CompetitiveMMRResponse;
  const queueSkills = mmr.QueueSkills as Record<string, any> | undefined;
  const competitive =
    queueSkills?.competitive ||
    Object.entries(queueSkills || {}).find(([queueName]) =>
      queueName.toLocaleLowerCase("en-US").includes("competitive")
    )?.[1];
  const seasonalInfo =
    competitive?.SeasonalInfoBySeasonID &&
    typeof competitive.SeasonalInfoBySeasonID === "object"
      ? competitive.SeasonalInfoBySeasonID as Record<string, any>
      : {};

  let peakTier = 0;
  let peakSeasonId: string | null = null;

  Object.entries(seasonalInfo).forEach(([seasonId, season]) => {
    const seasonTier = Math.max(
      getHighestWinningTier(season?.WinsByTier),
      toTier(season?.CompetitiveTier) || 0,
      toTier(season?.SeasonHighestCompetitiveTier) || 0
    );
    if (seasonTier > peakTier) {
      peakTier = seasonTier;
      peakSeasonId = seasonId;
    }
  });

  const currentTier =
    toTier(mmr.LatestCompetitiveUpdate?.TierAfterUpdate) ||
    toTier(competitive?.CompetitiveTier);
  const explicitPeak = toTier(competitive?.HighestCompetitiveTier) || 0;
  if (explicitPeak > peakTier) {
    peakTier = explicitPeak;
    peakSeasonId = null;
  }

  const resolvedPeakTier = peakTier > 0 ? peakTier : null;
  const hasRankData = Boolean(currentTier || resolvedPeakTier);

  return {
    status: hasRankData ? "ready" : "private",
    currentTier,
    currentRr: Number.isFinite(Number(mmr.LatestCompetitiveUpdate?.RankedRatingAfterUpdate))
      ? Number(mmr.LatestCompetitiveUpdate?.RankedRatingAfterUpdate)
      : null,
    peakTier: resolvedPeakTier,
    peakSeason: formatPeakSeason(peakSeasonId, seasons),
  };
};

const mapWithConcurrency = async <T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<R>
) => {
  const results = new Array<R>(values.length);
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index]);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), values.length) },
      runWorker
    )
  );
  return results;
};

const getCachedMatchDetails = (
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
) => {
  const cacheKey = `${region.toLocaleLowerCase("en-US")}|${matchId}`;
  const cached = matchDetailsCache.get(cacheKey);
  if (cached) return cached;

  const request = matchDetails(
    accessToken,
    entitlementsToken,
    region,
    matchId
  ).catch(() => null);
  matchDetailsCache.set(cacheKey, request);

  if (matchDetailsCache.size > 120) {
    const oldestKey = matchDetailsCache.keys().next().value;
    if (oldestKey) matchDetailsCache.delete(oldestKey);
  }
  return request;
};

const buildCompetitivePerformance = (
  subject: string,
  matchIds: string[],
  detailsById: ReadonlyMap<string, MatchDetailsData>,
  rrDelta: number | null
): CompetitivePerformance => {
  let kills = 0;
  let deaths = 0;
  let score = 0;
  let rounds = 0;
  let wins = 0;
  let matchesWithOutcome = 0;
  let validMatches = 0;
  let headshots = 0;
  let bodyshots = 0;
  let legshots = 0;
  const recentResults: CompetitivePerformance["recentResults"] = [];
  const normalizedSubject = subject.toLocaleLowerCase("en-US");

  matchIds.forEach((matchId) => {
    const details = detailsById.get(matchId);
    if (!details) return;

    const player = details.players.find(
      (entry) =>
        entry.subject.toLocaleLowerCase("en-US") === normalizedSubject
    );
    if (!player?.stats) return;

    validMatches += 1;
    kills += Number(player.stats.kills) || 0;
    deaths += Number(player.stats.deaths) || 0;
    score += Number(player.stats.score) || 0;
    rounds += Number(player.stats.roundsPlayed) || 0;

    const team = details.teams?.find(
      (entry) => entry.teamId === player.teamId
    );
    if (team) {
      matchesWithOutcome += 1;
      if (team.won) {
        wins += 1;
        recentResults.push({ matchId, outcome: "win" });
      } else if (details.teams?.some((entry) => entry.teamId !== player.teamId && entry.won)) {
        recentResults.push({ matchId, outcome: "loss" });
      } else {
        recentResults.push({ matchId, outcome: "draw" });
      }
    }

    (details.roundResults || []).forEach((round) => {
      const roundPlayer = round.playerStats.find(
        (entry) =>
          entry.subject.toLocaleLowerCase("en-US") === normalizedSubject
      );
      (roundPlayer?.damage || []).forEach((damage) => {
        headshots += Number(damage.headshots) || 0;
        bodyshots += Number(damage.bodyshots) || 0;
        legshots += Number(damage.legshots) || 0;
      });
    });
  });

  if (validMatches === 0) {
    return { ...EMPTY_COMPETITIVE_PERFORMANCE, status: "private" };
  }

  const totalHits = headshots + bodyshots + legshots;
  return {
    status: "ready",
    kd: kills / Math.max(1, deaths),
    winRate:
      matchesWithOutcome > 0 ? (wins / matchesWithOutcome) * 100 : null,
    acs: rounds > 0 ? score / rounds : null,
    headshotPercent: totalHits > 0 ? (headshots / totalHits) * 100 : null,
    matches: validMatches,
    recentResults,
    rrDelta,
  };
};

const buildMatchPerformanceBySubject = (
  details: MatchDetailsData,
  subjects: string[]
) => {
  const hitsBySubject = new Map<
    string,
    { headshots: number; bodyshots: number; legshots: number }
  >();

  (details.roundResults || []).forEach((round) => {
    round.playerStats.forEach((roundPlayer) => {
      const subject = roundPlayer.subject.toLocaleLowerCase("en-US");
      const hits = hitsBySubject.get(subject) || {
        headshots: 0,
        bodyshots: 0,
        legshots: 0,
      };
      roundPlayer.damage.forEach((damage) => {
        hits.headshots += Number(damage.headshots) || 0;
        hits.bodyshots += Number(damage.bodyshots) || 0;
        hits.legshots += Number(damage.legshots) || 0;
      });
      hitsBySubject.set(subject, hits);
    });
  });

  return subjects.reduce<Record<string, MatchPerformance>>(
    (performanceBySubject, subject) => {
      const normalizedSubject = subject.toLocaleLowerCase("en-US");
      const player = details.players.find(
        (entry) =>
          entry.subject.toLocaleLowerCase("en-US") === normalizedSubject
      );
      const stats = player?.stats;
      if (!stats) {
        performanceBySubject[normalizedSubject] = EMPTY_MATCH_PERFORMANCE;
        return performanceBySubject;
      }

      const hits = hitsBySubject.get(normalizedSubject);
      const totalHits = hits
        ? hits.headshots + hits.bodyshots + hits.legshots
        : 0;
      const rounds = Number(stats.roundsPlayed) || 0;
      performanceBySubject[normalizedSubject] = {
        status: "ready",
        kills: Number(stats.kills) || 0,
        deaths: Number(stats.deaths) || 0,
        assists: Number(stats.assists) || 0,
        acs: rounds > 0 ? (Number(stats.score) || 0) / rounds : null,
        headshotPercent:
          hits && totalHits > 0 ? (hits.headshots / totalHits) * 100 : null,
        rounds,
      };
      return performanceBySubject;
    },
    {}
  );
};

const fetchCompetitivePerformanceBatch = async (
  credentials: {
    accessToken: string;
    entitlementsToken: string;
    region: string;
  },
  subjects: string[]
) => {
  const now = Date.now();
  const resolved: Record<string, CompetitivePerformance> = {};
  const missingSubjects: string[] = [];

  subjects.forEach((subject) => {
    const cacheKey = `${credentials.region.toLocaleLowerCase("en-US")}|${subject}`;
    const cached = competitivePerformanceCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      resolved[subject] = cached.value;
    } else {
      missingSubjects.push(subject);
    }
  });

  const histories = await mapWithConcurrency(
    missingSubjects,
    3,
    async (subject) => {
      const updates = await getCompetitiveUpdates(
        credentials.accessToken,
        credentials.entitlementsToken,
        credentials.region,
        subject,
        {
          startIndex: 0,
          endIndex: RECENT_COMPETITIVE_MATCH_LIMIT,
          queue: "competitive",
        }
      ).catch(() => null);

      const recentUpdates = (updates?.Matches || []).slice(
        0,
        RECENT_COMPETITIVE_MATCH_LIMIT
      );
      const matchIds: string[] = [];
      const rrChanges: number[] = [];
      recentUpdates.forEach((match) => {
        if (match.MatchID) matchIds.push(match.MatchID);
        const rrChange = Number(match.RankedRatingEarned);
        if (Number.isFinite(rrChange)) rrChanges.push(rrChange);
      });

      return {
        subject,
        matchIds,
        rrDelta:
          rrChanges.length > 0
            ? rrChanges.reduce((total, change) => total + change, 0)
            : null,
      };
    }
  );

  const uniqueMatchIds = Array.from(
    new Set(histories.flatMap((history) => history.matchIds))
  );
  const detailEntries = await mapWithConcurrency(
    uniqueMatchIds,
    4,
    async (matchId) =>
      [
        matchId,
        await getCachedMatchDetails(
          credentials.accessToken,
          credentials.entitlementsToken,
          credentials.region,
          matchId
        ),
      ] as const
  );
  const detailsById = new Map(
    detailEntries.filter(
      (entry): entry is readonly [string, MatchDetailsData] =>
        Boolean(entry[1])
    )
  );

  histories.forEach(({ subject, matchIds, rrDelta }) => {
    const performance = buildCompetitivePerformance(
      subject,
      matchIds,
      detailsById,
      rrDelta
    );
    resolved[subject] = performance;
    competitivePerformanceCache.set(
      `${credentials.region.toLocaleLowerCase("en-US")}|${subject}`,
      {
        value: performance,
        expiresAt: Date.now() + COMPETITIVE_STATS_CACHE_TTL_MS,
      }
    );
  });

  return resolved;
};

const formatCompetitiveMetric = (
  value: number | null,
  digits: number,
  suffix = ""
) => (value === null ? "—" : `${value.toFixed(digits)}${suffix}`);

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
    const getMaxTier = (tierSet: any) =>
      (Array.isArray(tierSet?.tiers) ? tierSet.tiers : []).reduce(
        (highest: number, tier: any) => {
          const tierNumber = Number(tier?.tier);
          return Number.isFinite(tierNumber) ? Math.max(highest, tierNumber) : highest;
        },
        0
      );
    const currentTierSet = tierSets.reduce(
      (best: any, candidate: any) =>
        !best || getMaxTier(candidate) >= getMaxTier(best) ? candidate : best,
      null
    );
    const map = new Map<number, any>();
    (currentTierSet?.tiers || []).forEach((tier: any) => {
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
      void lockScreenOrientation("landscape")
        .finally(() => {
          if (active) setOrientationReady(true);
        });
      void loadSnapshot();

      return () => {
        active = false;
        setOrientationReady(false);
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
  const mapInfo = assets.maps?.find((map: any) => map.mapUrl === activeMapId);
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
      const toPregamePlayer = (player: any): SessionPlayer => ({
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

  if (!orientationReady) {
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TRACKER_COLORS.background,
  },
  sessionScroll: {
    flex: 1,
  },
  sessionScrollContent: {
    flexGrow: 1,
  },
  landscapeContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 7,
  },
  landscapeContentTight: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 5,
  },
  trackerHeader: {
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.border,
    backgroundColor: TRACKER_COLORS.panelStrong,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
  },
  trackerHeaderTight: {
    height: 46,
  },
  headerMapImage: {
    ...StyleSheet.absoluteFill,
    opacity: 0.28,
  },
  headerScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(7, 16, 29, 0.72)",
  },
  headerPlayer: {
    zIndex: 1,
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  headerAction: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(9, 20, 34, 0.82)",
    borderWidth: 1,
    borderColor: TRACKER_COLORS.border,
  },
  headerActionPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TRACKER_COLORS.panel,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.cyan,
  },
  headerAvatarImage: {
    width: 31,
    height: 31,
  },
  headerPlayerText: {
    flex: 1,
    minWidth: 0,
  },
  headerPlayerName: {
    color: TRACKER_COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },
  headerPlayerMeta: {
    marginTop: 2,
    color: TRACKER_COLORS.muted,
    fontSize: 9,
    fontWeight: "600",
  },
  headerMatch: {
    zIndex: 1,
    flex: 0.9,
    minWidth: 0,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerMapName: {
    color: TRACKER_COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  headerQueue: {
    marginTop: 1,
    color: TRACKER_COLORS.muted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  headerActions: {
    zIndex: 1,
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 7,
  },
  statsModeToggle: {
    minWidth: 58,
    minHeight: 28,
    paddingHorizontal: 8,
    borderRadius: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: TRACKER_COLORS.cyanSoft,
    borderWidth: 1,
    borderColor: "rgba(54, 213, 237, 0.42)",
  },
  statsModeToggleMatch: {
    backgroundColor: TRACKER_COLORS.redSoft,
    borderColor: "rgba(255, 94, 105, 0.46)",
  },
  statsModeToggleText: {
    color: TRACKER_COLORS.cyan,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.35,
  },
  statsModeToggleTextMatch: {
    color: TRACKER_COLORS.red,
  },
  liveState: {
    maxWidth: 135,
    minHeight: 28,
    paddingHorizontal: 9,
    borderRadius: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(9, 20, 34, 0.82)",
    borderWidth: 1,
    borderColor: TRACKER_COLORS.borderSoft,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  liveStateText: {
    flexShrink: 1,
    color: TRACKER_COLORS.text,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryBar: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.borderSoft,
    backgroundColor: TRACKER_COLORS.panel,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  summaryBarTight: {
    height: 30,
  },
  summaryItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  summaryDivider: {
    width: 1,
    height: 15,
    backgroundColor: TRACKER_COLORS.borderSoft,
  },
  summaryValue: {
    maxWidth: "68%",
    color: TRACKER_COLORS.text,
    fontSize: 10,
    fontWeight: "800",
  },
  summaryLabel: {
    color: TRACKER_COLORS.muted,
    fontSize: 7,
    fontWeight: "800",
  },
  matchBoard: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    gap: 8,
  },
  teamPanel: {
    flex: 1,
    minWidth: 0,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.border,
    borderTopWidth: 2,
    overflow: "hidden",
    backgroundColor: TRACKER_COLORS.panel,
  },
  teamHeader: {
    height: 29,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 9,
    borderBottomWidth: 1,
    borderBottomColor: TRACKER_COLORS.borderSoft,
  },
  teamTitleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  teamDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  teamTitle: {
    maxWidth: "60%",
    color: TRACKER_COLORS.text,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  sideLabel: {
    fontSize: 8,
    fontWeight: "900",
  },
  teamCount: {
    color: TRACKER_COLORS.muted,
    fontSize: 9,
    fontWeight: "800",
  },
  teamList: {
    flex: 1,
    minHeight: 0,
    padding: 3,
  },
  playerRow: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderLeftWidth: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TRACKER_COLORS.borderSoft,
    backgroundColor: "rgba(255, 255, 255, 0.012)",
  },
  playerRowPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  emptyPlayerSlot: {
    flex: 1,
    minHeight: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TRACKER_COLORS.borderSoft,
  },
  agentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    flexShrink: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TRACKER_COLORS.panelStrong,
    borderWidth: 1,
  },
  agentImage: {
    width: 33,
    height: 33,
  },
  playerIdentity: {
    flex: 1,
    minWidth: 58,
  },
  playerNameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  playerName: {
    flexShrink: 1,
    color: TRACKER_COLORS.text,
    fontSize: 10,
    fontWeight: "800",
  },
  youBadge: {
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  youBadgeText: {
    color: TRACKER_COLORS.background,
    fontSize: 6,
    fontWeight: "900",
  },
  agentName: {
    maxWidth: 50,
    flexShrink: 1,
    color: TRACKER_COLORS.muted,
    fontSize: 7,
    fontWeight: "600",
  },
  playerMetaLine: {
    marginTop: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  currentRankInline: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: 3,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: TRACKER_COLORS.border,
  },
  currentRankIcon: {
    width: 12,
    height: 12,
    flexShrink: 0,
  },
  currentRankIconPlaceholder: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  currentRankText: {
    flex: 1,
    color: TRACKER_COLORS.text,
    fontSize: 7,
    fontWeight: "700",
  },
  competitiveMetrics: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  competitiveMetric: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  competitiveMetricLabel: {
    color: TRACKER_COLORS.muted,
    fontSize: 7,
    fontWeight: "800",
  },
  competitiveMetricValue: {
    color: TRACKER_COLORS.text,
    fontSize: 9,
    fontWeight: "900",
  },
  matchMetricValue: {
    color: TRACKER_COLORS.red,
  },
  peakRankEnd: {
    width: 80,
    minWidth: 0,
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingLeft: 5,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: TRACKER_COLORS.borderSoft,
  },
  peakRankLabel: {
    color: TRACKER_COLORS.muted,
    fontSize: 6,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  peakRankLine: {
    maxWidth: "100%",
    marginTop: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  peakRankIcon: {
    width: 17,
    height: 17,
    flexShrink: 0,
  },
  peakRankName: {
    flexShrink: 1,
    color: TRACKER_COLORS.text,
    fontSize: 7,
    fontWeight: "800",
  },
  peakRankSeason: {
    maxWidth: "100%",
    color: TRACKER_COLORS.muted,
    fontSize: 6,
    fontWeight: "600",
  },
  emptyRoster: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  emptyRosterText: {
    maxWidth: 180,
    textAlign: "center",
    color: TRACKER_COLORS.muted,
    fontSize: 10,
  },
  emptyState: {
    flex: 1,
    minHeight: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.border,
    backgroundColor: TRACKER_COLORS.panel,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 14,
  },
  emptyStateText: {
    maxWidth: 430,
  },
  emptyStateTitle: {
    color: TRACKER_COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
  emptyStateSubtitle: {
    marginTop: 4,
    color: TRACKER_COLORS.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  orientationLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TRACKER_COLORS.background,
  },
  modalRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "rgba(2, 7, 13, 0.78)",
  },
  playerModal: {
    width: "100%",
    maxWidth: 590,
    maxHeight: "92%",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.border,
    backgroundColor: TRACKER_COLORS.panelStrong,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  modalHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalModeSwitch: {
    padding: 2,
    borderRadius: 8,
    flexDirection: "row",
    backgroundColor: TRACKER_COLORS.panel,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.border,
  },
  modalModeButton: {
    minWidth: 47,
    minHeight: 28,
    paddingHorizontal: 7,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  modalModeButtonCompetitive: {
    backgroundColor: TRACKER_COLORS.cyanSoft,
    borderWidth: 1,
    borderColor: "rgba(54, 213, 237, 0.42)",
  },
  modalModeButtonMatch: {
    backgroundColor: TRACKER_COLORS.redSoft,
    borderWidth: 1,
    borderColor: "rgba(255, 94, 105, 0.46)",
  },
  modalModeText: {
    color: TRACKER_COLORS.muted,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  modalModeTextCompetitive: {
    color: TRACKER_COLORS.cyan,
  },
  modalModeTextMatch: {
    color: TRACKER_COLORS.red,
  },
  modalIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalAvatar: {
    width: 50,
    height: 50,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TRACKER_COLORS.panel,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.cyan,
  },
  modalAvatarImage: {
    width: 46,
    height: 46,
  },
  modalTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    color: TRACKER_COLORS.text,
    fontSize: 17,
    fontWeight: "900",
  },
  modalSubtitle: {
    marginTop: 3,
    color: TRACKER_COLORS.muted,
    fontSize: 10,
    fontWeight: "600",
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TRACKER_COLORS.panel,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.border,
  },
  modalRankGrid: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  modalRankCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 74,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: TRACKER_COLORS.panel,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.borderSoft,
  },
  modalRankIcon: {
    width: 38,
    height: 38,
  },
  modalCardLabel: {
    color: TRACKER_COLORS.muted,
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  modalCardValue: {
    marginTop: 2,
    color: TRACKER_COLORS.text,
    fontSize: 13,
    fontWeight: "900",
  },
  modalCardMeta: {
    marginTop: 2,
    color: TRACKER_COLORS.cyan,
    fontSize: 9,
    fontWeight: "700",
  },
  modalStats: {
    marginTop: 8,
    borderRadius: 10,
    flexDirection: "row",
    backgroundColor: TRACKER_COLORS.panel,
    borderWidth: 1,
    borderColor: TRACKER_COLORS.borderSoft,
  },
  modalStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: TRACKER_COLORS.border,
  },
  modalStatValue: {
    color: TRACKER_COLORS.text,
    fontSize: 13,
    fontWeight: "900",
  },
  modalStatLabel: {
    marginTop: 2,
    color: TRACKER_COLORS.muted,
    fontSize: 7,
    fontWeight: "800",
  },
  modalRecentForm: {
    marginTop: 8,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: "rgba(9, 20, 34, 0.72)",
    borderWidth: 1,
    borderColor: TRACKER_COLORS.borderSoft,
  },
  modalRecentInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  modalRecentLabel: {
    color: TRACKER_COLORS.muted,
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  modalResults: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  modalResultBadge: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalResultWin: {
    backgroundColor: "rgba(82, 217, 155, 0.16)",
    borderColor: "rgba(82, 217, 155, 0.42)",
  },
  modalResultLoss: {
    backgroundColor: TRACKER_COLORS.redSoft,
    borderColor: "rgba(255, 94, 105, 0.42)",
  },
  modalResultDraw: {
    backgroundColor: "rgba(132, 150, 170, 0.12)",
    borderColor: "rgba(132, 150, 170, 0.3)",
  },
  modalResultText: {
    color: TRACKER_COLORS.text,
    fontSize: 8,
    fontWeight: "900",
  },
  modalRrDelta: {
    fontSize: 11,
    fontWeight: "900",
  },
  modalRrPositive: {
    color: TRACKER_COLORS.success,
  },
  modalRrNegative: {
    color: TRACKER_COLORS.red,
  },
  modalRrNeutral: {
    color: TRACKER_COLORS.muted,
  },
  privateNotice: {
    marginTop: 8,
    minHeight: 30,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(245, 198, 106, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(245, 198, 106, 0.2)",
  },
  privateNoticeText: {
    flex: 1,
    color: TRACKER_COLORS.muted,
    fontSize: 9,
    fontWeight: "600",
  },
});
