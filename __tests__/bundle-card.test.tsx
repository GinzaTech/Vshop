import React from "react";
import { Dimensions, StyleSheet } from "react-native";
import TestRenderer, {
  act,
  type ReactTestInstance,
} from "react-test-renderer";

import BundleImage from "~/components/BundleImage";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

// i18n: trả key gốc, riêng items_count nội suy count để kiểm tra meta row.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      key === "bundles_page.items_count" &&
      options &&
      typeof options.count === "number"
        ? `${options.count} items`
        : key,
  }),
}));

// Ảnh cache được mock: element vẫn nằm trong tree nên vẫn đọc được props.source.
jest.mock("~/components/CachedImage", () => ({
  CachedImage: () => null,
}));

const FIXED_NOW = new Date("2026-09-30T00:00:00.000Z").getTime();
// 21d 06:04:27 — full countdown của bundle Champions 2026.
const REMAINING_SECS = ((21 * 24 + 6) * 60 + 4) * 60 + 27;

function makeItem(
  overrides: Partial<AccessoryShopItem> = {}
): AccessoryShopItem {
  return {
    uuid: "item-1",
    displayName: "Champions Vandal",
    price: 1766,
    originalPrice: 2675,
    displayIcon: "https://example.com/vandal.png",
    ...overrides,
  };
}

function makeBundle(
  overrides: Partial<BundleShopItem> = {}
): BundleShopItem {
  return {
    uuid: "champions-2026",
    displayName: "Champions 2026",
    description: "",
    useAdditionalContext: false,
    displayIcon: "https://example.com/champions.png",
    displayIcon2: "",
    assetPath: "",
    price: 5310,
    originalPrice: 6640,
    items: [
      makeItem(),
      makeItem({
        uuid: "item-2",
        displayName: "Champions Card",
        displayIcon: undefined,
      }),
    ],
    ...overrides,
  };
}

function renderCard(bundle: BundleShopItem, remainingSecs = REMAINING_SECS) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <BundleImage bundle={bundle} remainingSecs={remainingSecs} />
    );
  });
  return renderer;
}

type TestRoot = ReactTestInstance;

/**
 * Chỉ đếm node host (typeof node.type === "string"): mỗi phần tử render
 * một lần. Node composite của react-native (Text/View wrapper) và node host
 * cùng mang props nên phải lọc để không đếm trùng.
 */
function findHostNodes(
  root: TestRoot,
  predicate: (node: ReactTestInstance) => boolean
) {
  return root.findAll(
    (node) => typeof node.type === "string" && predicate(node)
  );
}

function findAllByText(root: TestRoot, text: string) {
  return findHostNodes(
    root,
    (node) =>
      typeof node.props.children === "string" && node.props.children === text
  );
}

function findAllByTestId(root: TestRoot, testID: string) {
  return findHostNodes(root, (node) => node.props.testID === testID);
}

function findStruckTexts(root: TestRoot) {
  return findHostNodes(
    root,
    (node) =>
      StyleSheet.flatten(node.props.style ?? {}).textDecorationLine ===
      "line-through"
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe("BundleImage white detail card", () => {
  it("renders hero, title, real Riot prices and meta on a white surface", () => {
    const renderer = renderCard(makeBundle());
    try {
      const root = renderer.root;

      expect(findAllByText(root, "Champions 2026")).toHaveLength(1);
      expect(findAllByText(root, "5.310")).toHaveLength(1); // giá bundle hiện tại
      expect(findAllByText(root, "6.640")).toHaveLength(1); // giá gốc bị gạch
      expect(findAllByText(root, "21d 06:04:27")).toHaveLength(1);
      expect(findAllByText(root, "2 items")).toHaveLength(1);
      expect(findAllByText(root, "bundles_page.estimate")).toHaveLength(1);

      const card = findAllByTestId(root, "bundle-card")[0];
      expect(findAllByTestId(root, "bundle-card")).toHaveLength(1);
      expect(StyleSheet.flatten(card.props.style).backgroundColor).toBe(
        COLORS.SURFACE
      );
      expect(StyleSheet.flatten(card.props.style).borderRadius).toBe(
        RADIUS.screen
      );
      expect(StyleSheet.flatten(card.props.style).overflow).toBe("hidden");
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("strikes the old price only when it exceeds the current price", () => {
    const renderer = renderCard(makeBundle());
    try {
      const root = renderer.root;
      const oldPrice = findAllByText(root, "6.640")[0];
      expect(
        StyleSheet.flatten(oldPrice.props.style).textDecorationLine
      ).toBe("line-through");
      expect(
        StyleSheet.flatten(findAllByText(root, "5.310")[0].props.style)
          .textDecorationLine
      ).toBeUndefined();
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("renders one current price without strikethrough when there is no discount", () => {
    const renderer = renderCard(
      makeBundle({
        price: 5310,
        originalPrice: 5310,
        items: [makeItem({ price: 1766, originalPrice: 1766 })],
      })
    );
    try {
      const root = renderer.root;
      expect(findAllByText(root, "5.310")).toHaveLength(1);
      expect(findAllByText(root, "1.766")).toHaveLength(1);
      expect(findStruckTexts(root)).toHaveLength(0);
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("omits the old price row entirely when the base price is missing", () => {
    const renderer = renderCard(
      makeBundle({
        originalPrice: undefined,
        items: [makeItem({ originalPrice: undefined })],
      })
    );
    try {
      const root = renderer.root;
      expect(findAllByText(root, "6.640")).toHaveLength(0);
      expect(findAllByText(root, "2.675")).toHaveLength(0);
      expect(findStruckTexts(root)).toHaveLength(0);
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("shrinks long localized names without colliding with the price column", () => {
    const longName =
      "Evori Dreamwings Ultra Deluxe Collection September 2026";
    const renderer = renderCard(makeBundle({ displayName: longName }));
    try {
      const title = findAllByText(renderer.root, longName)[0];
      expect(title).toBeTruthy();
      expect(title.props.numberOfLines).toBe(2);
      expect(StyleSheet.flatten(title.props.style).flexShrink).toBe(1);
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("keeps reserved hero space and uses the fallback asset when art is missing", () => {
    const renderer = renderCard(
      makeBundle({ displayIcon: "", displayIcon2: "" })
    );
    try {
      const root = renderer.root;
      const hero = root.findByProps({
        cacheId: "bundle:champions-2026:hero",
      });
      expect(hero.props.source).not.toEqual({ uri: "" });
      expect(hero.props.source).toEqual(
        require("~/assets/images/noimage.png")
      );
      // Khung hero giữ chỗ cố định qua aspectRatio dù ảnh thiếu.
      const frameStyle = StyleSheet.flatten(hero.parent?.props.style ?? {});
      expect(frameStyle.aspectRatio).toBeGreaterThan(0);
      expect(frameStyle.backgroundColor).toBe(COLORS.SURFACE_MUTED);

      // Item thiếu ảnh cũng dùng fallback và giữ khung vuông.
      const itemImage = root.findByProps({
        cacheId: "bundle-item:item-2:display",
      });
      expect(itemImage.props.source).toEqual(
        require("~/assets/images/noimage.png")
      );
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("renders a horizontal non-wrapping carousel with a partially visible next card", () => {
    const renderer = renderCard(makeBundle());
    try {
      const root = renderer.root;
      const carousel = root.findByProps({
        testID: "bundle-item-carousel",
      });
      expect(carousel.props.horizontal).toBe(true);
      expect(carousel.props.numColumns).toBeUndefined();
      expect(carousel.props.data).toHaveLength(2);
      expect(carousel.props.showsHorizontalScrollIndicator).toBe(false);
      expect(carousel.props.nestedScrollEnabled).toBe(true);

      // Cell width nằm trong khoảng clamp và hẹp hơn card để lộ card kế tiếp.
      const cells = findAllByTestId(root, "bundle-item-cell");
      expect(cells).toHaveLength(2);
      const cellWidth = StyleSheet.flatten(cells[0].props.style).width;
      expect(StyleSheet.flatten(cells[0].props.style).backgroundColor).toBe(
        COLORS.SURFACE_MUTED
      );
      expect(StyleSheet.flatten(cells[0].props.style).borderRadius).toBe(
        RADIUS.xl
      );
      expect(cellWidth).toBeGreaterThanOrEqual(118);
      expect(cellWidth).toBeLessThanOrEqual(164);
      // Card content = chiều rộng màn hình trừ padding 20 mỗi bên của screen.
      const cardContentWidth = Dimensions.get("window").width - 2 * 20;
      expect(Number(cellWidth)).toBeLessThan(cardContentWidth);
      expect(Number(cellWidth) * 2 + 10).toBeLessThan(cardContentWidth);

      // getItemLayout ổn định cho độ rộng cố định.
      const layout = carousel.props.getItemLayout(null, 1);
      expect(layout.length).toBe(Number(cellWidth) + 10);
      expect(layout.offset).toBe(Number(cellWidth) + 10);
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("renders single-item and empty bundles without a broken carousel", () => {
    const single = renderCard(makeBundle({ items: [makeItem()] }));
    try {
      const carousel = single.root.findByProps({
        testID: "bundle-item-carousel",
      });
      expect(carousel.props.data).toHaveLength(1);
      expect(carousel.props.horizontal).toBe(true);
    } finally {
      act(() => {
        single.unmount();
      });
    }

    const empty = renderCard(makeBundle({ items: [] }));
    try {
      const carousel = empty.root.findByProps({
        testID: "bundle-item-carousel",
      });
      expect(carousel.props.data).toHaveLength(0);
      expect(findAllByText(empty.root, "0 items")).toHaveLength(1);
      expect(findAllByTestId(empty.root, "bundle-item-cell")).toHaveLength(0);
    } finally {
      act(() => {
        empty.unmount();
      });
    }
  });

  it("keeps the FlatList ungrouped and exposes one concise summary per item", () => {
    const renderer = renderCard(makeBundle());
    try {
      const root = renderer.root;
      const carousel = root.findByProps({
        testID: "bundle-item-carousel",
      });
      expect(carousel.props.accessible).toBe(false);

      const vandalSummary = findHostNodes(
        root,
        (node) =>
          node.props.accessibilityLabel === "Champions Vandal, 1.766 VP"
      );
      const cardSummary = findHostNodes(
        root,
        (node) =>
          node.props.accessibilityLabel === "Champions Card, 1.766 VP"
      );
      expect(vandalSummary).toHaveLength(1);
      expect(cardSummary).toHaveLength(1);
      expect(vandalSummary[0].props.accessible).toBe(true);
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("hides the ends-in prefix once the bundle has expired", () => {
    const renderer = renderCard(makeBundle(), 0);
    try {
      const root = renderer.root;
      expect(findAllByText(root, "bundles_page.ends_in")).toHaveLength(0);
      expect(findAllByText(root, "bundles_page.ended")).toHaveLength(1);
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("does not reset the absolute expiry when the parent rerenders", () => {
    const bundle = makeBundle();
    const renderer = renderCard(bundle);
    try {
      act(() => {
        jest.advanceTimersByTime(10_000);
      });
      expect(findAllByText(renderer.root, "21d 06:04:17")).toHaveLength(1);

      act(() => {
        renderer.update(
          <BundleImage bundle={bundle} remainingSecs={REMAINING_SECS} />
        );
      });
      expect(findAllByText(renderer.root, "21d 06:04:17")).toHaveLength(1);
      expect(findAllByText(renderer.root, "21d 06:04:27")).toHaveLength(0);
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });
});
