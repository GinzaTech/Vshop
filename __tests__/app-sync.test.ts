import {
  beginFullSync,
  endFullSync,
  getLastSync,
  isFullSyncInFlight,
  refreshMatches,
  refreshShopAndBalances,
} from "~/utils/app-sync";

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
