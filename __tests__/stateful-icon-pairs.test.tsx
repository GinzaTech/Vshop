import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import ItemUpgradesScreen from "~/app/(authenticated)/item_upgrades";
import ShopScreen from "~/app/(authenticated)/shop";
import { EconomyChart } from "~/components/match-detail/EconomyChart";
import { ScoreboardTable } from "~/components/match-detail/ScoreboardTable";
import { MatchImage } from "~/components/matches/MatchImage";
import {
  MatchListSkeleton,
  MatchStatePanel,
} from "~/components/matches/MatchStates";
import type { EconomyPoint, ScoreboardPlayer } from "~/types/match-ui";

const mockGetItemUpgrades = jest.fn();
const mockRefreshShopAndBalances = jest.fn();
const weaponSkinTypeId = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";
const mockCommerceUser = {
  accessToken: "access-token",
  entitlementsToken: "entitlements-token",
  region: "ap",
  name: "Agent",
  balances: { vp: 0 },
  shops: {
    main: [],
    remainingSecs: { main: 60 },
  },
};

const itemUpgradeFixture: ItemUpgradesResponse = {
  Definitions: [
    {
      ID: "definition-1",
      Item: { ItemTypeID: weaponSkinTypeId, ItemID: "item-1" },
      RequiredEntitlement: {
        ItemTypeID: weaponSkinTypeId,
        ItemID: "entitlement-1",
      },
      ProgressionSchedule: {
        Name: "Upgrade path",
        ProgressionCurrencyID: "currency-1",
        ProgressionDeltaPerLevel: [10],
      },
      RewardSchedule: {
        ID: "reward-schedule-1",
        Name: "Rewards",
        Prerequisites: null,
        RewardsPerLevel: [],
      },
      Sidegrades: [
        {
          SidegradeID: "sidegrade-1",
          Options: [
            {
              OptionID: "option-1",
              Cost: {
                WalletCosts: [
                  { CurrencyID: "currency-1", AmountToDeduct: 15 },
                ],
              },
              Rewards: [
                {
                  ItemTypeID: weaponSkinTypeId,
                  ItemID: "reward-1",
                  Amount: 1,
                },
              ],
            },
          ],
          Prerequisites: { RequiredEntitlements: [] },
        },
      ],
    },
  ],
};

function MockAppIcon(props: Record<string, unknown>) {
  const ActualAppIcon = jest.requireActual<
    typeof import("~/components/ui/AppIcon")
  >("~/components/ui/AppIcon").default;

  return React.createElement(
    ActualAppIcon,
    props as React.ComponentProps<typeof ActualAppIcon>,
  );
}

function MockMorphIcon(props: Record<string, unknown>) {
  return React.createElement("MorphIcon", props);
}

jest.mock("morphicons/react-native", () => ({ MorphIcon: MockMorphIcon }));
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () =>
  "MaterialCommunityIcons"
);
jest.mock("~/components/ui/AppIcon", () => ({
  __esModule: true,
  default: MockAppIcon,
}));
jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: (selector: (state: { user: typeof mockCommerceUser }) => unknown) =>
    selector({ user: mockCommerceUser }),
}));
jest.mock("~/hooks/useWishlistStore", () => ({
  useWishlistStore: (selector: (state: { skinIds: string[] }) => unknown) =>
    selector({ skinIds: [] }),
}));
jest.mock("~/hooks/useAsyncRefresh", () => ({
  useAsyncRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));
jest.mock("~/utils/app-sync", () => ({
  refreshShopAndBalances: (...args: unknown[]) =>
    mockRefreshShopAndBalances(...args),
}));
jest.mock("~/utils/valorant-api", () => ({
  getItemUpgrades: (...args: unknown[]) => mockGetItemUpgrades(...args),
}));
jest.mock("~/utils/valorant-assets", () => ({
  getAssetLookups: () => ({
    skinByAnyId: new Map([
      [
        "item-1",
        {
          uuid: "item-1",
          displayName: "Test skin",
          displayIcon: "https://example.invalid/item.png",
        },
      ],
      [
        "reward-1",
        {
          uuid: "reward-1",
          displayName: "Test variant",
          displayIcon: "https://example.invalid/reward.png",
        },
      ],
    ]),
  }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
jest.mock("react-native-paper", () => ({
  ActivityIndicator: "ActivityIndicator",
}));
jest.mock("~/components/Countdown", () => "Countdown");
jest.mock("~/components/ShopItem", () => "ShopItem");
jest.mock("~/components/CurrencyIcon", () => "CurrencyIcon");
jest.mock("~/components/ui/AppRefreshControl", () => "AppRefreshControl");
jest.mock("~/components/ui/EmptyStateCard", () => "EmptyStateCard");
jest.mock("~/components/ui/GlassCard", () => ({
  __esModule: true,
  default: "GlassCard",
}));
jest.mock("~/components/ui/InfoPill", () => "InfoPill");
jest.mock("~/components/CachedImage", () => ({ CachedImage: "CachedImage" }));
jest.mock("~/components/ui/GpuLineChartCanvas", () => ({
  GpuLineChartCanvas: "GpuLineChartCanvas",
}));
jest.mock("~/hooks/useMotionPreference", () => ({
  useMotionPreference: () => true,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.number === undefined ? key : `${key}:${options.number}`,
  }),
}));
jest.mock("~/utils/match-ui", () => ({
  formatMetric: (value: number | undefined) => String(value ?? "--"),
  formatPercent: (value: number | undefined) => `${value ?? "--"}%`,
  formatSigned: (value: number | undefined) => String(value ?? "--"),
}));

function findControlByIcon(
  renderer: TestRenderer.ReactTestRenderer,
  iconName: string,
) {
  const control = renderer.root.findAllByType(TouchableOpacity).find((node) =>
    node
      .findAllByType(MockAppIcon)
      .some((icon) => icon.props.name === iconName),
  );

  if (!control) {
    throw new Error(`Unable to find control with AppIcon ${iconName}`);
  }

  return control;
}

async function renderItemUpgrades() {
  mockGetItemUpgrades.mockResolvedValue(itemUpgradeFixture);
  let renderer!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    renderer = TestRenderer.create(<ItemUpgradesScreen />);
    await Promise.resolve();
  });

  return renderer;
}

const economyPoints: EconomyPoint[] = [
  {
    roundNumber: 1,
    teamAEconomy: 4_000,
    teamBEconomy: 3_000,
    teamASpent: 2_000,
    teamBSpent: 1_500,
    difference: 1_000,
    winningTeam: "A",
    outcome: "elimination",
  },
];

const scoreboardPlayers: ScoreboardPlayer[] = [
  {
    playerId: "player-a",
    playerName: "Alpha",
    team: "A",
    agent: { name: "Jett" },
    acs: 300,
    kills: 20,
    deaths: 10,
    assists: 5,
    plusMinus: 10,
    kd: 2,
    adr: 180,
  },
];

describe("stateful commerce icon pairs", () => {
  beforeEach(() => {
    mockGetItemUpgrades.mockReset();
    mockRefreshShopAndBalances.mockClear();
  });

  it("keeps one wishlist icon mounted from outline to filled", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<ShopScreen />);
    });

    const wishlistControl = renderer.root.findByProps({
      testID: "shop-filter-wishlist",
    });
    const outlineIcon = wishlistControl.findByType(MockAppIcon);
    expect(wishlistControl.findAllByType(MockAppIcon)).toHaveLength(1);
    expect(wishlistControl.props).toMatchObject({
      accessibilityRole: "tab",
      accessibilityState: { selected: false },
    });
    expect(outlineIcon.props).toMatchObject({
      decorative: true,
      name: "wishlist",
    });
    expect(outlineIcon.findByType(MockMorphIcon).props.fill).toBe("none");

    act(() => wishlistControl.props.onPress());

    const selectedControl = renderer.root.findByProps({
      testID: "shop-filter-wishlist",
    });
    const filledIcon = selectedControl.findByType(MockAppIcon);
    expect(selectedControl.findAllByType(MockAppIcon)).toHaveLength(1);
    expect(filledIcon).toBe(outlineIcon);
    expect(selectedControl.props.accessibilityState).toEqual({ selected: true });
    expect(filledIcon.props).toMatchObject({
      decorative: true,
      name: "wishlistFilled",
    });
    const filledGlyph = filledIcon.findByType(MockMorphIcon);
    expect(filledGlyph.props.fill).toBe(filledGlyph.props.color);
    expect(mockRefreshShopAndBalances).not.toHaveBeenCalled();

    act(() => renderer.unmount());
  });

  it("keeps one item-upgrade option icon mounted from unselected to selected", async () => {
    const renderer = await renderItemUpgrades();
    const collapsedControl = findControlByIcon(renderer, "chevronDown");

    act(() => collapsedControl.props.onPress());

    const optionControl = findControlByIcon(renderer, "unselected");
    const unselectedIcon = optionControl.findByType(MockAppIcon);
    expect(optionControl.findAllByType(MockAppIcon)).toHaveLength(1);
    expect(optionControl.props.accessibilityLabel).toBe("Test variant");
    expect(optionControl.props.accessibilityRole).toBe("radio");
    expect(optionControl.props.accessibilityState).toEqual({ selected: false });
    expect(unselectedIcon.props).toMatchObject({
      decorative: true,
      name: "unselected",
    });

    act(() => optionControl.props.onPress());

    const selectedControl = findControlByIcon(renderer, "selected");
    const selectedIcon = selectedControl.findByType(MockAppIcon);
    expect(selectedControl.findAllByType(MockAppIcon)).toHaveLength(1);
    expect(selectedIcon).toBe(unselectedIcon);
    expect(selectedControl.props.accessibilityState).toEqual({ selected: true });
    expect(selectedIcon.props).toMatchObject({
      decorative: true,
      name: "selected",
    });

    act(() => renderer.unmount());
  });

  it("keeps one item-upgrade group icon mounted from collapsed to expanded", async () => {
    const renderer = await renderItemUpgrades();
    const collapsedControl = findControlByIcon(renderer, "chevronDown");
    expect(collapsedControl.props.accessibilityLabel).toBe("Test skin");
    expect(collapsedControl.props.accessibilityRole).toBe("button");
    expect(collapsedControl.props.accessibilityState).toEqual({
      expanded: false,
    });
    const collapsedPairIcons = collapsedControl
      .findAllByType(MockAppIcon)
      .filter((icon) =>
        ["chevronDown", "chevronUp"].includes(icon.props.name),
      );
    expect(collapsedPairIcons).toHaveLength(1);
    const collapsedIcon = collapsedPairIcons[0];
    expect(collapsedIcon.props).toMatchObject({
      decorative: true,
      name: "chevronDown",
    });

    act(() => collapsedControl.props.onPress());

    const expandedControl = findControlByIcon(renderer, "chevronUp");
    const expandedPairIcons = expandedControl
      .findAllByType(MockAppIcon)
      .filter((icon) =>
        ["chevronDown", "chevronUp"].includes(icon.props.name),
      );
    expect(expandedPairIcons).toHaveLength(1);
    const expandedIcon = expandedPairIcons[0];
    expect(expandedIcon).toBe(collapsedIcon);
    expect(expandedControl.props.accessibilityState).toEqual({ expanded: true });
    expect(expandedIcon.props).toMatchObject({
      decorative: true,
      name: "chevronUp",
    });

    act(() => renderer.unmount());
  });
});

describe("stateful Match icon pairs", () => {
  it("keeps one economy icon mounted from collapsed to expanded", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<EconomyChart points={economyPoints} />);
    });

    const trigger = renderer.root.findByProps({
      testID: "match-detail-economy-menu",
    });
    const collapsedIcon = trigger.findByType(MockAppIcon);
    expect(collapsedIcon.props).toMatchObject({
      decorative: true,
      name: "chevronDown",
    });

    act(() => trigger.props.onPress());

    const expandedIcon = renderer.root
      .findByProps({ testID: "match-detail-economy-menu" })
      .findByType(MockAppIcon);
    expect(expandedIcon).toBe(collapsedIcon);
    expect(expandedIcon.props).toMatchObject({
      decorative: true,
      name: "chevronUp",
    });

    act(() => renderer.unmount());
  });

  it("keeps one scoreboard icon mounted from descending to ascending", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ScoreboardTable
          players={scoreboardPlayers}
          onSelectPlayer={jest.fn()}
        />,
      );
    });

    const sortControl = () =>
      renderer.root.findByProps({ testID: "match-detail-sort-acs" });

    act(() => sortControl().props.onPress());
    const descendingIcon = sortControl().findByType(MockAppIcon);
    expect(descendingIcon.props).toMatchObject({
      decorative: true,
      name: "sortDescending",
    });

    act(() => sortControl().props.onPress());
    const ascendingIcon = sortControl().findByType(MockAppIcon);
    expect(ascendingIcon).toBe(descendingIcon);
    expect(ascendingIcon.props).toMatchObject({
      decorative: true,
      name: "sortAscending",
    });

    act(() => renderer.unmount());
  });

  it("keeps retry and loading as separate real Match states", () => {
    let stateRenderer!: TestRenderer.ReactTestRenderer;
    let loadingRenderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      stateRenderer = TestRenderer.create(
        <MatchStatePanel
          icon="history"
          title="No matches"
          body="Try refreshing"
          primaryLabel="Retry"
          onPrimaryPress={jest.fn()}
        />,
      );
      loadingRenderer = TestRenderer.create(<MatchListSkeleton />);
    });

    const retryButton = stateRenderer.root.find(
      (node) => node.props.accessibilityRole === "button",
    );
    expect(retryButton.findByType(MockAppIcon).props).toMatchObject({
      decorative: true,
      name: "retry",
    });
    expect(
      loadingRenderer.root.findAll(
        (node) =>
          node.type === View && node.props.accessibilityLabel === "Loading match",
      ),
    ).toHaveLength(4);

    act(() => {
      stateRenderer.unmount();
      loadingRenderer.unmount();
    });
  });

  it("renders 100 static MatchImage fallbacks without repeat work or icon churn", () => {
    const source = readFileSync(
      join(process.cwd(), "components", "matches", "MatchImage.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/\b(?:setTimeout|setInterval|withRepeat)\b/);

    const renderRows = () => (
      <View>
        {Array.from({ length: 100 }, (_, index) => (
          <MatchImage key={index} style={{ height: 24, width: 24 }} />
        ))}
      </View>
    );

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(renderRows());
    });

    const initialIcons = renderer.root.findAllByType(MockAppIcon);
    expect(initialIcons).toHaveLength(100);
    expect(initialIcons.every((icon) => icon.props.name === "emptyImage")).toBe(
      true,
    );

    act(() => renderer.update(renderRows()));

    const updatedIcons = renderer.root.findAllByType(MockAppIcon);
    expect(updatedIcons).toHaveLength(100);
    updatedIcons.forEach((icon, index) => {
      expect(icon).toBe(initialIcons[index]);
      expect(icon.props.name).toBe("emptyImage");
    });

    act(() => renderer.unmount());
  });
});
