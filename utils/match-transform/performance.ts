import type { MatchAssetCatalog, MatchSide, OpponentBreakdown, PlayerMatchPerformance, PlayerPerformanceSummary, PlayerSideStats, SidePerformance, WeaponPerformance } from "~/types/match-ui";
import type { RawPlayer, RawRound } from "./common";
import { addToMap, numberOrZero, safeRatio, sideForPlayer, toTeam } from "./common";
import { normalizeAssetId, rankFromTier, resolveAgentAsset } from "./assets";
import { getRoundKills } from "./rounds";
export type MutableSideStats = {
  kills: number;
  deaths: number;
  assists: number;
};

export type MutableWeaponStats = {
  kills: number;
  damage: number;
};

export type PlayerAggregate = {
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

export const EMPTY_SIDE_STATS = (): MutableSideStats => ({
  kills: 0,
  deaths: 0,
  assists: 0,
});

export const createAggregate = (): PlayerAggregate => ({
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

export const toSidePerformance = (value: MutableSideStats): SidePerformance => ({
  ...value,
  kd: safeRatio(value.kills, value.deaths),
});

export function buildAggregates(
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
        const weaponId = normalizeAssetId(kill.finishingDamage.damageItem);
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

      const economyWeaponId = normalizeAssetId(playerStats.economy?.weapon);
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

export function buildOpponentBreakdown(
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
      const agent = resolveAgentAsset(catalog, opponent.characterId);
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

export function buildWeaponPerformance(
  aggregate: PlayerAggregate,
  catalog: MatchAssetCatalog
): WeaponPerformance[] {
  return Array.from(aggregate.weapons.entries())
    .flatMap(([weaponId, values]) => {
      const weapon = catalog.weaponsById.get(normalizeAssetId(weaponId));
      if (!weapon || (values.kills <= 0 && values.damage <= 0)) return [];
      const performance: WeaponPerformance = {
        weaponId,
        weaponName: weapon.displayName,
        weaponImageUrl: weapon.displayIcon,
        kills: values.kills,
        damage: values.damage,
      };
      return [performance];
    })
    .sort((left, right) => right.kills - left.kills || right.damage - left.damage);
}

export function buildPlayerPerformance(
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
  const agent = resolveAgentAsset(catalog, player.characterId);
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
