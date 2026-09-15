import React from "react";
import { Alert, Linking } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { Buffer } from "buffer";
import WebView from "react-native-webview";
import LoginWebView from "~/components/LoginWebView";

const mockUser = { id: "test-user", accessToken: "fake-access", idToken: "", entitlementsToken: "fake-entitlements", region: "ap" };
let mockCurrentUser = { ...mockUser, id: "", accessToken: "" };
let mockGeneration = 1;
const mockActivate = jest.fn((user: typeof mockUser) => { mockCurrentUser = user; });
const mockSave = jest.fn();
const mockCapture = jest.fn();
const mockPrepare = jest.fn();
const mockFinish = jest.fn();
const mockRestore = jest.fn();
const mockBuild = jest.fn();
const mockMatches = jest.fn();
const mockWarmup = jest.fn();
const mockSetCache = jest.fn();
const mockRouter = { replace: jest.fn() };
const mockCrypto = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("expo-crypto", () => ({ getRandomBytesAsync: (length: number) => mockCrypto(length) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("react-native-webview", () => function MockWebView() { return null; });
jest.mock("~/components/Loading", () => function MockLoading() { return null; });
jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: Object.assign((selector: (state: { activateUser: typeof mockActivate }) => unknown) => selector({ activateUser: mockActivate }), {
    getState: () => ({ user: mockCurrentUser }),
  }),
}));
jest.mock("~/hooks/useAccountStore", () => ({ useAccountStore: { getState: () => ({ saveAccount: mockSave }) } }));
jest.mock("~/hooks/useMatchStore", () => ({ useMatchStore: { getState: () => ({ fetchMatches: mockMatches }) } }));
jest.mock("~/hooks/useProfileCacheStore", () => ({ useProfileCacheStore: { getState: () => ({ setProfileCache: mockSetCache }) } }));
jest.mock("~/utils/profile-cache", () => ({ fetchProfileWarmCache: (...args: unknown[]) => mockWarmup(...args) }));
jest.mock("~/utils/cookies", () => ({ captureRiotAuthCookies: (...args: unknown[]) => mockCapture(...args) }));
jest.mock("~/utils/auth-session", () => ({ buildAuthenticatedUser: (...args: unknown[]) => mockBuild(...args) }));
jest.mock("~/utils/chat-service", () => ({ disconnectChatService: jest.fn() }));
jest.mock("~/utils/valorant-api", () => ({ defaultUser: { region: "ap" } }));
jest.mock("~/utils/session-operations", () => ({ getSessionGeneration: () => mockGeneration }));
jest.mock("~/services/accounts/session", () => ({
  prepareInteractiveAuthentication: () => mockPrepare(), finishInteractiveAuthentication: () => mockFinish(),
  restoreCurrentAccountAuthCookies: () => mockRestore(),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(async () => "ap"), setItem: jest.fn(async () => undefined) }));

describe("LoginWebView attempt lifecycle", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const mount = async (expectedAccountId?: string) => {
    await act(async () => { renderer = TestRenderer.create(<LoginWebView expectedAccountId={expectedAccountId} />); });
  };
  const web = () => renderer.root.findByType(WebView);
  const callback = (stateOverride?: string) => {
    const params = new URL(web().props.source.uri).searchParams;
    const token = `e30.${Buffer.from(JSON.stringify({ nonce: params.get("nonce") })).toString("base64url")}.signature`;
    return `https://playvalorant.com/opt_in#access_token=fake-access&id_token=${token}&state=${stateOverride ?? params.get("state")}`;
  };
  const navigate = async (url: string) => {
    await act(async () => { web().props.onNavigationStateChange({ url }); });
  };
  beforeEach(() => {
    jest.useFakeTimers();
    mockGeneration = 1;
    mockCurrentUser = { ...mockUser, id: "", accessToken: "" };
    let bytes = 0;
    mockCrypto.mockImplementation(async (length: number) => new Uint8Array(length).fill(++bytes));
    mockPrepare.mockResolvedValue(undefined); mockCapture.mockResolvedValue([]);
    mockRestore.mockResolvedValue(undefined); mockBuild.mockResolvedValue(mockUser);
    mockMatches.mockResolvedValue(undefined); mockWarmup.mockResolvedValue(null);
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(async () => {
    if (renderer) await act(async () => { renderer.unmount(); });
    jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
  });

  it("rejects callback state before reading cookies or using credentials", async () => {
    await mount(); await navigate(callback("mismatch"));
    expect(mockCapture).not.toHaveBeenCalled(); expect(mockBuild).not.toHaveBeenCalled();
    expect(mockActivate).not.toHaveBeenCalled(); expect(Alert.alert).toHaveBeenCalled();
  });

  it.each(["logout", "account", "token", "id-token", "entitlements", "generation", "unmount"])("ignores old profile preload after %s", async (change) => {
    let resolveWarmup!: (cache: object) => void;
    mockWarmup.mockImplementation(() => new Promise((resolve) => { resolveWarmup = resolve; }));
    await mount(); await navigate(callback());
    expect(mockActivate).toHaveBeenCalledWith(mockUser);
    if (change === "unmount") await act(async () => { renderer.unmount(); });
    await act(async () => {
      if (change === "logout") mockCurrentUser = { ...mockUser, id: "", accessToken: "" };
      if (change === "account") mockCurrentUser = { ...mockUser, id: "other-user" };
      if (change === "token") mockCurrentUser = { ...mockUser, accessToken: "new-token" };
      if (change === "id-token") mockCurrentUser = { ...mockUser, idToken: "new-id-token" };
      if (change === "entitlements") mockCurrentUser = { ...mockUser, entitlementsToken: "new-entitlements" };
      if (change === "generation") mockGeneration += 1;
      resolveWarmup({ player: "old-cache" });
    });
    expect(mockSetCache).not.toHaveBeenCalled();
  });

  it("keeps valid preload and suppresses duplicate callback completion", async () => {
    const cache = { player: "current-cache" };
    mockWarmup.mockResolvedValue(cache);
    await mount(); const url = callback();
    await navigate(url); await navigate(url);
    expect(mockSetCache).toHaveBeenCalledWith(cache);
    expect(mockBuild).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(mockRouter.replace).toHaveBeenCalledWith("/profile");
  });

  it("does not activate a user when cancellation occurs during authentication", async () => {
    let complete!: (user: typeof mockUser) => void;
    mockBuild.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    await mount(); await navigate(callback());
    await act(async () => { renderer.unmount(); });
    await act(async () => { complete(mockUser); });
    expect(mockSave).not.toHaveBeenCalled(); expect(mockActivate).not.toHaveBeenCalled();
  });

  it("restores the original cookie jar if the wrong saved account signs in", async () => {
    mockRestore.mockImplementationOnce(async () => { mockGeneration += 1; });
    await mount("different-user"); await navigate(callback());
    expect(mockRestore).toHaveBeenCalled(); expect(mockActivate).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith("/settings");
  });

  it("does not complete account mismatch recovery if external logout invalidates the restore", async () => {
    let finishRestore!: () => void;
    mockRestore.mockImplementationOnce(() => {
      mockGeneration += 1;
      return new Promise<void>((resolve) => { finishRestore = resolve; });
    });
    await mount("different-user"); await navigate(callback());
    mockGeneration += 1;
    mockCurrentUser = { ...mockUser, id: "", accessToken: "" };
    await act(async () => { finishRestore(); });
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockActivate).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("sanitizes external URL and both preload errors", async () => {
    const error = Object.assign(new Error("https://example.test/?access_token=raw-secret"), { config: { headers: { Cookie: "cookie-secret" } } });
    jest.spyOn(Linking, "openURL").mockRejectedValue(error);
    mockMatches.mockRejectedValue(error); mockWarmup.mockRejectedValue(error);
    await mount();
    await act(async () => { expect(web().props.onShouldStartLoadWithRequest({ url: "https://example.test/?access_token=raw-secret" })).toBe(false); });
    await navigate(callback());
    expect(JSON.stringify([jest.mocked(console.warn).mock.calls, jest.mocked(console.log).mock.calls])).not.toMatch(/raw-secret|cookie-secret/);
  });

  it("does not mount an insecure login URL if cryptographic setup fails", async () => {
    mockCrypto.mockRejectedValueOnce(new Error("rng-secret"));
    await mount();
    expect(renderer.root.findAllByType(WebView)).toHaveLength(0);
    expect(JSON.stringify(jest.mocked(console.warn).mock.calls)).not.toContain("rng-secret");
  });

  it("keeps native and HTTP error diagnostics free of callback URLs and raw descriptions", async () => {
    await mount();
    const url = callback();
    await act(async () => {
      web().props.onLoadStart(); web().props.onLoadEnd();
      web().props.onError({ nativeEvent: { url, description: "native-secret", code: -1 } });
      web().props.onHttpError({ nativeEvent: { url, description: "http-secret", statusCode: 403 } });
      web().props.onError({ nativeEvent: { description: "native-secret", code: -1 } });
      web().props.onHttpError({ nativeEvent: { description: "http-secret", statusCode: 503 } });
    });
    expect(JSON.stringify(jest.mocked(console.log).mock.calls)).not.toMatch(/native-secret|http-secret/);
    expect(JSON.stringify(renderer.toJSON())).not.toMatch(/native-secret|http-secret/);
  });

  it("preserves the host allowlist and ignores empty navigation", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await mount();
    expect(web().props.onShouldStartLoadWithRequest({ url: "https://auth.riotgames.com/login" })).toBe(true);
    expect(web().props.onShouldStartLoadWithRequest({ url: "about:blank" })).toBe(true);
    expect(web().props.onShouldStartLoadWithRequest({ url: "javascript:alert(1)" })).toBe(false);
    await act(async () => { web().props.onNavigationStateChange({}); });
    expect(open).not.toHaveBeenCalled(); expect(mockBuild).not.toHaveBeenCalled();
  });

  it("allows retry of a failed completion with the same validated attempt", async () => {
    mockBuild.mockRejectedValueOnce(new Error("temporary-secret"));
    await mount(); await navigate(callback());
    const retry = jest.mocked(Alert.alert).mock.calls[0]?.[2]?.find((button) => button.text === "login_web_view.retry");
    expect(retry).toBeDefined();
    await act(async () => { retry?.onPress?.(); });
    expect(mockBuild).toHaveBeenCalledTimes(2);
    expect(mockActivate).toHaveBeenCalledTimes(1);
  });

  it("ignores preparation and cookie reads that finish after cancellation", async () => {
    let finishPrepare!: () => void;
    mockPrepare.mockImplementationOnce(() => new Promise<void>((resolve) => { finishPrepare = resolve; }));
    await mount();
    expect(renderer.root.findAllByType(WebView)).toHaveLength(0);
    await act(async () => { renderer.unmount(); });
    await act(async () => { finishPrepare(); });
    let finishCapture!: (value: object[]) => void;
    mockCapture.mockImplementationOnce(() => new Promise((resolve) => { finishCapture = resolve; }));
    await mount(); await navigate(callback());
    await act(async () => { renderer.unmount(); });
    await act(async () => { finishCapture([]); });
    expect(mockBuild).not.toHaveBeenCalled();
  });

  it("uses the authenticated region and leaves production errors unlogged", async () => {
    const originalDev = __DEV__;
    Object.defineProperty(globalThis, "__DEV__", { value: false, configurable: true });
    try {
      mockBuild.mockResolvedValueOnce({ ...mockUser, region: "eu" });
      mockMatches.mockRejectedValueOnce(new Error("match-secret"));
      mockWarmup.mockRejectedValueOnce(new Error("profile-secret"));
      await mount(); await navigate(callback());
      await act(async () => {
        web().props.onError({ nativeEvent: { url: "https://auth.riotgames.com/login", code: -1 } });
        web().props.onHttpError({ nativeEvent: { url: "https://auth.riotgames.com/login", statusCode: 503 } });
      });
      expect(mockActivate).toHaveBeenCalledWith(expect.objectContaining({ region: "eu" }));
      expect(console.log).not.toHaveBeenCalled();
    } finally { Object.defineProperty(globalThis, "__DEV__", { value: originalDev, configurable: true }); }
  });
});
