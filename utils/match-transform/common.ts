import type { MatchPlayerIdentity, MatchSide, MatchTeam, RoundOutcome } from "~/types/match-ui";
export type RawPlayer = MatchDetailsResponse["players"][number];
export type RawRound = NonNullable<MatchDetailsResponse["roundResults"]>[number];

export const numberOrZero = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const optionalNumber = (value: unknown): number | undefined => {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const addToMap = (map: Map<string, number>, key: string, value: number) => {
  if (!key || value === 0) return;
  map.set(key, (map.get(key) ?? 0) + value);
};

export const toSeconds = (value: unknown): number => {
  const parsed = numberOrZero(value);
  return parsed > 300 ? Math.round(parsed / 1000) : Math.round(parsed);
};

export const toTeam = (teamId: string | undefined): MatchTeam =>
  String(teamId).toLowerCase() === "red" ? "B" : "A";

export const oppositeSide = (side: MatchSide): MatchSide =>
  side === "attack" ? "defense" : "attack";

export const teamASideForRound = (roundIndex: number): MatchSide => {
  if (roundIndex < 12) return "defense";
  if (roundIndex < 24) return "attack";
  return (roundIndex - 24) % 2 === 0 ? "defense" : "attack";
};

export const sideForPlayer = (team: MatchTeam, roundIndex: number): MatchSide => {
  const teamASide = teamASideForRound(roundIndex);
  return team === "A" ? teamASide : oppositeSide(teamASide);
};

export const normalizeRoundOutcome = (
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

export const resolveIdentity = (
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

export const safeRatio = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : numerator;
