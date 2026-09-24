import React from "react";
import { Linking, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { ErrorBoundary } from "~/components/ErrorBoundary";
import RecoveryUpdateActions from "~/components/ui/RecoveryUpdateActions";
import { useStartupRecoveryWatchdog } from "~/hooks/useStartupRecoveryWatchdog";
import type { RecoveryUpdateState } from "~/utils/recovery-update";

const mockStartRecoveryUpdate = jest.fn();
const mockMarkRecoveryStartupFailure = jest.fn(async () => undefined);

jest.mock("~/utils/recovery-update", () => ({
  markRecoveryStartupFailure: () => mockMarkRecoveryStartupFailure(),
  startRecoveryUpdate: (publish: (state: RecoveryUpdateState) => void) =>
    mockStartRecoveryUpdate(publish),
}));
jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

function WatchdogProbe({ active }: { active: boolean }) {
  return <Text>{String(useStartupRecoveryWatchdog(active))}</Text>;
}

function ThrowingChild(): React.ReactElement {
  throw new Error("render failed");
}

describe("startup recovery update UI", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reveals update recovery only after the eight-second watchdog", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<WatchdogProbe active />);
    });
    expect(renderer.root.findByType(Text).props.children).toBe("false");

    act(() => jest.advanceTimersByTime(7_999));
    expect(renderer.root.findByType(Text).props.children).toBe("false");

    act(() => jest.advanceTimersByTime(1));
    expect(renderer.root.findByType(Text).props.children).toBe("true");

    act(() => renderer.update(<WatchdogProbe active={false} />));
    expect(renderer.root.findByType(Text).props.children).toBe("false");
  });

  it("prevents duplicate update presses while checking", async () => {
    let finish!: (state: RecoveryUpdateState) => void;
    mockStartRecoveryUpdate.mockImplementation(
      (publish: (state: RecoveryUpdateState) => void) => {
        publish({ kind: "checking" });
        return new Promise<RecoveryUpdateState>((resolve) => {
          finish = resolve;
        });
      },
    );
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<RecoveryUpdateActions />);
    });
    const button = renderer.root.findByProps({
      testID: "recovery-check-update-button",
    });

    await act(async () => {
      void button.props.onPress();
      void button.props.onPress();
      await Promise.resolve();
    });
    expect(mockStartRecoveryUpdate).toHaveBeenCalledTimes(1);
    expect(button.props.accessibilityState).toEqual({ busy: true, disabled: true });

    await act(async () => {
      finish({ kind: "up-to-date" });
      await Promise.resolve();
    });
    expect(
      renderer.root.findByProps({ testID: "recovery-update-status" }).props
        .accessibilityLiveRegion,
    ).toBe("polite");
  });

  it("opens only the native release action returned by recovery", async () => {
    const releaseUrl = "https://github.com/GinzaTech/Vshop/releases/latest";
    mockStartRecoveryUpdate.mockImplementation(
      async (publish: (state: RecoveryUpdateState) => void) => {
        const state = { kind: "native-update", releaseUrl } as const;
        publish(state);
        return state;
      },
    );
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<RecoveryUpdateActions />);
    });

    await act(async () => {
      await renderer.root.findByProps({
        testID: "recovery-check-update-button",
      }).props.onPress();
    });
    await act(async () => {
      await renderer.root.findByProps({
        testID: "recovery-open-release-button",
      }).props.onPress();
    });

    expect(openUrl).toHaveBeenCalledWith(releaseUrl);
    openUrl.mockRestore();
  });

  it.each([
    ["downloading", "Downloading the update…", "polite"],
    ["restarting", "Restarting VShop…", "polite"],
    ["error", "Recovery failed safely", "assertive"],
  ] as const)(
    "announces the %s state",
    async (kind, expectedCopy, liveRegion) => {
      const state =
        kind === "error"
          ? ({ kind, message: expectedCopy } as const)
          : ({ kind } as RecoveryUpdateState);
      mockStartRecoveryUpdate.mockImplementation(
        async (publish: (next: RecoveryUpdateState) => void) => {
          publish(state);
          return state;
        },
      );
      let renderer!: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(<RecoveryUpdateActions />);
      });

      await act(async () => {
        await renderer.root.findByProps({
          testID: "recovery-check-update-button",
        }).props.onPress();
      });

      const status = renderer.root.findByProps({
        testID: "recovery-update-status",
      });
      expect(status.props.children).toBe(expectedCopy);
      expect(status.props.accessibilityLiveRegion).toBe(liveRegion);
    },
  );

  it("ignores a late recovery completion after unmount", async () => {
    let publish!: (state: RecoveryUpdateState) => void;
    let finish!: (state: RecoveryUpdateState) => void;
    mockStartRecoveryUpdate.mockImplementation(
      (next: (state: RecoveryUpdateState) => void) => {
        publish = next;
        return new Promise<RecoveryUpdateState>((resolve) => {
          finish = resolve;
        });
      },
    );
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<RecoveryUpdateActions />);
    });
    await act(async () => {
      void renderer.root.findByProps({
        testID: "recovery-check-update-button",
      }).props.onPress();
      await Promise.resolve();
    });

    act(() => renderer.unmount());
    await act(async () => {
      publish({ kind: "up-to-date" });
      finish({ kind: "up-to-date" });
      await Promise.resolve();
    });
  });

  it("renders update recovery inside ErrorBoundary without a Portal", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>,
      );
    });

    expect(
      renderer.root.findByProps({
        testID: "recovery-check-update-button",
      }),
    ).toBeDefined();
    expect(mockMarkRecoveryStartupFailure).toHaveBeenCalledTimes(1);
    expect(
      renderer.root.findAll(
        (node) => node.type && String(node.type).includes("Portal"),
      ),
    ).toHaveLength(0);
    consoleError.mockRestore();
  });
});
