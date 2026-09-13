import { VCurrencies, VItemTypes } from "~/utils/misc";
import { fetchBundle, getAssetLookups } from "~/utils/valorant-assets";

const BUNDLE_ASSET_FALLBACKS: Record<
  string,
  { displayName: string; displayIcon?: string }
> = {
  // Bundle ra mắt trước khi valorant-api.com kịp cập nhật metadata (13.02).
  // Chỉ dùng khi metadata upstream trả 404 — luôn thử API chính trước.
  "4d368017-4f98-1e89-dbec-31abd2533eb9": {
    displayName: "Neo Frontier",
    displayIcon: "https://i.ytimg.com/vi/iYfYrsd09lo/maxresdefault.jpg",
  },
  "8d29f5fe-402a-94ee-2d67-e29b97dda6f4": {
    displayName: "Neo Frontier",
    displayIcon: "https://i.ytimg.com/vi/iYfYrsd09lo/maxresdefault.jpg",
  },
};

const BUNDLE_ITEM_NAME_FALLBACKS: Record<string, string> = {
  "a5e0e761-472c-8287-2514-26a1c88f4d08": "Neo Frontier Lasso",
  "349bd9e2-479f-49a9-b70b-38aca900e11a": "Neo Frontier Weapon #1",
  "af1619fa-42c0-31e3-cfaf-edaed2b1a055": "Neo Frontier Weapon #2",
  "5e5a435f-4a0d-0320-39c9-3fbe8ff65ae2": "Neo Frontier Player Card #1",
  "e9a3d874-4893-b17a-00ca-0b88017f7919": "Neo Frontier Player Card #2",
  "5d3cde59-4d50-e54b-9126-d7bfac8d18bc": "Neo Frontier Spray",
};

/** Tên hiển thị fallback cho item bundle khi thiếu metadata asset:
 *  ưu tiên bảng tên cấu hình sẵn (Neo Frontier), sau đó "Loại #vị trí".
 *  @param itemId - UUID item. @param typeId - UUID loại (VItemTypes).
 *  @param itemIndex - Vị trí item trong bundle (0-based, dùng đánh số).
 *  @returns Tên an toàn để render — không bao giờ rỗng. */
export const getFallbackBundleItemName = (
  itemId: string,
  typeId: string,
  itemIndex: number
) => {
  const configuredName = BUNDLE_ITEM_NAME_FALLBACKS[itemId];
  if (configuredName) return configuredName;

  const position = itemIndex + 1;

  if (typeId === VItemTypes.SkinLevel || typeId === VItemTypes.SkinChroma) {
    return `Skin #${position}`;
  }
  if (typeId === VItemTypes.Spray) return `Spray #${position}`;
  if (typeId === VItemTypes.Flex) return `Flex #${position}`;
  if (typeId === VItemTypes.PlayerCard) return `Player Card #${position}`;
  if (typeId === VItemTypes.PlayerTitle) return `Player Title #${position}`;
  if (typeId === VItemTypes.Buddy) return `Gun Buddy #${position}`;

  return `Bundle Item #${position}`;
};

/** Dựng asset bundle thay thế khi valorant-api.com không có metadata:
 *  tên lấy từ fallback cấu hình sẵn hoặc item đầu tiên có tên thật.
 *  @param bundle - Bundle schema từ StorefrontResponse.
 *  @param items - Các item đã parse của bundle (tìm tên/ảnh đại diện).
 *  @returns ValorantBundle đủ trường để render card bundle. */
export const createFallbackBundleAsset = (
  bundle: BundleSchema,
  items: (SkinShopItem | AccessoryShopItem)[],
  bundleIndex: number
): ValorantBundle => {
  const configuredFallback = BUNDLE_ASSET_FALLBACKS[bundle.DataAssetID];
  const firstNamedItem = items.find(
    (item) =>
      item.displayName &&
      !/^(Skin|Spray|Flex|Player Card|Player Title|Gun Buddy|Bundle Item) #\d+$/.test(
        item.displayName
      )
  );
  const firstItemImage = items.find((item) => item.displayIcon)?.displayIcon;

  return {
    uuid: bundle.DataAssetID || bundle.ID,
    displayName:
      configuredFallback?.displayName ||
      firstNamedItem?.displayName ||
      `Bundle #${bundleIndex + 1}`,
    description: "",
    useAdditionalContext: false,
    displayIcon: configuredFallback?.displayIcon || firstItemImage || "",
    displayIcon2: configuredFallback?.displayIcon || firstItemImage || "",
    assetPath: "",
  };
};

/** Parse StorefrontResponse thô thành cấu trúc UI dùng trực tiếp.
 *  Chia 4 khu: main (4 skin ngày), bundles, nightMarket, accessory (tính KC).
 *  @param shop - Response v3 từ getShop() (services/riot/account-api).
 *  @param cachedBundles - Bundle đã cache, làm fallback khi asset 404.
 *  @returns { main, bundles, nightMarket, accessory, remainingSecs }. */
export async function parseShop(
  shop: StorefrontResponse,
  cachedBundles: BundleShopItem[] = []
) {
  /* SHOP CHÍNH (4 SKIN HÀNG NGÀY) */
  let singleItemStoreOffers = shop.SkinsPanelLayout.SingleItemStoreOffers;
  let main: SkinShopItem[] = [];
  // Lookup maps từ valorant-assets: tra UUID → asset (skin/buddy/spray...).
  const {
    skinByAnyId,     // Map UUID -> ValorantSkin (bao gồm level và chroma UUID)
    buddyByAnyId,    // Map UUID -> ValorantBuddyAccessory
    sprayById,       // Map UUID -> spray
    flexById,        // Map UUID -> flex
    cardById,        // Map UUID -> card
    titleById,       // Map UUID -> title
  } = getAssetLookups();

  // Duyệt 4 offer của shop chính; UUID không tra được → slot trống (undefined).
  for (let mainIndex = 0; mainIndex < singleItemStoreOffers.length; mainIndex++) {
    const offer = singleItemStoreOffers[mainIndex];

    // Tra UUID của offer để tìm skin tương ứng
    const skin = skinByAnyId.get(offer.OfferID);

    if (skin) {
      main[mainIndex] = {
        ...skin,                    // Thông tin skin (tên, icon, ...)
        price: offer.Cost[VCurrencies.VP],  // Giá bằng VP
      };
    }
  }

  /* BUNDLE (GÓI SẢN PHẨM) */
  const bundles: BundleShopItem[] = [];
  // FeaturedBundle.Bundles có thể là mảng hoặc object đơn → chuẩn hóa mảng.
  const featuredBundles = shop.FeaturedBundle.Bundles?.length
    ? shop.FeaturedBundle.Bundles
    : shop.FeaturedBundle.Bundle
      ? [shop.FeaturedBundle.Bundle]
      : [];
  // Tạo map bundle từ cache để tra nhanh
  const cachedBundleById = new Map(
    cachedBundles.map((bundle) => [bundle.uuid, bundle])
  );

  // Luôn thử API trước. Cache persisted chỉ là fallback để metadata tạm thời
  // vẫn có thể được thay thế ngay khi valorant-api.com cập nhật patch mới.
  const bundleResults = await Promise.all(
    featuredBundles.map(async (bundle) => {
      const bundleAsset =
        (await fetchBundle(bundle.DataAssetID)) ||
        cachedBundleById.get(bundle.DataAssetID) ||
        null;
      return { bundle, bundleAsset };
    })
  );

  // Parse từng bundle: phân loại item theo ItemTypeID, ghép asset + giá giảm.
  for (let bundleIndex = 0; bundleIndex < bundleResults.length; bundleIndex++) {
    const { bundle, bundleAsset } = bundleResults[bundleIndex];
    const allItems: (SkinShopItem | AccessoryShopItem)[] = [];

    for (let itemIndex = 0; itemIndex < bundle.Items.length; itemIndex++) {
      const item = bundle.Items[itemIndex];
      const uuid = item.Item.ItemID;
      const typeId = item.Item.ItemTypeID;
      const price = item.BasePrice;
      const fallbackItemName = getFallbackBundleItemName(uuid, typeId, itemIndex);

      // Skin level hoặc chroma
      if (typeId === VItemTypes.SkinLevel || typeId === VItemTypes.SkinChroma) {
        const skin = skinByAnyId.get(uuid);
        if (skin) {
          allItems.push({ ...skin, price } as SkinShopItem);
        } else {
          allItems.push({
            uuid,
            displayName: fallbackItemName,
            themeUuid: "",
            assetPath: "",
            chromas: [],
            levels: [],
            price,
          } as SkinShopItem);
        }
      // Spray
      } else if (typeId === VItemTypes.Spray) {
        const spray = sprayById.get(uuid);
        if (spray) {
          allItems.push({
            uuid: spray.uuid,
            displayName: spray.displayName,
            displayIcon: spray.displayIcon || spray.fullTransparentIcon,
            price,
          });
        } else {
          allItems.push({ uuid, displayName: fallbackItemName, price });
        }
      // Flex
      } else if (typeId === VItemTypes.Flex) {
        const flex = flexById.get(uuid);
        allItems.push({
          uuid: flex?.uuid || uuid,
          displayName: flex?.displayName || "Flex",
          displayIcon: flex?.displayIcon,
          price,
        });
      // Player card
      } else if (typeId === VItemTypes.PlayerCard) {
        const card = cardById.get(uuid);
        if (card) {
          allItems.push({
            uuid: card.uuid,
            displayName: card.displayName,
            displayIcon: card.displayIcon || card.largeArt,
            price,
          });
        } else {
          allItems.push({ uuid, displayName: fallbackItemName, price });
        }
      // Player title
      } else if (typeId === VItemTypes.PlayerTitle) {
        const title = titleById.get(uuid);
        if (title) {
          allItems.push({
            uuid: title.uuid,
            displayName: title.displayName,
            price,
          });
        } else {
          allItems.push({ uuid, displayName: fallbackItemName, price });
        }
      // Buddy
      } else if (typeId === VItemTypes.Buddy) {
        const buddy = buddyByAnyId.get(uuid);
        if (buddy) {
          allItems.push({
            uuid: buddy.uuid,
            displayName: buddy.displayName,
            displayIcon: buddy.levels?.[0]?.displayIcon || buddy.displayIcon,
            price,
          });
        } else {
          allItems.push({ uuid, displayName: fallbackItemName, price });
        }
      } else {
        allItems.push({ uuid, displayName: fallbackItemName, price });
      }
    }

    const resolvedBundleAsset =
      bundleAsset ||
      createFallbackBundleAsset(bundle, allItems, bundleIndex);
    const discountedPrice =
      bundle.TotalDiscountedCost?.[VCurrencies.VP] ??
      bundle.Items.reduce((total, item) => total + item.DiscountedPrice, 0);

    // Ưu tiên tổng giá chính thức từ Storefront, fallback sang tổng từng item.
    bundles.push({
      ...resolvedBundleAsset,
      price: discountedPrice,
      items: allItems,
    });
  }

  /* NIGHT MARKET (CHỢ ĐÊM) */
  let nightMarket: NightMarketItem[] = [];
  if (shop.BonusStore) {
    const bonusStore = shop.BonusStore.BonusStoreOffers;
    for (let k = 0; k < bonusStore.length; k++) {
      let itemid = bonusStore[k].Offer.Rewards[0].ItemID;
      const skin = skinByAnyId.get(itemid);
      if (!skin) continue;

      nightMarket.push({
        ...skin,
        price: bonusStore[k].Offer.Cost[VCurrencies.VP],           // Giá gốc
        discountedPrice: bonusStore[k].DiscountCosts[VCurrencies.VP], // Giá sau giảm
        discountPercent: bonusStore[k].DiscountPercent,               // % giảm giá
      });
    }
  }

  /* ACCESSORY SHOP (PHỤ KIỆN) */
  let accessoryStore = shop.AccessoryStore.AccessoryStoreOffers;
  let accessory: AccessoryShopItem[] = [];
  for (let accessoryIndex = 0; accessoryIndex < accessoryStore.length; accessoryIndex++) {
    const accessoryItem = accessoryStore[accessoryIndex].Offer;

    // Xác định loại item từ rewardId
    const rewardId = accessoryItem.Rewards[0].ItemID;
    const buddy = buddyByAnyId.get(rewardId);
    const card = cardById.get(rewardId);
    const title = titleById.get(rewardId);
    const spray = sprayById.get(rewardId);
    const flex = flexById.get(rewardId);

    if (buddy) {
      accessory[accessoryIndex] = {
        uuid: buddy.levels[0].uuid,
        displayName: buddy.displayName,
        displayIcon: buddy.levels[0].displayIcon,
        price: accessoryItem.Cost[VCurrencies.KC],  // Phụ kiện tính bằng KC
      };
    } else if (card) {
      accessory[accessoryIndex] = {
        uuid: card.uuid,
        displayName: card.displayName,
        displayIcon: card.displayIcon || card.largeArt,
        price: accessoryItem.Cost[VCurrencies.KC],
      };
    } else if (title) {
      accessory[accessoryIndex] = {
        uuid: title.uuid,
        displayName: title.displayName,
        price: accessoryItem.Cost[VCurrencies.KC],
      };
    } else if (spray) {
      accessory[accessoryIndex] = {
        uuid: spray.uuid,
        displayName: spray.displayName,
        displayIcon: spray.displayIcon || spray.fullTransparentIcon,
        price: accessoryItem.Cost[VCurrencies.KC],
      };
    } else if (flex) {
      accessory[accessoryIndex] = {
        uuid: flex.uuid,
        displayName: flex.displayName,
        displayIcon: flex.displayIcon,
        price: accessoryItem.Cost[VCurrencies.KC],
      };
    }
  }

  // Trả về kết quả đã parse, lọc bỏ các phần tử undefined/null
  return {
    main: main.filter(Boolean),
    bundles,
    nightMarket,
    accessory: accessory.filter(Boolean),
    remainingSecs: {                              // Thời gian còn lại (giây)
      main:
        shop.SkinsPanelLayout.SingleItemOffersRemainingDurationInSeconds ?? 0,
      bundles: featuredBundles.map(
        (bundle) => bundle.DurationRemainingInSeconds
      ),
      nightMarket: shop.BonusStore?.BonusStoreRemainingDurationInSeconds ?? 0,
      accessory:
        shop.AccessoryStore.AccessoryStoreRemainingDurationInSeconds ?? 0,
    },
  };
}
