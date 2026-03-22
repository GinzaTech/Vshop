import { Image } from "expo-image";

import { defaultUser } from "./valorant-api";
import { getAgent, getAssets } from "./valorant-assets";

type PreloadOptions = {
  batchSize?: number;
  cachePolicy?: "disk" | "memory" | "memory-disk";
};

const DEFAULT_BATCH_SIZE = 12;
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

const getSkinImageUrl = (item: SkinShopItem | NightMarketItem | GalleryItem) =>
  item.levels?.[0]?.displayIcon ||
  item.chromas?.[0]?.fullRender ||
  item.chromas?.[0]?.displayIcon ||
  item.displayIcon;

export async function preloadImageUrls(
  urls: (string | null | undefined)[],
  options?: PreloadOptions
) {
  const normalizedUrls = uniqueUrls(urls);
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

  return uniqueUrls(urls);
}

export async function preloadSessionResources(user: typeof defaultUser) {
  await preloadImageUrls(collectSessionImageUrls(user), {
    batchSize: 10,
    cachePolicy: "memory-disk",
  });
}

export function startBackgroundCatalogWarmup() {
  if (catalogWarmupStarted) {
    return;
  }

  catalogWarmupStarted = true;

  setTimeout(() => {
    void preloadImageUrls(collectCatalogImageUrls(), {
      batchSize: 18,
      cachePolicy: "disk",
    });
  }, 1200);
}
