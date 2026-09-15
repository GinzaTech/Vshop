import * as matchStore from "~/hooks/useMatchStore";
import type { MatchDetailsData, MatchHistoryRecord } from "~/types/match-ui";
import { defaultUser } from "~/utils/valorant-api";
import { invalidateSessionOperations } from "~/utils/session-operations";

let mockActiveUser = defaultUser;
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => ({ user: mockActiveUser }) } }));

jest.mock("~/utils/storage", () => ({
  appStorage: { getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock("~/utils/valorant-api", () => ({
  defaultUser: { id: "", region: "ap", accessToken: "", entitlementsToken: "" },
  matchDetails: jest.fn(), playerMatchHistory: jest.fn(),
  getCompetitiveUpdates: jest.fn(), getContent: jest.fn(),
}));
jest.mock("~/utils/valorant-assets", () => ({
  loadAssets: jest.fn(), loadAgent: jest.fn(),
}));
jest.mock("~/utils/match-ui", () => ({
  createMatchAssetCatalog: () => ({}),
  compactRankUpdate: (update: unknown) => update ?? null,
  enrichMatchHistoryAssets: (matches: unknown) => matches,
  buildMatchHistoryRecord: (record: MatchHistoryRecord, detail: MatchDetailsData | null) =>
    ({ ...record, stats: detail ? { kills: detail.players?.[0]?.stats?.kills ?? 1 } : null }),
}));
jest.mock("~/utils/network", () => ({
  getNetworkProfile: jest.fn(),
  mapWithConcurrency: async <T, R>(items: T[], _count: number, mapper: (item: T) => Promise<R>) => {
    const results: R[] = [];
    for (const item of items) results.push(await mapper(item));
    return results;
  },
}));

const api = jest.requireMock("~/utils/valorant-api") as {
  matchDetails: jest.Mock; playerMatchHistory: jest.Mock;
  getCompetitiveUpdates: jest.Mock; getContent: jest.Mock;
};
const assets = jest.requireMock("~/utils/valorant-assets") as {
  loadAssets: jest.Mock; loadAgent: jest.Mock;
};
const network = jest.requireMock("~/utils/network") as { getNetworkProfile: jest.Mock };
const { useMatchStore } = matchStore;
const user = { ...defaultUser, id: "account-a", accessToken: "old-access", entitlementsToken: "old-entitlements" };
const renewed = { ...user, accessToken: "new-access", entitlementsToken: "new-entitlements" };
const other = { ...user, id: "account-b" };
const record = (id: string): MatchHistoryRecord => ({ MatchID: id, GameStartTime: 10, QueueID: "competitive" });
const detail = (id: string, kills = 1) => ({
  matchInfo: { matchId: id, queueID: "competitive", seasonId: "act-1" },
  players: [{ subject: user.id, teamId: "Blue", stats: { kills, deaths: 1, score: 200, roundsPlayed: 1 } }],
  teams: [{ teamId: "Blue", won: true }], roundResults: [],
}) as unknown as MatchDetailsData;
const history = (id?: string) => ({ History: id ? [record(id)] : [], Total: id ? 1 : 0, EndIndex: id ? 1 : 0 });
const options = [{ id: "act-1", name: "Act 1", isActive: true, startTime: "2026-01-01" }];
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 12; i += 1) await Promise.resolve(); }
function seed(patch: Partial<ReturnType<typeof useMatchStore.getState>> = {}) {
  useMatchStore.setState({
    authKey: "ap|account-a", matches: [], detailsById: {}, loading: false,
    hydrating: false, error: null, lastUpdated: 0, totalMatches: 0, historyEndIndex: 0,
    seasonStats: null, seasonStatsById: {}, seasonMatchesById: {}, seasonOptions: options,
    seasonStatsLoading: false, ...patch,
  });
}

describe("match store request ownership", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockActiveUser = user;
    // Allows the pre-fix store to run behavioral regression tests before the new API exists.
    useMatchStore.getState().resetMatchCache?.();
    seed();
    api.matchDetails.mockImplementation(async (_access, _entitlements, _region, id) => detail(id));
    api.playerMatchHistory.mockResolvedValue(history());
    api.getCompetitiveUpdates.mockResolvedValue({ Matches: [] });
    api.getContent.mockResolvedValue({ Seasons: [] });
    assets.loadAssets.mockResolvedValue(undefined);
    assets.loadAgent.mockResolvedValue(undefined);
    network.getNetworkProfile.mockResolvedValue({ isConnected: true, isCellular: false, requestConcurrency: 2 });
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it("starts a new detail request after token renewal and discards the old response", async () => {
    const old = deferred<MatchDetailsData>();
    api.matchDetails.mockReturnValueOnce(old.promise).mockResolvedValueOnce(detail("detail-renew", 9));
    const pending = useMatchStore.getState().fetchMatchDetails(user, "detail-renew");
    mockActiveUser = renewed;
    const fresh = useMatchStore.getState().fetchMatchDetails(renewed, "detail-renew");
    const calls = api.matchDetails.mock.calls.length;
    old.resolve(detail("detail-renew", 2));
    await Promise.all([pending, fresh]);
    expect(calls).toBe(2);
    expect(await pending).toBeNull();
    expect(useMatchStore.getState().detailsById["detail-renew"].players[0].stats?.kills).toBe(9);
  });

  it("does not resurrect an account when a detail response arrives after logout", async () => {
    const old = deferred<MatchDetailsData>();
    api.matchDetails.mockReturnValueOnce(old.promise);
    const pending = useMatchStore.getState().fetchMatchDetails(user, "detail-logout");
    seed({ authKey: "guest" });
    mockActiveUser = defaultUser;
    old.resolve(detail("detail-logout"));
    await pending;
    expect(useMatchStore.getState().authKey).toBe("guest");
    expect(useMatchStore.getState().detailsById).toEqual({});
  });

  it("guards detail cache reads by account before returning a hit", async () => {
    seed({ detailsById: { shared: detail("private-a", 99) } });
    mockActiveUser = other;
    await useMatchStore.getState().fetchMatchDetails(other, "shared");
    expect(api.matchDetails).toHaveBeenCalledTimes(1);
    expect(useMatchStore.getState().authKey).toBe("ap|account-b");
  });

  it("does not let an old asset preload replace a newer account", async () => {
    const old = deferred<void>();
    assets.loadAssets.mockReturnValueOnce(old.promise);
    const pending = useMatchStore.getState().fetchMatches(user, true);
    mockActiveUser = other;
    await useMatchStore.getState().fetchMatches(other, true);
    old.resolve();
    await pending;
    expect(useMatchStore.getState().authKey).toBe("ap|account-b");
    expect(await pending).toBe(false);
  });

  it("starts a new full history request after token renewal", async () => {
    const old = deferred<ReturnType<typeof history>>();
    api.playerMatchHistory.mockImplementation((access: string) => access === user.accessToken ? old.promise : Promise.resolve(history("new-history")));
    const pending = useMatchStore.getState().fetchMatches(user, true);
    await flush();
    mockActiveUser = renewed;
    const fresh = useMatchStore.getState().fetchMatches(renewed, true);
    await flush();
    const calls = api.playerMatchHistory.mock.calls.length;
    old.resolve(history("old-history"));
    await Promise.all([pending, fresh]);
    expect(calls).toBe(4);
    expect(useMatchStore.getState().matches[0].MatchID).toBe("new-history");
  });

  it("does not join hydration using expired credentials", async () => {
    seed({ matches: [record("hydrate-renew")] });
    const old = deferred<MatchDetailsData>();
    api.matchDetails.mockReturnValueOnce(old.promise).mockResolvedValueOnce(detail("hydrate-renew", 9));
    const pending = useMatchStore.getState().hydrateNextMatches(user, 1);
    await flush();
    mockActiveUser = renewed;
    const fresh = useMatchStore.getState().hydrateNextMatches(renewed, 1);
    await flush();
    const calls = api.matchDetails.mock.calls.length;
    old.resolve(detail("hydrate-renew", 2));
    await Promise.all([pending, fresh]);
    expect(calls).toBe(2);
    expect(useMatchStore.getState().matches[0].stats?.kills).toBe(9);
  });

  it("starts a new season request after token renewal", async () => {
    const old = deferred<{ Matches: [] }>();
    api.getCompetitiveUpdates.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ Matches: [] });
    const pending = useMatchStore.getState().fetchSeasonStats(user, true);
    mockActiveUser = renewed;
    const fresh = useMatchStore.getState().fetchSeasonStats(renewed, true);
    const calls = api.getCompetitiveUpdates.mock.calls.length;
    old.resolve({ Matches: [] });
    await Promise.all([pending, fresh]);
    expect(calls).toBe(2);
    expect(useMatchStore.getState().seasonStatsLoading).toBe(false);
  });

  it("does not reuse a negative season result after credentials change", async () => {
    api.getCompetitiveUpdates.mockRejectedValueOnce(new Error("expired credentials"));
    await useMatchStore.getState().fetchSeasonStats(user, true);
    mockActiveUser = renewed;
    await useMatchStore.getState().fetchSeasonStats(renewed);
    expect(api.getCompetitiveUpdates).toHaveBeenCalledTimes(2);
    expect(useMatchStore.getState().seasonStats?.matchCount).toBe(0);
  });

  it("resets all data and pending detail bookkeeping before a same-account restart", async () => {
    const old = deferred<MatchDetailsData>();
    api.matchDetails.mockReturnValueOnce(old.promise).mockResolvedValueOnce(detail("reset-detail", 9));
    const pending = useMatchStore.getState().fetchMatchDetails(user, "reset-detail");
    useMatchStore.getState().resetMatchCache();
    expect(useMatchStore.getState()).toMatchObject({ authKey: "guest", detailsById: {}, seasonOptions: [], seasonStatsById: {}, seasonMatchesById: {} });
    const fresh = useMatchStore.getState().fetchMatchDetails(user, "reset-detail");
    old.resolve(detail("reset-detail", 2));
    await Promise.all([pending, fresh]);
    expect(await pending).toBeNull();
    expect(useMatchStore.getState().detailsById["reset-detail"].players[0].stats?.kills).toBe(9);
  });

  it("invalidates history requests waiting for assets during reset", async () => {
    const old = deferred<void>();
    assets.loadAssets.mockReturnValueOnce(old.promise);
    const pending = useMatchStore.getState().fetchMatches(user, true);
    useMatchStore.getState().resetMatchCache();
    old.resolve();
    expect(await pending).toBe(false);
    expect(api.playerMatchHistory).not.toHaveBeenCalled();
    expect(useMatchStore.getState().authKey).toBe("guest");
  });

  it("restores data without loading flags and invalidates both source and target requests", async () => {
    seed({ matches: [record("saved-a")], loading: true, hydrating: true, seasonStatsLoading: true });
    const snapshot = matchStore.captureMatchCache();
    expect(snapshot).not.toHaveProperty("loading");
    expect(snapshot).not.toHaveProperty("hydrating");
    expect(snapshot).not.toHaveProperty("seasonStatsLoading");
    const old = deferred<MatchDetailsData>();
    api.matchDetails.mockReturnValueOnce(old.promise);
    mockActiveUser = other;
    const pending = useMatchStore.getState().fetchMatchDetails(other, "target-detail");
    mockActiveUser = user;
    matchStore.restoreMatchCache(snapshot);
    old.resolve(detail("target-detail"));
    await pending;
    expect(useMatchStore.getState()).toMatchObject({ authKey: "ap|account-a", matches: [record("saved-a")], detailsById: {}, loading: false, hydrating: false, seasonStatsLoading: false });
  });

  it("rejects missing identities and credentials without touching caches", async () => {
    const invalid = { ...user, id: "" };
    expect(await useMatchStore.getState().fetchMatchDetails(invalid, "invalid")).toBeNull();
    expect(await useMatchStore.getState().fetchMatches(invalid)).toBe(false);
    await useMatchStore.getState().fetchSeasonStats(invalid);
    await useMatchStore.getState().hydrateNextMatches(invalid);
    expect(api.matchDetails).not.toHaveBeenCalled();
    expect(api.playerMatchHistory).not.toHaveBeenCalled();
  });

  it("rejects late calls from the previous account including cache hits", async () => {
    mockActiveUser = other;
    seed({ authKey: "ap|account-b", matches: [record("owned-b")], detailsById: { shared: detail("owned-b") }, lastUpdated: Date.now() });
    expect(await useMatchStore.getState().fetchMatchDetails(user, "shared")).toBeNull();
    expect(await useMatchStore.getState().fetchMatches(user)).toBe(false);
    await useMatchStore.getState().fetchSeasonStats(user);
    await useMatchStore.getState().hydrateNextMatches(user);
    expect(api.matchDetails).not.toHaveBeenCalled();
    expect(api.playerMatchHistory).not.toHaveBeenCalled();
    expect(api.getCompetitiveUpdates).not.toHaveBeenCalled();
    expect(useMatchStore.getState().authKey).toBe("ap|account-b");
  });

  it("rejects late calls with obsolete tokens without flipping request ownership back", async () => {
    mockActiveUser = renewed;
    await useMatchStore.getState().fetchMatchDetails(renewed, "fresh-owner");
    expect(await useMatchStore.getState().fetchMatchDetails(user, "fresh-owner", true)).toBeNull();
    expect(api.matchDetails).toHaveBeenCalledTimes(1);
  });

  it.each(["accessToken", "entitlementsToken", "generation"])("starts an independent request after only %s changes", async (change) => {
    const old = deferred<MatchDetailsData>();
    api.matchDetails.mockReturnValueOnce(old.promise).mockResolvedValueOnce(detail("single-change", 9));
    const first = useMatchStore.getState().fetchMatchDetails(user, "single-change");
    if (change === "generation") invalidateSessionOperations();
    else mockActiveUser = { ...user, [change]: "renewed-credential" };
    const second = useMatchStore.getState().fetchMatchDetails(mockActiveUser, "single-change");
    old.resolve(detail("single-change", 2));
    await Promise.all([first, second]);
    expect(api.matchDetails).toHaveBeenCalledTimes(2);
    expect(await first).toBeNull();
    expect(useMatchStore.getState().detailsById["single-change"].players[0].stats?.kills).toBe(9);
  });

  it.each(["account", "credentials", "session-generation", "logout"])("invalidates pending details after live %s changes without a replacement request", async (change) => {
    const waiting = deferred<MatchDetailsData>();
    api.matchDetails.mockReturnValueOnce(waiting.promise);
    const pending = useMatchStore.getState().fetchMatchDetails(user, "pending-live");
    if (change === "account") mockActiveUser = other;
    if (change === "credentials") mockActiveUser = renewed;
    if (change === "logout") mockActiveUser = defaultUser;
    if (change === "session-generation") invalidateSessionOperations();
    waiting.resolve(detail("pending-live"));
    expect(await pending).toBeNull();
    expect(useMatchStore.getState().detailsById).toEqual({});
  });

  it("deduplicates unchanged credentials and preserves LRU when merging details", async () => {
    const waiting = deferred<MatchDetailsData>();
    api.matchDetails.mockReturnValueOnce(waiting.promise);
    const first = useMatchStore.getState().fetchMatchDetails(user, "keep");
    const joined = useMatchStore.getState().fetchMatchDetails(user, "keep");
    waiting.resolve(detail("keep"));
    await Promise.all([first, joined]);
    expect(api.matchDetails).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 9; i += 1) await useMatchStore.getState().fetchMatchDetails(user, `lru-${i}`);
    useMatchStore.getState().mergeMatchDetails("keep", { playerIdentities: [{ subject: user.id }] });
    await useMatchStore.getState().fetchMatchDetails(user, "overflow");
    expect(Object.keys(useMatchStore.getState().detailsById)).toHaveLength(10);
    expect(useMatchStore.getState().detailsById["lru-0"]).toBeUndefined();
    useMatchStore.getState().mergeMatchDetails("lru-0", { playerIdentities: [] });
    expect(useMatchStore.getState().detailsById["lru-0"]).toBeUndefined();
    const cached = await useMatchStore.getState().fetchMatchDetails(user, "keep");
    expect(cached?.playerIdentities).toEqual([{ subject: user.id }]);
    expect(api.matchDetails).toHaveBeenCalledTimes(11);
  });

  it("retries transient detail failures but stops retrying immediately after reset", async () => {
    jest.useFakeTimers();
    api.matchDetails.mockRejectedValueOnce({ response: { status: 500 } });
    const recovered = useMatchStore.getState().fetchMatchDetails(user, "retry");
    await jest.runAllTimersAsync();
    expect(await recovered).not.toBeNull();
    api.matchDetails.mockRejectedValueOnce({ response: { status: 429 } });
    const pending = useMatchStore.getState().fetchMatchDetails(user, "retry-reset");
    await flush();
    useMatchStore.getState().resetMatchCache();
    await jest.runAllTimersAsync();
    expect(await pending).toBeNull();
    expect(api.matchDetails).toHaveBeenCalledTimes(3);
  });

  it("does not retry forbidden detail responses", async () => {
    api.matchDetails.mockRejectedValueOnce({ response: { status: 403 } });
    expect(await useMatchStore.getState().fetchMatchDetails(user, "forbidden")).toBeNull();
    expect(api.matchDetails).toHaveBeenCalledTimes(1);
  });

  it("redacts upstream credentials from all action error logs", async () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const secret = Object.assign(new Error("unsafe-private-access-value"), {
      response: { status: 403, config: { headers: { Authorization: "unsafe-private-access-value" } } },
    });
    api.matchDetails.mockRejectedValue(secret);
    await useMatchStore.getState().fetchMatchDetails(user, "private-match-id");
    api.getCompetitiveUpdates.mockRejectedValue(secret);
    await useMatchStore.getState().fetchSeasonStats(user, true);
    api.playerMatchHistory.mockRejectedValue(secret);
    await useMatchStore.getState().fetchMatches(user, true);
    expect(JSON.stringify([warning.mock.calls, errorLog.mock.calls])).not.toContain("unsafe-private-access-value");
    expect(warning.mock.calls.some((call) => call.some((arg) => arg === secret))).toBe(false);
  });

  it("uses fresh history while reloading asset metadata", async () => {
    seed({ matches: [record("cached")], lastUpdated: Date.now() });
    expect(await useMatchStore.getState().fetchMatches(user)).toBe(true);
    expect(assets.loadAssets).toHaveBeenCalledTimes(1);
    expect(api.playerMatchHistory).not.toHaveBeenCalled();
  });

  it("delta sync retries unavailable records and keeps a unique descending history", async () => {
    seed({ matches: [{ ...record("retry-old"), stats: null }, record("keep-old")] });
    api.playerMatchHistory.mockResolvedValue({ History: [record("retry-old"), { ...record("brand-new"), GameStartTime: 20 }], Total: 9 });
    api.getCompetitiveUpdates.mockResolvedValue({ Matches: [{ MatchID: "keep-old", RankedRatingEarned: 10 }] });
    expect(await useMatchStore.getState().fetchMatches(user)).toBe(true);
    expect(useMatchStore.getState().matches.map((item) => item.MatchID)).toEqual(["brand-new", "retry-old", "keep-old"]);
    expect(useMatchStore.getState().matches[1].stats).not.toBeNull();
    expect(useMatchStore.getState().totalMatches).toBe(9);
  });

  it("does not mark a failed delta fresh or erase the displayed history", async () => {
    seed({ matches: [record("cached-failure")] });
    api.playerMatchHistory.mockRejectedValueOnce(new Error("offline"));
    expect(await useMatchStore.getState().fetchMatches(user)).toBe(false);
    expect(useMatchStore.getState().lastUpdated).toBe(0);
    expect(useMatchStore.getState().matches).toEqual([record("cached-failure")]);
  });

  it("joins delta requests and refreshes the timestamp when no new matches exist", async () => {
    seed({ matches: [record("known")] });
    const waiting = deferred<ReturnType<typeof history>>();
    api.playerMatchHistory.mockReturnValueOnce(waiting.promise);
    const first = useMatchStore.getState().fetchMatches(user);
    const joined = useMatchStore.getState().fetchMatches(user);
    await flush();
    waiting.resolve(history("known"));
    await Promise.all([first, joined]);
    expect(api.playerMatchHistory).toHaveBeenCalledTimes(1);
    expect(useMatchStore.getState().lastUpdated).toBeGreaterThan(0);
  });

  it("starts exactly one full fetch after concurrent force callers wait for delta", async () => {
    seed({ matches: [record("known")] });
    const waiting = deferred<ReturnType<typeof history>>();
    api.playerMatchHistory.mockReturnValueOnce(waiting.promise);
    const delta = useMatchStore.getState().fetchMatches(user);
    await flush();
    const full = useMatchStore.getState().fetchMatches(user, true);
    const joined = useMatchStore.getState().fetchMatches(user, true);
    await flush();
    waiting.resolve(history("known"));
    await Promise.all([delta, full, joined]);
    expect(api.playerMatchHistory).toHaveBeenCalledTimes(3);
    expect(useMatchStore.getState().loading).toBe(false);
  });

  it("reset while force waits for delta prevents starting a replacement full request", async () => {
    seed({ matches: [record("known")] });
    const waiting = deferred<ReturnType<typeof history>>();
    api.playerMatchHistory.mockReturnValueOnce(waiting.promise);
    const delta = useMatchStore.getState().fetchMatches(user);
    await flush();
    const full = useMatchStore.getState().fetchMatches(user, true);
    await flush();
    useMatchStore.getState().resetMatchCache();
    waiting.resolve(history("known"));
    expect(await delta).toBe(false);
    expect(await full).toBe(false);
    expect(api.playerMatchHistory).toHaveBeenCalledTimes(1);
  });

  it("handles a full history outage while preserving displayed data", async () => {
    seed({ matches: [record("cached-offline")] });
    assets.loadAssets.mockRejectedValueOnce(new Error("asset offline"));
    api.playerMatchHistory.mockRejectedValue(new Error("history offline"));
    expect(await useMatchStore.getState().fetchMatches(user, true)).toBe(false);
    expect(useMatchStore.getState()).toMatchObject({ matches: [record("cached-offline")], loading: false, error: "Could not load match data." });
  });

  it("does not overwrite a restored same-account snapshot with an in-flight history response", async () => {
    seed({ matches: [record("snapshot")] });
    const snapshot = matchStore.captureMatchCache();
    const waiting = deferred<ReturnType<typeof history>>();
    api.playerMatchHistory.mockReturnValue(waiting.promise);
    const pending = useMatchStore.getState().fetchMatches(user, true);
    await flush();
    matchStore.restoreMatchCache(snapshot);
    waiting.resolve(history("stale"));
    expect(await pending).toBe(false);
    expect(useMatchStore.getState().matches).toEqual([record("snapshot")]);
  });

  it("hydrates a next page without duplicate records and merges competitive updates", async () => {
    seed({ matches: [{ ...record("page-known"), stats: null }], historyEndIndex: 1, totalMatches: 3 });
    api.playerMatchHistory.mockResolvedValue({ History: [record("page-known"), record("page-new")], EndIndex: 3, Total: 3 });
    api.getCompetitiveUpdates.mockResolvedValue({ Matches: [{ MatchID: "page-new", RankedRatingEarned: 15 }] });
    await useMatchStore.getState().hydrateNextMatches(user, 1);
    expect(useMatchStore.getState().matches.map((item) => item.MatchID)).toEqual(["page-known", "page-new"]);
    expect(useMatchStore.getState().matches[1]).toMatchObject({ stats: { kills: 1 }, rankUpdate: { RankedRatingEarned: 15 } });
    expect(useMatchStore.getState()).toMatchObject({ hydrating: false, historyEndIndex: 3 });
  });

  it("stops pagination at the last page and handles failed pagination", async () => {
    await useMatchStore.getState().hydrateNextMatches(user);
    expect(api.playerMatchHistory).not.toHaveBeenCalled();
    seed({ historyEndIndex: 1, totalMatches: 3 });
    api.playerMatchHistory.mockRejectedValueOnce(new Error("page offline"));
    await useMatchStore.getState().hydrateNextMatches(user);
    expect(useMatchStore.getState().hydrating).toBe(false);
  });

  it("does not let a reset hydration page mutate the new session", async () => {
    seed({ historyEndIndex: 1, totalMatches: 3 });
    const waiting = deferred<ReturnType<typeof history>>();
    api.playerMatchHistory.mockReturnValueOnce(waiting.promise);
    const pending = useMatchStore.getState().hydrateNextMatches(user);
    await flush();
    useMatchStore.getState().resetMatchCache();
    waiting.resolve(history("stale-page"));
    await pending;
    expect(useMatchStore.getState()).toMatchObject({ authKey: "guest", matches: [], hydrating: false });
  });

  it("handles unavailable network metadata during hydration", async () => {
    network.getNetworkProfile.mockRejectedValueOnce(new Error("network metadata unavailable"));
    await expect(useMatchStore.getState().hydrateNextMatches(user)).resolves.toBeUndefined();
    expect(useMatchStore.getState().hydrating).toBe(false);
  });

  it("retries seasons after failure TTL, while force bypasses the negative cache", async () => {
    jest.useFakeTimers();
    api.getCompetitiveUpdates.mockRejectedValue(new Error("offline"));
    await useMatchStore.getState().fetchSeasonStats(user, true);
    await useMatchStore.getState().fetchSeasonStats(user);
    expect(api.getCompetitiveUpdates).toHaveBeenCalledTimes(1);
    await useMatchStore.getState().fetchSeasonStats(user, true);
    expect(api.getCompetitiveUpdates).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(15 * 60 * 1000 + 1);
    api.getCompetitiveUpdates.mockResolvedValue({ Matches: [] });
    await useMatchStore.getState().fetchSeasonStats(user);
    expect(api.getCompetitiveUpdates).toHaveBeenCalledTimes(3);
  });

  it("keeps concurrent historical seasons separate and does not clear the active spinner early", async () => {
    seed({ seasonOptions: [...options, { ...options[0], id: "act-old", isActive: false }] });
    const active = deferred<{ Matches: [] }>();
    api.getCompetitiveUpdates.mockReturnValueOnce(active.promise);
    const pending = useMatchStore.getState().fetchSeasonStats(user, true);
    await useMatchStore.getState().fetchSeasonStats(user, true, "act-old");
    expect(useMatchStore.getState().seasonStatsLoading).toBe(true);
    expect(useMatchStore.getState().seasonStats).toBeNull();
    active.resolve({ Matches: [] });
    await pending;
    expect(Object.keys(useMatchStore.getState().seasonStatsById)).toEqual(["act-old", "act-1"]);
    expect(useMatchStore.getState().seasonStats?.seasonId).toBe("act-1");
    expect(useMatchStore.getState().seasonStatsLoading).toBe(false);
    await useMatchStore.getState().fetchSeasonStats(user);
    expect(api.getCompetitiveUpdates).toHaveBeenCalledTimes(2);
  });

  it("does not apply old negative results or clear a new season spinner after reset", async () => {
    const old = deferred<{ Matches: [] }>();
    const current = deferred<{ Matches: [] }>();
    api.getCompetitiveUpdates.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const first = useMatchStore.getState().fetchSeasonStats(user, true);
    useMatchStore.getState().resetMatchCache();
    seed();
    const next = useMatchStore.getState().fetchSeasonStats(user, true);
    old.reject(new Error("obsolete failure"));
    await first;
    expect(useMatchStore.getState().seasonStatsLoading).toBe(true);
    current.resolve({ Matches: [] });
    await next;
    await useMatchStore.getState().fetchSeasonStats(user, true);
    expect(api.getCompetitiveUpdates).toHaveBeenCalledTimes(3);
  });

  it("loads season options, crawls details and produces act-specific history", async () => {
    jest.useFakeTimers();
    seed({ seasonOptions: [] });
    api.getContent.mockResolvedValue({ Seasons: [{ ID: "act-1", Name: "Act 1", Type: "act", IsActive: true, StartTime: "2026-01-01", EndTime: "2027-01-01" }] });
    api.getCompetitiveUpdates.mockResolvedValue({ Matches: [{ MatchID: "season-match", SeasonID: "act-1", MatchStartTime: 10 }] });
    const pending = useMatchStore.getState().fetchSeasonStats(user, true);
    await jest.runAllTimersAsync();
    await pending;
    expect(useMatchStore.getState().seasonStats).toMatchObject({ matchCount: 1, wins: 1 });
    expect(useMatchStore.getState().seasonMatchesById["act-1"][0].MatchID).toBe("season-match");
    expect(api.getContent).toHaveBeenCalledTimes(1);
  });

  it("discovers a requested historical Act while the active Act is still loading", async () => {
    const active = deferred<{ Matches: [] }>();
    api.getCompetitiveUpdates.mockReturnValueOnce(active.promise);
    api.getContent.mockResolvedValue({ Seasons: [
      { ID: "act-1", Name: "Act 1", Type: "act", IsActive: true, StartTime: "2026-01-01", EndTime: "2027-01-01" },
      { ID: "act-old", Name: "Old", Type: "act", IsActive: false, StartTime: "2025-01-01", EndTime: "2026-01-01" },
    ] });
    const first = useMatchStore.getState().fetchSeasonStats(user, true);
    const historical = useMatchStore.getState().fetchSeasonStats(user, true, "act-old");
    await flush();
    const calls = api.getContent.mock.calls.length;
    active.resolve({ Matches: [] });
    await Promise.all([first, historical]);
    expect(calls).toBe(1);
    expect(useMatchStore.getState().seasonStatsById["act-old"]).toBeDefined();
  });

  it("walks past newer Acts and stops once the selected Act ends", async () => {
    jest.useFakeTimers();
    seed({ seasonOptions: [...options, { ...options[0], id: "act-old", isActive: false }] });
    api.getCompetitiveUpdates
      .mockResolvedValueOnce({ Matches: Array.from({ length: 20 }, (_, i) => ({ MatchID: `recent-${i}`, SeasonID: "act-1", MatchStartTime: 10 })) })
      .mockResolvedValueOnce({ Matches: [{ MatchID: "historical", SeasonID: "act-old", MatchStartTime: "2025-02-01" }, { MatchID: "older", SeasonID: "older", MatchStartTime: 1 }] });
    api.matchDetails.mockResolvedValue({ ...detail("historical"), matchInfo: { ...detail("historical").matchInfo, seasonId: "act-old" } });
    const pending = useMatchStore.getState().fetchSeasonStats(user, true, "act-old");
    await jest.runAllTimersAsync();
    await pending;
    expect(api.getCompetitiveUpdates.mock.calls.map((call) => call[4].startIndex)).toEqual([0, 20]);
    expect(useMatchStore.getState().seasonStats).toBeNull();
    expect(useMatchStore.getState().seasonStatsById["act-old"]).toMatchObject({ matchCount: 1 });
    expect(useMatchStore.getState().seasonMatchesById["act-old"][0].GameStartTime).toBe(Date.parse("2025-02-01"));
  });

  it.each([true, false])("handles season detail failures while preserving usable partial data: partial=%s", async (partial) => {
    jest.useFakeTimers();
    const ids = partial ? ["missing", "available"] : ["missing"];
    api.getCompetitiveUpdates.mockResolvedValue({ Matches: ids.map((MatchID) => ({ MatchID, SeasonID: "act-1", MatchStartTime: "invalid" })) });
    api.matchDetails.mockImplementation(async (_a, _e, _r, id) => {
      if (id === "missing") throw { response: { status: 403 } };
      return detail(id);
    });
    const pending = useMatchStore.getState().fetchSeasonStats(user, true);
    await jest.runAllTimersAsync();
    await pending;
    expect(api.matchDetails).toHaveBeenCalledTimes(partial ? 5 : 4);
    expect(useMatchStore.getState().seasonStatsLoading).toBe(false);
    if (partial) {
      expect(useMatchStore.getState().seasonStats?.matchCount).toBe(1);
      expect(useMatchStore.getState().seasonMatchesById["act-1"][0].GameStartTime).toBe(0);
    } else {
      expect(useMatchStore.getState().seasonStats).toBeNull();
      await useMatchStore.getState().fetchSeasonStats(user);
      expect(api.getCompetitiveUpdates).toHaveBeenCalledTimes(1);
    }
  });

  it("handles missing season metadata and unavailable competitive updates", async () => {
    seed({ seasonOptions: [] });
    await useMatchStore.getState().fetchSeasonStats(user, true);
    expect(useMatchStore.getState().seasonStatsLoading).toBe(false);
    expect(api.getCompetitiveUpdates).not.toHaveBeenCalled();
    seed();
    api.getCompetitiveUpdates.mockResolvedValueOnce(null);
    await useMatchStore.getState().fetchSeasonStats(user, true);
    expect(useMatchStore.getState().seasonStats).toBeNull();
    expect(useMatchStore.getState().seasonStatsLoading).toBe(false);
  });

  it("deduplicates hydration and full history without changing request kind", async () => {
    seed({ matches: [record("same-hydration")] });
    const waiting = deferred<MatchDetailsData>();
    api.matchDetails.mockReturnValueOnce(waiting.promise);
    const first = useMatchStore.getState().hydrateNextMatches(user);
    const joined = useMatchStore.getState().hydrateNextMatches(user);
    await flush();
    waiting.resolve(detail("same-hydration"));
    await Promise.all([first, joined]);
    expect(api.matchDetails).toHaveBeenCalledTimes(1);
    const page = deferred<ReturnType<typeof history>>();
    api.playerMatchHistory.mockReturnValue(page.promise);
    const full = useMatchStore.getState().fetchMatches(user, true);
    const fullJoin = useMatchStore.getState().fetchMatches(user, true);
    await flush();
    page.resolve(history());
    await Promise.all([full, fullJoin]);
    expect(api.playerMatchHistory).toHaveBeenCalledTimes(2);
  });

  it("preserves display data during malformed pagination and unavailable network", async () => {
    seed({ historyEndIndex: 1, totalMatches: 3 });
    api.playerMatchHistory.mockResolvedValueOnce({ History: [], EndIndex: "invalid", Total: "invalid" });
    api.getCompetitiveUpdates.mockRejectedValueOnce(new Error("updates unavailable"));
    await useMatchStore.getState().hydrateNextMatches(user);
    expect(useMatchStore.getState().historyEndIndex).toBe(3);
    network.getNetworkProfile.mockResolvedValueOnce({ isConnected: false });
    await useMatchStore.getState().hydrateNextMatches(user);
    expect(useMatchStore.getState().hydrating).toBe(false);
  });

  it("finishes history loading when network metadata throws after history arrived", async () => {
    api.playerMatchHistory.mockResolvedValue(history("network-failure"));
    network.getNetworkProfile.mockRejectedValueOnce(new Error("network unavailable"));
    expect(await useMatchStore.getState().fetchMatches(user, true)).toBe(false);
    expect(useMatchStore.getState()).toMatchObject({ loading: false, error: "Could not load match data." });
    expect(useMatchStore.getState().matches[0].MatchID).toBe("network-failure");
  });

  it("stops a season crawl and further detail retries when reset during its delay", async () => {
    jest.useFakeTimers();
    api.getCompetitiveUpdates.mockResolvedValue({ Matches: ["one", "two"].map((MatchID) => ({ MatchID, SeasonID: "act-1", MatchStartTime: 10 })) });
    const pending = useMatchStore.getState().fetchSeasonStats(user, true);
    await flush();
    useMatchStore.getState().resetMatchCache();
    await jest.runAllTimersAsync();
    await pending;
    expect(api.matchDetails).toHaveBeenCalledTimes(1);
    expect(useMatchStore.getState()).toMatchObject({ authKey: "guest", seasonStats: null, seasonStatsById: {} });
  });

  it("keeps the v6 persisted shape and caps persisted history at 200 records", () => {
    const persisted = useMatchStore.persist.getOptions();
    const data = Array.from({ length: 220 }, (_, i) => record(`persist-${i}`));
    seed({ matches: data, detailsById: { private: detail("private") }, loading: true });
    const state = persisted.partialize?.(useMatchStore.getState());
    expect(state).toHaveProperty("matches", data.slice(0, 200));
    expect(state).not.toHaveProperty("detailsById");
    expect(state).not.toHaveProperty("loading");
    expect(persisted.version).toBe(6);
    expect(persisted.name).toBe("match-history-cache");
    expect(persisted.migrate?.({ authKey: "ap|account-a", matches: data }, 5)).toMatchObject({ matches: [], lastUpdated: 0, seasonStats: null });
    expect(persisted.migrate?.({ authKey: "ap|account-a", matches: data }, 6)).toMatchObject({ matches: data, totalMatches: 220, historyEndIndex: 220 });
  });
});
