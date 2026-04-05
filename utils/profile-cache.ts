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
  updatedAt: number;
};

export const PROFILE_WARM_CACHE_TTL = 5 * 60 * 1000;

const profileWarmupInFlight = new Map<string, Promise<ProfileWarmCache | null>>();

export const getSessionAuthKey = (user: typeof defaultUser) =>
  user.accessToken && user.entitlementsToken && user.region && user.id
    ? [user.accessToken, user.entitlementsToken, user.region, user.id].join("|")
    : "guest";

export const isProfileCacheFresh = (
  cache?: Pick<ProfileWarmCache, "updatedAt"> | null,
  ttl = PROFILE_WARM_CACHE_TTL
) => Boolean(cache?.updatedAt && Date.now() - cache.updatedAt < ttl);

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

export function buildCompetitiveRankSummary(
  mmrResult?: CompetitiveMMRResponse | null
): CompetitiveRankSummary | null {
  if (!mmrResult) {
    return null;
  }

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

  const competitiveData = mmrResult?.QueueSkills?.competitive;
  const latestCompetitiveUpdate = (mmrResult as any)?.LatestCompetitiveUpdate;
  const seasonalInfo =
    competitiveData?.SeasonalInfoBySeasonID &&
    typeof competitiveData.SeasonalInfoBySeasonID === "object"
      ? competitiveData.SeasonalInfoBySeasonID
      : {};
  const currentSeasonId =
    typeof latestCompetitiveUpdate?.SeasonID === "string"
      ? latestCompetitiveUpdate.SeasonID
      : null;
  const currentSeasonInfo = currentSeasonId
    ? (seasonalInfo as Record<string, any>)[currentSeasonId]
    : null;

  const latestTierRaw = Number(latestCompetitiveUpdate?.TierAfterUpdate ?? 0);
  const seasonCurrentTierRaw = Number(
    currentSeasonInfo?.CompetitiveTier ?? competitiveData?.CompetitiveTier ?? 0
  );
  const currentTierCandidate =
    Number.isFinite(latestTierRaw) && latestTierRaw > 0
      ? latestTierRaw
      : seasonCurrentTierRaw;
  const currentTier =
    Number.isFinite(currentTierCandidate) && currentTierCandidate > 0
      ? currentTierCandidate
      : null;

  const peakFromSeasons = Object.values(seasonalInfo).reduce((max, season: any) => {
    const seasonPeak = Number(
      season?.Rank ?? season?.SeasonHighestCompetitiveTier ?? season?.CompetitiveTier ?? 0
    );
    return Number.isFinite(seasonPeak) && seasonPeak > max ? seasonPeak : max;
  }, 0);

  const explicitPeakRaw = Number(competitiveData?.HighestCompetitiveTier ?? 0);
  const latestPeakRaw = Number(latestCompetitiveUpdate?.TierAfterUpdate ?? 0);
  const peakTierCandidate = Math.max(
    peakFromSeasons,
    Number.isFinite(explicitPeakRaw) ? explicitPeakRaw : 0,
    Number.isFinite(latestPeakRaw) ? latestPeakRaw : 0
  );
  const peakTier = peakTierCandidate > 0 ? peakTierCandidate : null;

  const currentTierInfo = currentTier ? tierLookup.get(currentTier) : null;
  const peakTierInfo = peakTier ? tierLookup.get(peakTier) : null;

  return {
    currentTier,
    currentName: formatCompetitiveTierName(currentTierInfo?.name || "Unrated"),
    currentIcon: currentTierInfo?.icon || null,
    peakTier,
    peakName: formatCompetitiveTierName(peakTierInfo?.name || "Unrated", {
      stripDivision: true,
    }),
    peakIcon: peakTierInfo?.icon || null,
  };
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
  );

  if (!loadoutSnapshot) {
    return null;
  }

  const [ownershipResults, mmrResult] = await Promise.all([
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
    getCompetitiveMMR(
      user.accessToken,
      user.entitlementsToken,
      user.region,
      user.id
    ).catch(() => null),
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

  const competitiveRank = buildCompetitiveRankSummary(
    (mmrResult as CompetitiveMMRResponse | null) ?? null
  );
  const cache: ProfileWarmCache = {
    authKey: getSessionAuthKey(user),
    loadoutSnapshot,
    ownedSkinItemIds: Array.from(ownedSkinIds),
    ownedSprayItemIds: Array.from(ownedSprayIds),
    competitiveRank,
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
