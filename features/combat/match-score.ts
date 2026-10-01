export type MatchScore = Readonly<{
  selfTeamId: string;
  enemyTeamId: string;
  allyRoundsWon: number;
  enemyRoundsWon: number;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isScoreTeam = (value: unknown): value is { teamId: string; roundsWon: number } =>
  isRecord(value) && typeof value.teamId === "string" && value.teamId.trim().length > 0 &&
  typeof value.roundsWon === "number" && Number.isFinite(value.roundsWon) &&
  Number.isInteger(value.roundsWon) && value.roundsWon >= 0;

/** Validate match-details data against the active match and actual roster team.
 * Missing live data is unavailable; only an explicit upstream zero is a score. */
export function extractMatchScore(
  details: unknown,
  expectedMatchId: string | undefined,
  selfTeamId: string | undefined,
): MatchScore | null {
  if (!expectedMatchId || !selfTeamId || !isRecord(details) ||
    !isRecord(details.matchInfo) || details.matchInfo.matchId !== expectedMatchId ||
    !Array.isArray(details.teams) || details.teams.length !== 2 ||
    !details.teams.every(isScoreTeam)) return null;

  const ally = details.teams.find((team) => team.teamId === selfTeamId);
  const enemy = details.teams.find((team) => team.teamId !== selfTeamId);
  if (!ally || !enemy) return null;

  return {
    selfTeamId: ally.teamId,
    enemyTeamId: enemy.teamId,
    allyRoundsWon: ally.roundsWon,
    enemyRoundsWon: enemy.roundsWon,
  };
}
