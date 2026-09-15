import type { CompetitiveMMRResponse } from "~/services/riot/api-types";
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

// Thông tin xếp hạng của một mùa giải (season) trong payload MMR.
// Trường là unknown vì Riot trả nhiều shape tùy phiên bản API.
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

// Dữ liệu kỹ năng của một queue (thường "competitive") trong payload MMR.
type CompetitiveQueueSkill = {
  CompetitiveTier?: unknown;
  HighestCompetitiveTier?: unknown;
  SeasonalInfoBySeasonID?: Record<string, CompetitiveSeasonInfo>;
};

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
