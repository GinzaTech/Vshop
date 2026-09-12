import {
  finishInteractiveAuthentication,
  prepareInteractiveAuthentication,
  renewSavedAccountSession,
  signOutRiotAccount,
  switchSavedAccount,
} from "~/services/accounts/session";
import { defaultUser } from "~/utils/valorant-api";

const mockAccountState = {
  accounts: [] as {
    id: string;
    name: string;
    tagLine: string;
    region: string;
    accessToken: string;
    idToken: string;
    entitlementsToken: string;
    authCookies?: {
      name: string;
      value: string;
      domain?: string;
      path?: string;
      expires?: string;
    }[];
    lastUsedAt: number;
  }[],
  activeAccountId: "account-a" as string | null,
  activateAccount: jest.fn<void, [string]>(),
  saveAccount: jest.fn(),
  clearAccounts: jest.fn(),
};

const mockUserState = {
  user: {} as Record<string, unknown>,
  activateUser: jest.fn<void, [Record<string, unknown>]>(),
  setUser: jest.fn<void, [Record<string, unknown>]>(),
  resetUser: jest.fn(),
};

const mockSyncAllData = jest.fn();
const mockClearAllCookies = jest.fn<Promise<void>, [boolean]>();
const mockDisconnectChatService = jest.fn();
// Contract mới (L12): signOut dọn warm cache in-memory. Mock để tránh kéo
// import chain profile-cache → valorant-assets → storage (MMKV) vào test env.
const mockClearProfileWarmupCache = jest.fn();
jest.mock("~/utils/profile-cache", () => ({
  clearProfileWarmupCache: (...args: unknown[]) =>
    mockClearProfileWarmupCache(...args),
}));
const mockHasReusableAccessToken = jest.fn<boolean, [string | undefined]>(
  () => true
);
const mockRenewAuthenticatedSession = jest.fn();
const mockCaptureRiotAuthCookies = jest.fn();
const mockRestoreRiotAuthCookies = jest.fn();

const mockDefaultUser = {
  id: "",
  name: "",
  TagLine: "",
  region: "ap",
  accessToken: "",
  idToken: "",
  entitlementsToken: "",
  shops: { main: [], bundles: [], nightMarket: [], accessory: [], remainingSecs: { main: 0, bundles: [0], nightMarket: 0, accessory: 0 } },
  balances: { vp: 0, rad: 0, kc: 0, fag: 0 },
  ownedSkinIds: [] as string[],
  progress: { level: 0, xp: 0 },
};

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock("~/hooks/useAccountStore", () => ({
  useAccountStore: { getState: () => mockAccountState },
}));
jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: { getState: () => mockUserState },
}));
jest.mock("~/utils/auth-session", () => ({
  hasReusableAccessToken: (token?: string) =>
    mockHasReusableAccessToken(token),
  isReauthenticationRequiredError: (error: { code?: string }) =>
    error?.code === "REAUTHENTICATION_REQUIRED",
  ReauthenticationRequiredError: class extends Error {
    code = "REAUTHENTICATION_REQUIRED";
  },
  renewAuthenticatedSession: (...args: unknown[]) =>
    mockRenewAuthenticatedSession(...args),
}));
jest.mock("~/utils/chat-service", () => ({
  disconnectChatService: () => mockDisconnectChatService(),
}));
jest.mock("~/utils/cookies", () => ({
  clearAllCookies: (clearStorage: boolean) =>
    mockClearAllCookies(clearStorage),
  captureRiotAuthCookies: (...args: unknown[]) =>
    mockCaptureRiotAuthCookies(...args),
  restoreRiotAuthCookies: (...args: unknown[]) =>
    mockRestoreRiotAuthCookies(...args),
}));
jest.mock("~/utils/data-sync", () => ({
  syncAllData: (...args: unknown[]) => mockSyncAllData(...args),
}));
jest.mock("~/utils/valorant-api", () => ({ defaultUser: mockDefaultUser }));

const mockAsyncStorage = jest.requireMock(
  "@react-native-async-storage/async-storage"
) as {
  setItem: jest.Mock<Promise<void>, [string, string]>;
};

const accountA = {
  id: "account-a",
  name: "Player A",
  tagLine: "VSP",
  region: "ap",
  accessToken: "access-a",
  idToken: "id-a",
  entitlementsToken: "entitlements-a",
  lastUsedAt: 100,
};

const accountB = {
  ...accountA,
  id: "account-b",
  name: "Player B",
  accessToken: "access-b",
  idToken: "id-b",
  entitlementsToken: "entitlements-b",
  lastUsedAt: 200,
};

const userA = {
  ...mockDefaultUser,
  id: accountA.id,
  name: accountA.name,
  TagLine: accountA.tagLine,
  accessToken: accountA.accessToken,
  idToken: accountA.idToken,
  entitlementsToken: accountA.entitlementsToken,
};

describe("saved account session switching", () => {
  beforeEach(() => {
    finishInteractiveAuthentication();
    mockAccountState.accounts = [accountB, accountA];
    mockAccountState.activeAccountId = accountA.id;
    mockUserState.user = userA;
    mockAccountState.activateAccount.mockImplementation((accountId) => {
      mockAccountState.activeAccountId = accountId;
    });
    mockUserState.activateUser.mockImplementation((user) => {
      mockUserState.user = user;
    });
    mockUserState.setUser.mockImplementation((user) => { mockUserState.user = user; });
    mockUserState.resetUser.mockImplementation(() => { mockUserState.user = mockDefaultUser; });
    mockAccountState.clearAccounts.mockImplementation(() => { mockAccountState.accounts = []; });
    mockAsyncStorage.setItem.mockResolvedValue();
    mockClearAllCookies.mockResolvedValue();
    mockCaptureRiotAuthCookies.mockResolvedValue([]);
    mockRestoreRiotAuthCookies.mockResolvedValue(true);
    mockRenewAuthenticatedSession.mockImplementation(async (user) => user);
    mockHasReusableAccessToken.mockReturnValue(true);
    mockSyncAllData.mockResolvedValue(undefined);
  });

  it("does not replace the saved login with tracking cookies when adding an account", async () => {
    const authCookies = [{ name: "ssid", value: "saved-session" }];
    mockAccountState.accounts = [{ ...accountA, authCookies }, accountB];
    mockCaptureRiotAuthCookies.mockResolvedValue([{ name: "__cf_bm", value: "tracking" }]);
    await prepareInteractiveAuthentication(true);
    expect(mockAccountState.saveAccount).not.toHaveBeenCalled();
    expect(mockAccountState.accounts[0]?.authCookies).toEqual(authCookies);
    finishInteractiveAuthentication();
  });

  it("shares one renewal and preserves UI data changed while Riot responds", async () => {
    let resolveRenewal!: (user: typeof defaultUser) => void;
    mockRenewAuthenticatedSession.mockImplementation(() => new Promise((resolve) => { resolveRenewal = resolve; }));
    const seed = userA as typeof defaultUser;
    const first = renewSavedAccountSession(seed);
    const second = renewSavedAccountSession(seed);
    expect(first).toBe(second);
    await new Promise<void>((resolve) => setImmediate(resolve));
    mockUserState.user = { ...userA, balances: { vp: 123, rad: 9, kc: 8 } };
    resolveRenewal({ ...seed, accessToken: "new-token", entitlementsToken: "new-entitlements" });
    await expect(first).resolves.toMatchObject({ accessToken: "new-token", balances: { vp: 123 } });
    expect(mockRenewAuthenticatedSession).toHaveBeenCalledTimes(1);
    expect(mockUserState.user.accessToken).toBe("new-token");
    await renewSavedAccountSession(seed);
    expect(mockRenewAuthenticatedSession).toHaveBeenCalledTimes(1);
  });

  it("retains rotated cookies on a temporary entitlement failure and can retry", async () => {
    const rotated = [{ name: "ssid", value: "rotated", domain: ".riotgames.com" }];
    const error = { response: { status: 503 } };
    mockCaptureRiotAuthCookies.mockResolvedValue(rotated);
    mockRenewAuthenticatedSession.mockRejectedValueOnce(error);
    await expect(renewSavedAccountSession(userA as typeof defaultUser)).rejects.toBe(error);
    expect(mockAccountState.saveAccount).toHaveBeenCalledWith(userA, false, rotated);
    await expect(renewSavedAccountSession(userA as typeof defaultUser)).resolves.toMatchObject({ id: accountA.id });
    expect(mockRenewAuthenticatedSession).toHaveBeenCalledTimes(2);
  });

  it("drains renewal before mounting interactive auth and ignores its stale result", async () => {
    let finishRenewal!: (user: typeof defaultUser) => void;
    mockRenewAuthenticatedSession.mockImplementation(() => new Promise((resolve) => { finishRenewal = resolve; }));
    const renewal = renewSavedAccountSession(userA as typeof defaultUser);
    const rejected = expect(renewal).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    let ready = false;
    const interactive = prepareInteractiveAuthentication(true).then(() => { ready = true; });
    expect(ready).toBe(false);
    finishRenewal({ ...userA, accessToken: "late-token" } as typeof defaultUser);
    await rejected;
    await interactive;
    expect(mockUserState.user.accessToken).toBe(accountA.accessToken);
    expect(mockClearAllCookies).toHaveBeenCalled();
    finishInteractiveAuthentication();
  });

  it("cannot resurrect an account after logout while renewal is in flight", async () => {
    let finishRenewal!: (user: typeof defaultUser) => void;
    mockRenewAuthenticatedSession.mockImplementation(() => new Promise((resolve) => { finishRenewal = resolve; }));
    const renewal = renewSavedAccountSession(userA as typeof defaultUser);
    const rejected = expect(renewal).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const logout = signOutRiotAccount();
    finishRenewal({ ...userA, accessToken: "late-token" } as typeof defaultUser);
    await rejected;
    await logout;
    expect(mockUserState.user.id).toBe("");
    expect(mockAccountState.accounts).toEqual([]);
    expect(mockAccountState.saveAccount).not.toHaveBeenCalled();
  });

  it("renews a revoked but unexpired saved token once before retrying sync", async () => {
    mockAccountState.accounts = [{ ...accountB, authCookies: [{ name: "ssid", value: "b", domain: ".riotgames.com" }] }, accountA];
    mockSyncAllData.mockRejectedValueOnce({ response: { status: 401, config: { url: "https://pd.ap.a.pvp.net/store/v3/storefront/account-b" } } });
    mockRenewAuthenticatedSession.mockImplementation(async (user) => ({ ...user, accessToken: "new-b" }));
    await expect(switchSavedAccount(accountB.id)).resolves.toEqual({ kind: "switched" });
    expect(mockSyncAllData).toHaveBeenCalledTimes(2);
    expect(mockUserState.user.accessToken).toBe("new-b");
  });

  it("does not demand login for a gateway 403 while renewing a saved account", async () => {
    mockAccountState.accounts = [{ ...accountB, authCookies: [{ name: "ssid", value: "b", domain: ".riotgames.com" }] }, accountA];
    mockHasReusableAccessToken.mockReturnValue(false);
    mockRenewAuthenticatedSession.mockRejectedValueOnce({ response: { status: 403, config: { url: "https://auth.riotgames.com/api/v1/authorization" } } });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(switchSavedAccount(accountB.id)).resolves.toEqual({ kind: "failed" });
      expect(mockUserState.user.id).toBe(accountA.id);
    } finally { warn.mockRestore(); }
  });

  it("requires login when every saved cookie and the token have actually expired", async () => {
    mockAccountState.accounts = [{ ...accountB, authCookies: [{ name: "ssid", value: "expired", expires: "2000-01-01T00:00:00Z" }] }, accountA];
    mockHasReusableAccessToken.mockReturnValue(false);
    await expect(switchSavedAccount(accountB.id)).resolves.toEqual({ kind: "reauth-required" });
    expect(mockRenewAuthenticatedSession).not.toHaveBeenCalled();
    expect(mockUserState.user.id).toBe(accountA.id);
  });

  it("does not report success until the target account is fully synced", async () => {
    let finishSync: (() => void) | undefined;
    mockSyncAllData.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSync = resolve;
        })
    );

    let settled = false;
    const request = switchSavedAccount(accountB.id).then((result) => {
      settled = true;
      return result;
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(mockUserState.user).toMatchObject({ id: accountB.id });
    expect(settled).toBe(false);

    finishSync?.();
    await expect(request).resolves.toEqual({ kind: "switched" });
    expect(mockSyncAllData).toHaveBeenCalledWith(
      expect.objectContaining({ id: accountB.id }),
      "ap"
    );
    expect(mockAccountState.saveAccount).toHaveBeenCalledWith(
      expect.objectContaining({ id: accountB.id }),
      true,
      []
    );
  });

  it("renews an expired account from its saved Riot cookies", async () => {
    const authCookies = [
      {
        name: "ssid",
        value: "account-b-cookie",
        domain: ".riotgames.com",
        path: "/",
      },
    ];
    mockAccountState.accounts = [
      { ...accountB, authCookies },
      accountA,
    ];
    mockHasReusableAccessToken.mockReturnValue(false);
    mockSyncAllData.mockResolvedValue(undefined);
    const renewedUser = {
      ...mockDefaultUser,
      id: accountB.id,
      name: accountB.name,
      accessToken: "renewed-access-b",
      idToken: "renewed-id-b",
      entitlementsToken: "renewed-entitlements-b",
    };
    mockRenewAuthenticatedSession.mockResolvedValue(renewedUser);

    await expect(switchSavedAccount(accountB.id)).resolves.toEqual({
      kind: "switched",
    });

    expect(mockRestoreRiotAuthCookies).toHaveBeenCalledWith(authCookies);
    expect(mockRenewAuthenticatedSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: accountB.id })
    );
    expect(mockUserState.user).toMatchObject({
      id: accountB.id,
      accessToken: "renewed-access-b",
    });
  });

  it("requests interactive login when an expired account has no cookie snapshot", async () => {
    mockHasReusableAccessToken.mockReturnValue(false);

    await expect(switchSavedAccount(accountB.id)).resolves.toEqual({
      kind: "reauth-required",
    });

    expect(mockRenewAuthenticatedSession).not.toHaveBeenCalled();
    expect(mockUserState.user).toMatchObject({ id: accountA.id });
  });

  it("reports a retryable failure when native cookie restoration fails for an expired token", async () => {
    mockAccountState.accounts = [
      {
        ...accountB,
        authCookies: [
          {
            name: "ssid",
            value: "expired-cookie",
            domain: ".riotgames.com",
          },
        ],
      },
      accountA,
    ];
    mockRestoreRiotAuthCookies.mockResolvedValue(false);
    mockHasReusableAccessToken.mockReturnValue(false);

    await expect(switchSavedAccount(accountB.id)).resolves.toEqual({
      kind: "failed",
    });

    expect(mockUserState.user).toMatchObject({ id: accountA.id });
    expect(mockSyncAllData).not.toHaveBeenCalled();
  });

  it("restores the previous cookie jar when target synchronization fails", async () => {
    const previousCookies = [
      {
        name: "ssid",
        value: "account-a-cookie",
        domain: ".riotgames.com",
      },
    ];
    const targetCookies = [
      {
        name: "ssid",
        value: "account-b-cookie",
        domain: ".riotgames.com",
      },
    ];
    mockAccountState.accounts = [
      { ...accountB, authCookies: targetCookies },
      { ...accountA, authCookies: previousCookies },
    ];
    mockCaptureRiotAuthCookies.mockResolvedValueOnce(previousCookies);
    mockSyncAllData.mockRejectedValueOnce(new Error("network unavailable"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await expect(switchSavedAccount(accountB.id)).resolves.toEqual({
        kind: "failed",
      });
      expect(mockRestoreRiotAuthCookies).toHaveBeenNthCalledWith(
        1,
        targetCookies
      );
      expect(mockRestoreRiotAuthCookies).toHaveBeenNthCalledWith(
        2,
        previousCookies
      );
      expect(mockUserState.user).toMatchObject({ id: accountA.id });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("restores the previous account when core synchronization fails", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockSyncAllData.mockRejectedValueOnce(new Error("network unavailable"));

    try {
      await expect(switchSavedAccount(accountB.id)).resolves.toEqual({
        kind: "failed",
      });

      expect(mockAccountState.activeAccountId).toBe(accountA.id);
      expect(mockUserState.user).toMatchObject({ id: accountA.id });
      expect(mockAsyncStorage.setItem).toHaveBeenLastCalledWith(
        "region",
        "ap"
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
