import { getAssets, getAgent } from "~/utils/valorant-assets";
import type {
  DailyMatchSummary,
  EconomyPoint,
  MatchAgentAsset,
  MatchAssetCatalog,
  MatchDetailViewModel,
  MatchDetailsData,
  MatchHistoryGroup,
  MatchHistoryItem,
  MatchHistoryRecord,
  MatchHistoryStats,
  MatchMapAsset,
  MatchPlayerIdentity,
  MatchPlayerRef,
  MatchSide,
  MatchTeam,
  MatchTierAsset,
  MatchTierSetAsset,
  OpponentBreakdown,
  PlayerMatchPerformance,
  PlayerPerformanceSummary,
  PlayerSideStats,
  RankUpdate,
  RoundDetail,
  RoundEvent,
  RoundOutcome,
  ScoreboardPlayer,
  SidePerformance,
  ValorantWeaponAsset,
  WeaponPerformance,
} from "~/types/match-ui";

type RawPlayer = MatchDetailsResponse["players"][number];
type RawRound = NonNullable<MatchDetailsResponse["roundResults"]>[number];

type MutableSideStats = {
  kills: number;
  deaths: number;
  assists: number;
};

type MutableWeaponStats = {
  kills: number;
  damage: number;
};

type PlayerAggregate = {
  damageDealt: number;
  damageTaken: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  firstKills: number;
  firstDeaths: number;
  multiKills: number;
  kastRounds: number;
  spent: number;
  side: Record<MatchSide, MutableSideStats>;
  opponentDamageDealt: Map<string, number>;
  opponentDamageTaken: Map<string, number>;
  killsAgainst: Map<string, number>;
  deathsAgainst: Map<string, number>;
  weapons: Map<string, MutableWeaponStats>;
};

const EMPTY_SIDE_STATS = (): MutableSideStats => ({
  kills: 0,
  deaths: 0,
  assists: 0,
});

const createAggregate = (): PlayerAggregate => ({
  damageDealt: 0,
  damageTaken: 0,
  headshots: 0,
  bodyshots: 0,
  legshots: 0,
  firstKills: 0,
  firstDeaths: 0,
  multiKills: 0,
  kastRounds: 0,
  spent: 0,
  side: {
    attack: EMPTY_SIDE_STATS(),
    defense: EMPTY_SIDE_STATS(),
  },
  opponentDamageDealt: new Map(),
  opponentDamageTaken: new Map(),
  killsAgainst: new Map(),
  deathsAgainst: new Map(),
  weapons: new Map(),
});

const numberOrZero = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const optionalNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const addToMap = (map: Map<string, number>, key: string, value: number) => {
  if (!key || value === 0) return;
  map.set(key, (map.get(key) ?? 0) + value);
};

const toSeconds = (value: unknown): number => {
  const parsed = numberOrZero(value);
  return parsed > 300 ? Math.round(parsed / 1000) : Math.round(parsed);
};

const toTeam = (teamId: string | undefined): MatchTeam =>
  String(teamId).toLowerCase() === "red" ? "B" : "A";

const oppositeSide = (side: MatchSide): MatchSide =>
  side === "attack" ? "defense" : "attack";

const teamASideForRound = (roundIndex: number): MatchSide => {
  if (roundIndex < 12) return "defense";
  if (roundIndex < 24) return "attack";
  return (roundIndex - 24) % 2 === 0 ? "defense" : "attack";
};

const sideForPlayer = (team: MatchTeam, roundIndex: number): MatchSide => {
  const teamASide = teamASideForRound(roundIndex);
  return team === "A" ? teamASide : oppositeSide(teamASide);
};

const normalizeRoundOutcome = (
  roundResult: string | undefined,
  roundResultCode: string | undefined
): RoundOutcome => {
  const value = `${roundResult ?? ""} ${roundResultCode ?? ""}`.toLowerCase();
  if (value.includes("defus")) return "spike_defused";
  if (value.includes("deton") || value.includes("bomb")) {
    return "spike_detonated";
  }
  if (value.includes("elimin")) return "elimination";
  if (value.includes("time") || value.includes("expire")) {
    return "time_expired";
  }
  if (value.includes("surrender") || value.includes("forfeit")) {
    return "surrender";
  }
  return "unknown";
};

const resolveIdentity = (
  player: RawPlayer,
  identities: readonly MatchPlayerIdentity[],
  index: number
) => {
  const identity = identities.find((entry) => {
    const subject = entry.subject ?? entry.Subject ?? "";
    return subject.toLowerCase() === player.subject.toLowerCase();
  });
  const gameName =
    identity?.gameName ??
    identity?.GameName ??
    player.gameName ??
    `Player ${index + 1}`;
  const tagLine =
    identity?.tagLine ?? identity?.TagLine ?? player.tagLine ?? "";

  return tagLine ? `${gameName}#${tagLine}` : gameName;
};

const safeRatio = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : numerator;

const toSidePerformance = (value: MutableSideStats): SidePerformance => ({
  ...value,
  kd: safeRatio(value.kills, value.deaths),
});

export function createMatchAssetCatalog(): MatchAssetCatalog {
  const assets = getAssets();
  const agentAssets = getAgent().agents as unknown as MatchAgentAsset[];
  const mapAssets = assets.maps as unknown as MatchMapAsset[];
  const tierSets = assets.competitiveTiers as unknown as MatchTierSetAsset[];
  const weaponAssets = (assets.weapons ?? []) as ValorantWeaponAsset[];
  const tiersByNumber = new Map<number, MatchTierAsset>();

  tierSets.forEach((set) => {
    set.tiers?.forEach((tier) => {
      const tierNumber = optionalNumber(tier.tier);
      if (tierNumber && tierNumber > 0 && !tiersByNumber.has(tierNumber)) {
        tiersByNumber.set(tierNumber, tier);
      }
    });
  });

  return {
    agentsById: new Map(agentAssets.map((agent) => [agent.uuid, agent])),
    mapsByUrl: new Map(
      mapAssets
        .filter((map): map is MatchMapAsset & { mapUrl: string } =>
          Boolean(map.mapUrl)
        )
        .map((map) => [map.mapUrl, map])
    ),
    tiersByNumber,
    weaponsById: new Map(weaponAssets.map((weapon) => [weapon.uuid, weapon])),
  };
}

export function compactRankUpdate(value: unknown): RankUpdate | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;

  return {
    TierAfterUpdate: optionalNumber(entry.TierAfterUpdate),
    RankedRatingEarned: optionalNumber(entry.RankedRatingEarned),
    RankedRatingAfterUpdate: optionalNumber(entry.RankedRatingAfterUpdate),
    RankedRatingBeforeUpdate: optionalNumber(entry.RankedRatingBeforeUpdate),
    RankedRatingPerformanceBonus: optionalNumber(
      entry.RankedRatingPerformanceBonus
    ),
    AFKPenalty: optionalNumber(entry.AFKPenalty),
    CompetitiveMovement:
      typeof entry.CompetitiveMovement === "string"
        ? entry.CompetitiveMovement
        : undefined,
  };
}

function getRoundKills(round: RawRound) {
  return round.playerStats
    .flatMap((playerStats) => playerStats.kills)
    .sort((left, right) => left.roundTime - right.roundTime);
}

function buildAggregates(
  players: readonly RawPlayer[],
  rounds: readonly RawRound[]
): Map<string, PlayerAggregate> {
  const aggregates = new Map(
    players.map((player) => [player.subject, createAggregate()])
  );
  const teamByPlayer = new Map(
    players.map((player) => [player.subject, toTeam(player.teamId)])
  );

  rounds.forEach((round, roundIndex) => {
    const kills = getRoundKills(round);
    const killsByPlayer = new Map<string, number>();
    const assistsByPlayer = new Map<string, number>();
    const deaths = new Set<string>();

    kills.forEach((kill, killIndex) => {
      addToMap(killsByPlayer, kill.killer, 1);
      kill.assistants.forEach((assistant) =>
        addToMap(assistsByPlayer, assistant, 1)
      );
      deaths.add(kill.victim);

      const killerAggregate = aggregates.get(kill.killer);
      const victimAggregate = aggregates.get(kill.victim);
      if (killerAggregate) {
        addToMap(killerAggregate.killsAgainst, kill.victim, 1);
        if (killIndex === 0) killerAggregate.firstKills += 1;
        const weaponId = kill.finishingDamage.damageItem;
        if (weaponId) {
          const weapon = killerAggregate.weapons.get(weaponId) ?? {
            kills: 0,
            damage: 0,
          };
          weapon.kills += 1;
          killerAggregate.weapons.set(weaponId, weapon);
        }
      }
      if (victimAggregate) {
        addToMap(victimAggregate.deathsAgainst, kill.killer, 1);
        if (killIndex === 0) victimAggregate.firstDeaths += 1;
      }
    });

    round.playerStats.forEach((playerStats) => {
      const aggregate = aggregates.get(playerStats.subject);
      if (!aggregate) return;
      const team = teamByPlayer.get(playerStats.subject) ?? "A";
      const side = sideForPlayer(team, roundIndex);
      const roundKills = killsByPlayer.get(playerStats.subject) ?? 0;
      const roundAssists = assistsByPlayer.get(playerStats.subject) ?? 0;
      const died = deaths.has(playerStats.subject);

      aggregate.side[side].kills += roundKills;
      aggregate.side[side].assists += roundAssists;
      aggregate.side[side].deaths += died ? 1 : 0;
      aggregate.multiKills += roundKills >= 2 ? roundKills : 0;
      aggregate.kastRounds += roundKills > 0 || roundAssists > 0 || !died ? 1 : 0;
      aggregate.spent += numberOrZero(playerStats.economy?.spent);

      const roundDamage = playerStats.damage.reduce((total, damage) => {
        const amount = numberOrZero(damage.damage);
        aggregate.damageDealt += amount;
        aggregate.headshots += numberOrZero(damage.headshots);
        aggregate.bodyshots += numberOrZero(damage.bodyshots);
        aggregate.legshots += numberOrZero(damage.legshots);
        addToMap(aggregate.opponentDamageDealt, damage.receiver, amount);

        const receiverAggregate = aggregates.get(damage.receiver);
        if (receiverAggregate) {
          receiverAggregate.damageTaken += amount;
          addToMap(
            receiverAggregate.opponentDamageTaken,
            playerStats.subject,
            amount
          );
        }
        return total + amount;
      }, 0);

      const economyWeaponId = playerStats.economy?.weapon ?? "";
      if (economyWeaponId && roundDamage > 0) {
        const weapon = aggregate.weapons.get(economyWeaponId) ?? {
          kills: 0,
          damage: 0,
        };
        weapon.damage += roundDamage;
        aggregate.weapons.set(economyWeaponId, weapon);
      }
    });
  });

  return aggregates;
}

function buildRoundEvents(round: RawRound): RoundEvent[] {
  const events: RoundEvent[] = getRoundKills(round).map((kill, index) => ({
    id: `round-${round.roundNum + 1}-kill-${index}`,
    timestampSeconds: toSeconds(kill.roundTime),
    type: "kill",
    actorPlayerId: kill.killer,
    targetPlayerId: kill.victim,
    assistantPlayerIds: kill.assistants,
    weaponId: kill.finishingDamage.damageItem || undefined,
  }));

  if (round.bombPlanter) {
    events.push({
      id: `round-${round.roundNum + 1}-plant`,
      timestampSeconds: toSeconds(round.plantRoundTime),
      type: "plant",
      actorPlayerId: round.bombPlanter,
    });
  }
  if (round.bombDefuser) {
    events.push({
      id: `round-${round.roundNum + 1}-defuse`,
      timestampSeconds: toSeconds(round.defuseRoundTime),
      type: "defuse",
      actorPlayerId: round.bombDefuser,
    });
  }

  const durationSeconds = Math.max(
    1,
    ...events.map((event) => event.timestampSeconds),
    100
  );
  events.push({
    id: `round-${round.roundNum + 1}-end`,
    timestampSeconds: durationSeconds,
    type: "round_end",
  });

  return events.sort(
    (left, right) => left.timestampSeconds - right.timestampSeconds
  );
}

function buildRounds(
  rounds: readonly RawRound[],
  economy: readonly EconomyPoint[]
): RoundDetail[] {
  return rounds.map((round, index) => {
    const events = buildRoundEvents(round);
    const economyPoint = economy[index];

    return {
      roundNumber: round.roundNum + 1,
      winningTeam: toTeam(round.winningTeam),
      sideForTeamA: teamASideForRound(index),
      outcome: normalizeRoundOutcome(round.roundResult, round.roundResultCode),
      durationSeconds: Math.max(
        1,
        ...events.map((event) => event.timestampSeconds)
      ),
      teamAEconomy: economyPoint?.teamAEconomy ?? 0,
      teamBEconomy: economyPoint?.teamBEconomy ?? 0,
      events,
    };
  });
}

function buildEconomy(
  rounds: readonly RawRound[],
  teamByPlayer: ReadonlyMap<string, MatchTeam>
): EconomyPoint[] {
  return rounds.map((round) => {
    let teamAEconomy = 0;
    let teamBEconomy = 0;
    let teamASpent = 0;
    let teamBSpent = 0;

    round.playerStats.forEach((playerStats) => {
      const team = teamByPlayer.get(playerStats.subject) ?? "A";
      const loadoutValue = numberOrZero(playerStats.economy?.loadoutValue);
      const spent = numberOrZero(playerStats.economy?.spent);
      if (team === "A") {
        teamAEconomy += loadoutValue;
        teamASpent += spent;
      } else {
        teamBEconomy += loadoutValue;
        teamBSpent += spent;
      }
    });

    return {
      roundNumber: round.roundNum + 1,
      teamAEconomy,
      teamBEconomy,
      teamASpent,
      teamBSpent,
      difference: teamAEconomy - teamBEconomy,
      winningTeam: toTeam(round.winningTeam),
      outcome: normalizeRoundOutcome(round.roundResult, round.roundResultCode),
    };
  });
}

function rankFromTier(
  tierNumber: number,
  catalog: MatchAssetCatalog
): ScoreboardPlayer["rank"] {
  if (tierNumber <= 0) return undefined;
  const tier = catalog.tiersByNumber.get(tierNumber);
  return {
    name: tier?.tierName || `Tier ${tierNumber}`,
    iconUrl:
      tier?.smallIcon || tier?.largeIcon || tier?.rankTriangleDownIcon,
  };
}

function buildOpponentBreakdown(
  player: RawPlayer,
  players: readonly RawPlayer[],
  aggregate: PlayerAggregate,
  namesById: ReadonlyMap<string, string>,
  catalog: MatchAssetCatalog
): OpponentBreakdown[] {
  const ownTeam = toTeam(player.teamId);
  return players
    .filter((opponent) => toTeam(opponent.teamId) !== ownTeam)
    .map((opponent) => {
      const agent = catalog.agentsById.get(opponent.characterId);
      return {
        opponentPlayerId: opponent.subject,
        opponentAgentName:
          agent?.displayName || namesById.get(opponent.subject) || "Opponent",
        opponentAgentIconUrl: agent?.displayIcon || agent?.displayIconSmall,
        killsAgainst: aggregate.killsAgainst.get(opponent.subject) ?? 0,
        deathsAgainst: aggregate.deathsAgainst.get(opponent.subject) ?? 0,
        damageDealt: aggregate.opponentDamageDealt.get(opponent.subject) ?? 0,
        damageTaken: aggregate.opponentDamageTaken.get(opponent.subject) ?? 0,
      };
    })
    .sort(
      (left, right) =>
        right.killsAgainst - left.killsAgainst ||
        left.deathsAgainst - right.deathsAgainst
    );
}

function buildWeaponPerformance(
  aggregate: PlayerAggregate,
  catalog: MatchAssetCatalog
): WeaponPerformance[] {
  return Array.from(aggregate.weapons.entries())
    .map(([weaponId, values]) => {
      const weapon = catalog.weaponsById.get(weaponId);
      return {
        weaponId,
        weaponName: weapon?.displayName || "Weapon",
        weaponImageUrl: weapon?.displayIcon,
        kills: values.kills,
        damage: values.damage,
      };
    })
    .filter((weapon) => weapon.kills > 0 || weapon.damage > 0)
    .sort((left, right) => right.kills - left.kills || right.damage - left.damage);
}

function buildPlayerPerformance(
  player: RawPlayer,
  players: readonly RawPlayer[],
  aggregate: PlayerAggregate,
  namesById: ReadonlyMap<string, string>,
  catalog: MatchAssetCatalog
): PlayerMatchPerformance {
  const stats = player.stats;
  const roundsPlayed = Math.max(1, numberOrZero(stats?.roundsPlayed));
  const kills = numberOrZero(stats?.kills);
  const deaths = numberOrZero(stats?.deaths);
  const assists = numberOrZero(stats?.assists);
  const agent = catalog.agentsById.get(player.characterId);
  const rank = rankFromTier(numberOrZero(player.competitiveTier), catalog);
  const sideStats: PlayerSideStats = {
    defense: toSidePerformance(aggregate.side.defense),
    attack: toSidePerformance(aggregate.side.attack),
  };
  const summary: PlayerPerformanceSummary = {
    playerId: player.subject,
    playerName: namesById.get(player.subject) || "Player",
    agentName: agent?.displayName || "Agent",
    agentFullImageUrl:
      agent?.fullPortraitV2 || agent?.fullPortrait || agent?.bustPortrait,
    rankName: rank?.name || "Unrated",
    rankIconUrl: rank?.iconUrl,
    averageScore: Math.round(numberOrZero(stats?.score) / roundsPlayed),
    kills,
    deaths,
    assists,
    kd: safeRatio(kills, deaths),
    adr: aggregate.damageDealt / roundsPlayed,
  };

  return {
    summary,
    sideStats,
    opponents: buildOpponentBreakdown(
      player,
      players,
      aggregate,
      namesById,
      catalog
    ),
    weapons: buildWeaponPerformance(aggregate, catalog),
  };
}

export function buildMatchDetailViewModel(
  details: MatchDetailsData,
  currentPlayerId: string,
  catalog: MatchAssetCatalog = createMatchAssetCatalog()
): MatchDetailViewModel {
  const players = Array.isArray(details.players) ? details.players : [];
  const rounds = Array.isArray(details.roundResults) ? details.roundResults : [];
  const identities = details.playerIdentities ?? details.PlayerIdentities ?? [];
  const namesById = new Map(
    players.map((player, index) => [
      player.subject,
      resolveIdentity(player, identities, index),
    ])
  );
  const teamByPlayer = new Map(
    players.map((player) => [player.subject, toTeam(player.teamId)])
  );
  const aggregates = buildAggregates(players, rounds);
  const economy = buildEconomy(rounds, teamByPlayer);

  const scoreboardPlayers: ScoreboardPlayer[] = players.map((player) => {
    const stats = player.stats;
    const aggregate = aggregates.get(player.subject) ?? createAggregate();
    const roundsPlayed = Math.max(1, numberOrZero(stats?.roundsPlayed));
    const kills = numberOrZero(stats?.kills);
    const deaths = numberOrZero(stats?.deaths);
    const assists = numberOrZero(stats?.assists);
    const totalShots =
      aggregate.headshots + aggregate.bodyshots + aggregate.legshots;
    const agent = catalog.agentsById.get(player.characterId);

    return {
      playerId: player.subject,
      playerName: namesById.get(player.subject) || "Player",
      team: toTeam(player.teamId),
      agent: {
        name: agent?.displayName || "Agent",
        iconUrl: agent?.displayIcon || agent?.displayIconSmall,
      },
      rank: rankFromTier(numberOrZero(player.competitiveTier), catalog),
      acs: Math.round(numberOrZero(stats?.score) / roundsPlayed),
      kills,
      deaths,
      assists,
      plusMinus: kills - deaths,
      kd: safeRatio(kills, deaths),
      adr: aggregate.damageDealt / roundsPlayed,
      dda: (aggregate.damageDealt - aggregate.damageTaken) / roundsPlayed,
      kast: (aggregate.kastRounds / roundsPlayed) * 100,
      headshotPercent:
        totalShots > 0 ? (aggregate.headshots / totalShots) * 100 : undefined,
      firstKills: aggregate.firstKills,
      firstDeaths: aggregate.firstDeaths,
      multiKills: aggregate.multiKills,
      economyRating:
        aggregate.spent > 0
          ? (aggregate.damageDealt / aggregate.spent) * 1000
          : undefined,
      isCurrentUser: player.subject === currentPlayerId,
    };
  });

  const playerPerformance = Object.fromEntries(
    players.map((player) => {
      const aggregate = aggregates.get(player.subject) ?? createAggregate();
      return [
        player.subject,
        buildPlayerPerformance(
          player,
          players,
          aggregate,
          namesById,
          catalog
        ),
      ];
    })
  );
  const map = catalog.mapsByUrl.get(details.matchInfo?.mapId ?? "");
  const teams = details.teams ?? [];
  const teamA = teams.find((team) => toTeam(team.teamId) === "A");
  const teamB = teams.find((team) => toTeam(team.teamId) === "B");
  const resolvedCurrentPlayerId = players.some(
    (player) => player.subject === currentPlayerId
  )
    ? currentPlayerId
    : players[0]?.subject ?? currentPlayerId;

  return {
    match: {
      id: details.matchInfo?.matchId ?? "unknown-match",
      mode:
        details.matchInfo?.queueID || details.matchInfo?.gameMode || "Standard",
      mapName: map?.displayName || details.matchInfo?.mapId || "Unknown",
      mapImageUrl: map?.splash || map?.listViewIcon,
      startedAt: new Date(
        numberOrZero(details.matchInfo?.gameStartMillis)
      ).toISOString(),
      durationSeconds: Math.round(
        numberOrZero(details.matchInfo?.gameLengthMillis) / 1000
      ),
      teamAScore: numberOrZero(teamA?.roundsWon),
      teamBScore: numberOrZero(teamB?.roundsWon),
      winningTeam:
        numberOrZero(teamB?.roundsWon) > numberOrZero(teamA?.roundsWon)
          ? "B"
          : "A",
    },
    players: scoreboardPlayers,
    playerRefs: scoreboardPlayers.map<MatchPlayerRef>((player) => ({
      playerId: player.playerId,
      playerName: player.playerName,
      team: player.team,
      agentName: player.agent.name,
      agentIconUrl: player.agent.iconUrl,
      isCurrentUser: Boolean(player.isCurrentUser),
    })),
    currentPlayerId: resolvedCurrentPlayerId,
    economy,
    rounds: buildRounds(rounds, economy),
    playerPerformance,
  };
}

export function buildMatchHistoryRecord(
  match: MatchHistoryRecord,
  details: MatchDetailsData | null,
  userId: string,
  catalog: MatchAssetCatalog = createMatchAssetCatalog()
): MatchHistoryRecord {
  if (!details?.players || !details.teams) {
    return { ...match, stats: null };
  }

  const player = details.players.find((entry) => entry.subject === userId);
  if (!player?.stats) return { ...match, stats: null };

  const viewModel = buildMatchDetailViewModel(details, userId, catalog);
  const scoreboardPlayer = viewModel.players.find(
    (entry) => entry.playerId === userId
  );
  const performance = viewModel.playerPerformance[userId];
  if (!scoreboardPlayer || !performance) return { ...match, stats: null };

  const ownTeam = viewModel.match.winningTeam === scoreboardPlayer.team;
  const ownScore =
    scoreboardPlayer.team === "A"
      ? viewModel.match.teamAScore
      : viewModel.match.teamBScore;
  const opponentScore =
    scoreboardPlayer.team === "A"
      ? viewModel.match.teamBScore
      : viewModel.match.teamAScore;
  const rankTier = numberOrZero(
    match.rankUpdate?.TierAfterUpdate ?? player.competitiveTier
  );
  const tier = catalog.tiersByNumber.get(rankTier);
  const agent = catalog.agentsById.get(player.characterId);
  const map = catalog.mapsByUrl.get(details.matchInfo?.mapId ?? "");
  const roundsPlayed = Math.max(1, numberOrZero(player.stats.roundsPlayed));
  const hs = scoreboardPlayer.headshotPercent;
  const stats: MatchHistoryStats = {
    kda: `${scoreboardPlayer.kills}/${scoreboardPlayer.deaths}/${scoreboardPlayer.assists}`,
    kills: scoreboardPlayer.kills,
    deaths: scoreboardPlayer.deaths,
    assists: scoreboardPlayer.assists,
    score: numberOrZero(player.stats.score),
    acs: scoreboardPlayer.acs,
    adr: scoreboardPlayer.adr,
    kd: scoreboardPlayer.kd,
    kdRatio: scoreboardPlayer.kd.toFixed(2),
    headshotPercent: hs ?? null,
    headshotPct: hs === undefined ? null : `${Math.round(hs)}%`,
    placement:
      [...viewModel.players]
        .sort((left, right) => right.acs - left.acs)
        .findIndex((entry) => entry.playerId === userId) + 1,
    roundsPlayed,
    won: ownTeam,
    roundsWon: ownScore,
    roundsLost: opponentScore,
    agentIcon: agent?.displayIcon || agent?.displayIconSmall || null,
    agentId: player.characterId || null,
    agentName: agent?.displayName || "Agent",
    agentPortrait:
      agent?.bustPortrait || agent?.fullPortraitV2 || agent?.fullPortrait || null,
    mapId: details.matchInfo?.mapId || null,
    mapName: map?.displayName || details.matchInfo?.mapId || "Unknown",
    mapImage: map?.listViewIcon || map?.splash || null,
    gameMode: details.matchInfo?.gameMode || match.QueueID || "",
    rankTier: rankTier > 0 ? rankTier : null,
    rankName: tier?.tierName || scoreboardPlayer.rank?.name || null,
    rankIcon:
      tier?.smallIcon ||
      tier?.largeIcon ||
      tier?.rankTriangleDownIcon ||
      scoreboardPlayer.rank?.iconUrl ||
      null,
    rrEarned: optionalNumber(match.rankUpdate?.RankedRatingEarned) ?? null,
    rrAfter:
      optionalNumber(match.rankUpdate?.RankedRatingAfterUpdate) ?? null,
    rrBefore:
      optionalNumber(match.rankUpdate?.RankedRatingBeforeUpdate) ?? null,
    rrPerformanceBonus:
      optionalNumber(match.rankUpdate?.RankedRatingPerformanceBonus) ?? null,
    rrAfkPenalty: optionalNumber(match.rankUpdate?.AFKPenalty) ?? null,
    competitiveMovement: match.rankUpdate?.CompetitiveMovement ?? null,
  };

  return { ...match, stats };
}

export function toMatchHistoryItem(
  match: MatchHistoryRecord
): MatchHistoryItem | null {
  const stats = match.stats;
  if (!stats) return null;

  return {
    id: match.MatchID,
    startedAt: new Date(match.GameStartTime).toISOString(),
    result:
      stats.roundsWon === stats.roundsLost
        ? "draw"
        : stats.won
          ? "win"
          : "loss",
    teamScore: stats.roundsWon,
    opponentScore: stats.roundsLost,
    mode: match.QueueID || stats.gameMode,
    mapName: stats.mapName,
    mapImageUrl: stats.mapImage ?? undefined,
    agent: {
      id: stats.agentId || "unknown-agent",
      name: stats.agentName,
      iconUrl: stats.agentIcon ?? undefined,
    },
    rank:
      stats.rankTier && stats.rankName
        ? {
            tier: stats.rankTier,
            name: stats.rankName,
            iconUrl: stats.rankIcon ?? undefined,
          }
        : undefined,
    placement: Math.max(1, stats.placement),
    kills: stats.kills,
    deaths: stats.deaths,
    assists: stats.assists,
    kd: stats.kd,
    headshotPercent: stats.headshotPercent ?? undefined,
    adr: stats.adr,
    acs: stats.acs,
  };
}

const localDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function buildMatchHistoryGroups(
  records: readonly MatchHistoryRecord[],
  locale: string
): MatchHistoryGroup[] {
  const grouped = new Map<string, MatchHistoryItem[]>();
  records
    .map(toMatchHistoryItem)
    .filter((item): item is MatchHistoryItem => Boolean(item))
    .sort(
      (left, right) =>
        new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
    )
    .forEach((item) => {
      const dateKey = localDateKey(new Date(item.startedAt));
      grouped.set(dateKey, [...(grouped.get(dateKey) ?? []), item]);
    });

  return Array.from(grouped.entries()).map(([dateKey, matches]) => {
    const count = matches.length;
    const average = (read: (item: MatchHistoryItem) => number) =>
      count > 0
        ? matches.reduce((total, item) => total + read(item), 0) / count
        : undefined;
    const summary: DailyMatchSummary = {
      dateKey,
      dateLabel: new Date(matches[0].startedAt).toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
      }),
      matchCount: count,
      averageKD: average((item) => item.kd),
      averageADR: average((item) => item.adr),
      averageACS: average((item) => item.acs),
    };

    return { dateKey, summary, matches };
  });
}

export function formatMatchRelativeTime(
  startedAt: string,
  locale: string,
  now = Date.now()
): string {
  const elapsedMinutes = Math.max(
    1,
    Math.floor((now - new Date(startedAt).getTime()) / 60_000)
  );
  const vietnamese = (locale || "en").toLowerCase().startsWith("vi");
  if (elapsedMinutes < 60) {
    return vietnamese ? `${elapsedMinutes}ph truoc` : `${elapsedMinutes}m ago`;
  }
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return vietnamese ? `${hours}g truoc` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return vietnamese ? `${days}ng truoc` : `${days}d ago`;
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(numberOrZero(totalSeconds)));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}min ${seconds}s`;
}

export function formatMetric(
  value: number | null | undefined,
  digits = 0
): string {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : "--";
}

export function formatPercent(value: number | null | undefined): string {
  return Number.isFinite(value) ? `${Number(value).toFixed(1)}%` : "--";
}

export function formatSigned(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return "--";
  const number = Number(value);
  return number > 0 ? `+${Math.round(number)}` : `${Math.round(number)}`;
}

export function formatOrdinal(value: number): string {
  const integer = Math.max(1, Math.round(value));
  const mod100 = integer % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${integer}th`;
  const suffix = integer % 10 === 1 ? "st" : integer % 10 === 2 ? "nd" : integer % 10 === 3 ? "rd" : "th";
  return `${integer}${suffix}`;
}

export function humanizeMatchMode(value: string): string {
  const normalized = value.replace(/[_-]+/g, " ").trim();
  if (!normalized) return "Standard";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
