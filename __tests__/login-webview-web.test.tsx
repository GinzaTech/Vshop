import fs from "node:fs";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import LoginWebView from "~/components/LoginWebView.web";
import { useRiotInteractiveLogin } from "~/hooks/useRiotInteractiveLogin";
import { useRiotWebAuthBroker } from "~/hooks/useRiotWebAuthBroker";

const mockStart = jest.fn(async () => undefined);
const mockCancel = jest.fn(async () => undefined);
const mockRetry = jest.fn(async () => undefined);
const mockCompleteCallback = jest.fn(async () => undefined);
const mockWindowOpen = jest.fn(() => ({} as Window));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("~/hooks/useRiotInteractiveLogin", () => ({
  useRiotInteractiveLogin: jest.fn(),
}));
jest.mock("~/hooks/useRiotWebAuthBroker", () => ({
  useRiotWebAuthBroker: jest.fn(),
}));

const mockInteractive = jest.mocked(useRiotInteractiveLogin);
const mockBroker = jest.mocked(useRiotWebAuthBroker);

describe("LoginWebView.web", () => {
  beforeEach(() => {
    Object.defineProperty(window, "open", {
      configurable: true,
      value: mockWindowOpen,
      writable: true,
    });
    mockInteractive.mockReturnValue({
      authReady: true,
      loginUrl: "https://auth.riotgames.com/authorize?safe=1",
      loading: null,
      completionIssue: null,
      completeCallback: mockCompleteCallback,
    });
    mockBroker.mockReturnValue({
      state: { kind: "ready", mutationMode: false },
      start: mockStart,
      cancel: mockCancel,
      retry: mockRetry,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("opens normal browser login without starting controlled auth", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<LoginWebView />); });
    const button = renderer.root.findByProps({ testID: "riot-web-login-open" });
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityState).toEqual({ disabled: false, busy: false });
    expect(mockStart).not.toHaveBeenCalled();
    await act(async () => button.props.onPress());
    expect(mockWindowOpen).toHaveBeenCalledWith(
      "https://auth.riotgames.com/authorize?safe=1",
      "_blank",
      "noopener,noreferrer",
    );
    expect(mockStart).not.toHaveBeenCalled();
    await act(async () => renderer.root.findByProps({
      testID: "riot-web-login-automatic",
    }).props.onPress());
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("submits a manual callback once and clears it before completion", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<LoginWebView />); });
    await act(async () => renderer.root.findByProps({
      testID: "riot-web-login-open",
    }).props.onPress());
    const callback = "https://playvalorant.com/opt_in#access_token=secret&id_token=secret";
    const input = renderer.root.findByProps({ testID: "riot-web-callback-input" });
    expect(input.props.secureTextEntry).toBe(true);
    await act(async () => input.props.onChangeText(callback));
    await act(async () => renderer.root.findByProps({
      testID: "riot-web-callback-submit",
    }).props.onPress());
    expect(mockCompleteCallback).toHaveBeenCalledWith(callback);
    expect(renderer.root.findByProps({ testID: "riot-web-callback-input" }).props.value)
      .toBe("");
    expect(JSON.stringify(renderer.toJSON())).not.toContain("access_token");
  });

  it("disables login while checking and exposes a polite live status", async () => {
    mockBroker.mockReturnValue({
      state: { kind: "checking" },
      start: mockStart,
      cancel: mockCancel,
      retry: mockRetry,
    });
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<LoginWebView />); });
    expect(renderer.root.findByProps({ testID: "riot-web-login-open" }).props.disabled)
      .toBe(true);
    expect(renderer.root.findByProps({ testID: "riot-web-login-status" }).props.accessibilityLiveRegion)
      .toBe("polite");
  });

  it("renders cancel while waiting and an alert for fail-closed errors", async () => {
    mockBroker.mockReturnValue({
      state: { kind: "waiting", authSessionId: "b".repeat(64) },
      start: mockStart,
      cancel: mockCancel,
      retry: mockRetry,
    });
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<LoginWebView />); });
    await act(async () => renderer.root.findByProps({
      testID: "riot-web-login-cancel",
    }).props.onPress());
    expect(mockCancel).toHaveBeenCalledTimes(1);

    mockBroker.mockReturnValue({
      state: { kind: "error", code: "COMPANION_DISABLED" },
      start: mockStart,
      cancel: mockCancel,
      retry: mockRetry,
    });
    await act(async () => renderer.update(<LoginWebView />));
    expect(renderer.root.findByProps({ accessibilityRole: "alert" })).toBeDefined();
    await act(async () => renderer.root.findByProps({
      testID: "riot-web-login-retry",
    }).props.onPress());
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it("contains no native WebView or token rendering literals", () => {
    const source = fs.readFileSync(
      require.resolve("~/components/LoginWebView.web"),
      "utf8",
    );
    expect(source).not.toMatch(/react-native-webview/);
    expect(source).not.toMatch(/access_token|id_token/);
    expect(source).not.toMatch(/clipboard|localStorage|sessionStorage|console\./i);
  });

  it("announces mutation mode and timeout with localized keys", async () => {
    mockBroker.mockReturnValue({
      state: { kind: "ready", mutationMode: true },
      start: mockStart,
      cancel: mockCancel,
      retry: mockRetry,
    });
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<LoginWebView />); });
    expect(renderer.root.findByProps({ testID: "riot-web-login-status" }).props.children)
      .toBe("login_web_view.desktop_ready_mutation");

    mockBroker.mockReturnValue({
      state: { kind: "error", code: "AUTH_TIMEOUT" },
      start: mockStart,
      cancel: mockCancel,
      retry: mockRetry,
    });
    await act(async () => renderer.update(<LoginWebView />));
    expect(renderer.root.findByProps({ testID: "riot-web-login-status" }).props.children)
      .toBe("login_web_view.desktop_timeout");
  });
});
