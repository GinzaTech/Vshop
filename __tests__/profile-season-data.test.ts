import {
  hasPendingProfileSeasonRequest,
  inspectSeasonUpdatePage,
  resolveProfileSeason,
} from "~/features/profile/profile-season-data";
import type { LeaderboardSeasonOption } from "~/utils/leaderboard-seasons";

const seasons: LeaderboardSeasonOption[] = [
  {
    id: "season-current",
    name: "Episode 10 · Act 2",
    isActive: true,
    startTime: "2026-08-01T00:00:00Z",
  },
  {
    id: "season-target",
    name: "Episode 10 · Act 1",
    isActive: false,
    startTime: "2026-05-01T00:00:00Z",
  },
  {
    id: "season-older",
    name: "Episode 9 · Act 3",
    isActive: false,
    startTime: "2026-02-01T00:00:00Z",
  },
];

describe("profile season data", () => {
  it("honors an available requested season and otherwise falls back active", () => {
    expect(resolveProfileSeason(seasons, "season-target")?.id).toBe(
      "season-target"
    );
    expect(resolveProfileSeason(seasons, "missing")?.id).toBe(
      "season-current"
    );
    expect(resolveProfileSeason(seasons, null)?.id).toBe("season-current");
  });

  it("collects a target season after newer updates without stopping early", () => {
    const result = inspectSeasonUpdatePage(
      [
        {
          MatchID: "newer",
          SeasonID: "season-current",
          MatchStartTime: "300",
        },
        {
          MatchID: "target-1",
          SeasonID: "SEASON-TARGET",
          MatchStartTime: "200",
        },
      ],
      "season-target",
      false
    );

    expect(result.targetUpdates.map((update) => update.MatchID)).toEqual([
      "target-1",
    ]);
    expect(result.hasSeenTarget).toBe(true);
    expect(result.shouldStop).toBe(false);
  });

  it("stops after the ordered stream passes from the target into an older Act", () => {
    const result = inspectSeasonUpdatePage(
      [
        {
          MatchID: "target-2",
          SeasonID: "season-target",
          MatchStartTime: "190",
        },
        {
          MatchID: "older",
          SeasonID: "season-older",
          MatchStartTime: "100",
        },
      ],
      "season-target",
      true
    );

    expect(result.targetUpdates.map((update) => update.MatchID)).toEqual([
      "target-2",
    ]);
    expect(result.shouldStop).toBe(true);
  });

  it("stops on the first page without the target after that Act was seen", () => {
    const result = inspectSeasonUpdatePage(
      [
        {
          MatchID: "older",
          SeasonID: "season-older",
          MatchStartTime: "100",
        },
      ],
      "season-target",
      true
    );

    expect(result.targetUpdates).toEqual([]);
    expect(result.shouldStop).toBe(true);
  });

  it("scopes the loading flag to the active account", () => {
    const pendingKeys = [
      "account-old|season-current",
      "account-new|season-target",
    ];

    expect(hasPendingProfileSeasonRequest(pendingKeys, "account-new")).toBe(
      true
    );
    expect(
      hasPendingProfileSeasonRequest(
        ["account-old|season-current"],
        "account-new"
      )
    ).toBe(false);
  });
});
