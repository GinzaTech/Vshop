import { getDisplayIconUri, VItemTypes } from "./misc";
import {
  CompetitiveMMRResponse,
  defaultUser,
  extractOwnedItemIds,
  getCompetitiveMMR,
  ownedItems,
  playerLoadout,
  PlayerLoadoutResponse,
} from "./valorant-api";
import { getAssets } from "./valorant-assets";
import { preloadImageUrls } from "./preload";

export type CompetitiveRankSummary = {
  currentTier: number | null;
  currentName: string;
  currentIcon: string | null;
  peakTier: number | null;
  peakName: string;
  peakIcon: string | null;
};

export type ProfileWarmCache = {
  authKey: string;
  loadoutSnapshot: PlayerLoadoutResponse | null;
  ownedSkinItemIds: string[];
  ownedSprayItemIds: string[];
  competitiveRank: CompetitiveRankSummary | null;
  rankCacheVersion?: number;
  updatedAt: number;
};

export const PROFILE_WARM_CACHE_TTL = 5 * 60 * 1000;
export const PROFILE_RANK_CACHE_VERSION = 9;

const profileWarmupInFlight = new Map<string, Promise<ProfileWarmCache | null>>();

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

export const getSessionAuthKey = (user: typeof defaultUser) =>
  user.region && user.id
    ? [user.region, user.id].join("|")
    : "guest";

export const isProfileCacheFresh = (
  cache?: Pick<ProfileWarmCache, "updatedAt"> | null,
  ttl = PROFILE_WARM_CACHE_TTL
) => Boolean(cache?.updatedAt && Date.now() - cache.updatedAt < ttl);

export const hasValidCompetitiveRankCache = (
  cache?: Pick<ProfileWarmCache, "competitiveRank" | "rankCacheVersion"> | null
) =>
  Boolean(
    cache?.rankCacheVersion === PROFILE_RANK_CACHE_VERSION &&
      (cache.competitiveRank?.currentTier || cache.competitiveRank?.peakTier)
  );

const formatCompetitiveTierName = (
  value?: string | null,
  options?: { stripDivision?: boolean }
) => {
  if (!value) {
    return "Unrated";
  }

  const normalized = value
    .toLocaleLowerCase("vi-VN")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)(\p{L})/gu, (match, prefix: string, char: string) =>
      `${prefix}${char.toLocaleUpperCase("vi-VN")}`
    );

  if (options?.stripDivision) {
    return normalized.replace(/\s+[123]$/, "");
  }

  return normalized;
};

const toTitleCase = (value?: string | null) =>
  (value || "")
    .trim()
    .toLocaleLowerCase("vi-VN")
    .replace(/\s+/g, " ")
    .replace(/(^|\s)(\p{L})/gu, (match, prefix: string, char: string) =>
      `${prefix}${char.toLocaleUpperCase("vi-VN")}`
    );

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

const getCompetitiveQueueSkill = (mmrResult: CompetitiveMMRResponse) => {
  const queueSkills = mmrResult?.QueueSkills;
  if (!queueSkills || typeof queueSkills !== "object") {
    return null;
  }

  const directCompetitive = (queueSkills as Record<string, any>).competitive;
  if (directCompetitive) {
    return directCompetitive;
  }

  const competitiveEntry = Object.entries(queueSkills as Record<string, any>).find(
    ([queueName, queueData]) =>
      queueName.toLocaleLowerCase("en-US").includes("competitive") &&
      queueData &&
      typeof queueData === "object"
  );

  if (competitiveEntry?.[1]) {
    return competitiveEntry[1];
  }

  return (
    Object.values(queueSkills as Record<string, any>).find(
      (queueData) =>
        queueData &&
        typeof queueData === "object" &&
        queueData.SeasonalInfoBySeasonID &&
        typeof queueData.SeasonalInfoBySeasonID === "object"
    ) ?? null
  );
};

const toRankTier = (value: unknown) => {
  const tier = Number(value ?? 0);
  return Number.isFinite(tier) && tier > 0 ? tier : null;
};

const getTierLookup = () => {
  const tierLookup = new Map<number, { name: string; icon: string | null }>();
  const competitiveTierSeasons = Array.isArray(getAssets().competitiveTiers)
    ? getAssets().competitiveTiers
    : [];

  competitiveTierSeasons.forEach((season: any) => {
    const tiers = Array.isArray(season?.tiers) ? season.tiers : [];
    tiers.forEach((tier: any) => {
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
  };
};

export function buildCompetitiveRankSummary(
  mmrResult?: CompetitiveMMRResponse | null
): CompetitiveRankSummary | null {
  if (!mmrResult) {
    return null;
  }

  const competitiveData = getCompetitiveQueueSkill(mmrResult);
  const latestCompetitiveUpdate = (mmrResult as any)?.LatestCompetitiveUpdate;
  const seasonalInfo =
    competitiveData?.SeasonalInfoBySeasonID &&
    typeof competitiveData.SeasonalInfoBySeasonID === "object"
      ? competitiveData.SeasonalInfoBySeasonID
      : {};
  const seasonValues = Object.values(seasonalInfo) as any[];

  const currentTier =
    toRankTier(latestCompetitiveUpdate?.TierAfterUpdate) ||
    toRankTier(competitiveData?.CompetitiveTier);

  const peakFromSeasons = seasonValues.reduce<number>((max, season: any) => {
    const seasonPeak = Math.max(
      toRankTier(season?.Rank) ?? 0,
      toRankTier(season?.CompetitiveTier) ?? 0,
      toRankTier(season?.SeasonHighestCompetitiveTier) ?? 0
    );

    return seasonPeak > max ? seasonPeak : max;
  }, 0);

  const explicitPeakRaw = Number(competitiveData?.HighestCompetitiveTier ?? 0);
  const latestPeakRaw = Number(latestCompetitiveUpdate?.TierAfterUpdate ?? 0);
  const peakTierCandidate = Math.max(
    peakFromSeasons,
    Number.isFinite(explicitPeakRaw) ? explicitPeakRaw : 0,
    Number.isFinite(latestPeakRaw) ? latestPeakRaw : 0
  );
  const peakTier = peakTierCandidate > 0 ? peakTierCandidate : null;

  return buildCompetitiveRankSummaryFromTiers(currentTier, peakTier);
}

export async function fetchCompetitiveRankSummary(user: typeof defaultUser) {
  const mmrResult = await getCompetitiveMMR(
    user.accessToken,
    user.entitlementsToken,
    user.region,
    user.id
  ).catch(() => null);

  const mmrSummary = buildCompetitiveRankSummary(
    (mmrResult as CompetitiveMMRResponse | null) ?? null
  );

  return mmrSummary?.currentTier || mmrSummary?.peakTier ? mmrSummary : null;
}

const collectProfileWarmupUrls = (
  loadoutSnapshot: PlayerLoadoutResponse | null,
  ownedSkinItemIds: string[],
  ownedSprayItemIds: string[],
  competitiveRank: CompetitiveRankSummary | null
) => {
  const assets = getAssets();
  const urls: (string | null | undefined)[] = [];
  const ownedSkinIdSet = new Set(ownedSkinItemIds);
  const ownedSprayIdSet = new Set(ownedSprayItemIds);

  (loadoutSnapshot?.Guns || []).forEach((gun) => {
    const skin = assets.skins.find(
      (item) =>
        item.uuid === gun.SkinID ||
        item.levels?.some((level) => level.uuid === gun.SkinLevelID)
    );
    const chroma = skin?.chromas?.find((item) => item.uuid === gun.ChromaID);
    urls.push(
      chroma?.displayIcon,
      chroma?.fullRender,
      skin?.displayIcon,
      skin?.levels?.[0]?.displayIcon,
      getDisplayIconUri(skin as any)
    );
  });

  (loadoutSnapshot?.Sprays || []).forEach((spray) => {
    const sprayAsset = assets.sprays.find((item) => item.uuid === spray.SprayID);
    urls.push(sprayAsset?.displayIcon, sprayAsset?.fullTransparentIcon);
  });

  assets.skins.forEach((skin) => {
    if (
      skin.levels?.some((level) => ownedSkinIdSet.has(level.uuid)) ||
      skin.chromas?.some((chroma) => ownedSkinIdSet.has(chroma.uuid))
    ) {
      urls.push(
        getDisplayIconUri(skin as any),
        skin.displayIcon,
        skin.chromas?.[0]?.displayIcon,
        skin.chromas?.[0]?.fullRender
      );
    }
  });

  assets.sprays.forEach((spray) => {
    if (ownedSprayIdSet.has(spray.uuid)) {
      urls.push(spray.displayIcon, spray.fullTransparentIcon);
    }
  });

  urls.push(competitiveRank?.currentIcon, competitiveRank?.peakIcon);

  return urls;
};

async function fetchProfileWarmCacheInternal(user: typeof defaultUser) {
  if (!user.accessToken || !user.entitlementsToken || !user.region || !user.id) {
    return null;
  }

  const loadoutSnapshot = await playerLoadout(
    user.accessToken,
    user.entitlementsToken,
    user.region,
    user.id
  ).catch(() => null);

  const [ownershipResults, competitiveRank] = await Promise.all([
    Promise.allSettled([
      ownedItems(
        user.accessToken,
        user.entitlementsToken,
        user.region,
        user.id,
        VItemTypes.SkinLevel
      ),
      ownedItems(
        user.accessToken,
        user.entitlementsToken,
        user.region,
        user.id,
        VItemTypes.SkinChroma
      ),
      ownedItems(
        user.accessToken,
        user.entitlementsToken,
        user.region,
        user.id,
        VItemTypes.Spray
      ),
    ]),
    fetchCompetitiveRankSummary(user).catch(() => null),
  ]);

  const ownedSkinIds = new Set<string>(user.ownedSkinIds ?? []);
  const ownedSprayIds = new Set<string>();

  ownershipResults.forEach((result, index) => {
    if (result.status !== "fulfilled") {
      return;
    }

    extractOwnedItemIds(result.value).forEach((itemId) => {
      if (index === 2) {
        ownedSprayIds.add(itemId);
      } else {
        ownedSkinIds.add(itemId);
      }
    });
  });

  const cache: ProfileWarmCache = {
    authKey: getSessionAuthKey(user),
    loadoutSnapshot,
    ownedSkinItemIds: Array.from(ownedSkinIds),
    ownedSprayItemIds: Array.from(ownedSprayIds),
    competitiveRank,
    rankCacheVersion: PROFILE_RANK_CACHE_VERSION,
    updatedAt: Date.now(),
  };

  void preloadImageUrls(
    collectProfileWarmupUrls(
      cache.loadoutSnapshot,
      cache.ownedSkinItemIds,
      cache.ownedSprayItemIds,
      cache.competitiveRank
    ),
    {
      batchSize: 6,
      cachePolicy: "memory-disk",
      limit: 120,
    }
  );

  return cache;
}

export async function fetchProfileWarmCache(user: typeof defaultUser) {
  const authKey = getSessionAuthKey(user);
  if (authKey === "guest") {
    return null;
  }

  const existingPromise = profileWarmupInFlight.get(authKey);
  if (existingPromise) {
    return existingPromise;
  }

  const request = fetchProfileWarmCacheInternal(user).finally(() => {
    profileWarmupInFlight.delete(authKey);
  });

  profileWarmupInFlight.set(authKey, request);
  return request;
}
