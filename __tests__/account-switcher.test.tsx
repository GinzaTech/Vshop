import React from "react";
import { Alert, Modal, StyleSheet, Text, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { AccountSwitcherPopup } from "~/components/settings/AccountSwitcherPopup";
import { toAccountDisplayRow, type AccountDisplayRow } from "~/components/settings/AccountSwitcherDisplay";
import { COLORS } from "~/constants/DesignSystem";

let mockLocale = "vi";
jest.mock("~/hooks/useAppTranslation", () => ({ useTranslation: () => ({ t: (key: string) => `${mockLocale}:${key}` }) }));
jest.mock("~/components/ui/AppIcon", () => () => null);
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 24 }) }));
jest.mock("react-native-paper", () => ({ Portal: ({ children }: React.PropsWithChildren) => children }));

const current: AccountDisplayRow = { id: "current", displayName: "Current#ONE", region: "AP", status: "current" };
const other: AccountDisplayRow = { id: "other", displayName: "Other#TWO", region: "EU", status: "ready" };
let renderer: TestRenderer.ReactTestRenderer | undefined;
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; jest.restoreAllMocks(); mockLocale = "vi"; });

function mount(overrides: Partial<React.ComponentProps<typeof AccountSwitcherPopup>> = {}) {
  const props = { visible: true, accounts: [current, other], currentId: current.id, busyId: null,
    onDismiss: jest.fn(), onSwitch: jest.fn(), onRemove: jest.fn(), ...overrides };
  act(() => { renderer = TestRenderer.create(<AccountSwitcherPopup {...props} />); });
  return props;
}

it("projects explicit public strings without retaining credential fields", () => {
  const source = { id: "other", name: "Other", tagLine: "TWO", region: "eu",
    accessToken: "synthetic-access", idToken: "synthetic-id", entitlementsToken: "synthetic-entitlement" };
  const row = toAccountDisplayRow(source, "ready");
  expect(row).toEqual(other);
  expect(Object.values(row).every((value) => typeof value === "string")).toBe(true);
  expect(JSON.stringify(row)).not.toContain("synthetic-");
  expect(toAccountDisplayRow({ id: "fallback", name: "", tagLine: "", region: "ap" }, "login-required").displayName).toBe("fallback");
});

it("opens a gray accessible native chooser for alternatives without invoking account actions", () => {
  const props = mount();
  expect(renderer!.root.findAllByProps({ testID: "settings-account-switch-current" })).toHaveLength(0);
  expect(renderer!.root.findAllByProps({ testID: "settings-account-switch-other" }).length).toBeGreaterThan(0);
  const sheet = renderer!.root.findByProps({ testID: "settings-account-popup" });
  expect(sheet.props.accessibilityViewIsModal).toBe(true);
  expect(StyleSheet.flatten(sheet.props.style).backgroundColor).toBe(COLORS.BACKGROUND);
  expect(StyleSheet.flatten(renderer!.root.findByProps({ testID: "settings-account-close" }).props.style)).toMatchObject({ minHeight: 48, minWidth: 48 });
  expect(props.onSwitch).not.toHaveBeenCalled();
  expect(props.onRemove).not.toHaveBeenCalled();
  act(() => renderer!.root.findByType(Modal).props.onRequestClose());
  expect(props.onDismiss).toHaveBeenCalledTimes(1);
  act(() => renderer!.root.findByProps({ testID: "settings-account-close" }).props.onPress());
  expect(props.onDismiss).toHaveBeenCalledTimes(2);
  expect(props.onSwitch).not.toHaveBeenCalled();
});

it("switches only on user selection, dismisses before navigation and blocks a second pending tap", async () => {
  let finish!: () => void;
  const onDismiss = jest.fn();
  const onSwitch = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const props = mount({ onDismiss, onSwitch });
  const select = renderer!.root.findByProps({ testID: "settings-account-switch-other" }).props.onPress;
  act(() => { select(); select(); });
  expect(props.onSwitch).toHaveBeenCalledTimes(1);
  expect(props.onSwitch).toHaveBeenCalledWith("other");
  expect(props.onDismiss).toHaveBeenCalledTimes(1);
  expect(onDismiss.mock.invocationCallOrder[0]).toBeLessThan(onSwitch.mock.invocationCallOrder[0]);
  await act(async () => finish());
});

it("guards busy switch/remove actions and permits cancel without mutating an account", () => {
  const props = mount({ busyId: "other" });
  const select = renderer!.root.findByProps({ testID: "settings-account-switch-other" });
  const remove = renderer!.root.findByProps({ testID: "settings-account-remove-other" });
  expect(select.props.accessibilityState).toMatchObject({ selected: false, disabled: true, busy: true });
  expect(remove.props.disabled).toBe(true);
  act(() => { select.props.onPress(); remove.props.onPress(); });
  expect(props.onSwitch).not.toHaveBeenCalled();
  expect(props.onRemove).not.toHaveBeenCalled();
  act(() => renderer!.root.findByProps({ testID: "settings-account-close" }).props.onPress());
  expect(props.onDismiss).toHaveBeenCalledTimes(1);
});

it("rejects stale current/removed rows and uses fresh labels and callbacks after updates", async () => {
  const props = mount();
  const oldSelect = renderer!.root.findByProps({ testID: "settings-account-switch-other" }).props.onPress;
  const oldRemove = renderer!.root.findByProps({ testID: "settings-account-remove-other" }).props.onPress;
  act(() => renderer!.update(<AccountSwitcherPopup {...props} currentId="OTHER" />));
  act(() => { oldSelect(); oldRemove(); });
  expect(props.onSwitch).not.toHaveBeenCalled();
  expect(props.onRemove).not.toHaveBeenCalled();
  act(() => renderer!.update(<AccountSwitcherPopup {...props} accounts={[current]} />));
  act(() => { oldSelect(); oldRemove(); });
  expect(props.onRemove).not.toHaveBeenCalled();
  const onSwitch = jest.fn(), onRemove = jest.fn();
  mockLocale = "en";
  act(() => renderer!.update(<AccountSwitcherPopup {...props} accounts={[current, { ...other, displayName: "Fresh#THREE", status: "login-required" }]} onSwitch={onSwitch} onRemove={onRemove} />));
  expect(renderer!.root.findAllByType(Text).map((node) => node.props.children)).toContain("Fresh#THREE");
  expect(renderer!.root.findAllByType(Text).map((node) => node.props.children)).toContain("en:settings_page.accounts.login_required");
  act(() => oldRemove());
  expect(onRemove).toHaveBeenCalledWith("other");
  await act(async () => oldSelect());
  expect(onSwitch).toHaveBeenCalledWith("other");
  expect(props.onSwitch).not.toHaveBeenCalled();
});

it("hides on dismiss and rejects captured actions from a closed popup", () => {
  const props = mount();
  const select = renderer!.root.findByProps({ testID: "settings-account-switch-other" }).props.onPress;
  act(() => renderer!.update(<AccountSwitcherPopup {...props} visible={false} />));
  expect(renderer!.root.findAllByType(Modal)).toHaveLength(0);
  expect(renderer!.root.findAllByType(View)).toHaveLength(0);
  act(() => select());
  expect(props.onSwitch).not.toHaveBeenCalled();
});

it("rejects captured switch/remove actions after the popup owner unmounts", () => {
  const props = mount();
  const select = renderer!.root.findByProps({ testID: "settings-account-switch-other" }).props.onPress;
  const remove = renderer!.root.findByProps({ testID: "settings-account-remove-other" }).props.onPress;
  act(() => renderer!.unmount()); renderer = undefined;
  act(() => { select(); remove(); });
  expect(props.onSwitch).not.toHaveBeenCalled();
  expect(props.onRemove).not.toHaveBeenCalled();
});

it("handles a rejected switch with existing localized error copy and no credential output", async () => {
  const props = mount({ onSwitch: jest.fn().mockRejectedValue(new Error("synthetic-private-error")) });
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  await act(async () => renderer!.root.findByProps({ testID: "settings-account-switch-other" }).props.onPress());
  expect(props.onSwitch).toHaveBeenCalledWith("other");
  expect(alert).toHaveBeenCalledWith("vi:settings_page.accounts.switch_failed_title", "vi:settings_page.accounts.switch_failed_description");
});
