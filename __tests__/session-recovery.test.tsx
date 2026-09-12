import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AppState } from "react-native";
import AppWarmup from "~/components/AppWarmup";
import { defaultUser } from "~/utils/valorant-user";

const mockReplace = jest.fn();
const mockRenew = jest.fn();
const mockSync = jest.fn();
const mockSaveAccount = jest.fn();
const mockUserState = { user: defaultUser, setUser: jest.fn() };
let mockAuthListener: ((failure: { status: number; url: string; accessToken?: string }) => void) | undefined;
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
const mockRouter = { replace: mockReplace };
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: Object.assign(
  (selector: (state: typeof mockUserState) => unknown) => selector(mockUserState),
  { getState: () => mockUserState }
) }));
jest.mock("~/hooks/useAccountStore", () => ({ useAccountStore: Object.assign(
  (selector: (state: object) => unknown) => selector({ hydrated: true }),
  { getState: () => ({ saveAccount: mockSaveAccount }) }
) }));
jest.mock("~/hooks/useMatchStore", () => ({ useMatchStore: { getState: () => ({ fetchMatches: async () => undefined }) } }));
jest.mock("~/utils/chat-service", () => ({ disconnectChatService: jest.fn(), initChatService: jest.fn() }));
jest.mock("~/utils/chat-store", () => ({ useChatStore: { getState: () => ({ status: "disconnected" }) } }));
jest.mock("~/utils/network", () => ({ getNetworkProfile: async () => ({ isConnected: true, isCellular: false }) }));
jest.mock("~/utils/idle-task", () => ({ runWhenIdle: () => ({ cancel: jest.fn() }) }));
jest.mock("~/utils/app-sync", () => ({
  refreshShopAndBalances: async () => undefined,
  // Contract mới (H4/M4): AppWarmup dùng 2 hàm này để grace/TTL-skip recovery.
  // Test mô phỏng trạng thái "chưa sync gần đây" → getLastSync = 0, không skip.
  getLastSync: () => 0,
  shouldSkipFullSync: () => false,
}));
jest.mock("~/utils/data-sync", () => ({ syncAllData: (...args: unknown[]) => mockSync(...args) }));
jest.mock("~/utils/auth-session", () => ({
  hasReusableAccessToken: (token: string) => token === "fresh",
  shouldProactivelyRefreshToken: (token: string) => token === "expired",
  isReauthenticationRequiredError: (error: { code?: string }) => error?.code === "REAUTHENTICATION_REQUIRED",
}));
jest.mock("~/services/accounts/session", () => ({
  isSessionRecoveryPaused: () => false,
  renewSavedAccountSession: (...args: unknown[]) => mockRenew(...args),
}));
jest.mock("~/utils/session-events", () => ({
  ...jest.requireActual("~/utils/session-events"),
  subscribeSessionAuthFailures: (listener: typeof mockAuthListener) => {
    mockAuthListener = listener;
    return () => { mockAuthListener = undefined; };
  },
}));

describe("foreground token recovery", () => {
  const previousAppState = AppState.currentState;
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  beforeEach(() => {
    jest.useFakeTimers();
    AppState.currentState = "active";
    mockRenew.mockReset();
    mockUserState.user = { ...defaultUser, id: "a", region: "ap", accessToken: "expired", entitlementsToken: "ent" };
    mockUserState.setUser.mockImplementation((user: typeof defaultUser) => { mockUserState.user = user; });
    mockSync.mockResolvedValue(undefined);
  });
  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    jest.useRealTimers();
    AppState.currentState = previousAppState;
  });

  it.each([
    { code: "ERR_NETWORK" },
    { response: { status: 503 } },
    new Error("Unexpected upstream response"),
  ])("keeps an expired session on %s and retries after recovery", async (error) => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mockRenew.mockRejectedValueOnce(error).mockResolvedValueOnce({ ...mockUserState.user, accessToken: "fresh" });
      await act(async () => { renderer = TestRenderer.create(<AppWarmup />); });
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockUserState.user.accessToken).toBe("expired");
      await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });
      expect(mockRenew).toHaveBeenCalledTimes(2);
      expect(mockSync).toHaveBeenCalledTimes(1);
      expect(mockUserState.user.accessToken).toBe("fresh");
      expect(mockReplace).not.toHaveBeenCalled();
    } finally { warn.mockRestore(); }
  });

  it("opens reauth only when Riot requires interactive authentication", async () => {
    mockRenew.mockRejectedValue({ code: "REAUTHENTICATION_REQUIRED" });
    await act(async () => { renderer = TestRenderer.create(<AppWarmup />); });
    expect(mockReplace).toHaveBeenCalledWith("/reauth");
    expect(mockUserState.user.id).toBe("a");
  });

  it("ignores an old token's delayed unauthorized response after renewal", async () => {
    mockUserState.user = { ...mockUserState.user, accessToken: "fresh" };
    await act(async () => { renderer = TestRenderer.create(<AppWarmup />); });
    await act(async () => { mockAuthListener?.({ status: 401, url: "https://pd.ap.a.pvp.net", accessToken: "expired" }); });
    expect(mockRenew).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
