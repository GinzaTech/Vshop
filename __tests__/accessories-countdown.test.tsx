import React from "react";
import { ScrollView, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import AccessoryShop from "~/app/(authenticated)/accessories";

const mockRefreshShopAndBalances = jest.fn();

type MockAccessory = {
  uuid: string;
  displayName: string;
  price: number;
  displayIcon: string;
};

type MockUser = {
  id: string;
  region: string;
  balances: { kc: number };
  shops: {
    accessory: MockAccessory[];
    remainingSecs: { accessory: number };
  };
};

let mockUser: MockUser;

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: <T,>(selector: (state: { user: MockUser }) => T) =>
    selector({ user: mockUser }),
}));
jest.mock("~/utils/app-sync", () => ({
  refreshShopAndBalances: (...args: unknown[]) => mockRefreshShopAndBalances(...args),
}));
jest.mock("~/components/ShopAccessoryItem", () => {
  const { Text: NativeText } = require("react-native");
  return function MockShopAccessoryItem({ item }: { item: MockAccessory }) {
    return <NativeText>{item.displayName}</NativeText>;
  };
});
jest.mock("~/components/CurrencyIcon", () => {
  const { View: NativeView } = require("react-native");
  return function MockCurrencyIcon() {
    return <NativeView testID="currency-icon" />;
  };
});
jest.mock("~/components/ui/AppIcon", () => {
  const { View: NativeView } = require("react-native");
  return function MockAppIcon() {
    return <NativeView testID="app-icon" />;
  };
});
jest.mock("~/components/ui/EmptyStateCard", () => {
  const { Text: NativeText } = require("react-native");
  return function MockEmptyStateCard({ title }: { title: string }) {
    return <NativeText>{title}</NativeText>;
  };
});
jest.mock("~/components/ui/InfoPill", () => {
  const { View: NativeView } = require("react-native");
  return function MockInfoPill({ children }: { children: React.ReactNode }) {
    return <NativeView>{children}</NativeView>;
  };
});
jest.mock("~/components/ui/TwoColumnGrid", () => {
  const { View: NativeView } = require("react-native");
  return function MockTwoColumnGrid({
    items,
    renderItem,
  }: {
    items: MockAccessory[];
    renderItem: (item: MockAccessory) => React.ReactNode;
  }) {
    return (
      <NativeView>
        {items.map((item) => (
          <NativeView key={item.uuid}>{renderItem(item)}</NativeView>
        ))}
      </NativeView>
    );
  };
});

const BASE_NOW = 1_000_000;
const accessory = (name = "Lucky Buddy"): MockAccessory => ({
  uuid: name.toLowerCase().replace(/\s+/g, "-"),
  displayName: name,
  price: 4500,
  displayIcon: "https://example.invalid/accessory.png",
});
const makeUser = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: "account-a",
  region: "ap",
  balances: { kc: 100 },
  shops: {
    accessory: [accessory()],
    remainingSecs: { accessory: 120 },
  },
  ...overrides,
});

describe("Accessory shop countdown deadline", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const render = () => {
    act(() => {
      renderer = TestRenderer.create(<AccessoryShop />);
    });
  };
  const update = () => {
    act(() => {
      renderer.update(<AccessoryShop />);
    });
  };
  const countdown = () =>
    renderer.root.findAllByType(Text)
      .map((node) => node.props.children)
      .find((value): value is string =>
        typeof value === "string" && /^\d{2}:\d{2}:\d{2}$/.test(value)
      );
  const advance = async (ms: number) => {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });
  };
  const search = (query: string) => {
    act(() => {
      renderer.root.findByProps({ testID: "accessories-search-input" }).props.onChangeText(query);
    });
  };
  const refresh = () => {
    act(() => {
      void renderer.root.findByType(ScrollView).props.refreshControl.props.onRefresh();
    });
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(BASE_NOW);
    mockUser = makeUser();
    mockRefreshShopAndBalances.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    jest.useRealTimers();
  });

  it("keeps the accessory deadline stable across search, balance and refresh rerenders", async () => {
    let resolveRefresh!: () => void;
    mockRefreshShopAndBalances.mockReturnValue(new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    }));
    render();
    expect(countdown()).toBe("00:02:00");
    await advance(10_000);
    expect(countdown()).toBe("00:01:50");

    search("lucky");
    expect(countdown()).toBe("00:01:50");

    mockUser = {
      ...mockUser,
      balances: { kc: 250 },
      shops: {
        accessory: [...mockUser.shops.accessory],
        remainingSecs: { accessory: 120 },
      },
    };
    update();
    expect(countdown()).toBe("00:01:50");

    refresh();
    expect(renderer.root.findByType(ScrollView).props.refreshControl.props.refreshing).toBe(true);
    expect(countdown()).toBe("00:01:50");

    await act(async () => {
      resolveRefresh();
    });
    expect(renderer.root.findByType(ScrollView).props.refreshControl.props.refreshing).toBe(false);
    expect(countdown()).toBe("00:01:50");
  });

  it("moves the deadline when remaining seconds or the account owner changes", async () => {
    render();
    await advance(10_000);
    expect(countdown()).toBe("00:01:50");

    mockUser = {
      ...mockUser,
      shops: {
        ...mockUser.shops,
        remainingSecs: { accessory: 300 },
      },
    };
    update();
    expect(countdown()).toBe("00:05:00");

    await advance(10_000);
    expect(countdown()).toBe("00:04:50");

    mockUser = {
      ...mockUser,
      id: "account-b",
      shops: {
        ...mockUser.shops,
        remainingSecs: { accessory: 120 },
      },
    };
    update();
    expect(countdown()).toBe("00:02:00");
  });
});
