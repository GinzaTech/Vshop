import {
  buildCompetitivePerformance,
  buildMatchPerformanceBySubject,
  buildPlayerIntel,
  fetchCompetitivePerformanceBatch,
  formatPeakSeason,
  mapWithConcurrency,
  toTier,
} from "~/features/combat/session-insights";
import { getCompetitiveUpdates, matchDetails } from "~/utils/valorant-api";
import type { MatchDetailsData } from "~/types/match-ui";

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

describe("competitive helper retry and cache authority", () => {
  const credentials = { region: "ap", accessToken: "fixture-access", entitlementsToken: "fixture-entitlements" };
  const fixture = (subject: string) => ({
    players: [{ subject, teamId: "Blue", stats: { kills: 12, deaths: 6, assists: 3, score: 2000, roundsPlayed: 10 } }],
    teams: [{ teamId: "Blue", won: true }, { teamId: "Red", won: false }], roundResults: [],
  }) as unknown as MatchDetailsData;
  const history = (id: string) => ({ Matches: [{ MatchID: id, RankedRatingEarned: 10 }] }) as Awaited<ReturnType<typeof getCompetitiveUpdates>>;
  beforeEach(() => { jest.mocked(getCompetitiveUpdates).mockReset(); jest.mocked(matchDetails).mockReset(); });

  it("retries failed history without waiting for the performance cache TTL", async () => {
    const subject = "retry-history-fixture";
    jest.mocked(getCompetitiveUpdates).mockRejectedValueOnce(new Error("temporary"));
    expect((await fetchCompetitivePerformanceBatch(credentials, [subject]))[subject].status).toBe("private");
    jest.mocked(getCompetitiveUpdates).mockResolvedValue(history("retry-history-match"));
    jest.mocked(matchDetails).mockResolvedValue(fixture(subject));
    expect((await fetchCompetitivePerformanceBatch(credentials, [subject]))[subject].status).toBe("ready");
    expect(getCompetitiveUpdates).toHaveBeenCalledTimes(2);
  });

  it.each(["rejected", "null"] as const)("retries a settled %s detail without keeping a failed promise or private performance", async (failure) => {
    const subject = `retry-detail-${failure}`;
    jest.mocked(getCompetitiveUpdates).mockResolvedValue(history(`retry-detail-match-${failure}`));
    if (failure === "rejected") jest.mocked(matchDetails).mockRejectedValueOnce(new Error("temporary"));
    // Legacy/null transport receipts are outside the declared public response
    // type; exercise the helper's runtime boundary without introducing any.
    else jest.mocked(matchDetails).mockResolvedValueOnce(null as unknown as Awaited<ReturnType<typeof matchDetails>>);
    expect((await fetchCompetitivePerformanceBatch(credentials, [subject]))[subject].status).toBe("private");
    jest.mocked(matchDetails).mockResolvedValue(fixture(subject));
    expect((await fetchCompetitivePerformanceBatch(credentials, [subject]))[subject].status).toBe("ready");
    expect(matchDetails).toHaveBeenCalledTimes(2);
  });

  it("keeps ready performance and successful detail caches", async () => {
    const subject = "ready-cache-fixture";
    jest.mocked(getCompetitiveUpdates).mockResolvedValue(history("ready-cache-match"));
    jest.mocked(matchDetails).mockResolvedValue(fixture(subject));
    const ready = await fetchCompetitivePerformanceBatch(credentials, [subject]);
    expect(ready[subject].status).toBe("ready");
    jest.mocked(getCompetitiveUpdates).mockRejectedValue(new Error("must use cache"));
    expect(await fetchCompetitivePerformanceBatch(credentials, [subject])).toEqual(ready);
    expect(getCompetitiveUpdates).toHaveBeenCalledTimes(1);
    expect(matchDetails).toHaveBeenCalledTimes(1);
  });

  it("deduplicates a pending detail read across concurrent performance batches", async () => {
    const subject = "detail-dedup-fixture";
    jest.mocked(getCompetitiveUpdates).mockResolvedValue(history("detail-dedup-match"));
    let finish!: (value: MatchDetailsData) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const pending = new Promise<MatchDetailsData>((resolve) => { finish = resolve; });
    jest.mocked(matchDetails).mockImplementation(() => { markStarted(); return pending; });
    const first = fetchCompetitivePerformanceBatch(credentials, [subject]);
    const second = fetchCompetitivePerformanceBatch(credentials, [subject]);
    await started;
    expect(matchDetails).toHaveBeenCalledTimes(1);
    finish(fixture(subject));
    const [one, two] = await Promise.all([first, second]);
    expect(one[subject].status).toBe("ready");
    expect(two).toEqual(one);
  });
});
