import type { MatchAssetCatalog, MatchDetailsData, MatchDetailViewModel, MatchPlayerRef, ScoreboardPlayer } from "~/types/match-ui";
import { resolveMatchOutcome } from "~/utils/match-result";
import { numberOrZero, resolveIdentity, safeRatio, toTeam } from "./common";
import { createMatchAssetCatalog, rankFromTier, resolveAgentAsset, resolveMapAsset } from "./assets";
import { buildAggregates, buildPlayerPerformance, createAggregate } from "./performance";
import { buildEconomy, buildRounds } from "./rounds";
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
    const agent = resolveAgentAsset(catalog, player.characterId);

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
  const map = resolveMapAsset(catalog, details.matchInfo?.mapId);
  const teams = details.teams ?? [];
  const teamA = teams.find((team) => toTeam(team.teamId) === "A");
  const teamB = teams.find((team) => toTeam(team.teamId) === "B");
  const outcome = resolveMatchOutcome(details, currentPlayerId);
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
      ...outcome,
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
    rounds: buildRounds(rounds, economy, teamByPlayer, catalog),
    playerPerformance,
  };
}
