import type {
  MatchHistoryRecord,
  MatchHistoryStats,
  SeasonPerformanceStats,
} from "~/types/match-ui";
import {
  createMatchArchiveRepository,
  type MatchArchiveDriver,
} from "~/services/matches/match-archive";

const stats = (
  seasonId: string,
  patch: Partial<MatchHistoryStats> = {}
): MatchHistoryStats => ({
  acs: 200,
  adr: 140,
  agentIcon: null,
  agentId: "agent-1",
  agentName: "Agent",
  agentPortrait: null,
  assists: 4,
  competitiveMovement: null,
  deaths: 10,
  gameMode: "competitive",
  headshotPct: "25%",
  headshotPercent: 25,
  kd: 1.5,
  kdRatio: "1.50",
  kda: "15/10/4",
  kills: 15,
  mapId: "map-1",
  mapImage: null,
  mapName: "Map",
  placement: 1,
  rankIcon: null,
  rankName: "Gold 1",
  rankTier: 10,
  result: "win",
  roundsLost: 10,
  roundsPlayed: 23,
  roundsWon: 13,
  rrAfkPenalty: null,
  rrAfter: 55,
  rrBefore: 35,
  rrEarned: 20,
  rrPerformanceBonus: null,
  score: 4_600,
  seasonId,
  won: true,
  ...patch,
});

const record = (
  matchId: string,
  seasonId = "act-1",
  withStats = true
): MatchHistoryRecord => ({
  GameStartTime: Number(matchId.replace(/\D/g, "")) || 1,
  MatchID: matchId,
  QueueID: "competitive",
  stats: withStats ? stats(seasonId) : undefined,
});

const seasonStats = (
  seasonId: string,
  completeness: "full" | "partial" | "rank-only" = "full",
  matchCount = 1,
  updatedAt = 100
): SeasonPerformanceStats => ({
  acs: completeness === "rank-only" ? null : 200,
  adr: completeness === "rank-only" ? null : 140,
  bodyshots: 20,
  calculationVersion: 12,
  cancelled: 0,
  damage: 3_220,
  dataCompleteness: completeness,
  deaths: 10,
  draws: 0,
  headshotPercent: completeness === "rank-only" ? null : 25,
  headshots: 10,
  kast: completeness === "rank-only" ? null : 75,
  kastRounds: 18,
  kastRoundsPlayed: 24,
  kd: completeness === "rank-only" ? null : 1.5,
  kills: 15,
  legshots: 10,
  losses: 0,
  matchCount,
  roundsPlayed: 23,
  score: 4_600,
  seasonId,
  seasonName: "Act 1",
  unknown: 0,
  updatedAt,
  winRate: 100,
  wins: matchCount,
});

function createMemoryDriver(options: { delayFirstWrite?: boolean } = {}) {
  const values = new Map<string, string>();
  let releaseFirstWrite: (() => void) | null = null;
  let writeCount = 0;
  let markFirstWriteStarted: (() => void) | null = null;
  const firstWriteStarted = new Promise<void>((resolve) => {
    markFirstWriteStarted = resolve;
  });
  const key = (accountKey: string, seasonId: string) =>
    `${accountKey.toLowerCase()}|${seasonId.toLowerCase()}`;
  const driver: MatchArchiveDriver = {
    read: async (accountKey, seasonId) =>
      values.get(key(accountKey, seasonId)) ?? null,
    write: async (accountKey, seasonId, payload) => {
      writeCount += 1;
      if (options.delayFirstWrite && writeCount === 1) {
        markFirstWriteStarted?.();
        await new Promise<void>((resolve) => {
          releaseFirstWrite = resolve;
        });
      }
      values.set(key(accountKey, seasonId), payload);
    },
  };
  return {
    driver,
    firstWriteStarted,
    getWriteCount: () => writeCount,
    releaseFirstWrite: () => releaseFirstWrite?.(),
    values,
  };
}

describe("durable match season archive", () => {
  it("isolates data by account and Act", async () => {
    const memory = createMemoryDriver();
    const archive = createMatchArchiveRepository(memory.driver);

    await archive.saveMatchSeasonArchive({
      accountKey: "AP|ACCOUNT-A",
      matches: [record("match-1")],
      seasonId: "ACT-1",
      seasonName: "Act 1",
      stats: seasonStats("ACT-1"),
      syncStatus: "complete",
      updatedAt: 100,
    });

    expect(
      await archive.loadMatchSeasonArchive("ap|account-a", "act-1")
    ).toMatchObject({ accountKey: "ap|account-a", seasonId: "act-1" });
    expect(
      await archive.loadMatchSeasonArchive("ap|account-b", "act-1")
    ).toBeNull();
    expect(
      await archive.loadMatchSeasonArchive("ap|account-a", "act-2")
    ).toBeNull();
  });

  it("deduplicates MatchID and keeps the richer incoming record", async () => {
    const archive = createMatchArchiveRepository(createMemoryDriver().driver);
    await archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [record("match-1", "act-1", false)],
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: null,
      syncStatus: "observed",
      updatedAt: 10,
    });
    await archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [record("match-1")],
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: seasonStats("act-1"),
      syncStatus: "complete",
      updatedAt: 20,
    });

    const saved = await archive.loadMatchSeasonArchive(
      "ap|account-a",
      "act-1"
    );
    expect(saved?.matches).toHaveLength(1);
    expect(saved?.matches[0].stats?.kills).toBe(15);
  });

  it("keeps existing match stats while accepting a later rank update", async () => {
    const archive = createMatchArchiveRepository(createMemoryDriver().driver);
    await archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [record("match-1")],
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: null,
      syncStatus: "observed",
      updatedAt: 10,
    });
    await archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [
        {
          ...record("match-1", "act-1", false),
          rankUpdate: { RankedRatingEarned: 17 },
        },
      ],
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: null,
      syncStatus: "observed",
      updatedAt: 20,
    });

    const saved = await archive.loadMatchSeasonArchive(
      "ap|account-a",
      "act-1"
    );
    expect(saved?.matches[0].stats?.kills).toBe(15);
    expect(saved?.matches[0].rankUpdate?.RankedRatingEarned).toBe(17);
  });

  it("keeps a descriptive season name when an observed batch only knows the season id", async () => {
    const archive = createMatchArchiveRepository(createMemoryDriver().driver);
    await archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [record("match-1")],
      seasonId: "act-1",
      seasonName: "V26 · ACT V",
      stats: seasonStats("act-1"),
      syncStatus: "complete",
      updatedAt: 10,
    });
    await archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [record("match-2")],
      seasonId: "act-1",
      seasonName: "act-1",
      stats: null,
      syncStatus: "observed",
      updatedAt: 20,
    });

    await expect(
      archive.loadMatchSeasonArchive("ap|account-a", "act-1")
    ).resolves.toMatchObject({ seasonName: "V26 · ACT V" });
  });

  it("does not downgrade a complete full snapshot with rank-only or partial data", async () => {
    const archive = createMatchArchiveRepository(createMemoryDriver().driver);
    await archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [record("match-1")],
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: seasonStats("act-1", "full", 10, 100),
      syncStatus: "complete",
      updatedAt: 100,
    });
    await archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [record("match-2")],
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: seasonStats("act-1", "rank-only", 20, 200),
      syncStatus: "rank-only",
      updatedAt: 200,
    });
    await archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [record("match-3")],
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: seasonStats("act-1", "partial", 30, 300),
      syncStatus: "partial",
      updatedAt: 300,
    });

    const saved = await archive.loadMatchSeasonArchive(
      "ap|account-a",
      "act-1"
    );
    expect(saved?.matches.map(({ MatchID }) => MatchID)).toEqual([
      "match-3",
      "match-2",
      "match-1",
    ]);
    expect(saved?.stats).toMatchObject({
      dataCompleteness: "full",
      matchCount: 10,
      updatedAt: 100,
    });
    expect(saved?.syncStatus).toBe("complete");
  });

  it("chooses equal-quality season snapshots by match count then freshness", async () => {
    const archive = createMatchArchiveRepository(createMemoryDriver().driver);
    const save = (matchCount: number, updatedAt: number) =>
      archive.saveMatchSeasonArchive({
        accountKey: "ap|account-a",
        matches: [],
        seasonId: "act-1",
        seasonName: "Act 1",
        stats: seasonStats("act-1", "full", matchCount, updatedAt),
        syncStatus: "complete",
        updatedAt,
      });

    await save(3, 100);
    await save(2, 200);
    expect(
      (await archive.loadMatchSeasonArchive("ap|account-a", "act-1"))
        ?.stats?.matchCount
    ).toBe(3);

    await save(4, 50);
    await save(4, 60);
    await expect(
      archive.loadMatchSeasonArchive("ap|account-a", "act-1")
    ).resolves.toMatchObject({ stats: { matchCount: 4, updatedAt: 60 } });
  });

  it("does not replace known non-empty rank totals with an empty retained-history result", async () => {
    const archive = createMatchArchiveRepository(createMemoryDriver().driver);
    await archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [],
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: seasonStats("act-1", "rank-only", 42, 100),
      syncStatus: "rank-only",
      updatedAt: 100,
    });
    await archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [],
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: seasonStats("act-1", "full", 0, 200),
      syncStatus: "complete",
      updatedAt: 200,
    });

    await expect(
      archive.loadMatchSeasonArchive("ap|account-a", "act-1")
    ).resolves.toMatchObject({
      stats: { dataCompleteness: "rank-only", matchCount: 42 },
      syncStatus: "rank-only",
    });
  });

  it("serializes concurrent writes so neither batch is lost", async () => {
    const memory = createMemoryDriver({ delayFirstWrite: true });
    const archive = createMatchArchiveRepository(memory.driver);
    const first = archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [record("match-1")],
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: null,
      syncStatus: "observed",
      updatedAt: 10,
    });
    const second = archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [record("match-2")],
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: null,
      syncStatus: "observed",
      updatedAt: 20,
    });

    await memory.firstWriteStarted;
    memory.releaseFirstWrite();
    await Promise.all([first, second]);

    expect(memory.getWriteCount()).toBe(2);
    await expect(
      archive.loadMatchSeasonArchive("ap|account-a", "act-1")
    ).resolves.toMatchObject({
      matches: [
        expect.objectContaining({ MatchID: "match-2" }),
        expect.objectContaining({ MatchID: "match-1" }),
      ],
    });
  });

  it("allows a later write after an earlier driver failure", async () => {
    const memory = createMemoryDriver();
    const originalWrite = memory.driver.write;
    let shouldFail = true;
    memory.driver.write = async (accountKey, seasonId, payload) => {
      if (shouldFail) {
        shouldFail = false;
        throw new Error("disk unavailable");
      }
      await originalWrite(accountKey, seasonId, payload);
    };
    const archive = createMatchArchiveRepository(memory.driver);
    const input = {
      accountKey: "ap|account-a",
      matches: [record("match-1")],
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: null,
      syncStatus: "observed" as const,
      updatedAt: 10,
    };

    await expect(archive.saveMatchSeasonArchive(input)).rejects.toThrow(
      "disk unavailable"
    );
    await expect(
      archive.saveMatchSeasonArchive({ ...input, updatedAt: 20 })
    ).resolves.toMatchObject({ seasonId: "act-1" });
  });

  it("rejects corrupt or cross-scope persisted payloads", async () => {
    const memory = createMemoryDriver();
    memory.values.set("ap|account-a|act-1", "not-json");
    const archive = createMatchArchiveRepository(memory.driver);
    expect(
      await archive.loadMatchSeasonArchive("ap|account-a", "act-1")
    ).toBeNull();

    memory.values.set(
      "ap|account-a|act-1",
      JSON.stringify({
        accountKey: "ap|account-b",
        matches: [],
        schemaVersion: 1,
        seasonId: "act-1",
        seasonName: "Act 1",
        stats: null,
        syncStatus: "observed",
        updatedAt: 1,
      })
    );
    expect(
      await archive.loadMatchSeasonArchive("ap|account-a", "act-1")
    ).toBeNull();
  });

  it("rejects a non-finite recording baseline marker on season stats", async () => {
    const archive = createMatchArchiveRepository(createMemoryDriver().driver);

    await archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches: [],
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: {
        ...seasonStats("act-1"),
        recordingStartedAt: Number.NaN,
      },
      syncStatus: "complete",
      updatedAt: 100,
    });

    await expect(
      archive.loadMatchSeasonArchive("ap|account-a", "act-1")
    ).resolves.toMatchObject({ stats: null });
  });

  it("groups observed competitive records by season and ignores unsafe inputs", async () => {
    const memory = createMemoryDriver();
    const archive = createMatchArchiveRepository(memory.driver);
    const malformedQueue = {
      ...record("malformed-queue", "act-1"),
      QueueID: undefined,
    } as unknown as MatchHistoryRecord;

    await expect(
      archive.archiveObservedMatches("ap|account-a", [
        record("match-1", "act-1"),
        record("match-2", "act-2"),
        { ...record("unrated", "act-1"), QueueID: "unrated" },
        record("no-stats", "act-1", false),
        malformedQueue,
      ])
    ).resolves.toHaveLength(2);
    await archive.archiveObservedMatches("guest", [record("guest-match")]);

    expect(
      (await archive.loadMatchSeasonArchive("ap|account-a", "act-1"))
        ?.matches
    ).toHaveLength(1);
    expect(
      (await archive.loadMatchSeasonArchive("ap|account-a", "act-2"))
        ?.matches
    ).toHaveLength(1);
    expect(memory.getWriteCount()).toBe(2);
  });

  it("bounds each Act archive while retaining the newest observed matches", async () => {
    const archive = createMatchArchiveRepository(createMemoryDriver().driver);
    const matches = Array.from({ length: 1_005 }, (_, index) =>
      record(`match-${index + 1}`)
    );

    await archive.saveMatchSeasonArchive({
      accountKey: "ap|account-a",
      matches,
      seasonId: "act-1",
      seasonName: "Act 1",
      stats: null,
      syncStatus: "observed",
      updatedAt: 100,
    });

    const saved = await archive.loadMatchSeasonArchive(
      "ap|account-a",
      "act-1"
    );
    expect(saved?.matches).toHaveLength(1_000);
    expect(saved?.matches[0].MatchID).toBe("match-1005");
    expect(saved?.matches.at(-1)?.MatchID).toBe("match-6");
  });
});
