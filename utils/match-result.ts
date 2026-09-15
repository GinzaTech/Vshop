import type {
  MatchDetailsData,
  MatchHistoryStats,
  MatchResult,
  MatchTeam,
} from "~/types/match-ui";

export type MatchOutcome = {
  result: MatchResult;
  winningTeam: MatchTeam | null;
};

const neutral = (result: MatchResult): MatchOutcome => ({ result, winningTeam: null });

const teamFromId = (value: string | undefined): MatchTeam | null => {
  const id = value?.toLowerCase();
  return id === "blue" ? "A" : id === "red" ? "B" : null;
};

const validScore = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/** Resolve the API outcome before consulting scores, without assigning tied games a winner. */
export function resolveMatchOutcome(
  details: MatchDetailsData,
  userId: string,
): MatchOutcome {
  const info = details.matchInfo;
  const state = String(info?.completionState ?? "").trim().toLowerCase();
  if (/cancel|abort|remake|terminat/.test(state)) return neutral("cancelled");
  if (info?.isCompleted === false) return neutral("unknown");
  if (state === "votedraw" || state === "draw") return neutral("draw");

  const teams = Array.isArray(details.teams) ? details.teams : [];
  const blue = teams.find((team) => teamFromId(team.teamId) === "A");
  const red = teams.find((team) => teamFromId(team.teamId) === "B");
  const winners = [blue, red].filter((team) => team?.won === true);
  if (winners.length > 1) return neutral("unknown");
  let winningTeam = teamFromId(winners[0]?.teamId);

  if (!winningTeam) {
    if (!validScore(blue?.roundsWon) || !validScore(red?.roundsWon)) {
      return neutral("unknown");
    }
    if (blue.roundsWon === red.roundsWon) {
      return neutral(blue.roundsWon > 0 ? "draw" : "unknown");
    }
    // Two explicit false flags contradict an unequal-score win: don't guess.
    if (blue.won === false && red.won === false) return neutral("unknown");
    winningTeam = blue.roundsWon > red.roundsWon ? "A" : "B";
  }

  const player = details.players?.find((entry) => entry.subject === userId);
  const ownTeam = teamFromId(player?.teamId);
  return {
    winningTeam,
    result: ownTeam ? (ownTeam === winningTeam ? "win" : "loss") : "unknown",
  };
}

/** Legacy caches inferred Blue as the winner on ties; repair that at every consumer. */
export function getMatchHistoryResult(
  stats: MatchHistoryStats | null | undefined,
): MatchResult {
  if (!stats) return "unknown";
  if (stats.result) return stats.result;
  if (!validScore(stats.roundsWon) || !validScore(stats.roundsLost)) return "unknown";
  if (stats.roundsWon === stats.roundsLost) {
    return stats.roundsWon > 0 ? "draw" : "unknown";
  }
  return stats.won ? "win" : "loss";
}
