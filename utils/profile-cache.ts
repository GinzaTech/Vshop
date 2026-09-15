// Import UUID các loại vật phẩm từ misc
import { VItemTypes } from "./misc";
// Import hàm tạo session key chuẩn hóa (lowercase region + id) dùng chung toàn app
import { getAccountSessionKey } from "./saved-accounts";
// Import các hàm và kiểu từ module valorant-api
import {
  CompetitiveMMRResponse,
  defaultUser,
  extractOwnedItemIds,
  getCompetitiveMMR,
  ownedItems,
  playerLoadout,
  PlayerLoadoutResponse,
  type RiotPlayerRequestOptions,
} from "./valorant-api";
import { buildCompetitiveRankSummary, type CompetitiveRankSummary } from "./profile-rank";
import { createRequestScope } from "~/services/riot/request-scope";
import { isSessionChangedError } from "./session-operations";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";

export { buildCompetitiveRankSummary } from "./profile-rank";
export type { CompetitiveRankSummary } from "./profile-rank";

/**
 * ProfileWarmCache - Kiểu dữ liệu cache profile đã được làm nóng (warm)
 * @property {string} authKey - Khóa xác thực định danh cache
 * @property {PlayerLoadoutResponse | null} loadoutSnapshot - Ảnh chụp loadout hiện tại
 * @property {number} [loadoutCacheVersion] - Phiên bản cache loadout
 * @property {string[]} ownedSkinItemIds - Danh sách UUID skin đã sở hữu
 * @property {string[]} ownedSprayItemIds - Danh sách UUID spray đã sở hữu
 * @property {string[]} ownedFlexItemIds - Danh sách UUID flex đã sở hữu
 * @property {string[]} ownedPlayerCardItemIds - Danh sách UUID player card đã sở hữu
 * @property {string[]} ownedPlayerTitleItemIds - Danh sách UUID player title đã sở hữu
 * @property {CompetitiveRankSummary | null} competitiveRank - Thông tin thứ hạng
 * @property {number} [rankCacheVersion] - Phiên bản cache thứ hạng
 * @property {number} updatedAt - Thời gian cập nhật cache (timestamp ms)
 */
export type ProfileWarmCache = {
  authKey: string;
  loadoutSnapshot: PlayerLoadoutResponse | null;
  loadoutCacheVersion?: number;
  ownedSkinItemIds: string[];
  ownedSprayItemIds: string[];
  ownedFlexItemIds: string[];
  ownedPlayerCardItemIds: string[];
  ownedPlayerTitleItemIds: string[];
  competitiveRank: CompetitiveRankSummary | null;
  rankCacheVersion?: number;
  /** Last successful fetch per component; failed refreshes retain old times. */
  componentUpdatedAt?: {
    loadout: number;
    rank: number;
    ownership: number[];
  };
  updatedAt: number;
};

// Thời gian sống (TTL) của profile warm cache: 5 phút (tính bằng ms)
export const PROFILE_WARM_CACHE_TTL = 5 * 60 * 1000;
// Phiên bản cache loadout hiện tại
export const PROFILE_LOADOUT_CACHE_VERSION = 5;
// Phiên bản cache thứ hạng hiện tại
export const PROFILE_RANK_CACHE_VERSION = 11;

// Map lưu các Promise đang thực hiện fetch profile warm cache theo authKey
// Giúp tránh gọi API đồng thời cho cùng một user
const profileWarmupInFlight = new Map<string, Promise<ProfileWarmCache | null>>();
const profileWarmupCache = new Map<string, ProfileWarmCache>();
const profileRequestScope = createRequestScope();

// Trần số account giữ trong warm cache in-memory (fix L12). Trước đây map
// không bao giờ được dọn: mỗi account từng đăng nhập trong session chiếm 1
// slot vĩnh viễn (chứa cả loadout snapshot) và có thể diverge với persisted
// store (giữ 3 entry). 6 slot là đủ cho đa số phiên dùng.
const MAX_WARM_CACHE_ACCOUNTS = 6;

/**
 * Giới hạn số entry của profileWarmupCache theo updatedAt (mới nhất giữ lại).
 */
function evictWarmCacheIfOverflow() {
  if (profileWarmupCache.size <= MAX_WARM_CACHE_ACCOUNTS) return;
  const entries = [...profileWarmupCache.entries()].sort(
    ([, left], [, right]) => right.updatedAt - left.updatedAt
  );
  for (const [key] of entries.slice(MAX_WARM_CACHE_ACCOUNTS)) {
    profileWarmupCache.delete(key);
  }
}

/**
 * clearProfileWarmupCache - Xoá warm cache in-memory.
 * @param authKey - Xoá đúng 1 account; bỏ qua tham số để xoá toàn bộ.
 * Dùng khi sign-out / switch account để dữ liệu account cũ không chiếm chỗ
 * và không bị nhầm sang session kế tiếp.
 */
export function clearProfileWarmupCache(authKey?: string) {
  profileRequestScope.clear(authKey || undefined);
  if (authKey) {
    profileWarmupCache.delete(authKey);
  } else {
    profileWarmupCache.clear();
    profileWarmupInFlight.clear();
  }
  // Request keys are opaque identities; scope invalidation prevents joining
  // or publishing older promises, even when credentials are identical.
}


/**
 * getSessionAuthKey - Tạo khóa định danh duy nhất cho session của user
 * Delegate về getAccountSessionKey để TOÀN BỘ app dùng chung một quy ước
 * normalize (lowercase region + id). Trước đây hàm này tự nối chuỗi thô —
 * nếu region/id chứa chữ hoa thì cache lookup sẽ âm thầm miss giữa các layer.
 * @param {typeof defaultUser} user - Đối tượng user
 * @returns {string} Khóa authKey dạng "region|id", hoặc "guest" nếu không có region/id
 */
export const getSessionAuthKey = (user: typeof defaultUser) =>
  getAccountSessionKey(user);

/**
 * isProfileCacheFresh - Kiểm tra cache profile còn hạn sử dụng hay không
 * @param {Pick<ProfileWarmCache, "updatedAt"> | null | undefined} cache - Cache cần kiểm tra
 * @param {number} [ttl=PROFILE_WARM_CACHE_TTL] - Thời gian sống (ms)
 * @returns {boolean} true nếu cache còn hạn, false nếu hết hạn
 */
export const isProfileCacheFresh = (
  cache?: Pick<ProfileWarmCache, "updatedAt"> | null,
  ttl = PROFILE_WARM_CACHE_TTL
) => Boolean(cache?.updatedAt && Date.now() - cache.updatedAt < ttl);

/**
 * hasValidCompetitiveRankCache - Kiểm tra bản ghi thứ hạng trong cache còn
 * ĐÚNG PHIÊN BẢN SCHEMA không.
 *
 * Semantics QUAN TRỌNG (fix H1): "valid" nghĩa là chúng ta ĐÃ từng fetch rank
 * cho session này và dữ liệu được lưu đúng version — kể cả khi kết quả là
 * `competitiveRank: null` (tài khoản chưa xếp hạng). Trước đây hàm đòi hỏi
 * phải có tier data, khiến account không rank bị coi là "chưa có cache" và
 * Profile re-fetch toàn bộ loadout + ownership + MMR ở MỖI lần khởi động.
 * Với semantics mới: null rank là một kết quả được cache hợp lệ.
 *
 * Caller cần dữ liệu rank để HIỂN THỊ nên đọc `cache.competitiveRank` trực
 * tiếp (null/undefined khi không có hạng) — không dựa vào hàm này.
 *
 * @param cache - Cache thứ hạng cần kiểm tra
 * @returns true nếu cache đúng version schema (đã có bản ghi rank)
 */
export const hasValidCompetitiveRankCache = (
  cache?: Pick<ProfileWarmCache, "competitiveRank" | "rankCacheVersion"> | null
) => Boolean(cache?.rankCacheVersion === PROFILE_RANK_CACHE_VERSION);

/**
 * hasValidProfileLoadoutCache - Kiểm tra cache loadout còn hợp lệ không
 * @param {Pick<ProfileWarmCache, "loadoutSnapshot" | "loadoutCacheVersion"> | null | undefined} cache - Cache loadout cần kiểm tra
 * @returns {boolean} true nếu cache hợp lệ (có snapshot và đúng version)
 */
export const hasValidProfileLoadoutCache = (
  cache?: Pick<
    ProfileWarmCache,
    "loadoutSnapshot" | "loadoutCacheVersion"
  > | null
) =>
  Boolean(
    cache?.loadoutSnapshot &&
      cache.loadoutCacheVersion === PROFILE_LOADOUT_CACHE_VERSION
  );


/**
 * fetchCompetitiveRankSummary - Fetch thông tin thứ hạng competitive từ API
 * @param {typeof defaultUser} user - Đối tượng user
 * @returns {Promise<CompetitiveRankSummary | null>} Promise trả về thông tin thứ hạng hoặc null
 */
export async function fetchCompetitiveRankSummary(
  user: typeof defaultUser,
  options: RiotPlayerRequestOptions = {}
) {
  const outcome = await fetchCompetitiveRankOutcome(user, options);
  return outcome.status === "success" ? outcome.value : null;
}

/** A null summary is a successful unranked player; {} is MMR request failure. */
export async function fetchCompetitiveRankOutcome(
  user: typeof defaultUser,
  options: RiotPlayerRequestOptions = {}
): Promise<
  | { status: "success"; value: CompetitiveRankSummary | null }
  | { status: "failure" }
> {
  const mmrResult = await getCompetitiveMMR(
    user.accessToken,
    user.entitlementsToken,
    user.region,
    user.id,
    options
  ).catch((error: unknown) => {
    if (isSessionChangedError(error)) throw error;
    return null;
  });

  if (!mmrResult || Object.keys(mmrResult).length === 0) return { status: "failure" };

  // Xây dựng tóm tắt thứ hạng từ kết quả MMR
  const mmrSummary = buildCompetitiveRankSummary(
    (mmrResult as CompetitiveMMRResponse | null) ?? null
  );

  return {
    status: "success",
    value: mmrSummary?.currentTier || mmrSummary?.peakTier ? mmrSummary : null,
  };
}

/**
 * fetchProfileWarmCacheInternal - Fetch tất cả dữ liệu cần để làm nóng cache profile (nội bộ)
 * Bao gồm: loadout, danh sách vật phẩm đã sở hữu, thứ hạng competitive
 *
 * @param user - Đối tượng user
 * @param options - force: bỏ qua TTL cache nội bộ của từng API con
 * @returns Promise<ProfileWarmCache | null> - Cache hoặc null nếu thiếu thông tin xác thực
 */
async function fetchProfileWarmCacheInternal(
  user: typeof defaultUser,
  options: RiotPlayerRequestOptions = {}
) {
  // Kiểm tra thông tin xác thực
  if (!user.accessToken || !user.entitlementsToken || !user.region || !user.id) {
    return null;
  }

  const authKey = getSessionAuthKey(user);

  // Gọi song song: loadout, ownership (6 loại vật phẩm), và thứ hạng
  const [loadoutSnapshot, ownershipResults, rankOutcome] = await Promise.all([
    playerLoadout(
      user.accessToken,
      user.entitlementsToken,
      user.region,
      user.id,
      options
    ).catch((error: unknown) => {
      if (isSessionChangedError(error)) throw error;
      return null;
    }),
    // Dùng allSettled để không bị fail nếu một API bị lỗi
    Promise.allSettled([
      ownedItems(user.accessToken, user.entitlementsToken, user.region, user.id, VItemTypes.SkinLevel),
      ownedItems(user.accessToken, user.entitlementsToken, user.region, user.id, VItemTypes.SkinChroma),
      ownedItems(user.accessToken, user.entitlementsToken, user.region, user.id, VItemTypes.Spray),
      ownedItems(user.accessToken, user.entitlementsToken, user.region, user.id, VItemTypes.Flex),
      ownedItems(user.accessToken, user.entitlementsToken, user.region, user.id, VItemTypes.PlayerCard),
      ownedItems(user.accessToken, user.entitlementsToken, user.region, user.id, VItemTypes.PlayerTitle),
    ]),
    fetchCompetitiveRankOutcome(user, options),
  ]);

  for (const result of ownershipResults) {
    if (result.status === "rejected" && isSessionChangedError(result.reason)) throw result.reason;
  }

  // FIX (M3): seed danh sách sở hữu từ CACHE TRƯỚC ĐÓ thay vì seed rỗng.
  // Trước đây nếu 1/6 call ownership lỗi transient, danh sách tương ứng bị
  // ghi thành rỗng rồi persist → 5 phút sau UI tưởng user không sở hữu item.
  // Union với cache cũ: kết quả fetch thành công sẽ bổ sung ID mới; kết quả
  // lỗi thì giữ nguyên ID cũ (Valorant không thu hồi item nên union là an toàn,
  // cách làm này cũng trùng khớp với ownedSkinIds vốn đã seed từ user store).
  // After process restart the persisted store may be hydrated while this map
  // is empty. A partial first refresh must retain that account's good data.
  const previousCache = profileWarmupCache.get(authKey) ??
    useProfileCacheStore.getState().cacheByAuth[authKey];
  const ownedSkinIds = new Set<string>([
    ...(user.ownedSkinIds ?? []),
    ...(previousCache?.ownedSkinItemIds ?? []),
  ]);
  const ownedSprayIds = new Set<string>(previousCache?.ownedSprayItemIds ?? []);
  const ownedFlexIds = new Set<string>(previousCache?.ownedFlexItemIds ?? []);
  const ownedPlayerCardIds = new Set<string>(
    previousCache?.ownedPlayerCardItemIds ?? []
  );
  const ownedPlayerTitleIds = new Set<string>(
    previousCache?.ownedPlayerTitleItemIds ?? []
  );

  ownershipResults.forEach((result, index) => {
    if (result.status !== "fulfilled") {
      return; // Bỏ qua nếu API bị lỗi — cache cũ đã seed sẵn ở trên
    }

    extractOwnedItemIds(result.value).forEach((itemId) => {
      // index 0: SkinLevel, 1: SkinChroma -> ownedSkinIds
      // index 2: Spray, 3: Flex, 4: PlayerCard, 5: PlayerTitle
      if (index === 2) {
        ownedSprayIds.add(itemId);
      } else if (index === 3) {
        ownedFlexIds.add(itemId);
      } else if (index === 4) {
        ownedPlayerCardIds.add(itemId);
      } else if (index === 5) {
        ownedPlayerTitleIds.add(itemId);
      } else {
        ownedSkinIds.add(itemId);
      }
    });
  });

  const now = Date.now();
  const previousTimes = previousCache?.componentUpdatedAt;
  const componentUpdatedAt = {
    loadout: loadoutSnapshot ? now : previousTimes?.loadout ?? 0,
    rank: rankOutcome.status === "success" ? now : previousTimes?.rank ?? 0,
    ownership: ownershipResults.map((result, index) =>
      result.status === "fulfilled" ? now : previousTimes?.ownership[index] ?? 0
    ),
  };
  // A partially failed wave is never newer than its oldest component.
  const updatedAt = Math.min(componentUpdatedAt.loadout, componentUpdatedAt.rank, ...componentUpdatedAt.ownership);
  const cache: ProfileWarmCache = {
    authKey,
    loadoutSnapshot: loadoutSnapshot ?? previousCache?.loadoutSnapshot ?? null,
    loadoutCacheVersion: loadoutSnapshot ? PROFILE_LOADOUT_CACHE_VERSION : previousCache?.loadoutCacheVersion,
    ownedSkinItemIds: Array.from(ownedSkinIds),
    ownedSprayItemIds: Array.from(ownedSprayIds),
    ownedFlexItemIds: Array.from(ownedFlexIds),
    ownedPlayerCardItemIds: Array.from(ownedPlayerCardIds),
    ownedPlayerTitleItemIds: Array.from(ownedPlayerTitleIds),
    competitiveRank: rankOutcome.status === "success" ? rankOutcome.value : previousCache?.competitiveRank ?? null,
    rankCacheVersion: rankOutcome.status === "success" ? PROFILE_RANK_CACHE_VERSION : previousCache?.rankCacheVersion,
    componentUpdatedAt,
    updatedAt,
  };

  return cache;
}

/**
 * fetchProfileWarmCache - Fetch profile warm cache với cơ chế chống gọi trùng lặp
 *
 * @param user - Đối tượng user
 * @param options - force: bỏ qua TTL 5 phút của warm cache và TTL của các
 *   API con (loadout/MMR). Trước đây options bị bỏ qua — caller "ép làm mới"
 *   nhận về dữ liệu cũ tới 5 phút mà không hay biết (fix L1).
 * @returns Promise<ProfileWarmCache | null> - Cache hoặc null
 */
export async function fetchProfileWarmCache(
  user: typeof defaultUser,
  options: RiotPlayerRequestOptions = {}
) {
  const authKey = getSessionAuthKey(user);
  // Nếu là guest (chưa đăng nhập), trả về null
  if (authKey === "guest" || !user.accessToken || !user.entitlementsToken) {
    return null;
  }

  const scope = profileRequestScope.observe(authKey, user.accessToken, user.entitlementsToken);

  const cached = profileWarmupCache.get(authKey);
  if (!options.force && isProfileCacheFresh(cached)) {
    return cached;
  }

  // In-flight key PHẢI phân biệt force/cached: một caller force không được
  // join promise của request non-force (nếu join thì "force" nhận về dữ liệu
  // cũ đang chạy). Hai request song song là chấp nhận được (tình huống hiếm).
  const inFlightKey = scope.key(options.force ? "force" : "cached");
  const existingPromise = profileWarmupInFlight.get(inFlightKey);
  if (existingPromise) {
    return existingPromise;
  }

  // Tạo request mới và lưu vào Map
  const assertCurrent = scope.start();
  const request = fetchProfileWarmCacheInternal(user, options)
    .then((cache) => {
      assertCurrent();
      if (cache) {
        profileWarmupCache.set(authKey, cache);
        // FIX (L12): giữ map trong giới hạn, ưu tiên entry mới nhất
        evictWarmCacheIfOverflow();
      }
      return cache;
    })
    .catch((error: unknown) => {
      assertCurrent();
      throw error;
    })
    .finally(() => {
      if (profileWarmupInFlight.get(inFlightKey) === request) profileWarmupInFlight.delete(inFlightKey);
    });

  profileWarmupInFlight.set(inFlightKey, request);
  return request;
}
