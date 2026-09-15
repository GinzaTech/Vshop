describe("native match archive SQLite driver", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("initializes WAL storage and binds account/Act values as SQL parameters", async () => {
    let storedPayload: string | null = null;
    const execAsync = jest.fn<Promise<void>, [string]>(async () => undefined);
    const getFirstAsync = jest.fn<
      Promise<{ payload: string } | null>,
      [string, readonly unknown[]]
    >(async () => (storedPayload ? { payload: storedPayload } : null));
    const runAsync = jest.fn<
      Promise<void>,
      [string, readonly unknown[]]
    >(
      async (_statement: string, parameters: readonly unknown[]) => {
        storedPayload = String(parameters[4]);
      }
    );
    const openDatabaseAsync = jest.fn(async (_name: string) => ({
      execAsync,
      getFirstAsync,
      runAsync,
    }));
    jest.doMock("expo-sqlite", () => ({ openDatabaseAsync }));

    const archive = jest.requireActual<
      typeof import("~/services/matches/match-archive.native")
    >(
      "~/services/matches/match-archive.native"
    );
    await archive.saveMatchSeasonArchive({
      accountKey: "AP|' OR 1=1 --",
      matches: [],
      seasonId: "ACT-1",
      seasonName: "Act 1",
      stats: null,
      syncStatus: "observed",
      updatedAt: 100,
    });
    const restored = await archive.loadMatchSeasonArchive(
      "ap|' or 1=1 --",
      "act-1"
    );

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(execAsync.mock.calls[0][0]).toEqual(
      expect.stringContaining("PRAGMA journal_mode = WAL")
    );
    expect(execAsync.mock.calls[0][0]).toEqual(
      expect.stringContaining("PRIMARY KEY (account_key, season_id)")
    );
    expect(runAsync.mock.calls[0][0]).toEqual(
      expect.stringContaining("VALUES (?, ?, ?, ?, ?)")
    );
    expect(runAsync.mock.calls[0][1].slice(0, 3)).toEqual([
      "ap|' or 1=1 --",
      "act-1",
      archive.MATCH_ARCHIVE_SCHEMA_VERSION,
    ]);
    expect(getFirstAsync.mock.calls[0][0]).toEqual(
      expect.stringContaining("account_key = ? AND season_id = ?")
    );
    expect(getFirstAsync.mock.calls[0][1]).toEqual([
      "ap|' or 1=1 --",
      "act-1",
    ]);
    expect(restored).toMatchObject({
      accountKey: "ap|' or 1=1 --",
      seasonId: "act-1",
    });
  });
});
