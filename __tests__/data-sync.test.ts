import { getCachedDataSnapshot, syncAllData } from "~/utils/data-sync";
import { invalidateSessionOperations } from "~/utils/session-operations";
import { endFullSync, markSynced } from "~/utils/app-sync";
import { defaultUser } from "~/utils/valorant-user";
import { setStoredItem } from "~/utils/storage";

const mockBuildUser = jest.fn();
const mockFetchProfile = jest.fn();
const mockConfig = jest.fn();
const mockMarkReady = jest.fn();
const mockSetProfile = jest.fn();
const mockUserState = {
  user: defaultUser,
  setUser: jest.fn(),
};
const mockMatchState = {
  authKey: "ap|account-a", matches: [] as { MatchID: string }[], error: null as string | null, lastUpdated: 1, totalMatches: 0, fetchMatches: jest.fn(),
};

jest.mock("~/utils/auth-session", () => ({ buildAuthenticatedUser: (...args: unknown[]) => mockBuildUser(...args) }));
jest.mock("~/utils/profile-cache", () => ({ fetchProfileWarmCache: (...args: unknown[]) => mockFetchProfile(...args) }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => mockUserState } }));
jest.mock("~/hooks/useMatchStore", () => ({ useMatchStore: { getState: () => mockMatchState } }));
jest.mock("~/hooks/useProfileCacheStore", () => ({ useProfileCacheStore: { getState: () => ({ setProfileCache: mockSetProfile }) } }));
jest.mock("~/utils/app-sync", () => ({
  // Contract mới (H5/M1): syncAllData đăng ký full-sync guard quanh request
  markSynced: jest.fn(),
  beginFullSync: jest.fn(),
  endFullSync: jest.fn(),
}));
jest.mock("~/utils/valorant-api", () => ({ getRiotClientConfig: (...args: unknown[]) => mockConfig(...args) }));
jest.mock("~/utils/startup-cache", () => ({ markStartupCacheReady: (...args: unknown[]) => mockMarkReady(...args) }));
jest.mock("~/utils/storage", () => ({
  getStoredItem: jest.fn(), setStoredItem: jest.fn(), removeStoredItem: jest.fn(),
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const nextTurn = () => new Promise<void>((done) => setImmediate(done));

const user = { ...defaultUser, id: "account-a", region: "ap", accessToken: "old-token" };
const bundle: BundleShopItem = {
  uuid: "bundle", displayName: "Bundle", description: "", useAdditionalContext: false,
  displayIcon: "icon", displayIcon2: "wide-icon", assetPath: "bundle", price: 100,
  items: [{ uuid: "item", displayName: "Item", displayIcon: "item-icon", price: 100 }],
};

describe("core synchronization request ownership", () => {
  beforeEach(() => {
    mockUserState.user = user;
    mockUserState.setUser.mockImplementation((next: typeof defaultUser) => { mockUserState.user = next; });
    mockBuildUser.mockResolvedValue({ ...user, entitlementsToken: "fresh-entitlement" });
    mockFetchProfile.mockResolvedValue({ authKey: "ap|account-a" });
    mockConfig.mockResolvedValue({});
    // Contract mới (M2): fetchMatches trả boolean — true = fetch thành công
    mockMatchState.fetchMatches.mockResolvedValue(true);
    mockMatchState.matches = [];
    mockMatchState.authKey = "ap|account-a";
    mockMatchState.error = null;
    mockMatchState.lastUpdated = 1;
    mockMarkReady.mockResolvedValue(true);
    jest.mocked(setStoredItem).mockResolvedValue(undefined);
  });

  afterEach(() => { jest.restoreAllMocks(); });

  it.each(["entitlements", "generation"])("rejects stale credential preparation after %s changes", async (changed) => {
    let resolve!: (value: typeof user) => void;
    mockBuildUser.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const request = syncAllData(user, "ap");
    if (changed === "entitlements") mockUserState.user = { ...user, entitlementsToken: "rotated-only" };
    else invalidateSessionOperations();
    resolve(user);
    await expect(request).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(mockUserState.setUser).not.toHaveBeenCalled();
  });

  it("completes required core sync without waiting for optional startup metadata", async () => {
    const marker = deferred<boolean>();
    mockMarkReady.mockReturnValueOnce(marker.promise);
    const request = syncAllData(user, "ap");
    try {
      const outcome = await Promise.race([
        request.then((report) => ({ status: "complete", report })),
        nextTurn().then(() => ({ status: "pending", report: null })),
      ]);
      expect(outcome).toMatchObject({ status: "complete", report: { clientConfigLoaded: true } });
      expect(mockMarkReady).toHaveBeenCalledWith(expect.objectContaining({ id: user.id, entitlementsToken: "fresh-entitlement" }));
      expect(mockConfig).toHaveBeenCalledWith(user.accessToken, "fresh-entitlement");
      expect(mockMatchState.fetchMatches).toHaveBeenCalledTimes(1);
      expect(mockFetchProfile).toHaveBeenCalledTimes(1);
      expect(mockSetProfile).toHaveBeenCalledWith({ authKey: "ap|account-a" });
      expect(endFullSync).toHaveBeenCalledTimes(1);
    } finally {
      marker.resolve(true);
      await request;
    }
  });

  it.each(["account", "generation"])("rejects %s changes at final core completion before enqueueing metadata", async (changed) => {
    mockSetProfile.mockImplementationOnce(() => {
      if (changed === "account") mockUserState.user = { ...mockUserState.user, id: "account-b" };
      else invalidateSessionOperations();
    });
    await expect(syncAllData(user, "ap")).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(mockMarkReady).not.toHaveBeenCalled();
  });

  it.each(["account", "generation"])("keeps the real helper guard for a late %s change while metadata is queued", async (changed) => {
    const realCache = jest.requireActual<typeof import("~/utils/startup-cache")>("~/utils/startup-cache");
    const diskWrite = deferred<void>();
    jest.mocked(setStoredItem).mockReturnValueOnce(diskWrite.promise);
    const running = realCache.markStartupCacheReady({ id: "queue-blocker", region: "ap" });
    await nextTurn();
    const markerStarted = deferred<{ promise: Promise<boolean> }>();
    mockMarkReady.mockImplementationOnce((account: { id: string; region: string }) => {
      const writing = realCache.markStartupCacheReady(account);
      markerStarted.resolve({ promise: writing });
      return writing;
    });
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const request = syncAllData(user, "ap");
    const marker = (await markerStarted.promise).promise;
    try {
      const outcome = await Promise.race([
        request.then(() => "complete"), nextTurn().then(() => "pending"),
      ]);
      expect(outcome).toBe("complete");
      if (changed === "account") mockUserState.user = { ...mockUserState.user, id: "account-b" };
      invalidateSessionOperations();
    } finally {
      diskWrite.resolve();
      await running;
      await marker;
      await request.catch(() => undefined);
      await nextTurn();
    }
    await expect(marker).resolves.toBe(false);
    expect(setStoredItem).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith("[data-sync] Startup cache metadata was not persisted");
  });

  it("logs a failed optional storage result without failing core sync", async () => {
    const realCache = jest.requireActual<typeof import("~/utils/startup-cache")>("~/utils/startup-cache");
    mockMarkReady.mockImplementationOnce(realCache.markStartupCacheReady);
    jest.mocked(setStoredItem).mockRejectedValueOnce(new Error("storage token=private-fixture"));
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(syncAllData(user, "ap")).resolves.toMatchObject({ clientConfigLoaded: true });
    await nextTurn();
    expect(warning).toHaveBeenCalledWith("[data-sync] Startup cache metadata was not persisted");
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private-fixture");
  });

  it("handles and sanitizes a late optional marker rejection after core completion", async () => {
    const marker = deferred<boolean>();
    mockMarkReady.mockReturnValueOnce(marker.promise);
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const request = syncAllData(user, "ap");
    await nextTurn();
    marker.reject(new Error("storage token=private-fixture"));
    await expect(request).resolves.toMatchObject({ clientConfigLoaded: true });
    await nextTurn();
    expect(warning).toHaveBeenCalledWith(
      "[data-sync] Startup cache metadata persistence failed",
      { name: "Error", message: "Operation failed" },
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private-fixture");
  });

  it.each(["authentication", "configuration", "profile", "history"])("still waits for required %s before completing core sync", async (source) => {
    const core = deferred<unknown>();
    const dependency = source === "authentication" ? mockBuildUser
      : source === "configuration" ? mockConfig
        : source === "profile" ? mockFetchProfile : mockMatchState.fetchMatches;
    dependency.mockReturnValueOnce(core.promise);
    const request = syncAllData(user, "ap");
    try {
      const outcome = await Promise.race([
        request.then(() => "complete"), nextTurn().then(() => "pending"),
      ]);
      expect(outcome).toBe("pending");
      expect(mockMarkReady).not.toHaveBeenCalled();
      expect(endFullSync).not.toHaveBeenCalled();
    } finally {
      core.resolve(source === "authentication" ? { ...user, entitlementsToken: "fresh-entitlement" }
        : source === "profile" ? { authKey: "ap|account-a" }
          : source === "history" ? true : {});
      await request;
    }
  });

  it.each(["configuration", "profile", "history"])("does not mark startup complete without usable %s", async (source) => {
    if (source === "configuration") mockConfig.mockResolvedValueOnce(null);
    if (source === "profile") mockFetchProfile.mockResolvedValueOnce(null);
    if (source === "history") {
      mockMatchState.fetchMatches.mockResolvedValueOnce(false);
      mockMatchState.error = "History unavailable";
      mockMatchState.lastUpdated = 0;
    }
    await expect(syncAllData(user, "ap")).rejects.toThrow();
    expect(mockMarkReady).not.toHaveBeenCalled();
  });

  it("keeps usable cached history on a failed refresh without stamping it fresh", async () => {
    mockMatchState.matches = [{ MatchID: "cached" }];
    mockMatchState.fetchMatches.mockResolvedValueOnce(false);
    const report = await syncAllData(user, "ap");
    expect(report.matchesChanged).toBe(false);
    expect(markSynced).not.toHaveBeenCalledWith(["matches"], expect.anything());
  });

  it("does not expose another account's match snapshot during a switch", () => {
    mockMatchState.authKey = "eu|other";
    mockMatchState.matches = [{ MatchID: "private-other" }];
    mockMatchState.totalMatches = 100;
    expect(getCachedDataSnapshot()).toMatchObject({ matches: [], totalMatches: 0, lastMatchUpdated: 0 });
  });

  it("returns the active account's cached snapshot", () => {
    mockMatchState.matches = [{ MatchID: "own" }];
    expect(getCachedDataSnapshot()).toMatchObject({ user, matches: [{ MatchID: "own" }], lastMatchUpdated: 1 });
  });

  it("reports no changes for an identical response", async () => {
    mockBuildUser.mockResolvedValueOnce(user);
    await expect(syncAllData(user, "ap")).resolves.toMatchObject({
      userChanged: false, credentialsChanged: false, shopsChanged: false,
      balancesChanged: false, nameChanged: false, matchesChanged: false,
    });
  });

  it.each([
    { displayName: "Localized bundle" }, { displayIcon: "new-icon" },
    { displayIcon2: "new-wide-icon" }, { price: 90 },
    { items: [{ ...bundle.items[0], displayName: "Localized item" }] },
    { items: [{ ...bundle.items[0], price: 50 }] },
    { items: [] },
  ])("recognizes changed bundle metadata %j", async (change) => {
    mockUserState.user = { ...user, shops: { ...user.shops, bundles: [bundle] } };
    mockBuildUser.mockResolvedValueOnce({ ...mockUserState.user, shops: { ...user.shops, bundles: [{ ...bundle, ...change }] } });
    await expect(syncAllData(mockUserState.user, "ap")).resolves.toMatchObject({ shopsChanged: true, userChanged: true });
  });

  it("does not report identical bundle metadata as changed", async () => {
    mockUserState.user = { ...user, shops: { ...user.shops, bundles: [bundle] } };
    mockBuildUser.mockResolvedValueOnce({ ...mockUserState.user, shops: { ...user.shops, bundles: [{ ...bundle, items: bundle.items.map((item) => ({ ...item })) }] } });
    await expect(syncAllData(mockUserState.user, "ap")).resolves.toMatchObject({ shopsChanged: false });
  });

  it("reports new history, balances, display name and bundle additions", async () => {
    mockBuildUser.mockResolvedValueOnce({ ...user, name: "New Name", balances: { ...user.balances, vp: 500 }, shops: { ...user.shops, bundles: [bundle] } });
    mockMatchState.fetchMatches.mockImplementationOnce(async () => {
      mockMatchState.matches = [{ MatchID: "new" }];
      return true;
    });
    await expect(syncAllData(user, "ap")).resolves.toMatchObject({ shopsChanged: true, balancesChanged: true, nameChanged: true, matchesChanged: true });
  });

  it("deduplicates startup and foreground sync for the same credentials", async () => {
    const first = syncAllData(user, "ap");
    const second = syncAllData(user, "ap");
    expect(second).toBe(first);
    await first;
    expect(mockBuildUser).toHaveBeenCalledTimes(1);
    expect(mockMarkReady).toHaveBeenCalledTimes(1);
  });

  it.each(["new-token", "signed-out"])("does not overwrite %s with an older completed request", async (change) => {
    let resolve!: (value: typeof defaultUser) => void;
    mockBuildUser.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const request = syncAllData(user, "ap");
    mockUserState.user = change === "signed-out" ? defaultUser : { ...user, accessToken: change };
    resolve(user);
    await expect(request).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(mockUserState.setUser).not.toHaveBeenCalled();
    expect(mockMarkReady).not.toHaveBeenCalled();
  });

  it("preserves current ownership data when only credentials and shop are refreshed", async () => {
    let resolve!: (value: typeof defaultUser) => void;
    mockBuildUser.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const request = syncAllData(user, "ap");
    mockUserState.user = { ...user, ownedSkinIds: ["just-equipped"] };
    resolve({ ...user, entitlementsToken: "new-entitlement" });
    await request;
    expect(mockUserState.user).toMatchObject({ ownedSkinIds: ["just-equipped"], entitlementsToken: "new-entitlement" });
  });

  it("reports a changed history when Riot corrects the order of the same match IDs", async () => {
    mockMatchState.matches = [{ MatchID: "older" }, { MatchID: "newer" }];
    mockMatchState.fetchMatches.mockImplementationOnce(async () => {
      mockMatchState.matches = [{ MatchID: "newer" }, { MatchID: "older" }];
      return true;
    });
    const result = await syncAllData(user, "ap");
    expect(result.matchesChanged).toBe(true);
  });

  it("does not publish a completed startup cache for an account switched during profile loading", async () => {
    let resolve!: (value: object) => void;
    mockFetchProfile.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const request = syncAllData(user, "ap");
    await new Promise<void>((done) => setImmediate(done));
    mockUserState.user = { ...user, id: "account-b" };
    resolve({ authKey: "ap|account-a" });
    await expect(request).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(mockSetProfile).not.toHaveBeenCalled();
    expect(mockMarkReady).not.toHaveBeenCalled();
  });
});
