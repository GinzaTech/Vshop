import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import SessionHandoffScreen from "~/app/session_handoff";
const mockClaim = jest.fn(async (_input: unknown): Promise<void> => undefined);
const mockCapture = jest.fn(() => ({ schemaVersion: 2 }));
let mockEnabled = true;
let mockAccountState = {
  accounts: [] as typeof savedAccount[],
  activeAccountId: null as string | null,
  hydrated: true,
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "a".repeat(64), code: "b".repeat(64) }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");
  return { SafeAreaView: View };
});
jest.mock("~/services/mobile-handoff/snapshot", () => ({
  captureMobileAccountVaultEnvelope: () => mockCapture(),
}));
jest.mock("~/hooks/useAccountStore", () => ({
  useAccountStore: (selector: (state: typeof mockAccountState) => unknown) =>
    selector(mockAccountState),
}));
jest.mock("~/services/mobile-handoff/policy", () => ({
  claimMobileAccountVault: (input: unknown) => mockClaim(input),
  isMobileHandoffBuildEnabled: () => mockEnabled,
  validateMobileHandoffParams: (value: unknown) => value,
}));

const savedAccount = {
  id: "account-a",
  name: "Agent",
  tagLine: "AP",
  region: "ap",
  accessToken: "access",
  idToken: "id",
  entitlementsToken: "entitlements",
  lastUsedAt: 1,
};

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("SessionHandoffScreen", () => {
  beforeEach(() => {
    mockEnabled = true;
    mockClaim.mockClear();
    mockCapture.mockClear();
    mockAccountState = {
      accounts: [savedAccount],
      activeAccountId: savedAccount.id,
      hydrated: true,
    };
  });

  it("requires an explicit press before capturing and sending sessions", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<SessionHandoffScreen />); });
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockClaim).not.toHaveBeenCalled();

    const button = renderer.root.findByProps({ testID: "mobile-handoff-send" });
    expect(button.props.accessibilityState).toEqual({ disabled: false, busy: false });
    await act(async () => button.props.onPress());

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockClaim).toHaveBeenCalledWith(expect.objectContaining({
      id: "a".repeat(64),
      code: "b".repeat(64),
    }));
    expect(renderer.root.findByProps({ accessibilityLiveRegion: "polite" })).toBeDefined();
  });

  it("fails closed when the special build flag is disabled", async () => {
    mockEnabled = false;
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<SessionHandoffScreen />); });

    expect(renderer.root.findByProps({ accessibilityRole: "alert" }).props.children)
      .toBe("mobile_handoff.unavailable");
    expect(renderer.root.findAllByProps({ testID: "mobile-handoff-send" })).toHaveLength(0);
  });

  it("retries only after an explicit failed-send press with a fresh snapshot", async () => {
    const firstEnvelope = { schemaVersion: 2, attempt: "first" };
    const secondEnvelope = { schemaVersion: 2, attempt: "second" };
    mockCapture
      .mockReturnValueOnce(firstEnvelope)
      .mockReturnValueOnce(secondEnvelope);
    mockClaim
      .mockRejectedValueOnce(new Error("desktop unavailable"))
      .mockResolvedValueOnce(undefined);

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<SessionHandoffScreen />); });

    await act(async () => {
      await renderer.root.findByProps({ testID: "mobile-handoff-send" }).props.onPress();
    });

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(mockClaim).toHaveBeenLastCalledWith(expect.objectContaining({ envelope: firstEnvelope }));
    expect(renderer.root.findByProps({ accessibilityRole: "alert" }).props.children)
      .toBe("mobile_handoff.error");
    expect(renderer.root.findByProps({ testID: "mobile-handoff-send" }).props.accessibilityState)
      .toEqual({ disabled: false, busy: false });

    expect(mockClaim).toHaveBeenCalledTimes(1);

    await act(async () => {
      await renderer.root.findByProps({ testID: "mobile-handoff-send" }).props.onPress();
    });

    expect(mockCapture).toHaveBeenCalledTimes(2);
    expect(mockClaim).toHaveBeenCalledTimes(2);
    expect(mockClaim).toHaveBeenLastCalledWith(expect.objectContaining({ envelope: secondEnvelope }));
    expect(renderer.root.findByProps({ accessibilityLiveRegion: "polite" }).props.children)
      .toBe("mobile_handoff.sent");
  });

  it("blocks duplicate send presses while a claim is already in flight", async () => {
    const pendingClaim = deferred();
    mockClaim.mockReturnValueOnce(pendingClaim.promise);

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<SessionHandoffScreen />); });

    act(() => {
      const press = renderer.root.findByProps({ testID: "mobile-handoff-send" }).props.onPress;
      press();
      press();
    });

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockClaim).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingClaim.resolve(undefined);
      await pendingClaim.promise;
    });

    expect(renderer.root.findByProps({ accessibilityLiveRegion: "polite" }).props.children)
      .toBe("mobile_handoff.sent");
  });
});
