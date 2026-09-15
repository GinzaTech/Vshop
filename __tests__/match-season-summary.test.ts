import { summarizeSeasonMatches } from "~/features/matches/season-summary";
import type { MatchDetailsData } from "~/types/match-ui";

const season = { id: "act", name: "Act", startTimeMs: 0, endTimeMs: 0 };
function match(overrides: Record<string, unknown> = {}): MatchDetailsData {
  return {
    matchInfo: { seasonId: "act", queueID: "competitive", isCompleted: true, completionState: "Completed" },
    players: [{ subject: "me", teamId: "Blue", stats: { kills: 10, deaths: 5, score: 2000, roundsPlayed: 10 } }],
    teams: [{ teamId: "Blue", won: true, roundsWon: 13 }, { teamId: "Red", won: false, roundsWon: 8 }],
    roundResults: [], ...overrides,
  } as unknown as MatchDetailsData;
}

describe("competitive season outcome aggregation", () => {
  it("counts draws while excluding cancelled and unknown outcomes from performance and win-rate denominators", () => {
    const win = match();
    const loss = match({ teams: [{ teamId: "Blue", won: false, roundsWon: 8 }, { teamId: "Red", won: true, roundsWon: 13 }] });
    const draw = match({ teams: [{ teamId: "Blue", won: false, roundsWon: 14 }, { teamId: "Red", won: false, roundsWon: 14 }] });
    const cancelled = match({ matchInfo: { seasonId: "act", queueID: "competitive", isCompleted: true, completionState: "Remake" } });
    const unknown = match({ teams: [] });
    const stats = summarizeSeasonMatches([win, loss, draw, cancelled, unknown], "me", season);
    expect(stats).toMatchObject({ wins: 1, losses: 1, draws: 1, cancelled: 1, unknown: 1, matchCount: 3, kills: 30, deaths: 15 });
    expect(stats.winRate).toBeCloseTo(100 / 3);
  });

  it("ignores other acts, queues, null details and absent players", () => {
    const stats = summarizeSeasonMatches([
      null, match({ matchInfo: { seasonId: "another", queueID: "competitive" } }),
      match({ matchInfo: { seasonId: "act", queueID: "unrated" } }), match({ players: [] }),
    ], "me", season);
    expect(stats).toMatchObject({ matchCount: 0, kd: null, acs: null, adr: null, kast: null, winRate: null, headshotPercent: null });
  });

  it("computes KAST using kills, assists, survival and the five-second trade window", () => {
    const stats = summarizeSeasonMatches([match({
      players: [
        { subject: "me", teamId: "Blue", stats: { kills: 10, deaths: 5, score: 2000, roundsPlayed: 10 } },
        { subject: "ally", teamId: "BLUE" }, { subject: "enemy", teamId: "Red" },
      ],
      roundResults: [
        { playerStats: [
          { subject: "me", damage: [{ damage: 100, headshots: 2, bodyshots: 3, legshots: 1 }], kills: [{ killer: "me", victim: "enemy", roundTime: 500 }] },
        ] },
        { playerStats: [
          { subject: "me", kills: [] },
          { subject: "enemy", kills: [{ killer: "enemy", victim: "me", roundTime: 1000 }] },
          { subject: "ally", kills: [{ killer: "ally", victim: "enemy", roundTime: 6000 }] },
        ] },
        { playerStats: [
          { subject: "me", kills: [] },
          { subject: "enemy", kills: [{ killer: "enemy", victim: "me", roundTime: 1000 }] },
          { subject: "ally", kills: [{ killer: "ally", victim: "enemy", roundTime: 6001, assistants: ["me"] }] },
        ] },
        { playerStats: [{ subject: "me" }] },
        { playerStats: [
          { subject: "me", damage: [{ damage: 0, headshots: 0, bodyshots: 0, legshots: 0 }] },
          { subject: "enemy", kills: [{ killer: "enemy", victim: "me", roundTime: 1000 }] },
          { subject: "ally", kills: [{ killer: "ally", victim: "enemy", roundTime: 999 }] },
        ] },
        { playerStats: [{ subject: "ally" }] },
        {},
      ],
    })], "me", season);
    expect(stats).toMatchObject({ kills: 10, deaths: 5, kd: 2, acs: 200, adr: 10, kastRounds: 4, kastRoundsPlayed: 5, kast: 80, headshots: 2, bodyshots: 3, legshots: 1 });
    expect(stats.headshotPercent).toBeCloseTo(100 / 3);
  });

  it("retains null ratios when completed matches have zero recorded combat", () => {
    const stats = summarizeSeasonMatches([match({
      players: [{ subject: "me", teamId: "Blue", stats: {} }],
    })], "me", season);
    expect(stats).toMatchObject({ wins: 1, matchCount: 1, kills: 0, kd: null, acs: null, adr: null, headshotPercent: null, winRate: 100 });
  });
});
