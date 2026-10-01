import React from "react";
import { StyleSheet, View } from "react-native";
import TestRenderer, {
  act,
  type ReactTestInstance,
} from "react-test-renderer";

import BundleImage from "~/components/BundleImage";
import CurrencyIcon from "~/components/CurrencyIcon";
import { COLORS, RADIUS, SHADOWS, SPACING } from "~/constants/DesignSystem";
import { LiquidGlassDecoration } from "~/components/ui/LiquidGlassSurface";
import LiquidGlassBackdrop from "~/components/ui/LiquidGlassBackdrop";
import { createBundleOwnershipLookup } from "~/utils/bundle-ownership";
import { VItemTypes } from "~/utils/misc";
import {
  BUNDLE_CAROUSEL_CONTENT_PADDING,
  BUNDLE_CAROUSEL_GAP,
  BUNDLE_CARD_GUTTER,
  getBundleItemMaxPriceTextLength,
  getBundleItemWidth,
} from "~/utils/bundle-display";

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

jest.mock("~/components/ui/AppIcon", () => ({
  __esModule: true,
  default: "AppIcon",
}));

// BundleImage lấy viewport qua useAppWindowDimensions (AppViewport): mock
// hook để kiểm geometry theo viewport/font scale mà không cần provider.
jest.mock("~/components/ui/AppViewport", () => ({
  useAppWindowDimensions: () => mockWindowDimensions,
}));

const mockWindowDimensions = {
  width: 320,
  height: 640,
  scale: 2,
  fontScale: 1,
};

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

function renderCard(
  bundle: BundleShopItem,
  remainingSecs = REMAINING_SECS,
  isOwned?: (item: SkinShopItem | AccessoryShopItem) => boolean
) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <BundleImage
        bundle={bundle}
        remainingSecs={remainingSecs}
        isOwned={isOwned}
      />
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

/** Vị trí (document order) của host text đầu tiên khớp chuỗi. */
function hostTextIndex(root: TestRoot, text: string): number {
  return root
    .findAll((node) => typeof node.type === "string")
    .findIndex((node) => node.props.children === text);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
  mockWindowDimensions.width = 320;
  mockWindowDimensions.fontScale = 1;
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe("BundleImage white detail card", () => {
  it.each([VItemTypes.PlayerCard, VItemTypes.PlayerTitle, VItemTypes.Spray, VItemTypes.Flex, VItemTypes.Buddy])(
    "uses real type-specific ownership for accessory overlay/check (%s)", (itemTypeId) => {
      const owned = makeItem({ uuid: "display-root", displayName: "Owned accessory", itemTypeId, entitlementItemIds: ["owned-grant"] });
      const unowned = makeItem({ uuid: "unowned-root", displayName: "Unowned accessory", itemTypeId, entitlementItemIds: ["unowned-grant"] });
      const matcher = createBundleOwnershipLookup([], { [itemTypeId]: ["owned-grant"] });
      const renderer = renderCard(makeBundle({ items: [owned, unowned] }), REMAINING_SECS, matcher);
      try {
        const cells = findAllByTestId(renderer.root, "bundle-item-cell");
        expect(findAllByTestId(cells[0], "bundle-item-owned-overlay")).toHaveLength(1);
        expect(findAllByTestId(cells[0], "bundle-item-owned-check")).toHaveLength(1);
        expect(cells[0].props.accessibilityLabel).toContain("bundles_page.purchased");
        expect(findAllByTestId(cells[1], "bundle-item-owned-overlay")).toHaveLength(0);
        expect(findAllByTestId(cells[1], "bundle-item-owned-check")).toHaveLength(0);
      } finally { act(() => renderer.unmount()); }
    },
  );
  it("keeps subtle glass decoration on a white card without adding a carousel layout wrapper", () => {
    const renderer = renderCard(makeBundle());
    try {
      const root = renderer.root;
      const card = findAllByTestId(root, "bundle-card")[0];
      expect(StyleSheet.flatten(card.props.style)).toMatchObject({
        backgroundColor: COLORS.SURFACE,
        borderColor: COLORS.BORDER_STRONG,
        borderWidth: 1.5,
        ...SHADOWS.xs,
      });
      const decorations = root.findAllByType(LiquidGlassDecoration);
      // Chỉ card bundle giữ lớp kính; tile item phải sạch (artwork sắc nét).
      expect(decorations).toHaveLength(1);
      decorations.forEach((decoration) => {
        const layer = decoration.findAllByType(View)[0];
        expect(layer.props).toMatchObject({ pointerEvents: "none", accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
        expect(StyleSheet.flatten(layer.props.style).position).toBe("absolute");
      });
      expect(decorations[0].props).toMatchObject({ radius: RADIUS.card, tone: "light" });
      const cells = findAllByTestId(root, "bundle-item-cell");
      cells.forEach((cell) => {
        expect(StyleSheet.flatten(cell.props.style)).toMatchObject({
          backgroundColor: COLORS.SURFACE,
          borderColor: COLORS.BORDER,
          borderWidth: 1,
          ...SHADOWS.xs,
        });
        expect(cell.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
      });
      expect(card.props.children[0].type).toBe(LiquidGlassDecoration);
      expect(root.findByProps({ testID: "bundle-item-carousel" }).props.data).toEqual(makeBundle().items);
    } finally {
      act(() => renderer.unmount());
    }
  });

  it("renders clear hero artwork without a duplicated artwork blur backdrop", () => {
    const bundle = makeBundle({ displayIcon2: "https://example.com/hero2.png" });
    const renderer = renderCard(bundle);
    try {
      expect(renderer.root.findAllByType(LiquidGlassBackdrop)).toHaveLength(0);
      expect(renderer.root.findByProps({ priority: "high" }).props).toMatchObject({
        source: { uri: bundle.displayIcon2 },
        cacheId: "bundle:champions-2026:hero:displayIcon2",
        contentFit: "cover",
      });
    } finally {
      act(() => renderer.unmount());
    }
  });

  it("uses opaque white tokens for the information body and title row", () => {
    const renderer = renderCard(makeBundle());
    try {
      const views = renderer.root.findAllByType(View);
      const content = views.find((node) => {
        const style = StyleSheet.flatten(node.props.style ?? {});
        return style.paddingHorizontal === SPACING.sm && style.paddingTop === SPACING.sm;
      });
      const titleRow = views.find((node) =>
        StyleSheet.flatten(node.props.style ?? {}).justifyContent === "space-between"
      );
      expect(content).toBeDefined();
      expect(titleRow).toBeDefined();
      expect(StyleSheet.flatten(content?.props.style).backgroundColor).toBe(COLORS.SURFACE);
      expect(StyleSheet.flatten(titleRow?.props.style).backgroundColor).toBe(COLORS.SURFACE);
    } finally {
      act(() => renderer.unmount());
    }
  });

  it("updates ownership from the latest matcher while retaining real prices, artwork and tile width", () => {
    const bundle = makeBundle();
    const renderer = renderCard(bundle, REMAINING_SECS, (item) => item.uuid === "item-1");
    try {
      const width = StyleSheet.flatten(findAllByTestId(renderer.root, "bundle-item-cell")[0].props.style).width;
      act(() => renderer.update(<BundleImage bundle={bundle} remainingSecs={REMAINING_SECS} isOwned={(item) => item.uuid === "item-2"} />));
      const cells = findAllByTestId(renderer.root, "bundle-item-cell");
      expect(cells[0].findAllByProps({ testID: "bundle-item-owned-overlay" })).toHaveLength(0);
      expect(findAllByTestId(cells[1], "bundle-item-owned-overlay")).toHaveLength(1);
      expect(cells[0].props.accessibilityLabel).toBe("Champions Vandal, 1.766 VP");
      expect(cells[1].props.accessibilityLabel).toBe("Champions Card, 1.766 VP, bundles_page.purchased");
      expect(StyleSheet.flatten(cells[1].props.style).width).toBe(width);
      expect(findAllByText(renderer.root, "5.310")).toHaveLength(1);
      expect(findAllByText(renderer.root, "1.766")).toHaveLength(2);
      expect(renderer.root.findByProps({ cacheId: "bundle-item:item-1:display" }).props.source).toEqual({ uri: bundle.items[0].displayIcon });
    } finally {
      act(() => renderer.unmount());
    }
  });
  it("reads the ends-in prefix before the remaining time", () => {
    const renderer = renderCard(makeBundle());
    try {
      const texts = findHostNodes(renderer.root, (node) => typeof node.props.children === "string")
        .map((node) => node.props.children as string);
      expect(texts.indexOf("bundles_page.ends_in")).toBeLessThan(texts.indexOf("21d 06:04:27"));
    } finally {
      act(() => renderer.unmount());
    }
  });

  it("renders hero, title, real Riot prices and meta on a white surface", () => {
    const renderer = renderCard(makeBundle());
    try {
      const root = renderer.root;

      expect(findAllByText(root, "Champions 2026")).toHaveLength(1);
      expect(findAllByText(root, "5.310")).toHaveLength(1); // giá bundle hiện tại
      expect(findAllByText(root, "6.640")).toHaveLength(1); // giá gốc bị gạch
      expect(findAllByText(root, "21d 06:04:27")).toHaveLength(1);
      expect(findAllByText(root, "2 items")).toHaveLength(1);
      expect(findAllByText(root, "bundles_page.estimate")).toHaveLength(0);

      const card = findAllByTestId(root, "bundle-card")[0];
      expect(findAllByTestId(root, "bundle-card")).toHaveLength(1);
      expect(StyleSheet.flatten(card.props.style).backgroundColor).toBe(
        COLORS.SURFACE
      );
      expect(StyleSheet.flatten(card.props.style).borderRadius).toBe(
        RADIUS.card
      );
      expect(StyleSheet.flatten(card.props.style).overflow).toBe("hidden");
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("reserves hero space at the reference 2.40 aspect ratio", () => {
    const renderer = renderCard(makeBundle());
    try {
      const hero = renderer.root.findByProps({
        cacheId: "bundle:champions-2026:hero:displayIcon",
        priority: "high",
      });
      const frameStyle = StyleSheet.flatten(hero.parent?.props.style ?? {});
      expect(frameStyle.aspectRatio).toBe(2.4);
      expect(frameStyle.backgroundColor).toBe(COLORS.SURFACE_MUTED);
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("prefers displayIcon2 for the hero and keys the cache by source variant", () => {
    const renderer = renderCard(
      makeBundle({ displayIcon2: "https://example.com/hero2.png" })
    );
    try {
      const hero = renderer.root.findByProps({
        cacheId: "bundle:champions-2026:hero:displayIcon2",
        priority: "high",
      });
      expect(hero.props.source).toEqual({ uri: "https://example.com/hero2.png" });
      // Cache key của biến thể khác phải khác key displayIcon2.
      expect(
        renderer.root.findAllByProps({
          cacheId: "bundle:champions-2026:hero:displayIcon",
        })
      ).toHaveLength(0);
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("falls back to verticalPromoImage with its own cache key when both icons are missing", () => {
    const renderer = renderCard(
      makeBundle({
        displayIcon: "",
        displayIcon2: "",
        verticalPromoImage: "https://example.com/promo.png",
      })
    );
    try {
      const hero = renderer.root.findByProps({
        cacheId: "bundle:champions-2026:hero:verticalPromoImage",
        priority: "high",
      });
      expect(hero.props.source).toEqual({ uri: "https://example.com/promo.png" });
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("uses the fallback asset with a fallback cache key when all art is missing", () => {
    const renderer = renderCard(
      makeBundle({ displayIcon: "", displayIcon2: "" })
    );
    try {
      const root = renderer.root;
      const hero = root.findByProps({
        cacheId: "bundle:champions-2026:hero:fallback",
        priority: "high",
      });
      expect(hero.props.source).not.toEqual({ uri: "" });
      expect(hero.props.source).toEqual(
        require("~/assets/images/noimage.png")
      );
      // Khung hero giữ chỗ cố định qua aspectRatio dù ảnh thiếu.
      const frameStyle = StyleSheet.flatten(hero.parent?.props.style ?? {});
      expect(frameStyle.aspectRatio).toBe(2.4);

      // Item thiếu ảnh cũng dùng fallback và giữ khung artwork.
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

  it("places the countdown clock before the ends-in prefix and groups the separator with the count", () => {
    const renderer = renderCard(makeBundle());
    try {
      const root = renderer.root;
      const clockIndex = hostTextIndex(root, "21d 06:04:27");
      const prefixIndex = hostTextIndex(root, "bundles_page.ends_in");
      const dividerIndex = hostTextIndex(root, "·");
      const countIndex = hostTextIndex(root, "2 items");

      expect(clockIndex).toBeGreaterThanOrEqual(0);
      expect(prefixIndex).toBeLessThan(clockIndex);
      expect(clockIndex).toBeLessThan(dividerIndex);
      expect(dividerIndex).toBeLessThan(countIndex);

      // Separator "·" ở cùng container với số item để không bị wrap rời rạc:
      // node host "·" nằm dưới composite Text, lên một tầng nữa là group View.
      const divider = findHostNodes(
        root,
        (node) => node.props.children === "·"
      )[0];
      const groupContainer = divider.parent?.parent;
      const groupChildren = groupContainer?.props.children;
      const siblings = (Array.isArray(groupChildren)
        ? groupChildren
        : [groupChildren]) as unknown[];
      expect(siblings).toHaveLength(2);
      expect(
        siblings.some(
          (node) => (node as ReactTestInstance | null)?.props?.children === "·"
        )
      ).toBe(true);
      expect(
        siblings.some(
          (node) =>
            (node as ReactTestInstance | null)?.props?.children === "2 items"
        )
      ).toBe(true);
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("renders a horizontal non-wrapping carousel with three full compact tiles plus a fourth peek", () => {
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

      // Cell width theo geometry tham chiếu (24% card width, clamp 72–136).
      const cells = findAllByTestId(root, "bundle-item-cell");
      expect(cells).toHaveLength(2);
      const cellWidth = Number(
        StyleSheet.flatten(cells[0].props.style).width
      );
      expect(cellWidth).toBe(
        getBundleItemWidth(mockWindowDimensions.width, {
          fontScale: mockWindowDimensions.fontScale,
          maxPriceLength: getBundleItemMaxPriceTextLength(makeBundle().items),
        })
      );

      // Ba cell đầy + 2 gap vừa vùng nhìn thấy; cell thứ tư bị cắt (peek).
      const visibleWidth =
        mockWindowDimensions.width -
        BUNDLE_CARD_GUTTER -
        2 * BUNDLE_CAROUSEL_CONTENT_PADDING;
      expect(3 * cellWidth + 2 * BUNDLE_CAROUSEL_GAP).toBeLessThanOrEqual(
        visibleWidth
      );
      expect(4 * cellWidth + 3 * BUNDLE_CAROUSEL_GAP).toBeGreaterThan(
        visibleWidth
      );

      // getItemLayout ổn định cho độ rộng cố định.
      const layout = carousel.props.getItemLayout(null, 1);
      expect(layout.length).toBe(cellWidth + BUNDLE_CAROUSEL_GAP);
      expect(layout.offset).toBe(cellWidth + BUNDLE_CAROUSEL_GAP);
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("renders unified light tiles with a contained artwork band and a vertical price stack", () => {
    const renderer = renderCard(makeBundle());
    try {
      const root = renderer.root;
      const cells = findAllByTestId(root, "bundle-item-cell");
      const cell = cells[0];

      const cellStyle = StyleSheet.flatten(cell.props.style);
      expect(cellStyle.backgroundColor).toBe(COLORS.SURFACE);
      expect(cellStyle.borderRadius).toBe(RADIUS.md);

      // Artwork band: landscape, contain, không divider/viền ngăn cách.
      const itemImage = cell.findByProps({
        cacheId: "bundle-item:item-1:display",
      });
      const frameStyle = StyleSheet.flatten(itemImage.parent?.props.style ?? {});
      expect(frameStyle.aspectRatio).toBeGreaterThan(1.4);
      expect(frameStyle.borderBottomWidth).toBeUndefined();

      // Tên item căn giữa, 1 dòng ellipsized.
      const name = findHostNodes(
        cell,
        (node) => node.props.children === "Champions Vandal"
      )[0];
      expect(name.props.numberOfLines).toBe(1);
      expect(StyleSheet.flatten(name.props.style).textAlign).toBe("center");

      // Giá base bị gạch nằm TRÊN giá hiện tại, icon VP ở cả hai hàng.
      const cellTexts = cell.findAll((node) => typeof node.type === "string");
      const oldIndex = cellTexts.findIndex((node) => node.props.children === "2.675");
      const currentIndex = cellTexts.findIndex((node) => node.props.children === "1.766");
      expect(oldIndex).toBeGreaterThanOrEqual(0);
      expect(oldIndex).toBeLessThan(currentIndex);

      const vpIcons = cell.findAllByType(CurrencyIcon);
      expect(vpIcons).toHaveLength(2);
      const oldPrice = cellTexts[oldIndex];
      const currentPrice = cellTexts[currentIndex];
      expect(
        StyleSheet.flatten(oldPrice.props.style).textDecorationLine
      ).toBe("line-through");
      expect(StyleSheet.flatten(currentPrice.props.style).fontSize).toBeGreaterThan(
        StyleSheet.flatten(oldPrice.props.style).fontSize
      );
      // Không ellipsize/shrink chữ số giá.
      expect(currentPrice.props.numberOfLines).toBeUndefined();
      expect(oldPrice.props.numberOfLines).toBeUndefined();
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("widens tiles for large system font scales and long VP values", () => {
    // Font scale lớn → cell rộng hơn theo cùng công thức geometry.
    mockWindowDimensions.width = 390;
    mockWindowDimensions.fontScale = 1.35;
    const scaled = renderCard(makeBundle());
    try {
      const cells = findAllByTestId(scaled.root, "bundle-item-cell");
      const expected = getBundleItemWidth(390, {
        fontScale: 1.35,
        maxPriceLength: 4,
      });
      expect(StyleSheet.flatten(cells[0].props.style).width).toBe(expected);
      expect(expected).toBeGreaterThan(getBundleItemWidth(390));
    } finally {
      act(() => {
        scaled.unmount();
      });
    }

    // Giá VP dài ("1.000.000") → cell rộng hơn để giữ trọn chữ số.
    mockWindowDimensions.width = 320;
    mockWindowDimensions.fontScale = 1;
    const longVp = renderCard(
      makeBundle({
        items: [makeItem({ price: 1_000_000, originalPrice: undefined })],
      })
    );
    try {
      const cells = findAllByTestId(longVp.root, "bundle-item-cell");
      expect(StyleSheet.flatten(cells[0].props.style).width).toBe(
        getBundleItemWidth(320, { fontScale: 1, maxPriceLength: 9 })
      );
    } finally {
      act(() => {
        longVp.unmount();
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

  it("shows a faint light owned overlay with a green circular check for purchased skins", () => {
    const renderer = renderCard(
      makeBundle(),
      REMAINING_SECS,
      (item) => item.uuid === "item-1"
    );
    try {
      const root = renderer.root;

      const overlays = findAllByTestId(root, "bundle-item-owned-overlay");
      expect(overlays).toHaveLength(1);
      const overlayStyle = StyleSheet.flatten(overlays[0].props.style);
      expect(overlayStyle.backgroundColor).toBe(COLORS.SURFACE);
      expect(overlayStyle.opacity).toBeLessThan(1);
      // Overlay không chặn cử chỉ ngang/dọc của carousel.
      expect(overlays[0].props.pointerEvents).toBe("none");

      const checks = findAllByTestId(root, "bundle-item-owned-check");
      expect(checks).toHaveLength(1);
      expect(checks[0].props.pointerEvents).toBe("none");
      const checkStyle = StyleSheet.flatten(checks[0].props.style);
      expect(checkStyle.backgroundColor).toBe(COLORS.SUCCESS);
      expect(checkStyle.borderRadius).toBe(RADIUS.chip);

      // Overlay chỉ phủ artwork + tên; giá vẫn nằm ngoài vùng phủ.
      const overlayParent = overlays[0].parent!;
      expect(
        overlayParent.findAll(
          (node) =>
            typeof node.type === "string" && node.props.children === "1.766"
        )
      ).toHaveLength(0);

      // Tóm tắt screen reader chứa trạng thái purchased đúng một lần.
      expect(
        findHostNodes(
          root,
          (node) =>
            node.props.accessibilityLabel ===
            "Champions Vandal, 1.766 VP, bundles_page.purchased"
        )
      ).toHaveLength(1);
      // Item không sở hữu: nhãn giữ nguyên, không có overlay.
      expect(
        findHostNodes(
          root,
          (node) =>
            node.props.accessibilityLabel === "Champions Card, 1.766 VP"
        )
      ).toHaveLength(1);
      const secondCell = findAllByTestId(root, "bundle-item-cell")[1];
      expect(
        secondCell.findAllByProps({ testID: "bundle-item-owned-overlay" })
      ).toHaveLength(0);
    } finally {
      act(() => {
        renderer.unmount();
      });
    }
  });

  it("renders no owned affordances by default when no ownership callback is provided", () => {
    const renderer = renderCard(makeBundle());
    try {
      const root = renderer.root;
      expect(findAllByTestId(root, "bundle-item-owned-overlay")).toHaveLength(0);
      expect(findAllByTestId(root, "bundle-item-owned-check")).toHaveLength(0);
      expect(
        findHostNodes(
          root,
          (node) =>
            typeof node.props.accessibilityLabel === "string" &&
            node.props.accessibilityLabel.includes("bundles_page.purchased")
        )
      ).toHaveLength(0);
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
