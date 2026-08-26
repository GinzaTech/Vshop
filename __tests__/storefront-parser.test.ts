import {
  getFallbackBundleItemName,
  parseShop,
} from "~/services/riot/storefront-parser";
import { VItemTypes } from "~/utils/misc";

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

describe("storefront parser", () => {
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
});
