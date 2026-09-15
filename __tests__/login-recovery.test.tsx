import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert } from "react-native";
import { Buffer } from "buffer";
import LoginWebView from "~/components/LoginWebView";
import { defaultUser } from "~/utils/valorant-user";

const mockBuildUser = jest.fn();
let mockActiveUser = defaultUser;
const mockActivateUser = jest.fn((user: typeof defaultUser) => { mockActiveUser = user; });
const mockSaveAccount = jest.fn();
const mockReplace = jest.fn();
const mockClearCookies = jest.fn();
const mockRandomBytes = jest.fn();
jest.mock("expo-crypto", () => ({ getRandomBytesAsync: (length: number) => mockRandomBytes(length) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: async () => "ap", setItem: jest.fn() }));
jest.mock("react-native-webview", () => ({ __esModule: true, default: "RiotWebView" }));
jest.mock("~/components/Loading", () => () => null);
jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: Object.assign((selector: (state: object) => unknown) => selector({ activateUser: mockActivateUser }), {
    getState: () => ({ user: mockActiveUser }),
  }),
}));
jest.mock("~/hooks/useAccountStore", () => ({ useAccountStore: { getState: () => ({ saveAccount: mockSaveAccount }) } }));
jest.mock("~/hooks/useMatchStore", () => ({ useMatchStore: { getState: () => ({ fetchMatches: async () => undefined }) } }));
jest.mock("~/hooks/useProfileCacheStore", () => ({ useProfileCacheStore: { getState: () => ({ setProfileCache: jest.fn() }) } }));
jest.mock("~/utils/profile-cache", () => ({ fetchProfileWarmCache: async () => null }));
jest.mock("~/utils/auth-session", () => ({ buildAuthenticatedUser: (...args: unknown[]) => mockBuildUser(...args) }));
jest.mock("~/utils/valorant-api", () => ({ defaultUser: jest.requireActual("~/utils/valorant-user").defaultUser }));
jest.mock("~/utils/chat-service", () => ({ disconnectChatService: jest.fn() }));
jest.mock("~/utils/cookies", () => ({ captureRiotAuthCookies: async () => [{ name: "ssid", value: "saved" }], clearAllCookies: (...args: unknown[]) => mockClearCookies(...args) }));
jest.mock("~/services/accounts/session", () => ({
  prepareInteractiveAuthentication: async () => undefined,
  finishInteractiveAuthentication: jest.fn(),
  restoreCurrentAccountAuthCookies: async () => true,
}));

describe("WebView login completion recovery", () => {
  it("keeps cookies and retries a failed data load without another interactive login", async () => {
    jest.useFakeTimers();
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    let renderer!: TestRenderer.ReactTestRenderer;
    try {
      mockRandomBytes.mockResolvedValueOnce(new Uint8Array(32).fill(1))
        .mockResolvedValueOnce(new Uint8Array(32).fill(2));
      mockBuildUser.mockRejectedValueOnce({ code: "ERR_NETWORK" });
      await act(async () => { renderer = TestRenderer.create(<LoginWebView />); });
      const webview = renderer.root.find((node) => node.type === ("RiotWebView" as React.ElementType));
      const authorization = new URL(webview.props.source.uri);
      const state = authorization.searchParams.get("state");
      const nonce = authorization.searchParams.get("nonce");
      expect(state).toBeTruthy();
      expect(nonce).toBeTruthy();
      const idToken = `e30.${Buffer.from(JSON.stringify({ nonce })).toString("base64url")}.signature`;
      const callback = `https://playvalorant.com/opt_in#${new URLSearchParams({ access_token: "access", id_token: idToken, state: state! })}`;
      await act(async () => {
        webview.props.onNavigationStateChange({ url: callback });
      });
      expect(mockClearCookies).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockActivateUser).not.toHaveBeenCalled();
      expect(renderer.root.findAll((node) => node.type === ("RiotWebView" as React.ElementType))).toHaveLength(1);
      const retry = alert.mock.calls[0]?.[2]?.[1];
      expect(retry?.onPress).toBeDefined();
      mockBuildUser.mockResolvedValueOnce({ ...defaultUser, id: "a", region: "ap", accessToken: "access" });
      await act(async () => { retry?.onPress?.(); });
      await act(async () => { await jest.runAllTimersAsync(); });
      expect(mockBuildUser).toHaveBeenCalledTimes(2);
      expect(mockActivateUser).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/profile");
    } finally {
      act(() => renderer?.unmount());
      alert.mockRestore();
      jest.useRealTimers();
    }
  });
});
