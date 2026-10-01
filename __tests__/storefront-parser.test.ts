import {
  getFallbackBundleItemName,
  parseShop,
} from "~/services/riot/storefront-parser";
import { VCurrencies, VItemTypes } from "~/utils/misc";
import { getAssetLookups } from "~/utils/valorant-assets";

jest.mock("~/utils/valorant-assets", () => ({
  fetchBundle: jest.fn(async () => null),
  getAssetLookups: jest.fn(() => ({
    skinByAnyId: new Map(),
    buddyByAnyId: new Map(),
    sprayById: new Map(),
    flexById: new Map(),
    cardById: new Map(),
    titleById: new Map(),
  })),
}));

/** Dựng StorefrontResponse tối thiểu, chỉ thay FeaturedBundle.Bundles. */
function makeStorefrontWithBundles(
  bundles: BundleSchema[]
): StorefrontResponse {
  return {
    SkinsPanelLayout: {
      SingleItemOffers: [],
      SingleItemStoreOffers: [],
      SingleItemOffersRemainingDurationInSeconds: 0,
    },
    FeaturedBundle: {
      Bundle: undefined as unknown as BundleSchema,
      Bundles: bundles,
      BundleRemainingDurationInSeconds: 0,
    },
    UpgradeCurrencyStore: { UpgradeCurrencyOffers: [] },
    AccessoryStore: {
      AccessoryStoreOffers: [],
      AccessoryStoreRemainingDurationInSeconds: 0,
      StorefrontID: "accessory",
    },
  };
}

/** Item bundle thật: BasePrice 2675, DiscountedPrice 1766 (Champions 2026). */
function makeChampionsBundleItem(): BundleSchema["Items"][number] {
  return {
    Item: {
      ItemTypeID: VItemTypes.PlayerCard,
      ItemID: "champions-player-card",
      Amount: 1,
    },
    BasePrice: 2675,
    CurrencyID: VCurrencies.VP,
    DiscountPercent: 34,
    DiscountedPrice: 1766,
    IsPromoItem: false,
  };
}

/** Bundle Champions 2026: tổng base 6640, tổng sau giảm 5310. */
function makeChampionsBundle(overrides: {
  TotalBaseCost: Record<string, number> | null;
  TotalDiscountedCost: Record<string, number> | null;
}): BundleSchema {
  return {
    ID: "offer-champions-2026",
    DataAssetID: "champions-2026",
    CurrencyID: VCurrencies.VP,
    Items: [makeChampionsBundleItem()],
    ItemOffers: null,
    TotalBaseCost: overrides.TotalBaseCost,
    TotalDiscountedCost: overrides.TotalDiscountedCost,
    TotalDiscountPercent: 20,
    DurationRemainingInSeconds: 60,
    WholesaleOnly: false,
  };
}

describe("storefront parser", () => {
  it("preserves each Bundle offer's exact inventory type and item identity without inventing ownership", async () => {
    const kinds = [VItemTypes.SkinLevel, VItemTypes.SkinChroma, VItemTypes.PlayerCard,
      VItemTypes.PlayerTitle, VItemTypes.Spray, VItemTypes.Flex, VItemTypes.Buddy, "unknown-type"];
    const bundle = makeChampionsBundle({ TotalBaseCost: null, TotalDiscountedCost: null });
    bundle.Items = kinds.map((kind, index) => ({ ...makeChampionsBundleItem(), Item: {
      ItemTypeID: kind, ItemID: `inventory-${index}`, Amount: 1,
    } }));
    const before = JSON.stringify(bundle);
    const result = await parseShop(makeStorefrontWithBundles([bundle]));
    result.bundles[0].items.forEach((item, index) => {
      expect(item).toMatchObject({ itemTypeId: kinds[index], entitlementItemIds: [`inventory-${index}`] });
      expect(item).not.toHaveProperty("owned");
    });
    expect(JSON.stringify(bundle)).toBe(before);
  });

  it("retains Buddy offer/level IDs when display metadata remaps to a root UUID", async () => {
    const lookups = getAssetLookups();
    const buddy = { uuid: "buddy-root", displayName: "Buddy", displayIcon: "root.png",
      levels: [{ uuid: "buddy-offer-level", displayIcon: "level.png" }, { uuid: "buddy-level-2", displayIcon: "level2.png" }] } as unknown as ValorantBuddyAccessory;
    jest.mocked(getAssetLookups).mockReturnValueOnce({ ...lookups, buddyByAnyId: new Map([["buddy-offer-level", buddy]]) });
    const bundle = makeChampionsBundle({ TotalBaseCost: null, TotalDiscountedCost: null });
    bundle.Items = [{ ...makeChampionsBundleItem(), Item: { ItemTypeID: VItemTypes.Buddy, ItemID: "buddy-offer-level", Amount: 1 } }];
    const result = await parseShop(makeStorefrontWithBundles([bundle]));
    expect(result.bundles[0].items[0]).toMatchObject({ uuid: "buddy-root", itemTypeId: VItemTypes.Buddy,
      entitlementItemIds: ["buddy-offer-level", "buddy-level-2"], price: 1766 });
  });
  it("returns stable empty collections for an empty storefront", async () => {
    const result = await parseShop({
      SkinsPanelLayout: {
        SingleItemOffers: [],
        SingleItemStoreOffers: [],
        SingleItemOffersRemainingDurationInSeconds: 120,
      },
      FeaturedBundle: {
        Bundle: undefined as unknown as BundleSchema,
        Bundles: [],
        BundleRemainingDurationInSeconds: 0,
      },
      UpgradeCurrencyStore: { UpgradeCurrencyOffers: [] },
      AccessoryStore: {
        AccessoryStoreOffers: [],
        AccessoryStoreRemainingDurationInSeconds: 240,
        StorefrontID: "accessory",
      },
    });

    expect(result).toEqual({
      main: [],
      bundles: [],
      nightMarket: [],
      accessory: [],
      remainingSecs: {
        main: 120,
        bundles: [],
        nightMarket: 0,
        accessory: 240,
      },
    });
  });

  it("provides deterministic labels while upstream metadata is missing", () => {
    expect(getFallbackBundleItemName("unknown", VItemTypes.Spray, 1)).toBe("Spray #2");
    expect(getFallbackBundleItemName("unknown", "unknown-type", 0)).toBe("Bundle Item #1");
  });

  it("retains real base and discounted prices for the bundle and its items", async () => {
    const result = await parseShop(
      makeStorefrontWithBundles([
        makeChampionsBundle({
          TotalBaseCost: { [VCurrencies.VP]: 6640 },
          TotalDiscountedCost: { [VCurrencies.VP]: 5310 },
        }),
      ])
    );

    expect(result.bundles).toHaveLength(1);
    const bundle = result.bundles[0];
    expect(bundle.price).toBe(5310);
    expect(bundle.originalPrice).toBe(6640);
    expect(bundle.items).toHaveLength(1);
    expect(bundle.items[0].price).toBe(1766);
    expect(bundle.items[0].originalPrice).toBe(2675);
    expect(result.remainingSecs.bundles).toEqual([60]);
  });

  it("keeps equal base/discounted totals for undiscounted bundles", async () => {
    const result = await parseShop(
      makeStorefrontWithBundles([
        makeChampionsBundle({
          TotalBaseCost: { [VCurrencies.VP]: 5310 },
          TotalDiscountedCost: { [VCurrencies.VP]: 5310 },
        }),
      ])
    );

    const bundle = result.bundles[0];
    expect(bundle.price).toBe(5310);
    expect(bundle.originalPrice).toBe(5310);
  });

  it("falls back to per-item totals when bundle cost maps are absent", async () => {
    const result = await parseShop(
      makeStorefrontWithBundles([
        makeChampionsBundle({
          TotalBaseCost: null,
          TotalDiscountedCost: null,
        }),
      ])
    );

    const bundle = result.bundles[0];
    expect(bundle.price).toBe(1766); // tổng DiscountedPrice của item
    expect(bundle.originalPrice).toBe(2675); // tổng BasePrice của item
  });

  it("never invents an ownership flag on parsed bundle items", async () => {
    const result = await parseShop(
      makeStorefrontWithBundles([
        makeChampionsBundle({
          TotalBaseCost: { [VCurrencies.VP]: 6640 },
          TotalDiscountedCost: { [VCurrencies.VP]: 5310 },
        }),
      ])
    );

    const bundle = result.bundles[0];
    expect(bundle).not.toHaveProperty("owned");
    expect(bundle.items[0]).not.toHaveProperty("owned");
    expect(bundle).not.toHaveProperty("isOwned");
    expect(bundle.items[0]).not.toHaveProperty("isOwned");
  });
});
