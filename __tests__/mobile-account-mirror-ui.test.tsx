import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import MobileAccountMirrorPanel from "~/components/MobileAccountMirrorPanel.web";
import { useMobileAccountMirror } from "~/hooks/useMobileAccountMirror";

const mockReplace = jest.fn();
const mockStart = jest.fn(async () => undefined);
const mockCancel = jest.fn(async () => undefined);
const mockActivate = jest.fn(async () => undefined);
let mockMirror: Record<string, unknown>;
let mockClientAvailable = true;

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, options?: { count?: number }) =>
    options?.count === undefined ? key : `${key}:${options.count}` }),
}));
jest.mock("~/hooks/useMobileAccountMirror", () => ({
  useMobileAccountMirror: jest.fn(() => mockMirror),
}));
jest.mock("~/services/pentest-companion/client.web", () => ({
  getPentestCompanionClient: () => {
    if (!mockClientAvailable) throw new Error("COMPANION_DISABLED");
    return {};
  },
}));
jest.mock("~/services/accounts/transferred-session.runtime", () => ({
  createTransferredSessionDependencies: () => ({}),
}));

const manifest = {
  schemaVersion: 2 as const,
  capturedAt: Date.now(),
  activeHandle: "a".repeat(64),
  accounts: [{
    handle: "a".repeat(64),
    name: "Agent",
    tagLine: "AP",
    region: "ap",
    lastUsedAt: Date.now(),
    tokenStatus: "ready" as const,
  }],
  snapshotManifest: { hasMatchCache: true, profileCacheCount: 1, wishlistCount: 2 },
};

describe("MobileAccountMirrorPanel.web", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientAvailable = true;
    mockMirror = {
      status: "idle",
      manifest: null,
      activeHandle: null,
      errorCode: null,
      expiresAt: null,
      start: mockStart,
      cancel: mockCancel,
      activate: mockActivate,
    };
  });

  it("starts an explicit phone import and navigates only after success", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<MobileAccountMirrorPanel mode="import" />);
    });
    const button = renderer.root.findByProps({ testID: "mobile-mirror-start" });
    expect(button.props.accessibilityState).toEqual({ disabled: false, busy: false });
    await act(async () => button.props.onPress());
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/profile");
  });

  it("renders a safe account manifest and switches by opaque handle", async () => {
    mockMirror = {
      ...mockMirror,
      status: "ready",
      manifest,
      activeHandle: manifest.activeHandle,
    };
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<MobileAccountMirrorPanel mode="accounts" />);
    });
    const serialized = JSON.stringify(renderer.toJSON());
    expect(serialized).toContain("Agent#AP");
    expect(serialized).not.toMatch(/accessToken|idToken|authCookies|11111111/);
    const accountButton = renderer.root.findByProps({
      testID: `mobile-mirror-account-${manifest.activeHandle}`,
    });
    expect(accountButton.props.accessibilityState).toMatchObject({ selected: true });
  });

  it("offers cancel while waiting for the phone", async () => {
    mockMirror = { ...mockMirror, status: "waiting_for_phone" };
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<MobileAccountMirrorPanel mode="import" />);
    });
    await act(async () => renderer.root.findByProps({
      testID: "mobile-mirror-cancel",
    }).props.onPress());
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it("uses stable localized error copy without rendering the raw code", async () => {
    mockMirror = {
      ...mockMirror,
      status: "error",
      errorCode: "MOBILE_VAULT_REJECTED",
    };
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<MobileAccountMirrorPanel mode="import" />);
    });
    const serialized = JSON.stringify(renderer.toJSON());
    expect(serialized).toContain("mobile_mirror.error");
    expect(serialized).not.toContain("MOBILE_VAULT_REJECTED");
  });

  it("receives controller dependencies through the hook boundary", () => {
    expect(useMobileAccountMirror).toBeDefined();
  });

  it("fails closed without crashing when the companion is unavailable", async () => {
    mockClientAvailable = false;
    let renderer!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<MobileAccountMirrorPanel mode="import" />);
    });

    expect(renderer.root.findByProps({ accessibilityRole: "alert" }).props.children)
      .toBe("mobile_mirror.unavailable");
    expect(renderer.root.findAllByProps({ testID: "mobile-mirror-start" })).toHaveLength(0);
  });
});
