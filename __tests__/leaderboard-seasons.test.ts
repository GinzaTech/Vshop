import { buildLeaderboardSeasonOptions } from "~/utils/leaderboard-seasons";

const seasons = [
  {
    ID: "episode-1",
    Name: "Episode 1",
    Type: "episode" as const,
    StartTime: "2024-01-01T00:00:00Z",
    EndTime: "2024-07-01T00:00:00Z",
    IsActive: false,
  },
  {
    ID: "act-1",
    Name: "Act 1",
    Type: "act" as const,
    StartTime: "2024-01-01T00:00:00Z",
    EndTime: "2024-03-01T00:00:00Z",
    IsActive: false,
  },
  {
    ID: "act-2",
    Name: "Act 2",
    Type: "act" as const,
    StartTime: "2024-03-01T00:00:00Z",
    EndTime: "2024-05-01T00:00:00Z",
    IsActive: true,
  },
  {
    ID: "future-act",
    Name: "Act 3",
    Type: "act" as const,
    StartTime: "2025-01-01T00:00:00Z",
    EndTime: "2025-03-01T00:00:00Z",
    IsActive: false,
  },
];

describe("buildLeaderboardSeasonOptions", () => {
  it("returns every started Act newest first with its Episode label", () => {
    expect(
      buildLeaderboardSeasonOptions(
        seasons,
        Date.parse("2024-06-01T00:00:00Z"),
      ),
    ).toEqual([
      {
        id: "act-2",
        name: "Episode 1 · Act 2",
        isActive: true,
        startTime: "2024-03-01T00:00:00Z",
      },
      {
        id: "act-1",
        name: "Episode 1 · Act 1",
        isActive: false,
        startTime: "2024-01-01T00:00:00Z",
      },
    ]);
  });

  it("deduplicates IDs and keeps an Act without a matching Episode", () => {
    const duplicate = { ...seasons[1], Name: "Updated Act 1" };
    const result = buildLeaderboardSeasonOptions(
      [duplicate, seasons[1]],
      Date.parse("2024-06-01T00:00:00Z"),
    );

    expect(result).toEqual([
      {
        id: "act-1",
        name: "Act 1",
        isActive: false,
        startTime: "2024-01-01T00:00:00Z",
      },
    ]);
  });
});

