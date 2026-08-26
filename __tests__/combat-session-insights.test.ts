import {
  buildCompetitivePerformance,
  buildMatchPerformanceBySubject,
  buildPlayerIntel,
  formatPeakSeason,
  mapWithConcurrency,
  toTier,
} from "~/features/combat/session-insights";

jest.mock("~/utils/valorant-api", () => ({
  getCompetitiveUpdates: jest.fn(),
  matchDetails: jest.fn(),
}));

const matchDetailsFixture = {
  players: [
    {
      subject: "player",
      teamId: "Blue",
      stats: { kills: 20, deaths: 10, assists: 5, score: 4000, roundsPlayed: 20 },
    },
  ],
  teams: [
    { teamId: "Blue", won: true },
    { teamId: "Red", won: false },
  ],
  roundResults: [
    {
      playerStats: [
        {
          subject: "player",
          damage: [{ headshots: 5, bodyshots: 4, legshots: 1 }],
        },
      ],
    },
  ],
} as never;

describe("combat session insight helpers", () => {
  it("normalizes tiers and formats episode/act labels", () => {
    expect(toTier("12")).toBe(12);
    expect(toTier(0)).toBeNull();
    expect(
      formatPeakSeason("act-id", [
        {
          ID: "episode-id",
          Name: "Episode VII",
          Type: "episode",
          StartTime: "2025-01-01T00:00:00Z",
          EndTime: "2026-01-01T00:00:00Z",
          IsActive: false,
        },
        {
          ID: "act-id",
          Name: "Act 2",
          Type: "act",
          StartTime: "2025-04-01T00:00:00Z",
          EndTime: "2025-07-01T00:00:00Z",
          IsActive: false,
        },
      ])
    ).toBe("Episode 7 – Act 2");
  });

  it("derives current and peak competitive rank", () => {
    const intel = buildPlayerIntel(
      {
        QueueSkills: {
          competitive: {
            CompetitiveTier: 12,
            SeasonalInfoBySeasonID: {
              act: { WinsByTier: { "15": 2 } },
            },
          },
        },
        LatestCompetitiveUpdate: {
          TierAfterUpdate: 13,
          RankedRatingAfterUpdate: 72,
        },
      },
      []
    );
    expect(intel).toMatchObject({
      status: "ready",
      currentTier: 13,
      currentRr: 72,
      peakTier: 15,
    });
  });

  it("computes competitive and current-match performance", () => {
    const details = new Map([["match", matchDetailsFixture]]);
    expect(buildCompetitivePerformance("player", ["match"], details, 18)).toMatchObject({
      status: "ready",
      kd: 2,
      winRate: 100,
      acs: 200,
      headshotPercent: 50,
      rrDelta: 18,
    });
    expect(buildMatchPerformanceBySubject(matchDetailsFixture, ["PLAYER"]).player).toMatchObject({
      status: "ready",
      kills: 20,
      deaths: 10,
      assists: 5,
      acs: 200,
      headshotPercent: 50,
    });
  });

  it("preserves input order while limiting concurrent work", async () => {
    let active = 0;
    let peak = 0;
    const result = await mapWithConcurrency([3, 1, 2], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      return value * 2;
    });
    expect(result).toEqual([6, 2, 4]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
