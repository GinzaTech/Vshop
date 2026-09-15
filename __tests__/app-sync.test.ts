import {
  beginFullSync,
  endFullSync,
  getLastSync,
  isFullSyncInFlight,
  refreshMatches,
  refreshShopAndBalances,
  clearSyncTracking,
  markSynced,
  fullBackgroundSync,
  shouldSkipFullSync,
  isStale,
  SYNC_TTL,
} from "~/utils/app-sync";
import { invalidateSessionOperations } from "~/utils/session-operations";

const mockGetShop = jest.fn();
const mockGetProgress = jest.fn();
const mockGetBalances = jest.fn();
const mockParseShop = jest.fn();
const mockFetchMatches = jest.fn();

const makeUser = (accessToken: string) => ({
  id: "account-a",
  region: "ap",
  accessToken,
  entitlementsToken: `entitlements-${accessToken}`,
  shops: { bundles: [], main: [], accessory: [], nightMarket: [] },
  progress: {},
  balances: { vp: 0, rad: 0, kc: 0 },
});

const mockUserState = {
  user: makeUser("token-a"),
  setUser: jest.fn(),
};

jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: { getState: () => mockUserState },
}));
jest.mock("~/hooks/useMatchStore", () => ({
  useMatchStore: { getState: () => ({ fetchMatches: mockFetchMatches }) },
}));
jest.mock("~/utils/network", () => ({
  getNetworkProfile: async () => ({ isCellular: false }),
}));
jest.mock("~/utils/saved-accounts", () => ({
  getAccountSessionKey: (user: { id?: string; region?: string }) =>
    user.id ? `${user.region}|${user.id}`.toLowerCase() : "guest",
}));
jest.mock("~/utils/valorant-api", () => ({
  getShop: (...args: unknown[]) => mockGetShop(...args),
  getProgress: (...args: unknown[]) => mockGetProgress(...args),
  getBalances: (...args: unknown[]) => mockGetBalances(...args),
  parseShop: (...args: unknown[]) => mockParseShop(...args),
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("background synchronization ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSyncTracking();
    mockUserState.user = makeUser("token-a");
    mockUserState.setUser.mockImplementation((user) => {
      mockUserState.user = user;
    });
    mockGetShop.mockResolvedValue({});
    mockGetProgress.mockResolvedValue({});
    mockGetBalances.mockResolvedValue({ vp: 1, rad: 2, kc: 3 });
    mockParseShop.mockResolvedValue({
      bundles: [],
      main: [],
      accessory: [],
      nightMarket: [],
    });
    mockFetchMatches.mockResolvedValue(true);
  });

  it.each(["entitlements", "generation"])("does not publish background data after %s changed", async (changed) => {
    const pendingShop = deferred<object>();
    const pendingMatches = deferred<boolean>();
    mockGetShop.mockReturnValueOnce(pendingShop.promise);
    mockFetchMatches.mockReturnValueOnce(pendingMatches.promise);
    const shop = refreshShopAndBalances(true);
    const matches = refreshMatches(true);
    if (changed === "entitlements") mockUserState.user = { ...mockUserState.user, entitlementsToken: "rotated-only" };
    else invalidateSessionOperations();
    pendingShop.resolve({});
    pendingMatches.resolve(true);
    await Promise.all([shop, matches]);
    expect(mockUserState.setUser).not.toHaveBeenCalled();
    expect(getLastSync("shop")).toBe(0);
    expect(getLastSync("matches")).toBe(0);
  });

  it("deduplicates concurrent shop requests, preserves live user fields, then honors TTL", async () => {
    const pendingShop = deferred<object>();
    mockGetShop.mockReturnValueOnce(pendingShop.promise);
    const first = refreshShopAndBalances();
    const second = refreshShopAndBalances();
    mockUserState.user = { ...mockUserState.user, progress: { edited: true } };
    pendingShop.resolve({});
    await Promise.all([first, second]);
    expect(mockGetShop).toHaveBeenCalledTimes(1);
    expect(mockUserState.user.balances).toEqual({ vp: 1, rad: 2, kc: 3 });
    await refreshShopAndBalances();
    expect(mockGetShop).toHaveBeenCalledTimes(1);
  });

  it("lets an active full sync own shop data", async () => {
    beginFullSync("ap|account-a");
    await refreshShopAndBalances(true);
    expect(mockGetShop).not.toHaveBeenCalled();
  });

  it("refreshes both sources and then skips fresh background work", async () => {
    expect(shouldSkipFullSync()).toBe(false);
    await fullBackgroundSync();
    expect(shouldSkipFullSync()).toBe(true);
    await fullBackgroundSync();
    expect(mockGetShop).toHaveBeenCalledTimes(1);
    expect(mockFetchMatches).toHaveBeenCalledTimes(1);
    expect(isStale("shop", Date.now() - SYNC_TTL.shop - 1000)).toBe(true);
  });

  it("does no network work for a signed-out user", async () => {
    mockUserState.user = { ...makeUser(""), id: "", region: "" };
    await Promise.all([refreshShopAndBalances(true), refreshMatches(true), fullBackgroundSync(true)]);
    expect(mockGetShop).not.toHaveBeenCalled();
    expect(mockFetchMatches).not.toHaveBeenCalled();
  });

  it("keeps good cached data and allows retry after temporary failures", async () => {
    const cached = mockUserState.user;
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockGetShop.mockRejectedValueOnce(new Error("network"));
    mockFetchMatches.mockRejectedValueOnce(new Error("network"));
    try {
      await fullBackgroundSync(true);
      expect(mockUserState.user).toBe(cached);
      expect(shouldSkipFullSync()).toBe(false);
      await fullBackgroundSync(true);
      expect(shouldSkipFullSync()).toBe(true);
    } finally { warning.mockRestore(); }
  });

  it("resets freshness and makes old full-sync completion harmless", () => {
    markSynced(["shop", "matches"]);
    const oldGeneration = beginFullSync("ap|account-a");
    clearSyncTracking();
    expect(getLastSync("shop")).toBe(0);
    expect(getLastSync("matches")).toBe(0);
    beginFullSync("ap|account-a");
    endFullSync("ap|account-a", oldGeneration);
    expect(isFullSyncInFlight("ap|account-a")).toBe(true);
    endFullSync("ap|account-a");
  });

  it("cannot publish an old shop response after logout and login with the same credential", async () => {
    const pendingShop = deferred<object>();
    mockGetShop.mockReturnValueOnce(pendingShop.promise);
    const pending = refreshShopAndBalances(true);
    clearSyncTracking();
    pendingShop.resolve({});
    await pending;
    expect(mockUserState.setUser).not.toHaveBeenCalled();
    expect(getLastSync("shop")).toBe(0);
  });

  it("keeps the full-sync guard active until every overlapping sync ends", () => {
    const key = "ap|overlap-test";
    beginFullSync(key);
    beginFullSync(key);
    endFullSync(key);
    expect(isFullSyncInFlight(key)).toBe(true);
    endFullSync(key);
    expect(isFullSyncInFlight(key)).toBe(false);
  });

  it("does not mark match data fresh when the store reports a failed refresh", async () => {
    mockUserState.user = { ...makeUser("token-failed"), id: "failed-account" };
    mockFetchMatches.mockResolvedValue(false);

    await refreshMatches(true);

    expect(getLastSync("matches")).toBe(0);
  });

  it("starts a new shop request when credentials rotate", async () => {
    const oldShop = deferred<object>();
    mockGetShop.mockReturnValueOnce(oldShop.promise).mockResolvedValueOnce({});

    const first = refreshShopAndBalances(true);
    mockUserState.user = makeUser("token-renewed");
    const second = refreshShopAndBalances(true);

    await second;
    expect(mockGetShop).toHaveBeenCalledTimes(2);

    oldShop.resolve({});
    await first;
    expect(mockUserState.user.accessToken).toBe("token-renewed");
  });
});
