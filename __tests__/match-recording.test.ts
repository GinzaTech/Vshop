import type { MatchHistoryRecord } from "~/types/match-ui";
import type { LeaderboardSeasonOption } from "~/utils/leaderboard-seasons";
import {
  createMatchRecordingRepository,
  filterRecordedMatches,
  filterRecordedSeasonOptions,
  getRecordedSeasonStartTime,
  isRecordingStartSeason,
  type MatchRecordingDriver,
} from "~/services/matches/match-recording-core";

const option = (
  id: string,
  startTime: string,
  isActive = false
): LeaderboardSeasonOption => ({ id, name: id, isActive, startTime });

const match = (id: string, GameStartTime: number): MatchHistoryRecord => ({
  MatchID: id,
  GameStartTime,
  QueueID: "competitive",
});

function createMemoryDriver(options: { delayFirstWrite?: boolean } = {}) {
  const values = new Map<string, string>();
  let releaseFirstWrite: (() => void) | null = null;
  let firstWriteStartedResolve: (() => void) | null = null;
  let writeCount = 0;
  const firstWriteStarted = new Promise<void>((resolve) => {
    firstWriteStartedResolve = resolve;
  });
  const driver: MatchRecordingDriver = {
    read: async (accountKey) => values.get(accountKey) ?? null,
    write: jest.fn(async (accountKey, payload) => {
      writeCount += 1;
      if (options.delayFirstWrite && writeCount === 1) {
        firstWriteStartedResolve?.();
        await new Promise<void>((resolve) => {
          releaseFirstWrite = resolve;
        });
      }
      values.set(accountKey, payload);
    }),
  };
  return {
    driver,
    firstWriteStarted,
    releaseFirstWrite: () => releaseFirstWrite?.(),
    values,
  };
}

describe("match recording baseline", () => {
  it("creates one normalized immutable baseline under concurrent ensure calls", async () => {
    const memory = createMemoryDriver({ delayFirstWrite: true });
    const repository = createMatchRecordingRepository(memory.driver);
    const first = repository.ensure(" AP|Account-A ", 1_000);
    const second = repository.ensure("ap|account-a", 2_000);

    await memory.firstWriteStarted;
    memory.releaseFirstWrite();
    const [left, right] = await Promise.all([first, second]);

    expect(left).toMatchObject({
      baseline: {
        accountKey: "ap|account-a",
        schemaVersion: 1,
        startedAt: 1_000,
        startSeasonId: null,
      },
      created: true,
    });
    expect(right).toMatchObject({
      baseline: { startedAt: 1_000 },
      created: false,
    });
    expect(memory.driver.write).toHaveBeenCalledTimes(1);
  });

  it("binds the first valid season once and isolates accounts", async () => {
    const repository = createMatchRecordingRepository(
      createMemoryDriver().driver
    );
    await repository.ensure("ap|account-a", 1_000);
    await repository.ensure("ap|account-b", 2_000);

    await repository.bindSeason("AP|ACCOUNT-A", " ACT-START ");
    await repository.bindSeason("ap|account-a", "act-replacement");

    await expect(repository.load("ap|account-a")).resolves.toMatchObject({
      startedAt: 1_000,
      startSeasonId: "act-start",
    });
    await expect(repository.load("ap|account-b")).resolves.toMatchObject({
      startedAt: 2_000,
      startSeasonId: null,
    });
  });

  it("fails closed for guest, invalid timestamps, malformed and cross-account payloads", async () => {
    const memory = createMemoryDriver();
    const repository = createMatchRecordingRepository(memory.driver);

    await expect(repository.ensure("guest", 1_000)).resolves.toBeNull();
    await expect(repository.ensure("ap|account-a", Number.NaN)).resolves.toBeNull();

    memory.values.set("ap|account-a", "not-json");
    await expect(repository.load("ap|account-a")).resolves.toBeNull();

    memory.values.set(
      "ap|account-a",
      JSON.stringify({
        accountKey: "ap|account-b",
        schemaVersion: 1,
        startedAt: 1_000,
        startSeasonId: null,
      })
    );
    await expect(repository.load("ap|account-a")).resolves.toBeNull();
  });

  it("keeps only matches at or after the baseline", () => {
    const baseline = {
      accountKey: "ap|account-a",
      schemaVersion: 1 as const,
      startedAt: 1_000,
      startSeasonId: "act-start",
    };

    expect(
      filterRecordedMatches(
        [match("before", 999), match("at", 1_000), match("after", 1_001)],
        baseline
      ).map(({ MatchID }) => MatchID)
    ).toEqual(["at", "after"]);
  });

  it("shows the baseline Act and every Act that starts later", () => {
    const baseline = {
      accountKey: "ap|account-a",
      schemaVersion: 1 as const,
      startedAt: Date.parse("2026-06-01T00:00:00Z"),
      startSeasonId: "act-start",
    };
    const seasons = [
      option("future", "2026-09-01T00:00:00Z", true),
      option("act-start", "2026-05-01T00:00:00Z"),
      option("legacy", "2026-02-01T00:00:00Z"),
    ];

    expect(
      filterRecordedSeasonOptions(seasons, baseline).map(({ id }) => id)
    ).toEqual(["future", "act-start"]);
    expect(isRecordingStartSeason(seasons[1], baseline)).toBe(true);
    expect(getRecordedSeasonStartTime(seasons[1], baseline)).toBe(
      baseline.startedAt
    );
    expect(getRecordedSeasonStartTime(seasons[0], baseline)).toBe(
      Date.parse(seasons[0].startTime)
    );
  });

  it("shows only the active/new options before the start season is bound", () => {
    const baseline = {
      accountKey: "ap|account-a",
      schemaVersion: 1 as const,
      startedAt: Date.parse("2026-06-01T00:00:00Z"),
      startSeasonId: null,
    };
    const seasons = [
      option("active", "2026-05-01T00:00:00Z", true),
      option("future", "2026-09-01T00:00:00Z"),
      option("legacy", "2026-02-01T00:00:00Z"),
    ];

    expect(
      filterRecordedSeasonOptions(seasons, baseline).map(({ id }) => id)
    ).toEqual(["active", "future"]);
    expect(isRecordingStartSeason(seasons[0], baseline)).toBe(true);
    expect(getRecordedSeasonStartTime(seasons[0], baseline)).toBe(
      baseline.startedAt
    );
  });
});
