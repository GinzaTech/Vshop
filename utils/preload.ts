// Import Image từ expo-image để prefetch ảnh
import { Image } from "expo-image";

// Import các hàm từ các module khác trong project
import { defaultUser } from "./valorant-api";
import { getAgent, getAssets } from "./valorant-assets";
import { getDisplayIconUri } from "./misc";
import { getNetworkProfile } from "./network";

/**
 * PreloadOptions - Định nghĩa tùy chọn cho việc preload ảnh
 * @property {number} [batchSize] - Số lượng ảnh tải cùng lúc trong một batch
 * @property {"disk" | "memory" | "memory-disk"} [cachePolicy] - Chính sách cache (disk, memory hoặc cả hai)
 * @property {number} [cellularLimit] - Giới hạn số ảnh khi dùng mạng di động
 * @property {number} [limit] - Giới hạn tổng số ảnh
 * @property {boolean} [wifiOnly] - Chỉ tải khi dùng WiFi
 */
type PreloadOptions = {
  batchSize?: number;
  cachePolicy?: "disk" | "memory" | "memory-disk";
  cellularLimit?: number;
  limit?: number;
  wifiOnly?: boolean;
};

// Kích thước batch mặc định: 8 ảnh cùng lúc
const DEFAULT_BATCH_SIZE = 8;
// Cờ đánh dấu đã khởi động warmup catalog nền hay chưa
let catalogWarmupStarted = false;
// Set lưu các URL đã được prefetch thành công (tránh prefetch lại)
// Giới hạn tối đa để tránh memory leak trong long session
const PREFETCHED_URLS_MAX_SIZE = 1000;
const prefetchedUrls = new Set<string>();
// Set lưu các URL đang trong quá trình prefetch (tránh prefetch trùng lặp đồng thời)
const prefetchingUrls = new Set<string>();

/** Đảm bảo prefetchedUrls không vượt quá kích thước tối đa */
function prunePrefetchedUrls() {
  if (prefetchedUrls.size > PREFETCHED_URLS_MAX_SIZE) {
    const toRemove = prefetchedUrls.size - PREFETCHED_URLS_MAX_SIZE;
    let removed = 0;
    for (const url of prefetchedUrls) {
      prefetchedUrls.delete(url);
      removed++;
      if (removed >= toRemove) break;
    }
  }
}

/**
 * chunk - Chia mảng thành các mảng con có kích thước xác định
 * @param {T[]} items - Mảng cần chia
 * @param {number} size - Kích thước mỗi mảng con
 * @returns {T[][]} Mảng các mảng con
 */
const chunk = <T>(items: T[], size: number) => {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
};

/**
 * uniqueUrls - Lọc các URL hợp lệ (bắt đầu bằng http), loại bỏ trùng lặp và null/undefined
 * @param {(string | null | undefined)[]} urls - Mảng các URL cần lọc
 * @returns {string[]} Mảng các URL hợp lệ và duy nhất
 */
const uniqueUrls = (urls: (string | null | undefined)[]) =>
  [...new Set(urls.filter((url): url is string => Boolean(url && url.startsWith("http"))))];

// Số lượng URL tối đa khi warmup catalog
const MAX_CATALOG_WARMUP_URLS = 180;

/**
 * getSkinImageUrl - Lấy URL hình ảnh của skin từ vật phẩm
 * @param {SkinShopItem | NightMarketItem | GalleryItem | AccessoryShopItem} item - Vật phẩm cần lấy URL ảnh
 * @returns {string | undefined} URL ảnh hoặc undefined nếu không có
 */
const getSkinImageUrl = (item: SkinShopItem | NightMarketItem | GalleryItem | AccessoryShopItem) =>
  getDisplayIconUri(item) ||
  ("chromas" in item ? item.chromas?.[0]?.displayIcon ?? item.chromas?.[0]?.fullRender : undefined) ||
  item.displayIcon;

/**
 * preloadImageUrls - Prefetch danh sách URL ảnh xuống cache
 * Chia thành các batch nhỏ và kiểm tra kết nối mạng giữa các batch
 * @param {(string | null | undefined)[]} urls - Danh sách URL cần prefetch
 * @param {PreloadOptions} [options] - Tùy chọn preload
 * @returns {Promise<void>} Promise void
 */
export async function preloadImageUrls(
  urls: (string | null | undefined)[],
  options?: PreloadOptions
) {
  // Kiểm tra kết nối mạng trước khi bắt đầu
  const network = await getNetworkProfile();
  if (!network.isConnected || (options?.wifiOnly && network.isCellular)) {
    return;
  }

  // Xác định giới hạn dựa trên tùy chọn và loại mạng
  const requestedLimit = options?.limit ?? Number.MAX_SAFE_INTEGER;
  const networkLimit = network.isCellular
    ? options?.cellularLimit ?? requestedLimit
    : requestedLimit;
  // Lọc URL hợp lệ, loại bỏ URL đã prefetch hoặc đang prefetch
  const normalizedUrls = uniqueUrls(urls)
    .filter((url) => !prefetchedUrls.has(url) && !prefetchingUrls.has(url))
    .slice(0, Math.min(requestedLimit, networkLimit));
  if (normalizedUrls.length === 0) {
    return;
  }

  // Kích thước batch dựa trên tùy chọn và cấu hình mạng
  const batchSize = Math.min(
    options?.batchSize ?? DEFAULT_BATCH_SIZE,
    network.imagePrefetchBatchSize
  );
  const cachePolicy = options?.cachePolicy ?? "memory-disk";

  // Duyệt từng batch và prefetch
  for (const batch of chunk(normalizedUrls, batchSize)) {
    // Kiểm tra lại kết nối mạng trước mỗi batch
    const currentNetwork = await getNetworkProfile();
    if (
      !currentNetwork.isConnected ||
      (options?.wifiOnly && currentNetwork.isCellular)
    ) {
      break;
    }

    // Đánh dấu URL đang được prefetch
    batch.forEach((url) => prefetchingUrls.add(url));
    try {
      const loaded = await Image.prefetch(batch, { cachePolicy });
      if (loaded) {
        // Nếu prefetch thành công, đánh dấu là đã prefetch
        batch.forEach((url) => prefetchedUrls.add(url));
        prunePrefetchedUrls();
      }
    } catch (error) {
      if (__DEV__) {
        console.warn("[preload] Failed to prefetch image batch", error);
      }
    } finally {
      // Xóa đánh dấu đang prefetch
      batch.forEach((url) => prefetchingUrls.delete(url));
    }
  }
}

/**
 * collectSessionImageUrls - Thu thập tất cả URL ảnh từ shops của user (main, nightMarket, bundles)
 * @param {typeof defaultUser} user - Đối tượng user chứa thông tin shops
 * @returns {string[]} Mảng các URL ảnh duy nhất
 */
export function collectSessionImageUrls(user: typeof defaultUser) {
  const sessionUrls: (string | null | undefined)[] = [];

  // Thu thập URL từ cửa hàng chính
  user.shops.main.forEach((item) => {
    sessionUrls.push(getSkinImageUrl(item));
  });

  // Thu thập URL từ chợ đêm (Night Market)
  user.shops.nightMarket.forEach((item) => {
    sessionUrls.push(getSkinImageUrl(item));
  });

  // Thu thập URL từ các bundle
  user.shops.bundles.forEach((bundle) => {
    sessionUrls.push(
      bundle.displayIcon2 || bundle.displayIcon || bundle.verticalPromoImage
    );
    bundle.items.forEach((item) => {
      sessionUrls.push(getSkinImageUrl(item));
    });
  });

  return uniqueUrls(sessionUrls);
}

/**
 * collectCatalogImageUrls - Thu thập tất cả URL ảnh từ catalog (bản đồ, đặc vụ, skin, buddy, spray, flex, card)
 * @returns {string[]} Mảng các URL ảnh duy nhất, tối đa MAX_CATALOG_WARMUP_URLS URL
 */
export function collectCatalogImageUrls() {
  const assets = getAssets();
  const agents = getAgent().agents;

  const urls: (string | null | undefined)[] = [];

  // Thu thập URL ảnh bản đồ
  assets.maps.forEach((map) => {
    urls.push(map.listViewIcon || map.displayIcon);
  });

  // Thu thập URL ảnh đặc vụ (Agent)
  agents.forEach((agent) => {
    urls.push(agent.displayIconSmall || agent.displayIcon);
  });

  // Thu thập URL ảnh skin
  assets.skins.forEach((skin) => {
    urls.push(
      skin.levels?.[0]?.displayIcon ||
        skin.displayIcon ||
        skin.chromas?.[0]?.displayIcon
    );
  });

  // Thu thập URL ảnh buddy
  assets.buddies.forEach((buddy) => {
    urls.push(buddy.levels?.[0]?.displayIcon || buddy.displayIcon);
  });

  // Thu thập URL ảnh spray
  assets.sprays.forEach((spray) => {
    urls.push(spray.displayIcon || spray.fullTransparentIcon);
  });

  // Thu thập URL ảnh flex
  assets.flex.forEach((flex) => {
    urls.push(flex.displayIcon);
  });

  // Thu thập URL ảnh card
  assets.cards.forEach((card) => {
    urls.push(card.displayIcon || card.wideArt || card.largeArt);
  });

  return uniqueUrls(urls).slice(0, MAX_CATALOG_WARMUP_URLS);
}

/**
 * preloadSessionResources - Prefetch ảnh cho session hiện tại của user (shops)
 * @param {typeof defaultUser} user - Đối tượng user chứa thông tin shops
 * @param {{ cellular?: boolean }} [options] - Tùy chọn: cellular - có đang dùng mạng di động không
 * @returns {Promise<void>} Promise void
 */
export async function preloadSessionResources(
  user: typeof defaultUser,
  options?: { cellular?: boolean }
) {
  await preloadImageUrls(collectSessionImageUrls(user), {
    batchSize: options?.cellular ? 3 : 6,    // Batch nhỏ hơn nếu dùng mạng di động
    cachePolicy: "memory-disk",
    cellularLimit: 8,                         // Giới hạn 8 ảnh khi dùng mạng di động
    limit: options?.cellular ? 8 : undefined, // Giới hạn tổng số
  });
}

/**
 * startBackgroundCatalogWarmup - Khởi động warmup catalog trong nền
 * Prefetch ảnh từ catalog (bản đồ, đặc vụ, vũ khí...) sau 4.5 giây
 * Chỉ chạy một lần duy nhất (dùng cờ catalogWarmupStarted)
 * Chỉ tải khi dùng WiFi để tiết kiệm dữ liệu di động
 */
export function startBackgroundCatalogWarmup() {
  // Nếu đã chạy rồi thì bỏ qua
  if (catalogWarmupStarted) {
    return;
  }

  catalogWarmupStarted = true;

  // Prefetch sau 4.5 giây để không ảnh hưởng đến trải nghiệm người dùng lúc đầu
  setTimeout(() => {
    void preloadImageUrls(collectCatalogImageUrls(), {
      batchSize: 8,
      cachePolicy: "disk",   // Lưu vào disk cache để dùng lâu dài
      wifiOnly: true,        // Chỉ tải khi dùng WiFi
    });
  }, 4500);
}
