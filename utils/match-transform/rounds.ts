import type { EconomyPoint, MatchAssetCatalog, MatchTeam, RoundDetail, RoundEvent } from "~/types/match-ui";
import type { RawRound } from "./common";
import { normalizeRoundOutcome, numberOrZero, teamASideForRound, toSeconds, toTeam } from "./common";
import { normalizeAssetId } from "./assets";
export function getRoundKills(round: RawRound) {
  return round.playerStats
    .flatMap((playerStats) => playerStats.kills)
    .sort((left, right) => left.roundTime - right.roundTime);
}

export function buildRoundEvents(
  round: RawRound,
  catalog: MatchAssetCatalog
): RoundEvent[] {
  const events: RoundEvent[] = getRoundKills(round).map((kill, index) => {
    const weaponId = kill.finishingDamage.damageItem || undefined;
    const weapon = weaponId
      ? catalog.weaponsById.get(normalizeAssetId(weaponId))
      : undefined;
    const weaponImageUrl =
      weapon?.displayIcon ||
      (weaponId && /^[0-9a-f-]{36}$/i.test(weaponId)
        ? `https://media.valorant-api.com/weapons/${weaponId}/displayicon.png`
        : undefined);
    const killerLocation = kill.playerLocations.find(
      (playerLocation) => playerLocation.subject === kill.killer
    )?.location;
    const rawDistance =
      killerLocation && kill.victimLocation
        ? Math.hypot(
            killerLocation.x - kill.victimLocation.x,
            killerLocation.y - kill.victimLocation.y
          ) / 100
        : Number.NaN;

    return {
      id: `round-${round.roundNum + 1}-kill-${index}`,
      timestampSeconds: toSeconds(kill.roundTime),
      type: "kill",
      actorPlayerId: kill.killer,
      targetPlayerId: kill.victim,
      assistantPlayerIds: kill.assistants,
      weaponId,
      weaponName: weapon?.displayName,
      weaponImageUrl,
      distanceMeters: Number.isFinite(rawDistance)
        ? Math.max(0, Math.round(rawDistance))
        : undefined,
    };
  });

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

export function buildRounds(
  rounds: readonly RawRound[],
  economy: readonly EconomyPoint[],
  teamByPlayer: ReadonlyMap<string, MatchTeam>,
  catalog: MatchAssetCatalog
): RoundDetail[] {
  return rounds.map((round, index) => {
    const events = buildRoundEvents(round, catalog);
    const economyPoint = economy[index];
    const teamEconomy = round.playerStats.reduce(
      (summary, playerStats) => {
        const team = teamByPlayer.get(playerStats.subject) ?? "A";
        const values = summary[team];
        values.players += 1;
        values.loadout += numberOrZero(playerStats.economy?.loadoutValue);
        values.credits += numberOrZero(playerStats.economy?.remaining);
        return summary;
      },
      {
        A: { players: 0, loadout: 0, credits: 0 },
        B: { players: 0, loadout: 0, credits: 0 },
      }
    );
    const average = (
      value: number,
      players: number,
      fallback = 0
    ) => (players > 0 ? Math.round(value / players) : fallback);

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
      teamAAverageLoadout: average(
        teamEconomy.A.loadout,
        teamEconomy.A.players,
        economyPoint?.teamAEconomy ?? 0
      ),
      teamBAverageLoadout: average(
        teamEconomy.B.loadout,
        teamEconomy.B.players,
        economyPoint?.teamBEconomy ?? 0
      ),
      teamAAverageCredits: average(
        teamEconomy.A.credits,
        teamEconomy.A.players
      ),
      teamBAverageCredits: average(
        teamEconomy.B.credits,
        teamEconomy.B.players
      ),
      events,
    };
  });
}

export function buildEconomy(
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
