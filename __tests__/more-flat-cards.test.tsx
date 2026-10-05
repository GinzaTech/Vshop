import React from "react";
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import Settings from "~/app/(authenticated)/settings";
import GlassCard from "~/components/ui/GlassCard";
import { LiquidGlassDecoration } from "~/components/ui/LiquidGlassSurface";
import { MoreGlassCard } from "~/components/ui/more-glass/MoreGlassCard";
import { MoreGlassScene } from "~/components/ui/more-glass/MoreGlassScene";
import { COLORS } from "~/constants/DesignSystem";
import { defaultUser } from "~/utils/valorant-user";
import { toSavedAccount } from "~/utils/saved-accounts";

const mockUser = { ...defaultUser, id: "current", name: "Current", accessToken: "test-session" };
const mockAccounts = [toSavedAccount(mockUser, 2), toSavedAccount({ ...mockUser, id: "other", name: "Other" }, 1)];
const mockRemoveAccount = jest.fn();
const mockToggleScreenshot = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockFeature = { screenshotModeEnabled: false, toggleScreenshotMode: mockToggleScreenshot };
const mockWishlist = { notificationEnabled: false, setNotificationEnabled: jest.fn() };
const mockCheckUpdate = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useIsFocused: () => true }));
jest.mock("~/components/ui/more-glass/MoreGlassRenderer", () => ({ MoreGlassRenderer: () => null }));
jest.mock("~/components/ui/more-glass/MoreGlassSceneRenderer", () => ({ MoreGlassSceneRenderer: () => null }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 24 }) }));
jest.mock("react-native-paper", () => {
  const Native = require("react-native") as typeof import("react-native");
  return { Text: Native.Text, Switch: Native.Switch };
});
jest.mock("react-native-reanimated", () => {
  const ReactModule = require("react") as typeof React;
  const Native = require("react-native") as typeof import("react-native");
  const entrance = { duration: () => entrance, reduceMotion: () => entrance };
  return {
    __esModule: true, default: { View: Native.View, ScrollView: Native.ScrollView }, Easing: Native.Easing,
    FadeInDown: entrance, ReduceMotion: { System: "system" },
    useSharedValue: (value: number) => ReactModule.useRef({ value }).current,
    useAnimatedScrollHandler: (handler: { onScroll: (event: { contentOffset: { x: number; y: number } }) => void }) =>
      (event: { nativeEvent: { contentOffset: { x: number; y: number } } }) => handler.onScroll(event.nativeEvent),
  };
});
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: (selector: (state: { user: typeof mockUser }) => unknown) => selector({ user: mockUser }) }));
jest.mock("~/hooks/useAccountStore", () => ({ useAccountStore: (selector: (state: { accounts: typeof mockAccounts; removeAccount: jest.Mock }) => unknown) => selector({ accounts: mockAccounts, removeAccount: mockRemoveAccount }) }));
jest.mock("~/hooks/useFeatureStore", () => ({ useFeatureStore: (selector: (state: typeof mockFeature) => unknown) => selector(mockFeature) }));
jest.mock("~/hooks/useWishlistStore", () => ({ useWishlistStore: (selector: (state: typeof mockWishlist) => unknown) => selector(mockWishlist) }));
jest.mock("~/utils/wishlist", () => ({ initBackgroundFetch: jest.fn(), stopBackgroundFetch: jest.fn() }));
jest.mock("~/utils/app-update", () => ({ applyOtaUpdate: jest.fn(), checkForAppUpdate: (...args: unknown[]) => mockCheckUpdate(...args) }));
jest.mock("~/utils/app-sync", () => ({ fullBackgroundSync: jest.fn() }));
jest.mock("~/utils/auth-session", () => ({ hasReusableAccessToken: () => true }));
jest.mock("~/services/accounts/session", () => ({ prepareInteractiveAuthentication: jest.fn(), signOutRiotAccount: jest.fn(), switchSavedAccount: jest.fn() }));
jest.mock("~/hooks/useAsyncRefresh", () => ({ useAsyncRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }) }));
jest.mock("~/components/ui/AppRefreshControl", () => "AppRefreshControl");
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("~/components/BatteryOptimizationWarning", () => () => null);
jest.mock("~/components/popups/UpdatePopup", () => "UpdatePopup");
jest.mock("~/components/MobileAccountMirrorPanel", () => () => null);
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("expo-notifications", () => ({ getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn() }));

describe("More white glass scene and all card groups", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => { renderer = TestRenderer.create(<Settings />); });
  });
  afterEach(() => { act(() => renderer?.unmount()); });

  it("renders all fourteen More cards as glass instead of leaving the lower groups opaque", () => {
    const cards = renderer.root.findAllByType(MoreGlassCard);
    expect(cards).toHaveLength(14);
    expect(renderer.root.findAllByType(MoreGlassScene)).toHaveLength(1);
    expect(renderer.root.findAllByType(GlassCard)).toHaveLength(0);
    expect(cards.map((card) => card.props.index)).toEqual(Array.from({ length: 14 }, (_, index) => index));
    for (const card of cards.slice(10)) {
      expect(card.props.onLayout).toEqual(expect.any(Function));
      expect(StyleSheet.flatten(card.props.style)).toMatchObject({ marginBottom: 20 });
      expect(StyleSheet.flatten(card.props.contentStyle)).toMatchObject({ padding: 16 });
      expect(card.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
      expect(StyleSheet.flatten(card.findAllByType(View)[0].props.style)).toMatchObject({
        minHeight: 112,
        shadowOpacity: 0, shadowRadius: 0, elevation: 0, boxShadow: "none",
      });
    }
    expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toEqual(expect.arrayContaining([
      "settings_page.preferences", "settings_page.links", "settings_page.accounts.logged_in", "settings_page.accounts.manage",
    ]));
  });

  it("renders ten measured refractive shortcut cards instead of the former white glass wrappers", () => {
    const cards = renderer.root.findAllByType(GlassCard);
    expect(renderer.root.findAllByType(MoreGlassCard)).toHaveLength(14);
    expect(cards).toHaveLength(0);
    const shortcuts = renderer.root.findAllByType(TouchableOpacity).filter((node) =>
      typeof node.props.testID === "string" && node.props.testID.startsWith("settings-shortcut-"));
    expect(shortcuts).toHaveLength(10);
    for (const shortcut of shortcuts) {
      expect(shortcut.props).toMatchObject({ accessibilityRole: "button", activeOpacity: 1 });
      expect(StyleSheet.flatten(shortcut.props.style)).toMatchObject({
        width: "48%", minHeight: 112, marginBottom: 10,
        padding: 0, borderWidth: 0, backgroundColor: "transparent",
      });
      expect(shortcut.props.onLayout).toEqual(expect.any(Function));
      const card = shortcut.findByType(MoreGlassCard);
      expect(card.props.index).toBe(shortcuts.indexOf(shortcut));
      expect(StyleSheet.flatten(card.props.contentStyle)).toMatchObject({ padding: 14 });
      expect(card.findAllByType(GlassCard)).toHaveLength(0);
      expect(card.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
      expect(card.findAllByType(TouchableOpacity)).toHaveLength(0);
    }
    expect(renderer.root.findAll((node) => String(node.type) === "BlurView")).toHaveLength(0);
  });

  it("keeps the More viewport gray with one content inset and a transparent scrolling layer", () => {
    const scene = renderer.root.findByType(MoreGlassScene);
    expect(StyleSheet.flatten(scene.findAllByType(View)[0].props.style).backgroundColor).toBe(COLORS.BACKGROUND);
    const scroll = renderer.root.findByType(ScrollView);
    expect(StyleSheet.flatten(scroll.props.style).backgroundColor).toBe("transparent");
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)?.padding ?? 0).toBe(0);
    expect(scroll.props.onScroll).toEqual(expect.any(Function));
    expect(scroll.props.scrollEventThrottle).toBe(16);
    expect(scroll.findAllByType(View).filter((node) => StyleSheet.flatten(node.props.style)?.padding === 20)).toHaveLength(1);
  });

  it("keeps the nine route shortcuts and Update callback on their outer buttons", async () => {
    const routes = ["equip", "accessories", "gallery", "agent", "combat", "history", "crosshair", "leaderboard", "friends"];
    for (const route of routes) {
      const button = renderer.root.findAllByType(TouchableOpacity).find((node) => node.props.testID === `settings-shortcut-${route}`)!;
      act(() => { button.props.onPress(); });
      expect(mockRouter.push).toHaveBeenLastCalledWith(`/${route}`);
    }
    expect(mockRouter.push).toHaveBeenCalledTimes(9);
    const update = renderer.root.findAllByType(TouchableOpacity).find((node) => node.props.testID === "settings-shortcut-update")!;
    await act(async () => { update.props.onPress(); });
    expect(mockCheckUpdate).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByType("UpdatePopup" as never).props.visible).toBe(true);
    expect(renderer.root.findByType("UpdatePopup" as never).props.checking).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledTimes(9);
  });

  it("retains switch callbacks and language/link actions inside the glass groups", () => {
    const control = (label: string) => renderer.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === label)!;
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    try {
      act(() => { control("language").props.onPress(); });
      expect(mockRouter.push).toHaveBeenCalledWith("/language");
      act(() => { control("credits").props.onPress(); });
      expect(openUrl).toHaveBeenCalledWith("https://vshop.one/credits");
      const screenshot = renderer.root.findAllByType(Switch).find((node) => node.props.onValueChange === mockToggleScreenshot)!;
      expect(screenshot.props.value).toBe(false);
      act(() => screenshot.props.onValueChange(true));
      expect(mockToggleScreenshot).toHaveBeenCalledTimes(1);
    } finally { openUrl.mockRestore(); }
  });

  it("retains current-account restrictions and confirms removal before changing saved accounts", async () => {
    const session = jest.requireMock("~/services/accounts/session") as { switchSavedAccount: jest.Mock };
    const popupModule = jest.requireActual<typeof import("~/components/settings/AccountSwitcherPopup")>("~/components/settings/AccountSwitcherPopup");
    const ActualPopup = popupModule.AccountSwitcherPopup;
    let accountFocused = true;
    const focus = jest.spyOn(jest.requireMock("expo-router"), "useIsFocused").mockImplementation(() => accountFocused);
    let popupSpy: jest.SpyInstance | undefined;
    const accounts = renderer.root.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityLabel === "settings_page.accounts.switch_to");
    expect(accounts).toHaveLength(1);
    expect(accounts[0].props).toMatchObject({ disabled: true, accessibilityState: { disabled: true, selected: true } });
    const count = renderer.root.findByProps({ testID: "settings-account-count" });
    expect(count.props.accessibilityRole).toBe("button");
    expect(count.props.accessibilityState.expanded).toBe(false);
    expect(StyleSheet.flatten(count.props.style)).toMatchObject({ minHeight: 48, minWidth: 48 });
    act(() => count.props.onPress());
    expect(session.switchSavedAccount).not.toHaveBeenCalled();
    const popup = renderer.root.findByType(popupModule.AccountSwitcherPopup);
    for (const row of popup.props.accounts) {
      expect(Object.keys(row).sort()).toEqual(["displayName", "id", "region", "status"]);
    }
    const alternatives = renderer.root.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityLabel === "settings_page.accounts.switch_to" && !node.props.accessibilityState.selected);
    expect(alternatives).toHaveLength(1);
    expect(alternatives[0].props).toMatchObject({ disabled: false, accessibilityState: { disabled: false, selected: false } });
    const removals = renderer.root.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityLabel === "settings_page.accounts.remove_account");
    expect(removals).toHaveLength(1);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    try {
      act(() => removals[0].props.onPress());
      expect(mockRemoveAccount).not.toHaveBeenCalled();
      const buttons = alert.mock.calls[0][2]!;
      expect(buttons.some((button) => button.style === "cancel")).toBe(true);
      act(() => buttons.find((button) => button.style === "cancel")!.onPress?.());
      expect(mockRemoveAccount).not.toHaveBeenCalled();
      act(() => buttons.find((button) => button.style === "destructive")!.onPress!());
      expect(mockRemoveAccount).toHaveBeenCalledWith("other");
      session.switchSavedAccount.mockResolvedValue({ kind: "switched" });
      await act(async () => {
        alternatives[0].props.onPress();
        await Promise.resolve();
      });
      expect(session.switchSavedAccount).toHaveBeenCalledWith("other");
      expect(mockRouter.replace).toHaveBeenCalledWith("/profile");
      expect(renderer.root.findByProps({ testID: "settings-account-count" }).props.accessibilityState.expanded).toBe(false);
      const popupCommits: boolean[] = [];
      popupSpy = jest.spyOn(popupModule, "AccountSwitcherPopup").mockImplementation(function ObservePopup(props) {
        React.useLayoutEffect(() => { popupCommits.push(props.visible); });
        return <ActualPopup {...props} />;
      });
      act(() => renderer.root.findByProps({ testID: "settings-account-count" }).props.onPress());
      expect(popupCommits.at(-1)).toBe(true);
      const oldSwitch = renderer.root.findByProps({ testID: "settings-account-switch-other" }).props.onPress;
      const oldRemove = renderer.root.findByProps({ testID: "settings-account-remove-other" }).props.onPress;
      const switchesBeforeBlur = session.switchSavedAccount.mock.calls.length;
      const removalsBeforeBlur = mockRemoveAccount.mock.calls.length;
      const beforeBlur = popupCommits.length;
      accountFocused = false;
      act(() => renderer.update(<Settings />));
      expect(popupCommits.slice(beforeBlur)).not.toContain(true);
      await act(async () => { oldSwitch(); oldRemove(); });
      expect(session.switchSavedAccount).toHaveBeenCalledTimes(switchesBeforeBlur);
      expect(mockRemoveAccount).toHaveBeenCalledTimes(removalsBeforeBlur);
      expect(renderer.root.findByProps({ testID: "settings-account-count" }).props.accessibilityState.expanded).toBe(false);
      accountFocused = true;
      act(() => renderer.update(<Settings />));
      expect(popupCommits.at(-1)).toBe(false);
    } finally { alert.mockRestore(); session.switchSavedAccount.mockReset(); popupSpy?.mockRestore(); focus.mockRestore(); }
  });
});
