import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import NightMarket from "~/app/(authenticated)/night_market";
import { getGlassNavigationMetrics } from "~/features/navigation/navigation-model";
import { refreshShopAndBalances } from "~/utils/app-sync";

let mockBottom = 24;
let mockItems: { uuid: string }[] = [];
jest.mock("~/constants/Motion", () => ({ NAV_MOTION: {} }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: mockBottom }) }));
jest.mock("~/components/ui/AppViewport", () => ({ useAppWindowDimensions: () => ({ width: 360, height: 800 }) }));
jest.mock("~/components/ui/AppIcon", () => "AppIcon");
jest.mock("~/components/Countdown", () => "Countdown");
jest.mock("~/components/NightMarketItem", () => "NightMarketItem");
jest.mock("~/components/ui/EmptyStateCard", () => "EmptyStateCard");
jest.mock("~/components/ui/AppRefreshControl", () => "AppRefreshControl");
jest.mock("~/utils/app-sync", () => ({ refreshShopAndBalances: jest.fn() }));
jest.mock("~/hooks/useAsyncRefresh", () => ({ useAsyncRefresh: (task: () => unknown) => ({ refreshing: false, onRefresh: task }) }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: () => ({ name: "QA", balances: { vp: 0 }, shops: { nightMarket: mockItems, remainingSecs: { nightMarket: 60 } } }) }));

describe("Night Market full-height glass viewport", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  afterEach(() => act(() => renderer?.unmount()));
  it.each([0, 24, 48])("keeps safe clearance inside scrolling content at inset %s", (bottom) => {
    mockBottom = bottom;
    mockItems = [{ uuid: "qa-item" }];
    act(() => { renderer = TestRenderer.create(<NightMarket />); });
    const scroll = renderer.root.findByType(ScrollView);
    expect(StyleSheet.flatten(scroll.props.style).paddingBottom).toBeUndefined();
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBe(getGlassNavigationMetrics(360, bottom).contentBottomPadding);
    expect(renderer.root.findAllByProps({ item: mockItems[0] })).toHaveLength(1);
  });
  it("keeps the empty page scrollable and its refresh connected to real reads", () => {
    mockItems = [];
    act(() => { renderer = TestRenderer.create(<NightMarket />); });
    const scroll = renderer.root.findByType(ScrollView);
    expect(scroll.props.alwaysBounceVertical).toBe(true);
    act(() => scroll.props.refreshControl.props.onRefresh());
    expect(refreshShopAndBalances).toHaveBeenCalledWith(true);
  });
});
