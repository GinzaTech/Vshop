import { switchSavedAccount } from "~/services/accounts/session";

const mockAccountState = {
  accounts: [] as {
    id: string;
    name: string;
    tagLine: string;
    region: string;
    accessToken: string;
    idToken: string;
    entitlementsToken: string;
    lastUsedAt: number;
  }[],
  activeAccountId: "account-a" as string | null,
  activateAccount: jest.fn<void, [string]>(),
  saveAccount: jest.fn(),
};

const mockUserState = {
  user: {} as Record<string, unknown>,
  activateUser: jest.fn<void, [Record<string, unknown>]>(),
};

const mockSyncAllData = jest.fn();
const mockClearAllCookies = jest.fn<Promise<void>, [boolean]>();
const mockDisconnectChatService = jest.fn();
const mockHasReusableAccessToken = jest.fn<boolean, [string | undefined]>(
  () => true
);

const mockDefaultUser = {
  id: "",
  name: "",
  TagLine: "",
  region: "ap",
  accessToken: "",
  idToken: "",
  entitlementsToken: "",
  shops: { main: [], bundles: [], nightMarket: [], accessory: [] },
  balances: { vp: 0, rad: 0, kc: 0 },
  progress: { level: 0, xp: 0 },
};

jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(),
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
}));
jest.mock("~/utils/chat-service", () => ({
  disconnectChatService: () => mockDisconnectChatService(),
}));
jest.mock("~/utils/cookies", () => ({
  clearAllCookies: (clearStorage: boolean) =>
    mockClearAllCookies(clearStorage),
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
    mockAccountState.accounts = [accountB, accountA];
    mockAccountState.activeAccountId = accountA.id;
    mockUserState.user = userA;
    mockAccountState.activateAccount.mockImplementation((accountId) => {
      mockAccountState.activeAccountId = accountId;
    });
    mockUserState.activateUser.mockImplementation((user) => {
      mockUserState.user = user;
    });
    mockAsyncStorage.setItem.mockResolvedValue();
    mockClearAllCookies.mockResolvedValue();
    mockHasReusableAccessToken.mockReturnValue(true);
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
      true
    );
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
