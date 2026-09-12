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
// Import hàm lấy assets từ valorant-assets
import { getAssets } from "./valorant-assets";

/**
 * CompetitiveRankSummary - Kiểu dữ liệu tóm tắt thứ hạng cạnh tranh
 * @property {number | null} currentTier - Thứ hạng hiện tại
 * @property {string} currentName - Tên thứ hạng hiện tại
 * @property {string | null} currentIcon - URL icon thứ hạng hiện tại
 * @property {number | null} peakTier - Thứ hạng cao nhất đã đạt được
 * @property {string} peakName - Tên thứ hạng cao nhất
 * @property {string | null} peakIcon - URL icon thứ hạng cao nhất
 */
export type CompetitiveRankSummary = {
  currentTier: number | null;
  currentName: string;
  currentIcon: string | null;
  peakTier: number | null;
  peakName: string;
  peakIcon: string | null;
  actSeasonId: string | null;
  actWins: number | null;
  actLosses: number | null;
  actGames: number | null;
};

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
  if (authKey) {
    profileWarmupCache.delete(authKey);
  } else {
    profileWarmupCache.clear();
  }
}

/**
 * FALLBACK_COMPETITIVE_TIER_NAMES - Bảng tên thứ hạng dự phòng khi không lấy được từ API
 * Key là số thứ hạng (tier), value là tên hiển thị
 * @type {Record<number, string>}
 */
const FALLBACK_COMPETITIVE_TIER_NAMES: Record<number, string> = {
  0: "Unrated",
  3: "Iron 1",
  4: "Iron 2",
  5: "Iron 3",
  6: "Bronze 1",
  7: "Bronze 2",
  8: "Bronze 3",
  9: "Silver 1",
  10: "Silver 2",
  11: "Silver 3",
  12: "Gold 1",
  13: "Gold 2",
  14: "Gold 3",
  15: "Platinum 1",
  16: "Platinum 2",
  17: "Platinum 3",
  18: "Diamond 1",
  19: "Diamond 2",
  20: "Diamond 3",
  21: "Ascendant 1",
  22: "Ascendant 2",
  23: "Ascendant 3",
  24: "Immortal 1",
  25: "Immortal 2",
  26: "Immortal 3",
  27: "Radiant",
};

type CompetitiveSeasonInfo = {
  Rank?: unknown;
  CompetitiveTier?: unknown;
  SeasonHighestCompetitiveTier?: unknown;
  NumberOfWins?: unknown;
  NumberOfWinsWithPlacements?: unknown;
  NumberOfGames?: unknown;
  NumberOfLosses?: unknown;
  NumberOfDraws?: unknown;
  WinsByTier?: Record<string, number> | null;
};

type CompetitiveQueueSkill = {
  CompetitiveTier?: unknown;
  HighestCompetitiveTier?: unknown;
  SeasonalInfoBySeasonID?: Record<string, CompetitiveSeasonInfo>;
};

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
 * formatCompetitiveTierName - Format tên thứ hạng theo dạng Title Case
 * @param {string | null | undefined} value - Tên thứ hạng gốc
 * @param {{ stripDivision?: boolean }} [options] - Tùy chọn: stripDivision - có loại bỏ số phân hạng (1, 2, 3) không
 * @returns {string} Tên thứ hạng đã format
 */
const formatCompetitiveTierName = (
  value?: string | null,
  options?: { stripDivision?: boolean }
) => {
  if (!value) {
    return "Unrated";
  }

  // Chuẩn hóa: lowercase "vi-VN", thay _ bằng space, viết hoa chữ cái đầu mỗi từ
  const normalized = value
    .toLocaleLowerCase("vi-VN")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)(\p{L})/gu, (match, prefix: string, char: string) =>
      `${prefix}${char.toLocaleUpperCase("vi-VN")}`
    );

  // Nếu stripDivision, loại bỏ số 1, 2, 3 ở cuối tên
  if (options?.stripDivision) {
    return normalized.replace(/\s+[123]$/, "");
  }

  return normalized;
};

/**
 * toTitleCase - Chuyển chuỗi thành dạng Title Case
 * @param {string | null | undefined} value - Chuỗi cần chuyển
 * @returns {string} Chuỗi đã chuyển sang Title Case
 */
const toTitleCase = (value?: string | null) =>
  (value || "")
    .trim()
    .toLocaleLowerCase("vi-VN")
    .replace(/\s+/g, " ")
    .replace(/(^|\s)(\p{L})/gu, (match, prefix: string, char: string) =>
      `${prefix}${char.toLocaleUpperCase("vi-VN")}`
    );

/**
 * resolveTierName - Lấy tên thứ hạng từ dữ liệu API hoặc fallback
 * @param {number | null} tier - Số thứ hạng
 * @param {{ name: string; icon: string | null } | null | undefined} tierInfo - Thông tin thứ hạng từ assets
 * @returns {string} Tên thứ hạng
 */
const resolveTierName = (
  tier: number | null,
  tierInfo?: { name: string; icon: string | null } | null
) => {
  if (tierInfo?.name) {
    return tierInfo.name;
  }

  if (tier !== null) {
    return FALLBACK_COMPETITIVE_TIER_NAMES[tier] || `Tier ${tier}`;
  }

  return FALLBACK_COMPETITIVE_TIER_NAMES[0];
};

/**
 * getCompetitiveQueueSkill - Lấy thông tin kỹ năng competitive từ kết quả MMR
 * Xử lấy dữ liệu từ nhiều cấu trúc queue khác nhau
 * @param {CompetitiveMMRResponse} mmrResult - Kết quả MMR từ API
 * @returns Dữ liệu competitive queue, hoặc null nếu không có
 */
const getCompetitiveQueueSkill = (
  mmrResult: CompetitiveMMRResponse,
): CompetitiveQueueSkill | null => {
  const queueSkills = mmrResult?.QueueSkills;
  if (!queueSkills || typeof queueSkills !== "object") {
    return null;
  }

  // Thử lấy trực tiếp key "competitive"
  const directCompetitive = queueSkills.competitive;
  if (directCompetitive) {
    return directCompetitive;
  }

  // Tìm queue có tên chứa "competitive"
  const competitiveEntry = Object.entries(queueSkills).find(
    ([queueName, queueData]) =>
      queueName.toLocaleLowerCase("en-US").includes("competitive") &&
      queueData &&
      typeof queueData === "object"
  );

  if (competitiveEntry?.[1]) {
    return competitiveEntry[1];
  }

  // Fallback: tìm queue có SeasonalInfoBySeasonID
  return (
    Object.values(queueSkills).find(
      (queueData) =>
        queueData &&
        typeof queueData === "object" &&
        queueData.SeasonalInfoBySeasonID &&
        typeof queueData.SeasonalInfoBySeasonID === "object"
    ) ?? null
  );
};

/**
 * toRankTier - Chuyển đổi giá trị sang số thứ hạng
 * @param {unknown} value - Giá trị cần chuyển
 * @returns {number | null} Số thứ hạng nếu hợp lệ và > 0, null nếu không
 */
const toRankTier = (value: unknown) => {
  const tier = Number(value ?? 0);
  return Number.isFinite(tier) && tier > 0 ? tier : null;
};

/**
 * getTierLookup - Xây dựng Map tra cứu thông tin thứ hạng từ assets
 * @returns {Map<number, { name: string; icon: string | null }>} Map với key là số thứ hạng, value là tên và icon
 */
const getTierLookup = () => {
  const tierLookup = new Map<number, { name: string; icon: string | null }>();
  const competitiveTierSeasons = Array.isArray(getAssets().competitiveTiers)
    ? getAssets().competitiveTiers
    : [];

  // Duyệt qua từng season competitive tier và xây dựng lookup
  competitiveTierSeasons.forEach((season) => {
    const tiers = Array.isArray(season?.tiers) ? season.tiers : [];
    tiers.forEach((tier) => {
      const numberTier = Number(tier?.tier);
      if (!Number.isFinite(numberTier) || numberTier <= 0 || tierLookup.has(numberTier)) {
        return;
      }

      tierLookup.set(numberTier, {
        name: toTitleCase(tier?.tierName) || `Tier ${numberTier}`,
        icon:
          tier?.smallIcon ||
          tier?.largeIcon ||
          tier?.rankTriangleDownIcon ||
          null,
      });
    });
  });

  return tierLookup;
};

/**
 * buildCompetitiveRankSummaryFromTiers - Xây dựng đối tượng CompetitiveRankSummary từ số thứ hạng
 * @param {number | null} currentTier - Thứ hạng hiện tại
 * @param {number | null} peakTier - Thứ hạng cao nhất
 * @returns {CompetitiveRankSummary} Đối tượng tóm tắt thứ hạng
 */
const buildCompetitiveRankSummaryFromTiers = (
  currentTier: number | null,
  peakTier: number | null
): CompetitiveRankSummary => {
  const tierLookup = getTierLookup();
  const currentTierInfo = currentTier ? tierLookup.get(currentTier) : null;
  const peakTierInfo = peakTier ? tierLookup.get(peakTier) : null;

  return {
    currentTier,
    currentName: formatCompetitiveTierName(
      resolveTierName(currentTier, currentTierInfo)
    ),
    currentIcon: currentTierInfo?.icon || null,
    peakTier,
    peakName: formatCompetitiveTierName(resolveTierName(peakTier, peakTierInfo)),
    peakIcon: peakTierInfo?.icon || null,
    actSeasonId: null,
    actWins: null,
    actLosses: null,
    actGames: null,
  };
};

/**
 * buildCompetitiveRankSummary - Xây dựng thông tin thứ hạng từ dữ liệu MMR
 * @param {CompetitiveMMRResponse | null | undefined} mmrResult - Kết quả MMR từ API
 * @returns {CompetitiveRankSummary | null} Đối tượng tóm tắt thứ hạng, hoặc null nếu không có dữ liệu
 */
export function buildCompetitiveRankSummary(
  mmrResult?: CompetitiveMMRResponse | null
): CompetitiveRankSummary | null {
  if (!mmrResult) {
    return null;
  }

  // Lấy dữ liệu competitive queue và thông tin cập nhật gần nhất
  const competitiveData = getCompetitiveQueueSkill(mmrResult);
  const latestCompetitiveUpdate = mmrResult.LatestCompetitiveUpdate;
  const seasonalInfo =
    competitiveData?.SeasonalInfoBySeasonID &&
    typeof competitiveData.SeasonalInfoBySeasonID === "object"
      ? competitiveData.SeasonalInfoBySeasonID
      : {};
  const seasonValues = Object.values(seasonalInfo);

  // Xác định thứ hạng hiện tại
  const currentTier =
    toRankTier(latestCompetitiveUpdate?.TierAfterUpdate) ||
    toRankTier(competitiveData?.CompetitiveTier);

  // Xác định thứ hạng cao nhất từ tất cả mùa giải
  const peakFromSeasons = seasonValues.reduce<number>((max, season) => {
    const seasonPeak = Math.max(
      toRankTier(season?.Rank) ?? 0,
      toRankTier(season?.CompetitiveTier) ?? 0,
      toRankTier(season?.SeasonHighestCompetitiveTier) ?? 0
    );

    return seasonPeak > max ? seasonPeak : max;
  }, 0);

  const explicitPeakRaw = Number(competitiveData?.HighestCompetitiveTier ?? 0);
  const latestPeakRaw = Number(latestCompetitiveUpdate?.TierAfterUpdate ?? 0);
  // Lấy giá trị cao nhất trong tất cả các nguồn
  const peakTierCandidate = Math.max(
    peakFromSeasons,
    Number.isFinite(explicitPeakRaw) ? explicitPeakRaw : 0,
    Number.isFinite(latestPeakRaw) ? latestPeakRaw : 0
  );
  const peakTier = peakTierCandidate > 0 ? peakTierCandidate : null;
  const rankSummary = buildCompetitiveRankSummaryFromTiers(
    currentTier,
    peakTier
  );
  const actSeasonId =
      typeof latestCompetitiveUpdate?.SeasonID === "string"
          ? latestCompetitiveUpdate.SeasonID
          : null;
  const currentSeason = actSeasonId ? seasonalInfo[actSeasonId] : null;
  const rawWins = Number(currentSeason?.NumberOfWins);
  const rawWinsWithPlacements = Number(
      currentSeason?.NumberOfWinsWithPlacements
  );
  const winsFromTiers = Object.values(
      currentSeason?.WinsByTier ?? {}
  ).reduce<number>((total, wins) => {
    const numericWins = Number(wins);
    return total + (Number.isFinite(numericWins) ? numericWins : 0);
  }, 0);
  const actWins = Number.isFinite(rawWinsWithPlacements)
      ? Math.max(0, rawWinsWithPlacements)
      : winsFromTiers > 0
          ? winsFromTiers
          : Number.isFinite(rawWins)
              ? Math.max(0, rawWins)
              : null;
  const rawGames = Number(currentSeason?.NumberOfGames);
  const actGames = Number.isFinite(rawGames) ? Math.max(0, rawGames) : null;
  const rawLosses = Number(currentSeason?.NumberOfLosses);
  const rawDraws = Number(currentSeason?.NumberOfDraws);
  // Một số payload mới trả thẳng loss/draw. Với payload cũ, phần chênh
  // giữa hai bộ đếm win là offset placement; phải loại nó khỏi non-win
  // nếu không các trận placement sẽ bị tính lặp thành trận thua.
  const placementWinOffset =
      Number.isFinite(rawWinsWithPlacements) && Number.isFinite(rawWins)
          ? Math.max(0, rawWinsWithPlacements - rawWins)
          : 0;
  const actLosses = Number.isFinite(rawLosses)
      ? Math.max(0, rawLosses)
      : actWins !== null && actGames !== null
          ? Math.max(
              0,
              actGames -
              actWins -
              (Number.isFinite(rawDraws)
                  ? Math.max(0, rawDraws)
                  : placementWinOffset)
          )
          : null;

  return {
    ...rankSummary,
    actSeasonId,
    actWins,
    actLosses,
    actGames,
  };
}

/**
 * fetchCompetitiveRankSummary - Fetch thông tin thứ hạng competitive từ API
 * @param {typeof defaultUser} user - Đối tượng user
 * @returns {Promise<CompetitiveRankSummary | null>} Promise trả về thông tin thứ hạng hoặc null
 */
export async function fetchCompetitiveRankSummary(
  user: typeof defaultUser,
  options: RiotPlayerRequestOptions = {}
) {
  // Gọi API MMR
  const mmrResult = await getCompetitiveMMR(
    user.accessToken,
    user.entitlementsToken,
    user.region,
    user.id,
    options
  ).catch(() => null);

  // Xây dựng tóm tắt thứ hạng từ kết quả MMR
  const mmrSummary = buildCompetitiveRankSummary(
    (mmrResult as CompetitiveMMRResponse | null) ?? null
  );

  return mmrSummary?.currentTier || mmrSummary?.peakTier ? mmrSummary : null;
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
  const [loadoutSnapshot, ownershipResults, competitiveRank] = await Promise.all([
    playerLoadout(
      user.accessToken,
      user.entitlementsToken,
      user.region,
      user.id,
      options
    ).catch(() => null),
    // Dùng allSettled để không bị fail nếu một API bị lỗi
    Promise.allSettled([
      ownedItems(user.accessToken, user.entitlementsToken, user.region, user.id, VItemTypes.SkinLevel),
      ownedItems(user.accessToken, user.entitlementsToken, user.region, user.id, VItemTypes.SkinChroma),
      ownedItems(user.accessToken, user.entitlementsToken, user.region, user.id, VItemTypes.Spray),
      ownedItems(user.accessToken, user.entitlementsToken, user.region, user.id, VItemTypes.Flex),
      ownedItems(user.accessToken, user.entitlementsToken, user.region, user.id, VItemTypes.PlayerCard),
      ownedItems(user.accessToken, user.entitlementsToken, user.region, user.id, VItemTypes.PlayerTitle),
    ]),
    fetchCompetitiveRankSummary(user, options).catch(() => null),
  ]);

  // FIX (M3): seed danh sách sở hữu từ CACHE TRƯỚC ĐÓ thay vì seed rỗng.
  // Trước đây nếu 1/6 call ownership lỗi transient, danh sách tương ứng bị
  // ghi thành rỗng rồi persist → 5 phút sau UI tưởng user không sở hữu item.
  // Union với cache cũ: kết quả fetch thành công sẽ bổ sung ID mới; kết quả
  // lỗi thì giữ nguyên ID cũ (Valorant không thu hồi item nên union là an toàn,
  // cách làm này cũng trùng khớp với ownedSkinIds vốn đã seed từ user store).
  const previousCache = profileWarmupCache.get(authKey);
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

  // Xây dựng đối tượng cache
  const cache: ProfileWarmCache = {
    authKey,
    loadoutSnapshot,
    loadoutCacheVersion: PROFILE_LOADOUT_CACHE_VERSION,
    ownedSkinItemIds: Array.from(ownedSkinIds),
    ownedSprayItemIds: Array.from(ownedSprayIds),
    ownedFlexItemIds: Array.from(ownedFlexIds),
    ownedPlayerCardItemIds: Array.from(ownedPlayerCardIds),
    ownedPlayerTitleItemIds: Array.from(ownedPlayerTitleIds),
    competitiveRank,
    // Luôn stamp version — kể cả khi competitiveRank là null (tài khoản chưa
    // xếp hạng). Version là "chứng nhận đã fetch", không phải "có dữ liệu".
    rankCacheVersion: PROFILE_RANK_CACHE_VERSION,
    updatedAt: Date.now(),
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
  if (authKey === "guest") {
    return null;
  }

  const cached = profileWarmupCache.get(authKey);
  if (!options.force && isProfileCacheFresh(cached)) {
    return cached;
  }

  // In-flight key PHẢI phân biệt force/cached: một caller force không được
  // join promise của request non-force (nếu join thì "force" nhận về dữ liệu
  // cũ đang chạy). Hai request song song là chấp nhận được (tình huống hiếm).
  const inFlightKey = `${authKey}|${options.force ? "force" : "cached"}`;
  const existingPromise = profileWarmupInFlight.get(inFlightKey);
  if (existingPromise) {
    return existingPromise;
  }

  // Tạo request mới và lưu vào Map
  const request = fetchProfileWarmCacheInternal(user, options)
    .then((cache) => {
      if (cache) {
        profileWarmupCache.set(authKey, cache);
        // FIX (L12): giữ map trong giới hạn, ưu tiên entry mới nhất
        evictWarmCacheIfOverflow();
      }
      return cache;
    })
    .finally(() => {
      profileWarmupInFlight.delete(inFlightKey);
    });

  profileWarmupInFlight.set(inFlightKey, request);
  return request;
}
