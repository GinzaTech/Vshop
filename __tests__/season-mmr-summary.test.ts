import { buildMmrSeasonPerformanceStats } from "~/features/matches/season-mmr-summary";

const season = {
  endTimeMs: Date.parse("2026-01-01T00:00:00Z"),
  id: "ACT-OLD",
  name: "V25 · ACT III",
  startTimeMs: Date.parse("2025-09-01T00:00:00Z"),
};

describe("historical season MMR summary", () => {
  it("builds rank-only counts case-insensitively without inventing combat stats", () => {
    expect(
      buildMmrSeasonPerformanceStats(
        {
          QueueSkills: {
            competitive: {
              SeasonalInfoBySeasonID: {
                "act-old": {
                  NumberOfDraws: 1,
                  NumberOfGames: 25,
                  NumberOfLosses: 12,
                  NumberOfWins: 12,
                },
              },
            },
          },
        },
        season,
        123
      )
    ).toMatchObject({
      acs: null,
      adr: null,
      dataCompleteness: "rank-only",
      draws: 1,
      headshotPercent: null,
      kd: null,
      kills: 0,
      losses: 12,
      matchCount: 25,
      updatedAt: 123,
      winRate: 48,
      wins: 12,
    });
  });

  it("returns null when the selected Act is absent from seasonal MMR", () => {
    expect(
      buildMmrSeasonPerformanceStats(
        { QueueSkills: { competitive: { SeasonalInfoBySeasonID: {} } } },
        season,
        123
      )
    ).toBeNull();
  });

  it("accepts differently-cased competitive queues and derives missing losses", () => {
    const result = buildMmrSeasonPerformanceStats(
      {
        QueueSkills: {
          Competitive: {
            SeasonalInfoBySeasonID: {
              "act-old": {
                NumberOfGames: 10,
                NumberOfWinsWithPlacements: 6,
              },
            },
          },
        },
      },
      season,
      123
    );

    expect(result).toMatchObject({ losses: 4, matchCount: 10, wins: 6 });
  });

  it("falls back to a queue carrying seasonal data and sums WinsByTier", () => {
    const result = buildMmrSeasonPerformanceStats(
      {
        QueueSkills: {
          ranked: {
            SeasonalInfoBySeasonID: {
              "act-old": {
                NumberOfDraws: -2,
                NumberOfLosses: 3,
                WinsByTier: { "20": 2, "21": 4 },
              },
            },
          },
        },
      },
      season,
      123
    );

    expect(result).toMatchObject({
      draws: 0,
      losses: 3,
      matchCount: 9,
      wins: 6,
    });
    expect(result?.winRate).toBeCloseTo(66.7, 1);
  });

  it("rejects missing or metadata-only seasonal totals", () => {
    expect(buildMmrSeasonPerformanceStats({}, season, 123)).toBeNull();
    expect(
      buildMmrSeasonPerformanceStats(
        {
          QueueSkills: {
            ranked: {
              SeasonalInfoBySeasonID: { "act-old": { Rank: 5 } },
            },
          },
        },
        season,
        123
      )
    ).toBeNull();
  });

  it("keeps a real zero-game season without inventing a win rate", () => {
    expect(
      buildMmrSeasonPerformanceStats(
        {
          QueueSkills: {
            competitive: {
              SeasonalInfoBySeasonID: {
                "act-old": { NumberOfGames: 0, NumberOfWins: 0 },
              },
            },
          },
        },
        season,
        123
      )
    ).toMatchObject({ matchCount: 0, winRate: null, wins: 0 });
  });
});
