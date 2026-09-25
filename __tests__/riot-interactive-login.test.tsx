import AsyncStorage from "@react-native-async-storage/async-storage";
import { Buffer } from "buffer";
import React, { useEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";

import { useRiotInteractiveLogin } from "~/hooks/useRiotInteractiveLogin";

const mockUser = {
  id: "test-user",
  accessToken: "fake-access",
  idToken: "fake-id",
  entitlementsToken: "fake-entitlements",
  region: "ap",
};
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
jest.mock("expo-crypto", () => ({
  getRandomBytesAsync: (length: number) => mockCrypto(length),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: Object.assign(
    (selector: (state: { activateUser: typeof mockActivate }) => unknown) =>
      selector({ activateUser: mockActivate }),
    { getState: () => ({ user: mockCurrentUser }) },
  ),
}));
jest.mock("~/hooks/useAccountStore", () => ({
  useAccountStore: { getState: () => ({ saveAccount: mockSave }) },
}));
jest.mock("~/hooks/useMatchStore", () => ({
  useMatchStore: { getState: () => ({ fetchMatches: mockMatches }) },
}));
jest.mock("~/hooks/useProfileCacheStore", () => ({
  useProfileCacheStore: { getState: () => ({ setProfileCache: mockSetCache }) },
}));
jest.mock("~/utils/profile-cache", () => ({
  fetchProfileWarmCache: (...args: unknown[]) => mockWarmup(...args),
}));
jest.mock("~/utils/cookies", () => ({
  captureRiotAuthCookies: (...args: unknown[]) => mockCapture(...args),
}));
jest.mock("~/utils/auth-session", () => ({
  buildAuthenticatedUser: (...args: unknown[]) => mockBuild(...args),
}));
jest.mock("~/utils/chat-service", () => ({ disconnectChatService: jest.fn() }));
jest.mock("~/utils/valorant-api", () => ({ defaultUser: { region: "ap" } }));
jest.mock("~/utils/session-operations", () => ({
  getSessionGeneration: () => mockGeneration,
}));
jest.mock("~/services/accounts/session", () => ({
  prepareInteractiveAuthentication: () => mockPrepare(),
  finishInteractiveAuthentication: () => mockFinish(),
  restoreCurrentAccountAuthCookies: () => mockRestore(),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => "ap"),
  setItem: jest.fn(async () => undefined),
}));

type Controller = ReturnType<typeof useRiotInteractiveLogin>;
let latest!: Controller;

function HookHarness({
  expectedAccountId,
  onController,
}: {
  expectedAccountId?: string;
  onController: (controller: Controller) => void;
}) {
  const controller = useRiotInteractiveLogin({ expectedAccountId });
  useEffect(() => onController(controller), [controller, onController]);
  return null;
}

const callbackForCurrentAttempt = (stateOverride?: string) => {
  const url = new URL(latest.loginUrl!);
  const nonce = url.searchParams.get("nonce");
  const state = stateOverride ?? url.searchParams.get("state");
  const idToken = `e30.${Buffer.from(JSON.stringify({ nonce })).toString("base64url")}.signature`;
  return `https://playvalorant.com/opt_in#access_token=fake-access&id_token=${idToken}&state=${state}`;
};

describe("useRiotInteractiveLogin", () => {
  let renderer: TestRenderer.ReactTestRenderer;

  beforeEach(() => {
    jest.useFakeTimers();
    mockGeneration = 1;
    mockCurrentUser = { ...mockUser, id: "", accessToken: "" };
    let byte = 0;
    mockCrypto.mockImplementation(async (length: number) =>
      new Uint8Array(length).fill(++byte));
    mockPrepare.mockResolvedValue(undefined);
    mockFinish.mockReset();
    mockCapture.mockResolvedValue([]);
    mockRestore.mockResolvedValue(undefined);
    mockBuild.mockResolvedValue(mockUser);
    mockMatches.mockResolvedValue(undefined);
    mockWarmup.mockResolvedValue(null);
    mockSetCache.mockReset();
    mockRouter.replace.mockReset();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue("ap");
  });

  afterEach(async () => {
    if (renderer) await act(async () => renderer.unmount());
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const mount = async (expectedAccountId?: string) => {
    await act(async () => {
      renderer = TestRenderer.create(
        <HookHarness
          expectedAccountId={expectedAccountId}
          onController={(controller) => { latest = controller; }}
        />,
      );
    });
  };

  const complete = async (callbackUrl: string) => {
    let completion!: Promise<void>;
    await act(async () => {
      completion = latest.completeCallback(callbackUrl);
      await Promise.resolve();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
      await completion;
    });
  };

  it("prepares one cryptographic attempt and finishes it on cleanup", async () => {
    await mount();
    expect(latest.authReady).toBe(true);
    expect(latest.loginUrl).toContain("state=");
    expect(latest.loginUrl).toContain("nonce=");
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    await act(async () => renderer.unmount());
    expect(mockFinish).toHaveBeenCalledTimes(1);
  });

  it("rejects mismatched state before cookie or token use", async () => {
    await mount();
    await complete(callbackForCurrentAttempt("wrong-state"));
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockBuild).not.toHaveBeenCalled();
    expect(mockActivate).not.toHaveBeenCalled();
    expect(latest.completionIssue).toBe("login_web_view.completion_error");
  });

  it("publishes one authenticated user and ignores a duplicate callback", async () => {
    await mount();
    const callback = callbackForCurrentAttempt();
    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    await act(async () => {
      first = latest.completeCallback(callback);
      duplicate = latest.completeCallback(callback);
      await Promise.resolve();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
      await Promise.all([first, duplicate]);
    });
    expect(mockBuild).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockActivate).toHaveBeenCalledWith(mockUser);
    expect(mockRouter.replace).toHaveBeenCalledWith("/profile");
  });

  it("restores the active account when the authenticated identity mismatches", async () => {
    mockRestore.mockImplementationOnce(async () => { mockGeneration += 1; });
    await mount("different-account");
    await complete(callbackForCurrentAttempt());
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(mockActivate).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith("/settings");
  });

  it("ignores completion after unmount", async () => {
    let finishBuild!: (value: typeof mockUser) => void;
    mockBuild.mockImplementationOnce(() => new Promise((resolve) => {
      finishBuild = resolve;
    }));
    await mount();
    let pending!: Promise<void>;
    await act(async () => {
      pending = latest.completeCallback(callbackForCurrentAttempt());
      await Promise.resolve();
    });
    await act(async () => renderer.unmount());
    await act(async () => finishBuild(mockUser));
    await act(async () => pending);
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockActivate).not.toHaveBeenCalled();
  });
});
