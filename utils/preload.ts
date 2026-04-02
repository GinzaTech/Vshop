import { Image } from "expo-image";

import { defaultUser } from "./valorant-api";
import { getAgent, getAssets } from "./valorant-assets";
import { getDisplayIconUri } from "./misc";

type PreloadOptions = {
  batchSize?: number;
  cachePolicy?: "disk" | "memory" | "memory-disk";
  limit?: number;
};

const DEFAULT_BATCH_SIZE = 8;
let catalogWarmupStarted = false;

const chunk = <T>(items: T[], size: number) => {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
};

const uniqueUrls = (urls: (string | null | undefined)[]) =>
  [...new Set(urls.filter((url): url is string => Boolean(url && url.startsWith("http"))))];

const MAX_CATALOG_WARMUP_URLS = 180;

const getSkinImageUrl = (item: SkinShopItem | NightMarketItem | GalleryItem) =>
  getDisplayIconUri(item) ||
  item.displayIcon ||
  item.chromas?.[0]?.displayIcon ||
  item.chromas?.[0]?.fullRender;

export async function preloadImageUrls(
  urls: (string | null | undefined)[],
  options?: PreloadOptions
) {
  const normalizedUrls = uniqueUrls(urls).slice(
    0,
    options?.limit ?? Number.MAX_SAFE_INTEGER
  );
  if (normalizedUrls.length === 0) {
    return;
  }

  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const cachePolicy = options?.cachePolicy ?? "memory-disk";

  for (const batch of chunk(normalizedUrls, batchSize)) {
    try {
      await Image.prefetch(batch, { cachePolicy });
    } catch (error) {
      if (__DEV__) {
        console.warn("[preload] Failed to prefetch image batch", error);
      }
    }
  }
}

export function collectSessionImageUrls(user: typeof defaultUser) {
  const sessionUrls: (string | null | undefined)[] = [];

  user.shops.main.forEach((item) => {
    sessionUrls.push(getSkinImageUrl(item));
  });

  user.shops.nightMarket.forEach((item) => {
    sessionUrls.push(getSkinImageUrl(item));
  });

  user.shops.bundles.forEach((bundle) => {
    sessionUrls.push(bundle.displayIcon, bundle.displayIcon2, bundle.verticalPromoImage);
    bundle.items.forEach((item) => {
      sessionUrls.push(getSkinImageUrl(item));
    });
  });

  return uniqueUrls(sessionUrls);
}

export function collectCatalogImageUrls() {
  const assets = getAssets();
  const agents = getAgent().agents;

  const urls: (string | null | undefined)[] = [];

  assets.skins.forEach((skin) => {
    urls.push(
      skin.levels?.[0]?.displayIcon,
      skin.displayIcon,
      skin.chromas?.[0]?.displayIcon,
      skin.chromas?.[0]?.fullRender
    );
  });

  assets.buddies.forEach((buddy) => {
    urls.push(buddy.displayIcon, buddy.levels?.[0]?.displayIcon);
  });

  assets.sprays.forEach((spray) => {
    urls.push(spray.displayIcon, spray.fullTransparentIcon);
  });

  assets.cards.forEach((card) => {
    urls.push(card.displayIcon, card.largeArt, card.wideArt);
  });

  assets.maps.forEach((map: any) => {
    urls.push(map.listViewIcon, map.splash, map.displayIcon);
  });

  agents.forEach((agent) => {
    urls.push(
      agent.displayIcon,
      agent.displayIconSmall,
      agent.fullPortrait,
      agent.fullPortraitV2,
      agent.bustPortrait
    );
  });

  return uniqueUrls(urls).slice(0, MAX_CATALOG_WARMUP_URLS);
}

export async function preloadSessionResources(
  user: typeof defaultUser,
  options?: { cellular?: boolean }
) {
  await preloadImageUrls(collectSessionImageUrls(user), {
    batchSize: options?.cellular ? 3 : 6,
    cachePolicy: "memory-disk",
    limit: options?.cellular ? 8 : undefined,
  });
}

export function startBackgroundCatalogWarmup() {
  if (catalogWarmupStarted) {
    return;
  }

  catalogWarmupStarted = true;

  setTimeout(() => {
    void preloadImageUrls(collectCatalogImageUrls(), {
      batchSize: 8,
      cachePolicy: "disk",
    });
  }, 4500);
}
