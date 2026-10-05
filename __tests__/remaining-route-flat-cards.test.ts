import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "react-native-paper";
import TestRenderer, { act } from "react-test-renderer";
import Setup from "~/app/setup";
import ReAuth from "~/app/reauth";
import Contracts from "~/app/(authenticated)/contracts";
import GlassCard from "~/components/ui/GlassCard";
import { FLAT_CARD_STYLE, LiquidGlassDecoration } from "~/components/ui/LiquidGlassSurface";
import { COLORS } from "~/constants/DesignSystem";

const mockUserState = { user: { region: "ap" }, setUser: jest.fn() };
const mockParams: { mode?: string; accountId?: string } = {};
const mockRouter = { replace: jest.fn() };
const mockRestoreCookies = jest.fn().mockResolvedValue(undefined);
const mockRefresh = jest.fn();
const mockContractsState = {
  contracts: {
    Contracts: [{ ContractDefinitionID: "agent-a", ProgressionLevelReached: 2,
      ProgressionTowardsNextLevel: 100, ContractProgression: { TotalProgressionEarned: 20 } }],
    Missions: [{ ID: "mission-a", Objectives: { target: 10 }, Complete: false }],
    ActiveSpecialContract: "agent-a",
  },
  contractDefinitions: [{ uuid: "agent-a", displayName: "Agent contract" }],
  loading: false, reload: mockRefresh, session: "synthetic-session",
};

jest.mock("~/hooks/useAppTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: (selector: (state: typeof mockUserState) => unknown) => selector(mockUserState) }));
jest.mock("~/hooks/useContractsScreenData", () => ({ useContractsScreenData: () => mockContractsState }));
jest.mock("~/hooks/useAsyncRefresh", () => ({ useAsyncRefresh: (reload: () => unknown) => ({ refreshing: false, onRefresh: reload }) }));
jest.mock("~/utils/valorant-assets", () => ({ getAgent: () => ({ agents: [] }) }));
jest.mock("~/utils/misc", () => ({ regions: ["ap", "eu"] }));
jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: { setItem: jest.fn() } }));
jest.mock("~/services/accounts/session", () => ({ restoreCurrentAccountAuthCookies: () => mockRestoreCookies() }));
jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams, useRouter: () => mockRouter }));
jest.mock("~/components/ui/AppViewport", () => ({ useAppWindowDimensions: () => ({ width: 390, height: 844 }) }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView", useSafeAreaInsets: () => ({ top: 12, bottom: 24 }) }));
jest.mock("react-native-paper", () => {
  const Native = require("react-native") as typeof import("react-native");
  return { Paragraph: Native.Text, Title: Native.Text, Button: "PaperButton", ActivityIndicator: "ActivityIndicator",
    RadioButton: { Group: "RadioGroup", Item: "RadioItem" }, useTheme: () => ({ colors: { primary: "black" } }) };
});
jest.mock("react-native-reanimated", () => {
  const Native = require("react-native") as typeof import("react-native");
  const entrance = { duration: () => entrance, reduceMotion: () => entrance };
  return { __esModule: true, default: { View: Native.View }, Easing: Native.Easing, FadeInDown: entrance, ReduceMotion: { System: "system" } };
});
jest.mock("~/components/LoginWebView", () => ({ __esModule: true, default: "LoginWebView" }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: "CachedImage" }));
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("~/components/ui/AppRefreshControl", () => ({ __esModule: true, default: "AppRefreshControl" }));
jest.mock("react-native-paper/lib/module/components/MaterialCommunityIcon", () => ({ __esModule: true, default: () => null }));

// This inventory is SOURCE ONLY proof of the fourteen JSX call sites, not device appearance.
describe("remaining route flat variants — source-only AST contract", () => {
  it.each([
    ["app/(authenticated)/about.tsx", 4],
    ["app/(authenticated)/contracts.tsx", 3],
    ["app/(authenticated)/item_upgrades.tsx", 2],
    ["app/setup.tsx", 4],
    ["app/reauth.tsx", 1],
  ] as const)("%s explicitly flattens its %i ordinary GlassCard call sites", (file, count) => {
    const source = ts.createSourceFile(file, readFileSync(path.join(__dirname, "..", file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const variants: (string | undefined)[] = [];
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === "GlassCard") {
        const variant = node.attributes.properties.find((prop) => ts.isJsxAttribute(prop) && prop.name.getText(source) === "variant");
        variants.push(variant && ts.isJsxAttribute(variant) && variant.initializer && ts.isStringLiteral(variant.initializer)
          ? variant.initializer.text : undefined);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(variants).toHaveLength(count);
    expect(variants).toEqual(Array.from({ length: count }, () => "flat"));
  });
});

describe("remaining route cards — actual component renders with mocked service boundaries", () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  const mount = (Screen: React.ComponentType) => { act(() => { renderer = TestRenderer.create(React.createElement(Screen)); }); };
  const cards = () => renderer!.root.findAllByType(GlassCard);
  const expectFlat = (count: number) => {
    expect(cards()).toHaveLength(count);
    for (const card of cards()) {
      expect(card.props.variant).toBe("flat");
      expect(StyleSheet.flatten(card.findAllByType(View)[0].props.style)).toMatchObject({ ...FLAT_CARD_STYLE,
        borderColor: StyleSheet.flatten(card.props.style)?.borderColor ?? FLAT_CARD_STYLE.borderColor });
      expect(card.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
    }
  };
  beforeEach(() => { jest.clearAllMocks(); mockUserState.user = { region: "ap" }; delete mockParams.mode; delete mockParams.accountId; });
  afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; });

  it("renders all four onboarding cards flat with the existing media and login geometry", () => {
    mount(Setup);
    expectFlat(4);
    const login = renderer!.root.findByType("LoginWebView" as never);
    expect(login.props.minHeight).toBe(572);
    expect(StyleSheet.flatten(cards()[0].props.contentStyle)).toEqual({ padding: 0 });
    const pager = renderer!.root.findAllByType(ScrollView).find((node) => node.props.pagingEnabled)!;
    expect(pager.props).toMatchObject({ horizontal: true, scrollEnabled: false });
    const buttons = renderer!.root.findAllByType(Button);
    expect(buttons.map((button) => button.props.disabled)).toEqual([true, false]);
  });

  it("keeps the region guard and next-button state when the login card is absent", () => {
    mockUserState.user = { region: "" };
    mount(Setup);
    expectFlat(3);
    expect(renderer!.root.findAllByType("LoginWebView" as never)).toHaveLength(0);
    const pager = renderer!.root.findAllByType(ScrollView).find((node) => node.props.pagingEnabled)!;
    act(() => pager.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 390 } } }));
    expect(renderer!.root.findAllByType(Button).map((button) => button.props.disabled)).toEqual([false, true]);
  });

  it.each(["reauth", "add", "switch"])("renders a flat %s login card with existing account and cancel guards", (mode) => {
    mockParams.mode = mode; mockParams.accountId = "synthetic-account";
    mount(ReAuth);
    expectFlat(1);
    expect(renderer!.root.findByType("LoginWebView" as never).props).toMatchObject({
      minHeight: 648, expectedAccountId: mode === "switch" ? "synthetic-account" : undefined,
    });
    const cancel = renderer!.root.findAll((node) => node.props.accessibilityRole === "button" &&
      node.props.accessibilityLabel === "settings_page.accounts.back_to_more");
    expect(cancel.length > 0).toBe(mode !== "reauth");
    expect(mockRestoreCookies).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("renders contract and mission cards flat while retaining the active border, stats geometry and refresh", () => {
    mount(Contracts);
    expectFlat(2);
    expect(StyleSheet.flatten(cards()[0].props.style)).toMatchObject({ borderColor: COLORS.PURE_BLACK, borderWidth: 1 });
    const stats = renderer!.root.findAllByType(View).filter((node) => StyleSheet.flatten(node.props.style)?.minHeight === 84);
    expect(stats).toHaveLength(2);
    for (const stat of stats) expect(StyleSheet.flatten(stat.props.style)).toMatchObject({ ...FLAT_CARD_STYLE,
      flex: 1, minHeight: 84, borderRadius: 18, padding: 12, justifyContent: "center" });
    expect(renderer!.root.findAllByType(Text).some((node) => node.props.children === "contracts_page.activated")).toBe(true);
    expect(renderer!.root.findByType("AppRefreshControl" as never).props.onRefresh).toBe(mockRefresh);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("renders the empty contract card flat and retains its refresh container", () => {
    const previous = mockContractsState.contracts;
    mockContractsState.contracts = { ...previous, Contracts: [], Missions: [] };
    try {
      mount(Contracts); expectFlat(1);
      expect(renderer!.root.findByType(ScrollView)).toBeDefined();
      expect(renderer!.root.findByType("AppRefreshControl" as never).props.onRefresh).toBe(mockRefresh);
    } finally { mockContractsState.contracts = previous; }
  });
});
