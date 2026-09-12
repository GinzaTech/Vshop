import { syncAllData } from "~/utils/data-sync";
import { defaultUser } from "~/utils/valorant-user";

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
  matches: [], error: null, lastUpdated: 1, totalMatches: 0, fetchMatches: jest.fn(),
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

const user = { ...defaultUser, id: "account-a", region: "ap", accessToken: "old-token" };

describe("core synchronization request ownership", () => {
  beforeEach(() => {
    mockUserState.user = user;
    mockUserState.setUser.mockImplementation((next: typeof defaultUser) => { mockUserState.user = next; });
    mockBuildUser.mockResolvedValue({ ...user, entitlementsToken: "fresh-entitlement" });
    mockFetchProfile.mockResolvedValue({ authKey: "ap|account-a" });
    mockConfig.mockResolvedValue({});
    // Contract mới (M2): fetchMatches trả boolean — true = fetch thành công
    mockMatchState.fetchMatches.mockResolvedValue(true);
    mockMarkReady.mockResolvedValue(undefined);
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
