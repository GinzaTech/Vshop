// Import axios để thực hiện HTTP requests đến API Riot Games
import axios from "axios";
// Import jwtDecode để giải mã JWT token lấy thông tin user
import { jwtDecode } from "jwt-decode";
// Import các hàm tiện ích: normalize shard, enum tiền tệ, enum loại item
import { normalizeValorantShard, VCurrencies, VItemTypes } from "./misc";
// Import https-browserify để tạo HTTPS agent với ciphers tùy chỉnh (dùng cho reAuth)
import https from "https-browserify";
// Import hàm fetch bundle, getAssetLookups và getAssets từ module assets
import { fetchBundle, getAssetLookups, getAssets } from "./valorant-assets";
// Import các hàm log cho axios request/response/error
import {
  logAxiosRequest,
  logAxiosResponse,
  logAxiosError,
  initApiLogger,
} from "./api-logger";

// Thiết lập timeout mặc định cho axios: 10 giây (giảm từ 15s để fail-fast trên 4G)
axios.defaults.timeout = 10_000;

// Khởi tạo API logger (async, không await để tránh chặn)
void initApiLogger();

// Interceptor cho request: log URL, ghi lại thời gian bắt đầu
axios.interceptors.request.use(
  function (config) {
    if (__DEV__) console.log(`${config.method?.toUpperCase()} ${config.url}`);
    (config as any).metadata = { startTime: Date.now() };
    return logAxiosRequest(config);
  },
  function (error) {
    return Promise.reject(error);
  }
);

// Interceptor cho response: log response/error
axios.interceptors.response.use(logAxiosResponse, logAxiosError);

// Hàm che giấu thông tin bí mật (token, secret) khi log
// Chỉ hiện 8 ký tự đầu và 6 ký tự cuối nếu chuỗi dài > 16, nếu không thì hiện "***"
// Parameters:
//   - value: chuỗi cần che giấu
// Returns: chuỗi đã được che hoặc rỗng
const maskSecretForLog = (value?: string | null) => {
  const text = String(value || "");
  if (!text) return "";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-6)}` : "***";
};

// Hàm log debug cho module valorant-api (chỉ log khi __DEV__ = true)
// Parameters:
//   - label: nhãn log
//   - payload: dữ liệu cần log
const logValorantApiDebug = (
  label: string,
  payload: Record<string, unknown>
) => {
  if (__DEV__) {
    console.log(`[valorant-api] ${label}`, payload);
  }
};

// Kiểu dữ liệu cho tên người chơi: Subject (UUID), GameName, TagLine
type PlayerName = { Subject: string; GameName: string; TagLine: string };
// Thời gian sống (TTL) của cache tên người chơi: 1 giờ (tính bằng milliseconds)
const PLAYER_NAME_CACHE_TTL_MS = 60 * 60 * 1000;
// Số lượng tối đa entry trong cache tên người chơi (LRU eviction)
const PLAYER_NAME_CACHE_MAX_SIZE = 500;
// Cache tên người chơi: key = "region|subject", value = { value, expiresAt }
const playerNameCache = new Map<
  string,
  { value: PlayerName; expiresAt: number; lastAccessed: number }
>();
// Map lưu các Promise đang thực thi để lấy tên người chơi (deduplicate request trùng lặp)
const playerNameRequests = new Map<string, Promise<PlayerName[]>>();


// Export interface phản hồi loadout (trang bị) của người chơi từ API Riot
export interface PlayerLoadoutResponse {
  SourceApiVersion?: "v2" | "v3";   // Phiên bản API (v2 cũ hoặc v3 mới)
  Subject: string;                    // UUID của người chơi
  Version: number;                    // Phiên bản loadout
  Guns: {                            // Danh sách vũ khí và skin đã trang bị
    ID: string;                       // UUID vũ khí
    CharmInstanceID?: string;         // UUID instance của charm (nếu có)
    CharmID?: string;                 // UUID charm
    CharmLevelID?: string;            // UUID cấp độ charm
    SkinID: string;                   // UUID skin đã chọn
    SkinLevelID: string;              // UUID cấp độ skin
    ChromaID: string;                 // UUID chroma (màu sắc)
    Attachments: unknown[];           // Các đính kèm khác
  }[];
  Sprays: {                          // Danh sách spray đã trang bị
    EquipSlotID: string;              // ID slot trang bị
    SprayID: string;                  // UUID spray
    SprayLevelID: string | null;      // UUID cấp độ spray hoặc null
  }[];
  ActiveExpressions?: PlayerLoadoutExpression[];  // Biểu cảm đang kích hoạt (v3)
  DynamicOptions?: Record<string, unknown>;        // Tùy chọn động (v3)
  Identity: {                        // Thông tin định danh người chơi
    PlayerCardID: string;             // UUID thẻ người chơi
    PlayerTitleID: string;            // UUID danh hiệu
    AccountLevel: number;             // Cấp độ tài khoản
    PreferredLevelBorderID: string;   // UUID viền cấp độ ưa thích
    HideAccountLevel: boolean;        // Ẩn cấp độ tài khoản?
  };
  Incognito: boolean;                 // Chế độ ẩn danh?
}

// Export interface biểu cảm (expression) của người chơi
export interface PlayerLoadoutExpression {
  TypeID: string;    // Loại biểu cảm
  AssetID: string;   // UUID asset biểu cảm
}

// Type nội bộ cho phản hồi loadout v3 (không có Sprays, thay bằng ActiveExpressions và DynamicOptions)
type PlayerLoadoutV3Response = Omit<PlayerLoadoutResponse, "Sprays"> & {
  ActiveExpressions: PlayerLoadoutExpression[];
  DynamicOptions: Record<string, unknown>;
};

// Hàm kiểm tra dữ liệu có phải là PlayerLoadoutV3Response hợp lệ không (type guard)
// Parameters:
//   - value: dữ liệu cần kiểm tra
// Returns: true nếu value là PlayerLoadoutV3Response
const isUsablePlayerLoadoutV3 = (
  value: unknown
): value is PlayerLoadoutV3Response => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const loadout = value as Partial<PlayerLoadoutV3Response>;
  return (
    typeof loadout.Subject === "string" &&
    typeof loadout.Version === "number" &&
    Array.isArray(loadout.Guns) &&
    Array.isArray(loadout.ActiveExpressions) &&
    Boolean(loadout.Identity)
  );
};

// Export interface phản hồi danh sách item đã sở hữu (entitlements)
export interface OwnedItemsResponse {
  Subject?: string;                    // UUID người chơi
  ItemTypeID?: string;                 // Loại item
  Entitlements?: {                    // Danh sách entitlement (cách cũ)
    TypeID?: string;
    ItemID: string;
    InstanceID?: string;
  }[];
  EntitlementsByTypes?: {             // Danh sách entitlement theo loại (cách mới)
    ItemTypeID: string;
    Entitlements: {
      TypeID: string;
      ItemID: string;
      InstanceID?: string;
    }[];
  }[];
}

// Export interface phản hồi thông tin MMR (rank) competitive
export interface CompetitiveMMRResponse {
  Subject?: string;                    // UUID người chơi
  QueueSkills?: {                     // Kỹ năng theo queue
    competitive?: {                   // Queue competitive
      CompetitiveTier?: number;        // Tier hiện tại (số)
      HighestCompetitiveTier?: number;  // Tier cao nhất từng đạt
      SeasonalInfoBySeasonID?: Record<  // Thông tin theo season
        string,
        {
          Rank?: number;
          CompetitiveTier?: number;
          RankedRating?: number;         // Điểm Ranked Rating (RR)
          WinsByTier?: Record<string, number> | null; // Số trận thắng theo tier
          SeasonHighestCompetitiveTier?: number;
        }
      >;
    };
  };
  LatestCompetitiveUpdate?: {         // Cập nhật competitive gần nhất
    SeasonID?: string;
    TierAfterUpdate?: number;
    TierBeforeUpdate?: number;
    RankedRatingAfterUpdate?: number;
    MatchStartTime?: number;
  };
}

// Export interface phản hồi session Valorant (thông tin phiên chơi)
export interface ValorantSessionResponse {
  subject?: string;                    // UUID người chơi
  clientVersion?: string;              // Phiên bản Riot client
  clientPlatformInfo?: {               // Thông tin nền tảng
    platformType?: string;
    platformOS?: string;
    platformOSVersion?: string;
    platformChipset?: string;
    platformDevice?: string;
  };
  [key: string]: any;                  // Các trường khác
}

// Export interface phản hồi trận đấu đang diễn ra (current game)
export interface CurrentGameMatchResponse {
  MatchID: string;
  Version: number;
  State: string;
  MapID: string;
  ModeID: string;
  ProvisioningFlow: string;
  GamePodID: string;
  AllMUCName: string;
  TeamMUCName: string;
  TeamVoiceID: string;
  TeamMatchToken: string;
  IsReconnectable: boolean;
  ConnectionDetails?: {
    GameServerHosts: string[];
    GameServerHost: string;
    GameServerPort: number;
    GameClientHash: number;
    PlayerKey: string;
  };
  Players: {
    Subject: string;
    TeamID: string;
    CharacterID: string;
    PlayerIdentity?: {
      Subject: string;
      PlayerCardID: string;
      PlayerTitleID: string;
      AccountLevel: number;
      PreferredLevelBorderID: string;
      Incognito: boolean;
      HideAccountLevel: boolean;
    };
    SeasonalBadgeInfo?: {
      SeasonID: string;
      NumberOfWins: number;
      Rank: number;
      LeaderboardRank: number;
    };
    IsCoach: boolean;
    IsAssociated: boolean;
    [key: string]: any;
  }[];
  [key: string]: any;
}

// Export interface phản hồi party (nhóm)
export interface PartyResponse {
  ID: string;                          // UUID party
  Members: {                          // Danh sách thành viên
    Subject: string;
    IsReady: boolean;
    [key: string]: any;
  }[];
  [key: string]: any;
}

// Export hàm trích xuất danh sách ItemID từ response OwnedItemsResponse
// Xử lý cả hai định dạng cũ (Entitlements) và mới (EntitlementsByTypes)
// Parameters:
//   - response: OwnedItemsResponse hoặc null
// Returns: mảng các ItemID (string) duy nhất
export const extractOwnedItemIds = (response?: OwnedItemsResponse | null) =>
  Array.from(
    new Set(
      [
        ...(response?.Entitlements ?? []).map((entitlement) => entitlement.ItemID),
        ...(response?.EntitlementsByTypes ?? []).flatMap((entry) =>
          (entry.Entitlements ?? []).map((entitlement) => entitlement.ItemID)
        ),
      ].filter((itemId): itemId is string => Boolean(itemId))
    )
  );


// Export biến defaultUser - đối tượng người dùng mặc định (trống)
// Dùng làm template/initial state cho thông tin người dùng
export let defaultUser = {
  id: "",                              // UUID người dùng
  name: "",                            // Tên hiển thị (GameName)
  TagLine: "",                         // TagLine (ví dụ: #NA1)
  region: "",                          // Khu vực (na, eu, ap, ...)
  shops: {                             // Thông tin shop
    main: [] as SkinShopItem[],         // Shop chính (4 skin hàng ngày)
    bundles: [] as BundleShopItem[],    // Bundle (gói)
    nightMarket: [] as NightMarketItem[], // Night Market
    accessory: [] as AccessoryShopItem[], // Phụ kiện
    remainingSecs: {                    // Thời gian còn lại (giây)
      main: 0,
      bundles: [0],
      nightMarket: 0,
      accessory: 0,
    },
  },
  balances: {                          // Số dư tiền tệ
    vp: 0,                              // Valorant Points (VP)
    rad: 0,                             // Radianite Points
    fag: 0,                             // Free Agent? (có thể là Kingdom Credits cũ)
    kc: 0,                              // Kingdom Credits
  },
  progress: {                          // Tiến trình tài khoản
    level: 0,                           // Cấp độ
    xp: 0,                              // Kinh nghiệm
  },
  ownedSkinIds: [] as string[],        // Danh sách UUID skin đã sở hữu
  accessToken: "",                      // Access token xác thực
  idToken: "",                          // ID token
  entitlementsToken: "",                // Entitlements token
};

// Hằng số: phiên bản Riot client mặc định (dùng khi chưa có dữ liệu assets hoặc override)
const DEFAULT_RIOT_CLIENT_VERSION = "release-13.00-shipping-32-4990475";
// Hằng số: platform info của Riot client (base64 encoded JSON của Windows PC)
const RIOT_CLIENT_PLATFORM =
  "eyJwbGF0Zm9ybVR5cGUiOiJQQyIsInBsYXRmb3JtT1MiOiJXaW5kb3dzIiwicGxhdGZvcm1PU1ZlcnNpb24iOiIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwicGxhdGZvcm1DaGlwc2V0IjoiVW5rbm93biJ9";

// Biến override phiên bản Riot client (có thể được set từ session)
let riotClientVersionOverride: string | null = null;

// Export hàm ghi đè phiên bản Riot client
// Nếu version hợp lệ (string không rỗng) thì set override, nếu không thì xóa override
// Parameters:
//   - version: phiên bản mới hoặc null/undefined để xóa
// Returns: phiên bản đã set hoặc null nếu xóa
export const setRiotClientVersionOverride = (version?: string | null) => {
  const normalizedVersion = typeof version === "string" ? version.trim() : "";

  if (!normalizedVersion) {
    riotClientVersionOverride = null;
    return null;
  }

  riotClientVersionOverride = normalizedVersion;
  return riotClientVersionOverride;
};

// Export hàm lấy phiên bản Riot client cho requests
// Ưu tiên: override > assets > default
// Returns: chuỗi phiên bản
export const getRiotClientVersionForRequests = () =>
  riotClientVersionOverride ||
  getAssets().riotClientVersion ||
  DEFAULT_RIOT_CLIENT_VERSION;

// Hàm nội bộ: tạo headers phụ (extra) cho các request API Riot
// Bao gồm: ClientVersion, ClientPlatform, Accept-Encoding (gzip), Connection keep-alive
// Accept-Encoding gzip giảm 60-80% payload trên 4G
const extraHeaders = () => ({
  "X-Riot-ClientVersion": getRiotClientVersionForRequests(),
  "X-Riot-ClientPlatform": RIOT_CLIENT_PLATFORM,
  "Accept-Encoding": "gzip, deflate",
  "Connection": "keep-alive",
});

// Export hàm lấy entitlements token từ access token
// Gọi API entitlements.auth.riotgames.com để lấy token quyền
// Parameters:
//   - accessToken: token xác thực Riot
// Returns: Promise<string> entitlements token
export async function getEntitlementsToken(accessToken: string) {
  const res = await axios.request<EntitlementResponse>({
    url: getUrl({ name: "entitlements" }),
    method: "POST",
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    data: {},
  });
  return res.data.entitlements_token;
}

// Export hàm lấy User ID (subject) từ access token JWT
// Giải mã JWT và trả về trường "sub" (subject = UUID người dùng)
// Parameters:
//   - accessToken: JWT token cần giải mã
// Returns: string UUID người dùng
export function getUserId(accessToken: string) {
  const data = jwtDecode(accessToken) as any;
  return data.sub;
}

// Export hàm lấy tên hiển thị (GameName + TagLine) của người dùng
// Gọi API name-service của Riot
// Parameters:
//   - accessToken: token xác thực
//   - entitlementsToken: token quyền
//   - userId: UUID người dùng
//   - region: khu vực (na, eu, ap, ...)
// Returns: Promise<{ GameName: string, TagLine: string }>
export async function getUsername(
  accessToken: string,
  entitlementsToken: string,
  userId: string,
  region: string
) {
  const res = await axios.request<NameServiceResponse>({
    url: getUrl({ name: "name", region: region }),
    method: "PUT",
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
    data: [userId],
  });

  return {
    GameName: res.data[0].GameName || "?",
    TagLine: res.data[0].TagLine || "?",
  };
}


// Export hàm lấy thông tin shop (cửa hàng) hiện tại của người dùng
// Gọi API storefront v3
// Parameters:
//   - accessToken: token xác thực
//   - entitlementsToken: token quyền
//   - region: khu vực
//   - userId: UUID người dùng
// Returns: Promise<StorefrontResponse> dữ liệu shop
export async function getShop(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const res = await axios.request<StorefrontResponse>({
    url: getUrl({ name: "storefront", region: region, userId: userId }),
    method: "POST",
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
    data: {},
  });
  return res.data;
}

// Export hàm parse dữ liệu shop từ StorefrontResponse thành cấu trúc có tổ chức
// Chia shop thành: main (4 skin chính), bundles, night market, accessory (phụ kiện)
// Parameters:
//   - shop: StorefrontResponse từ API
//   - cachedBundles: danh sách bundle đã cache (tránh fetch lại)
// Returns: object chứa main, bundles, nightMarket, accessory, remainingSecs
export async function parseShop(
  shop: StorefrontResponse,
  cachedBundles: BundleShopItem[] = []
) {
  /* SHOP CHÍNH (4 SKIN HÀNG NGÀY) */
  let singleItemStoreOffers = shop.SkinsPanelLayout.SingleItemStoreOffers;
  let main: SkinShopItem[] = [];
  // Lấy các lookup map từ assets
  const {
    skinByAnyId,     // Map UUID -> ValorantSkin (bao gồm level và chroma UUID)
    buddyByAnyId,    // Map UUID -> ValorantBuddyAccessory
    sprayById,       // Map UUID -> spray
    flexById,        // Map UUID -> flex
    cardById,        // Map UUID -> card
    titleById,       // Map UUID -> title
  } = getAssetLookups();

  // Duyệt từng offer trong shop chính
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
  // Xử lý featured bundles (có thể là mảng hoặc object đơn)
  const featuredBundles = shop.FeaturedBundle.Bundles?.length
    ? shop.FeaturedBundle.Bundles
    : shop.FeaturedBundle.Bundle
      ? [shop.FeaturedBundle.Bundle]
      : [];
  // Tạo map bundle từ cache để tra nhanh
  const cachedBundleById = new Map(
    cachedBundles.map((bundle) => [bundle.uuid, bundle])
  );

  // Fetch thông tin chi tiết từng bundle (từ cache hoặc API)
  const bundleResults = await Promise.all(
    featuredBundles.map(async (bundle) => {
      const bundleAsset =
        cachedBundleById.get(bundle.DataAssetID) ||
        (await fetchBundle(bundle.DataAssetID));
      return { bundle, bundleAsset };
    })
  );

  // Parse từng bundle: xác định loại item, lấy thông tin hiển thị
  for (const { bundle, bundleAsset } of bundleResults) {
    if (bundleAsset == null) continue;

    const allItems: (SkinShopItem | AccessoryShopItem)[] = [];

    for (const item of bundle.Items) {
      const uuid = item.Item.ItemID;
      const typeId = item.Item.ItemTypeID;
      const price = item.BasePrice;

      // Skin level hoặc chroma
      if (typeId === VItemTypes.SkinLevel || typeId === VItemTypes.SkinChroma) {
        const skin = skinByAnyId.get(uuid);
        if (skin) {
          allItems.push({ ...skin, price } as SkinShopItem);
        } else {
          allItems.push({
            uuid,
            displayName: "",
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
        }
      }
    }

    // Tính tổng giá bundle (từ các item discounted price)
    bundles.push({
      ...bundleAsset,
      price: bundle.Items.map((item) => item.DiscountedPrice).reduce(
        (a, b) => a + b,
        0
      ),
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

// Export hàm lấy số dư các loại tiền tệ của người dùng
// Gọi API wallet
// Parameters:
//   - accessToken: token xác thực
//   - entitlementsToken: token quyền
//   - region: khu vực
//   - userId: UUID người dùng
// Returns: Promise<{ vp, rad, fag, kc }> số dư từng loại
export async function getBalances(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const res = await axios.request<WalletResponse>({
    url: getUrl({ name: "wallet", region: region, userId: userId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
  });

  return {
    vp: res.data.Balances[VCurrencies.VP],     // Valorant Points
    rad: res.data.Balances[VCurrencies.RAD],    // Radianite
    fag: res.data.Balances[VCurrencies.FAG],    // Free agent (?)
    kc: res.data.Balances[VCurrencies.KC],      // Kingdom Credits
  };
}

// Export hàm lấy tiến trình tài khoản (cấp độ + kinh nghiệm)
// Gọi API account-xp
// Parameters:
//   - accessToken: token xác thực
//   - entitlementsToken: token quyền
//   - region: khu vực
//   - userId: UUID người dùng
// Returns: Promise<{ level: number, xp: number }>
export async function getProgress(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const res = await axios.request<AccountXPResponse>({
    url: getUrl({ name: "playerxp", region: region, userId: userId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
  });
  return {
    level: res.data.Progress.Level,   // Cấp độ tài khoản
    xp: res.data.Progress.XP,          // Kinh nghiệm
  };
}


// Export hàm re-authentication (đăng nhập lại) với Riot
// Gửi request đến auth.riotgames.com với User-Agent giả Riot client
// Sử dụng HTTPS agent với ciphers tùy chỉnh để bypass các hạn chế bảo mật
// Parameters:
//   - version: phiên bản Riot client để giả mạo User-Agent
// Returns: Promise<AxiosResponse> chứa URI xác thực
export const reAuth = (version: string) =>
  axios.request({
    url: "https://auth.riotgames.com/api/v1/authorization",
    method: "POST",
    headers: {
      "User-Agent": `RiotClient/${version} rso-auth (Windows; 10;;Professional, x64)`,
      "Content-Type": "application/json",
    },
    data: {
      client_id: "play-valorant-web-prod",       // Client ID của Valorant web
      nonce: "1",
      redirect_uri: "https://playvalorant.com/opt_in",
      response_type: "token id_token",
      response_mode: "query",
      scope: "account openid",                    // Phạm vi quyền
    },
    // Cấu hình HTTPS agent với các cipher cụ thể (cần thiết cho Riot auth)
    httpsAgent: new https.Agent({
      ciphers: [
        "TLS_CHACHA20_POLY1305_SHA256",
        "TLS_AES_128_GCM_SHA256",
        "TLS_AES_256_GCM_SHA384",
        "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256",
      ].join(":"),
      honorCipherOrder: true,
      minVersion: "TLSv1.2",
    }),
    withCredentials: true,                        // Gửi kèm cookie
  });

// Export hàm lấy MatchID của trận đấu pregame (trước khi vào game)
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực và người dùng
// Returns: Promise<string> UUID của trận đấu
export async function getMatchID(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string) {
  const res = await axios.request<PreGamePlayerResponse>({
    url: getUrl({ name: "matchID", region: region, userId: userId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      'X-Riot-Entitlements-JWT': entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.data.MatchID;
}

// Export hàm lock (chọn) agent trong pregame lobby
// Parameters:
//   - accesstoken, entitlementsToken, userId, region: thông tin xác thực
//   - agentId: UUID của agent muốn chọn
// Returns: Promise<LockCharacterResponse>
export async function lockAgent(
  accesstoken: string,
  entitlementsToken: string,
  userId: string,
  region: string,
  agentId: string) {
  const matchId = await getMatchID(accesstoken, entitlementsToken, region, userId);

  const res = await axios.request<LockCharacterResponse>({
    url: getUrl({ name: "lock", region: region, matchId: matchId, agentId: agentId }),
    method: "POST",
    headers: {
      ...extraHeaders(),
      'X-Riot-Entitlements-JWT': entitlementsToken,
      Authorization: `Bearer ${accesstoken}`,
    }
  })
  return res.data;
}

// Export hàm thoát pregame lobby
// Parameters:
//   - accesstoken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<any>
export async function quitPreGameLobby(
  accesstoken: string,
  entitlementsToken: string,
  region: string,
  userId: string) {
  const matchId = await getMatchID(accesstoken, entitlementsToken, region, userId);
  const res = await axios.request({
    url: getUrl({ name: "quit", region: region, matchId: matchId }),
    method: "POST",
    headers: {
      ...extraHeaders(),
      'X-Riot-Entitlements-JWT': entitlementsToken,
      Authorization: `Bearer ${accesstoken}`,
    }
  })
  return res.data;
}

// Export hàm lấy loadout (trang bị) của người chơi
// Ưu tiên API v3, fallback về v2 nếu v3 không khả dụng
// Parameters:
//   - accesstoken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<PlayerLoadoutResponse | null>
export async function playerLoadout(
  accesstoken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<PlayerLoadoutResponse | null> {
  const headers = {
    ...extraHeaders(),
    "X-Riot-Entitlements-JWT": entitlementsToken,
    Authorization: `Bearer ${accesstoken}`,
  };

  // Thử API v3 trước
  const currentResponse = await axios
    .request<PlayerLoadoutV3Response>({
      url: getUrl({ name: "player-v3", region, userId }),
      method: "GET",
      validateStatus: () => true,
      headers,
    })
    .catch(() => null);

  // Nếu v3 thành công và dữ liệu hợp lệ
  if (
    currentResponse?.status === 200 &&
    isUsablePlayerLoadoutV3(currentResponse.data)
  ) {
    if (__DEV__) {
      console.log("Player Loadout status:", {
        v3: currentResponse.status,
        v2: "skipped",
      });
    }

    return {
      ...currentResponse.data,
      SourceApiVersion: "v3",
      Sprays: [],                                                  // v3 không có Sprays
      ActiveExpressions: currentResponse.data.ActiveExpressions ?? [],
      DynamicOptions: currentResponse.data.DynamicOptions ?? {},
    };
  }

  // Fallback về API v2
  const legacyResponse = await axios
    .request<PlayerLoadoutResponse>({
      url: getUrl({ name: "player", region, userId }),
      method: "GET",
      validateStatus: () => true,
      headers,
    })
    .catch(() => null);

  const legacy =
    legacyResponse?.status === 200 ? legacyResponse.data : null;

  if (__DEV__) {
    console.log("Player Loadout status:", {
      v3: currentResponse?.status ?? null,
      v2: legacyResponse?.status ?? null,
    });
  }

  if (!legacy) {
    return null;    // Cả hai API đều thất bại
  }

  return {
    ...legacy,
    SourceApiVersion: "v2",
    Guns: legacy.Guns ?? [],
    Sprays: legacy.Sprays ?? [],
    ActiveExpressions: legacy.ActiveExpressions ?? [],
    DynamicOptions: legacy.DynamicOptions ?? {},
  };
}

// Export hàm cập nhật loadout người chơi (API v2)
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - loadout: dữ liệu loadout mới
// Returns: Promise<PlayerLoadoutResponse>
export async function updatePlayerLoadout(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  loadout: PlayerLoadoutResponse
): Promise<PlayerLoadoutResponse> {
  const res = await axios.request<PlayerLoadoutResponse>({
    url: getUrl({ name: "player", region, userId }),
    method: "PUT",
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      Guns: loadout.Guns,
      Sprays: loadout.Sprays,
      Identity: loadout.Identity,
      Incognito: loadout.Incognito,
    },
  });

  return {
    ...loadout,
    ...res.data,
    SourceApiVersion: "v2",
    ActiveExpressions: loadout.ActiveExpressions ?? [],
    DynamicOptions: loadout.DynamicOptions ?? {},
  };
}

// Export hàm cập nhật loadout người chơi (API v3)
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - loadout: dữ liệu loadout mới
// Returns: Promise<PlayerLoadoutResponse>
export async function updatePlayerLoadoutV3(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  loadout: PlayerLoadoutResponse
): Promise<PlayerLoadoutResponse> {
  const res = await axios.request<PlayerLoadoutV3Response>({
    url: getUrl({ name: "player-v3", region, userId }),
    method: "PUT",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      Subject: loadout.Subject,
      Version: loadout.Version,
      Guns: loadout.Guns,
      ActiveExpressions: loadout.ActiveExpressions ?? [],
      DynamicOptions: loadout.DynamicOptions ?? {},
      Identity: loadout.Identity,
      Incognito: loadout.Incognito,
    },
  });

  if (res.status !== 200) {
    throw new Error(`Player loadout v3 update failed with ${res.status}`);
  }

  return {
    ...loadout,
    ...res.data,
    SourceApiVersion: "v3",
    Sprays: loadout.Sprays,
    ActiveExpressions:
      res.data.ActiveExpressions ?? loadout.ActiveExpressions ?? [],
    DynamicOptions: res.data.DynamicOptions ?? loadout.DynamicOptions ?? {},
  } as PlayerLoadoutResponse;
}

// Export hàm cập nhật loadout, ưu tiên v3 nếu loadout hiện tại là v3
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - loadout: dữ liệu loadout mới
// Returns: Promise<PlayerLoadoutResponse>
export async function updatePlayerLoadoutV3First(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  loadout: PlayerLoadoutResponse
): Promise<PlayerLoadoutResponse> {
  if (loadout.SourceApiVersion === "v2") {
    return updatePlayerLoadout(
      accessToken,
      entitlementsToken,
      region,
      userId,
      loadout
    );
  }

  return updatePlayerLoadoutV3(
    accessToken,
    entitlementsToken,
    region,
    userId,
    loadout
  );
}

// Export hàm lấy danh sách item đã sở hữu (entitlements) theo loại item
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - itemTypeId: UUID loại item (skin, spray, card, ...)
// Returns: Promise<OwnedItemsResponse> hoặc object rỗng nếu lỗi
export async function ownedItems(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  itemTypeId: string
) {
  const res = await axios.request<OwnedItemsResponse>({
    url: getUrl({
      name: "owned-items",
      region,
      userId,
      itemTypeId,
    }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.status === 200 ? res.data : {};
}

// Export hàm lấy lịch sử trận đấu của người chơi
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - params: tham số tùy chọn (startIndex, endIndex, queue)
// Returns: Promise<MatchHistoryResponse>
export async function playerMatchHistory(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  params?: { startIndex?: number; endIndex?: number; queue?: string }
): Promise<MatchHistoryResponse> {
  const res = await axios.request<MatchHistoryResponse>({
    url: getUrl({ name: "match-history", region: region, userId: userId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    params,
  });
  return res.data;
}

// Export hàm lấy thông tin session Valorant hiện tại
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<ValorantSessionResponse | null>
export async function getValorantSession(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const res = await axios.request<ValorantSessionResponse>({
    url: getUrl({ name: "session", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.status === 200 ? res.data : null;
}

// Export hàm cập nhật phiên bản Riot client từ thông tin session
// Lấy clientVersion từ session và set làm override
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<string | null> phiên bản đã set hoặc null
export async function hydrateRiotClientVersionFromSession(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  const session = await getValorantSession(
    accessToken,
    entitlementsToken,
    region,
    userId
  ).catch(() => null);
  const sessionVersion = session?.clientVersion?.trim();

  if (!sessionVersion) {
    return null;
  }

  return setRiotClientVersionOverride(sessionVersion);
}

// Export hàm lấy thông tin MMR competitive của người chơi
// Tự động retry với client version từ session nếu request đầu thất bại
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<CompetitiveMMRResponse | {}>
export async function getCompetitiveMMR(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
) {
  // Hàm nội bộ thực hiện request MMR
  const requestMmr = () => axios.request<CompetitiveMMRResponse>({
    url: getUrl({ name: "mmr", region: region, userId: userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  logValorantApiDebug("MMR_FetchPlayer request", {
    region,
    userId: maskSecretForLog(userId),
    accessToken: maskSecretForLog(accessToken),
    entitlementsToken: maskSecretForLog(entitlementsToken),
  });

  const res = await requestMmr();
  logValorantApiDebug("MMR_FetchPlayer response", {
    status: res.status,
    statusText: res.statusText,
    data: res.data,
  });

  // Thành công ngay lần đầu
  if (res.status === 200) {
    return res.data;
  }

  // Thất bại: thử hydrate client version và retry
  const currentVersion = getRiotClientVersionForRequests();
  const sessionVersion = await hydrateRiotClientVersionFromSession(
    accessToken,
    entitlementsToken,
    region,
    userId
  );

  if (sessionVersion && sessionVersion !== currentVersion) {
    const retryRes = await requestMmr();
    logValorantApiDebug("MMR_FetchPlayer retry response", {
      status: retryRes.status,
      statusText: retryRes.statusText,
      data: retryRes.data,
    });
    return retryRes.status === 200 ? retryRes.data : {};
  }

  return {};
}

// Export hàm lấy chi tiết một trận đấu cụ thể
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - matchId: UUID trận đấu
// Returns: Promise<MatchDetailsResponse>
export async function matchDetails(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<MatchDetailsResponse> {
  const res = await axios.request<MatchDetailsResponse>({
    url: getUrl({ name: "match-details", region: region, matchId: matchId }),
    method: "GET",
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.data;
}

// Hàm nội bộ: xây dựng URL đầy đủ cho các API endpoint của Riot
// Dựa trên tên endpoint, region (shard), và các tham số cần thiết
// Parameters:
//   - name: tên endpoint (tra trong URLS map)
//   - region: khu vực (na, eu, ap, ...)
//   - userId: UUID người dùng
//   - matchId: UUID trận đấu
//   - agentId: UUID agent
//   - itemTypeId: UUID loại item
//   - code: mã mời party
// Returns: URL hoàn chỉnh dạng string
function getUrl({
  name,
  region,
  userId,
  matchId,
  agentId,
  itemTypeId,
  code,
}: {
  name: string;
  region?: string | null;
  userId?: string | null;
  matchId?: string | null;
  agentId?: string | null;
  itemTypeId?: string | null;
  code?: string | null;
}) {
  // Chuẩn hóa shard từ region
  const shard = normalizeValorantShard(region);
  // Map chứa tất cả các API endpoints
  const URLS: Record<string, string> = {
    auth: "https://auth.riotgames.com/api/v1/authorization/",
    entitlements: "https://entitlements.auth.riotgames.com/api/token/v1/",
    storefront: `https://pd.${shard}.a.pvp.net/store/v3/storefront/${userId}`,
    wallet: `https://pd.${shard}.a.pvp.net/store/v1/wallet/${userId}`,
    playerxp: `https://pd.${shard}.a.pvp.net/account-xp/v1/players/${userId}`,
    weapons: "https://valorant-api.com/v1/weapons/",
    offers: `https://pd.${shard}.a.pvp.net/store/v1/offers/`,
    name: `https://pd.${shard}.a.pvp.net/name-service/v2/players`,
    matchID: `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/players/${userId}`,
    lock: `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/matches/${matchId}/lock/${agentId}`,
    quit: `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/matches/${matchId}/quit`,
    player: `https://pd.${shard}.a.pvp.net/personalization/v2/players/${userId}/playerloadout`,
    "player-v3": `https://pd.${shard}.a.pvp.net/personalization/v3/players/${userId}/playerloadout`,
    mmr: `https://pd.${shard}.a.pvp.net/mmr/v1/players/${userId}`,
    "owned-items": `https://pd.${shard}.a.pvp.net/store/v1/entitlements/${userId}/${itemTypeId}`,
    "match-history": `https://pd.${shard}.a.pvp.net/match-history/v1/history/${userId}`,
    "match-details": `https://pd.${shard}.a.pvp.net/match-details/v1/matches/${matchId}`,
    "competitive-updates": `https://pd.${shard}.a.pvp.net/mmr/v1/players/${userId}/competitiveupdates`,
    session: `https://glz-${shard}-1.${shard}.a.pvp.net/session/v1/sessions/${userId}`,
    "pregame-player": `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/players/${userId}`,
    "pregame-match": `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/matches/${matchId}`,
    "select-agent": `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/matches/${matchId}/select/${agentId}`,
    "pregame-loadouts": `https://glz-${shard}-1.${shard}.a.pvp.net/pregame/v1/matches/${matchId}/loadouts`,
    "coregame-player": `https://glz-${shard}-1.${shard}.a.pvp.net/core-game/v1/players/${userId}`,
    "coregame-match": `https://glz-${shard}-1.${shard}.a.pvp.net/core-game/v1/matches/${matchId}`,
    "coregame-loadouts": `https://glz-${shard}-1.${shard}.a.pvp.net/core-game/v1/matches/${matchId}/loadouts`,
    "coregame-quit": `https://glz-${shard}-1.${shard}.a.pvp.net/core-game/v1/matches/${matchId}/quit`,
    "party-player": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/players/${userId}`,
    "party": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/parties/${matchId}`,
    "party-ready": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/parties/${matchId}/members/${userId}/setReady`,
    "party-remove": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/players/${userId}`,
    "party-join-queue": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/parties/${matchId}/matchmaking/join`,
    "party-leave-queue": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/parties/${matchId}/matchmaking/leave`,
    "party-invite-code": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/parties/${matchId}/invitecode`,
    "party-join-by-code": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/players/joinbycode/${code}`,
    "party-muc-token": `https://glz-${shard}-1.${shard}.a.pvp.net/parties/v1/parties/${matchId}/muctoken`,
    "contracts": `https://pd.${shard}.a.pvp.net/contracts/v1/contracts/${userId}`,
    "activate-contract": `https://pd.${shard}.a.pvp.net/contracts/v1/contracts/${userId}/special/${itemTypeId}`,
    "item-upgrades": `https://pd.${shard}.a.pvp.net/contract-definitions/v3/item-upgrades`,
    "content": `https://shared.${shard}.a.pvp.net/content-service/v3/content`,
    "leaderboard": `https://pd.${shard}.a.pvp.net/mmr/v1/leaderboards/affinity/${shard}/queue/competitive/season/${itemTypeId}`,
    "config": `https://pd.${shard}.a.pvp.net/v1/config/${shard}`,
    "penalties": `https://pd.${shard}.a.pvp.net/restrictions/v3/penalties`,
    "playerinfo": "https://auth.riotgames.com/userinfo",
    "riotgeo": "https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant",
    "pastoken": "https://riot-geo.pas.si.riotgames.com/pas/v1/service/chat",
    "riotclientconfig": "https://clientconfig.rpg.riotgames.com/api/v1/config/player?app=Riot%20Client",
  };

  return URLS[name];
}

// ---------------------------------------------------------------------------
// getCompetitiveUpdates - Lấy cập nhật competitive (lịch sử rank)
// ---------------------------------------------------------------------------
// Export hàm lấy lịch sử thay đổi rank competitive
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - params: tham số tùy chọn (startIndex, endIndex, queue)
// Returns: Promise<CompetitiveUpdatesResponse | null>
export async function getCompetitiveUpdates(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  params?: { startIndex?: number; endIndex?: number; queue?: string }
): Promise<CompetitiveUpdatesResponse | null> {
  logValorantApiDebug("MMR_FetchCompetitiveUpdates request", {
    region,
    userId: maskSecretForLog(userId),
    params,
    accessToken: maskSecretForLog(accessToken),
    entitlementsToken: maskSecretForLog(entitlementsToken),
  });

  const res = await axios.request<CompetitiveUpdatesResponse>({
    url: getUrl({ name: "competitive-updates", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    params,
  });
  logValorantApiDebug("MMR_FetchCompetitiveUpdates response", {
    status: res.status,
    statusText: res.statusText,
    data: res.data,
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// getPlayerNames – Giải mã danh sách UUID subject thành GameName/TagLine
// Có cache và deduplicate request
// ---------------------------------------------------------------------------
// Export hàm lấy tên người chơi từ danh sách subject UUIDs
// Parameters:
//   - accessToken: token xác thực
//   - entitlementsToken: token quyền
//   - subjects: mảng UUID cần tra cứu
//   - region: khu vực
// Returns: Promise<PlayerName[]> danh sách tên người chơi
export async function getPlayerNames(
  accessToken: string,
  entitlementsToken: string,
  subjects: string[],
  region: string
): Promise<PlayerName[]> {
  // Chuẩn hóa: loại bỏ trùng lặp, chuyển về chữ thường
  const normalizedSubjects = Array.from(
    new Set(subjects.filter(Boolean).map((subject) => subject.toLowerCase()))
  );
  const now = Date.now();
  // Lọc các subject chưa có cache hoặc cache đã hết hạn
  const missingSubjects = normalizedSubjects.filter((subject) => {
    const cached = playerNameCache.get(`${region}|${subject}`);
    return !cached || cached.expiresAt <= now;
  });

  if (missingSubjects.length > 0) {
    // Tạo key duy nhất cho request để deduplicate
    const requestKey = `${region}|${[...missingSubjects].sort().join(",")}`;
    let request = playerNameRequests.get(requestKey);

    if (!request) {
      // Chưa có request nào đang chạy -> tạo mới
      request = axios
        .request<PlayerName[]>({
          url: getUrl({ name: "name", region }),
          method: "PUT",
          headers: {
            ...extraHeaders(),
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "X-Riot-Entitlements-JWT": entitlementsToken,
          },
          data: missingSubjects,
          validateStatus: () => true,
        })
        .then((res) => {
          if (res.status !== 200 || !Array.isArray(res.data)) {
            throw new Error(
              `Name Service returned ${res.status} instead of a player list`
            );
          }

          return res.data;
        })
        .finally(() => {
          playerNameRequests.delete(requestKey);
        });
      playerNameRequests.set(requestKey, request);
    }

    // Chờ request hoàn thành, cập nhật cache
    const fetchedNames = await request;
    fetchedNames.forEach((entry) => {
      const cacheKey = `${region}|${entry.Subject.toLowerCase()}`;
      if (playerNameCache.size >= PLAYER_NAME_CACHE_MAX_SIZE) {
        const oldestKey = [...playerNameCache.entries()].sort(
          (a, b) => a[1].lastAccessed - b[1].lastAccessed
        )[0]?.[0];
        if (oldestKey) playerNameCache.delete(oldestKey);
      }
      playerNameCache.set(cacheKey, {
        value: entry,
        expiresAt: Date.now() + PLAYER_NAME_CACHE_TTL_MS,
        lastAccessed: Date.now(),
      });
    });
  }

  // Trả về kết quả từ cache
  return normalizedSubjects.flatMap((subject) => {
    const cached = playerNameCache.get(`${region}|${subject}`);
    if (cached && cached.expiresAt > Date.now()) {
      cached.lastAccessed = Date.now();
      return [cached.value];
    }
    return [];
  });
}

// ---------------------------------------------------------------------------
// Pre-game (trước trận đấu)
// ---------------------------------------------------------------------------
// Export hàm lấy thông tin người chơi trong pregame
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<{ Subject, MatchID, Version } | null>
export async function getPreGamePlayer(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<{ Subject: string; MatchID: string; Version: number } | null> {
  const res = await axios.request<PreGamePlayerResponse>({
    url: getUrl({ name: "pregame-player", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// Export hàm lấy thông tin trận đấu pregame
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - matchId: UUID trận đấu
// Returns: Promise<LockCharacterResponse | null>
export async function getPreGameMatch(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<LockCharacterResponse | null> {
  const res = await axios.request<LockCharacterResponse>({
    url: getUrl({ name: "pregame-match", region, matchId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// Export hàm chọn agent (khóa) trong pregame
// Parameters:
//   - accessToken, entitlementsToken, userId, region: thông tin xác thực
//   - agentId: UUID agent muốn chọn
// Returns: Promise<any>
export async function selectAgent(
  accessToken: string,
  entitlementsToken: string,
  userId: string,
  region: string,
  agentId: string
): Promise<any> {
  const matchId = await getMatchID(accessToken, entitlementsToken, region, userId);
  const res = await axios.request({
    url: getUrl({ name: "select-agent", region, matchId, agentId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Core-game (trận đấu đang diễn ra)
// ---------------------------------------------------------------------------
// Export hàm lấy thông tin người chơi trong trận đấu đang diễn ra
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<{ Subject, MatchID, Version } | null>
export async function getCurrentGamePlayer(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<{ Subject: string; MatchID: string; Version: number } | null> {
  const res = await axios.request<{ Subject: string; MatchID: string; Version: number }>({
    url: getUrl({ name: "coregame-player", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// Export hàm lấy thông tin trận đấu đang diễn ra
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - matchId: UUID trận đấu
// Returns: Promise<CurrentGameMatchResponse | null>
export async function getCurrentGameMatch(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<CurrentGameMatchResponse | null> {
  const res = await axios.request<CurrentGameMatchResponse>({
    url: getUrl({ name: "coregame-match", region, matchId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Party (nhóm chơi)
// ---------------------------------------------------------------------------
// Export hàm lấy thông tin party của người chơi (gồm CurrentPartyID)
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<{ CurrentPartyID, ... } | null>
export async function getPartyPlayer(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<{ CurrentPartyID: string; [key: string]: any } | null> {
  const url = getUrl({ name: "party-player", region, userId });
  const res = await axios.request<{ CurrentPartyID: string; [key: string]: any }>({
    url,
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (__DEV__) {
    console.log("[party-player] response", {
      status: res.status,
      url,
      userId,
      currentPartyId: res.data?.CurrentPartyID || null,
      data: res.status === 200 ? undefined : res.data,
    });
  }
  return res.status === 200 ? res.data : null;
}

// Export hàm lấy thông tin chi tiết party theo ID
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - partyId: UUID party
// Returns: Promise<PartyResponse | null>
export async function getParty(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const url = getUrl({ name: "party", region, matchId: partyId });  // tái sử dụng matchId slot để truyền partyId
  const res = await axios.request<PartyResponse>({
    url,
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (__DEV__) {
    console.log("[party] response", {
      status: res.status,
      url,
      partyId,
      hasParty: res.status === 200,
      mucName: res.status === 200 ? res.data?.MUCName : undefined,
      members: res.status === 200 ? res.data?.Members?.length || 0 : 0,
    });
  }
  return res.status === 200 ? res.data : null;
}

// Export hàm lấy MUC token cho party chat (XMPP)
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - partyId: UUID party
// Returns: Promise<PartyChatTokenResponse | null>
// Throw error nếu không lấy được token
export async function getPartyMucToken(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyChatTokenResponse | null> {
  const url = getUrl({ name: "party-muc-token", region, matchId: partyId });
  const res = await axios.request<PartyChatTokenResponse>({
    url,
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const responseData = res.data as any;
  // Che token trong log
  const logData =
    responseData && typeof responseData === "object"
      ? {
          ...responseData,
          Token: responseData.Token ? "[redacted]" : responseData.Token,
        }
      : responseData;
  if (__DEV__) console.log("[party-muc-token] response", {
    status: res.status,
    url,
    partyId,
    data: logData,
  });
  if (res.status !== 200) {
    const message =
      responseData?.message ||
      responseData?.errorCode ||
      `HTTP ${res.status}`;
    throw new Error(`Could not get party chat token (${res.status}: ${message})`);
  }
  return res.data;
}

// Export hàm set trạng thái ready/unready trong party
// Parameters:
//   - accessToken, entitlementsToken, region, partyId, userId: thông tin xác thực
//   - ready: true = ready, false = unready
// Returns: Promise<PartyResponse | null>
export async function setPartyReady(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string,
  userId: string,
  ready: boolean
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: getUrl({ name: "party-ready", region, matchId: partyId, userId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    data: { ready },
  });
  return res.status === 200 ? res.data : null;
}

// Export hàm tạo mã mời party
// Parameters:
//   - accessToken, entitlementsToken, region, partyId: thông tin xác thực
// Returns: Promise<PartyResponse | null>
export async function generatePartyInviteCode(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: getUrl({ name: "party-invite-code", region, matchId: partyId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// Export hàm xóa mã mời party
// Parameters:
//   - accessToken, entitlementsToken, region, partyId: thông tin xác thực
// Returns: Promise<PartyResponse | null>
export async function disablePartyInviteCode(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: getUrl({ name: "party-invite-code", region, matchId: partyId }),
    method: "DELETE",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// Export hàm tham gia party bằng mã mời
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - inviteCode: mã mời
// Returns: Promise<{ CurrentPartyID?, ... } | null>
export async function joinPartyByCode(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  inviteCode: string
): Promise<{ CurrentPartyID?: string; [key: string]: any } | null> {
  const res = await axios.request<{ CurrentPartyID?: string; [key: string]: any }>({
    url: getUrl({
      name: "party-join-by-code",
      region,
      code: encodeURIComponent(inviteCode),
    }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Contracts (hợp đồng/agent contract)
// ---------------------------------------------------------------------------
// Export hàm lấy thông tin contracts của người chơi
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<ContractsResponse | null>
export async function getContracts(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<ContractsResponse | null> {
  const res = await axios.request<ContractsResponse>({
    url: getUrl({ name: "contracts", region, userId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (__DEV__) console.log("[contracts] response", {
    status: res.status,
    data: res.data,
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Activate Contract (kích hoạt hợp đồng agent)
// ---------------------------------------------------------------------------
// Export hàm kích hoạt một contract (hợp đồng agent)
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
//   - contractId: UUID contract cần kích hoạt
// Returns: Promise<ContractsResponse | null>
export async function activateContract(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string,
  contractId: string
): Promise<ContractsResponse | null> {
  const res = await axios.request<ContractsResponse>({
    url: getUrl({ name: "activate-contract", region, userId, itemTypeId: contractId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (__DEV__) console.log("[activate-contract] response", {
    status: res.status,
    contractId,
    data: res.data,
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Item Upgrades (nâng cấp skin bằng Radianite)
// ---------------------------------------------------------------------------
// Export hàm lấy danh sách item upgrades (nâng cấp skin) khả dụng
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
// Returns: Promise<ItemUpgradesResponse | null>
export async function getItemUpgrades(
  accessToken: string,
  entitlementsToken: string,
  region: string
): Promise<ItemUpgradesResponse | null> {
  const res = await axios.request<ItemUpgradesResponse>({
    url: getUrl({ name: "item-upgrades", region }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Fetch Content (seasons, acts, events)
// ---------------------------------------------------------------------------
// Export hàm lấy nội dung game (season, act, event hiện tại)
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
// Returns: Promise<ContentResponse | null>
export async function getContent(
  accessToken: string,
  entitlementsToken: string,
  region: string
): Promise<ContentResponse | null> {
  const res = await axios.request<ContentResponse>({
    url: getUrl({ name: "content", region }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Leaderboard (bảng xếp hạng)
// ---------------------------------------------------------------------------
// Export hàm lấy bảng xếp hạng competitive
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - seasonId: UUID season
//   - params: tham số tùy chọn (startIndex, size, query)
// Returns: Promise<LeaderboardResponse | null>
export async function getLeaderboard(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  seasonId: string,
  params?: { startIndex?: number; size?: number; query?: string }
): Promise<LeaderboardResponse | null> {
  const res = await axios.request<LeaderboardResponse>({
    url: getUrl({ name: "leaderboard", region, itemTypeId: seasonId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
    params,
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Config (cấu hình game)
// ---------------------------------------------------------------------------
// Export hàm lấy cấu hình game cho shard hiện tại
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
// Returns: Promise<ConfigResponse | null>
export async function getConfig(
  accessToken: string,
  entitlementsToken: string,
  region: string
): Promise<ConfigResponse | null> {
  const res = await axios.request<ConfigResponse>({
    url: getUrl({ name: "config", region }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Penalties (hình phạt)
// ---------------------------------------------------------------------------
// Export hàm lấy thông tin hình phạt (nếu có) của tài khoản
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
// Returns: Promise<PenaltiesResponse | null>
export async function getPenalties(
  accessToken: string,
  entitlementsToken: string,
  region: string
): Promise<PenaltiesResponse | null> {
  const res = await axios.request<PenaltiesResponse>({
    url: getUrl({ name: "penalties", region }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Player Info (thông tin người chơi từ auth.riotgames.com/userinfo)
// ---------------------------------------------------------------------------
// Export hàm lấy thông tin tài khoản Riot (không cần entitlementsToken)
// Parameters:
//   - accessToken: token xác thực
// Returns: Promise<PlayerInfoResponse | null>
export async function getPlayerInfo(
  accessToken: string
): Promise<PlayerInfoResponse | null> {
  const res = await axios.request<PlayerInfoResponse>({
    url: getUrl({ name: "playerinfo" }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Riot Geo (lấy region affinity)
// ---------------------------------------------------------------------------
// Export hàm lấy thông tin region (khu vực) của người dùng từ Riot Geo
// Parameters:
//   - accessToken: token xác thực
//   - idToken: ID token
// Returns: Promise<RiotGeoResponse | null>
export async function getRiotGeo(
  accessToken: string,
  idToken: string
): Promise<RiotGeoResponse | null> {
  const res = await axios.request<RiotGeoResponse>({
    url: getUrl({ name: "riotgeo" }),
    method: "PUT",
    validateStatus: () => true,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    data: { id_token: idToken },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// PAS Token (token xác thực chat XMPP)
// ---------------------------------------------------------------------------
// Export hàm lấy PAS token dùng cho xác thực XMPP chat
// Parameters:
//   - accessToken: token xác thực Riot
// Returns: Promise<string | null> PAS token
export async function getPASToken(
  accessToken: string
): Promise<string | null> {
  const res = await axios.request<string>({
    url: getUrl({ name: "pastoken" }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Riot Client Config (cấu hình Riot client)
// ---------------------------------------------------------------------------
// Export hàm lấy cấu hình Riot client
// Parameters:
//   - accessToken: token xác thực
//   - entitlementsToken: token quyền
// Returns: Promise<RiotClientConfigResponse | null>
export async function getRiotClientConfig(
  accessToken: string,
  entitlementsToken: string
): Promise<RiotClientConfigResponse | null> {
  const res = await axios.request<RiotClientConfigResponse>({
    url: getUrl({ name: "riotclientconfig" }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Riot-Entitlements-JWT": entitlementsToken,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Pre-Game Loadouts (trang bị trong pregame)
// ---------------------------------------------------------------------------
// Export hàm lấy loadouts của người chơi trong pregame
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - matchId: UUID trận đấu
// Returns: Promise<PregameLoadoutsResponse | null>
export async function getPregameLoadouts(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<PregameLoadoutsResponse | null> {
  const res = await axios.request<PregameLoadoutsResponse>({
    url: getUrl({ name: "pregame-loadouts", region, matchId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Current Game Loadouts (trang bị trong trận đang diễn ra)
// ---------------------------------------------------------------------------
// Export hàm lấy loadouts của người chơi trong trận đang diễn ra
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - matchId: UUID trận đấu
// Returns: Promise<CurrentGameLoadoutsResponse | null>
export async function getCurrentGameLoadouts(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<CurrentGameLoadoutsResponse | null> {
  const res = await axios.request<CurrentGameLoadoutsResponse>({
    url: getUrl({ name: "coregame-loadouts", region, matchId }),
    method: "GET",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Quit Current Game (thoát trận đang diễn ra)
// ---------------------------------------------------------------------------
// Export hàm thoát khỏi trận đấu đang diễn ra
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - matchId: UUID trận đấu
// Returns: Promise<any>
export async function quitCurrentGame(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  matchId: string
): Promise<any> {
  const res = await axios.request({
    url: getUrl({ name: "coregame-quit", region, matchId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Party: Remove Player (xóa người chơi khỏi party)
// ---------------------------------------------------------------------------
// Export hàm xóa người chơi khỏi party
// Parameters:
//   - accessToken, entitlementsToken, region, userId: thông tin xác thực
// Returns: Promise<void>
export async function removeFromParty(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  userId: string
): Promise<void> {
  await axios.request({
    url: getUrl({ name: "party-remove", region, userId }),
    method: "DELETE",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// ---------------------------------------------------------------------------
// Party: Enter Matchmaking Queue (vào hàng chờ)
// ---------------------------------------------------------------------------
// Export hàm tham gia hàng chờ matchmaking
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - partyId: UUID party
// Returns: Promise<PartyResponse | null>
export async function enterMatchmakingQueue(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: getUrl({ name: "party-join-queue", region, matchId: partyId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}

// ---------------------------------------------------------------------------
// Party: Leave Matchmaking Queue (rời hàng chờ)
// ---------------------------------------------------------------------------
// Export hàm rời khỏi hàng chờ matchmaking
// Parameters:
//   - accessToken, entitlementsToken, region: thông tin xác thực
//   - partyId: UUID party
// Returns: Promise<PartyResponse | null>
export async function leaveMatchmakingQueue(
  accessToken: string,
  entitlementsToken: string,
  region: string,
  partyId: string
): Promise<PartyResponse | null> {
  const res = await axios.request<PartyResponse>({
    url: getUrl({ name: "party-leave-queue", region, matchId: partyId }),
    method: "POST",
    validateStatus: () => true,
    headers: {
      ...extraHeaders(),
      "Content-Type": "application/json",
      "X-Riot-Entitlements-JWT": entitlementsToken,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.status === 200 ? res.data : null;
}
