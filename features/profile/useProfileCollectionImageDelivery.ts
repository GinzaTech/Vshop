import React from "react";
import { Platform } from "react-native";
import { Image as ExpoImage } from "expo-image";
import type { TFunction } from "i18next";
import { buildImageCacheKey } from "~/utils/image-cache";
import { runWhenIdle, type IdleTask } from "~/utils/idle-task";
import type { useProfileCollection } from "./useProfileCollection";

type Props = {
  rows: ReturnType<typeof useProfileCollection>["profileListRowsByTab"]["collection"];
  authKey: string;
  focused: boolean;
  t: TFunction;
};

const VISIBLE_THUMBNAIL_LIMIT = 12;
type WarmImage = { uri: string; cacheKey: string };

function isPublicThumbnail(uri: string) {
  try {
    const url = new URL(uri);
    return url.origin === "https://media.valorant-api.com" &&
      !url.username && !url.password && !url.search && !url.hash &&
      /^\/weapon(?:skins|skinlevels|skinchromas)\/[^/]+\/(?:displayicon|fullrender)\.png$/i.test(url.pathname);
  } catch { return false; }
}

function buildDeliveryPlan(rows: Props["rows"]) {
  const priorityIds = new Set<string>();
  const warmImages: WarmImage[] = [];
  const cacheKeys = new Set<string>();
  for (const row of rows) {
    if (row.kind !== "collection-row") continue;
    for (const item of row.items) {
      if (priorityIds.size >= VISIBLE_THUMBNAIL_LIMIT) return { priorityIds, warmImages };
      if (priorityIds.has(item.collectionId)) continue;
      priorityIds.add(item.collectionId);
      const cacheKey = buildImageCacheKey(`skin-image:${item.chromaId || item.skinLevelId || item.skinId}:display`);
      if (!item.image || !cacheKey || !isPublicThumbnail(item.image) || cacheKeys.has(cacheKey)) continue;
      cacheKeys.add(cacheKey);
      warmImages.push({ uri: item.image, cacheKey });
    }
  }
  return { priorityIds, warmImages };
}

/** Preserve image URIs/IDs; warm public thumbnails serially without owning account data. */
export function useProfileCollectionImageDelivery({ rows, authKey, focused, t }: Props): ReadonlySet<string> {
  const plan = React.useMemo(() => buildDeliveryPlan(rows), [rows]);
  React.useEffect(() => {
    if (!focused || !authKey || Platform.OS === "web" || plan.warmImages.length === 0) return;
    let cancelled = false;
    let warned = false;
    let index = 0;
    let task: IdleTask | undefined;
    const warm = async ({ uri, cacheKey }: WarmImage) => {
      if (cancelled) return;
      const existing = await ExpoImage.getCachePathAsync(cacheKey);
      if (cancelled || existing) return;
      const prefetched = await ExpoImage.prefetch(uri, "memory-disk");
      if (cancelled) return;
      if (!prefetched) throw new Error("Public thumbnail prefetch failed");
      // URL prefetch uses URL keys. Seed the same managed key as CachedImage
      // from the original cached file, preserving resolution and chroma artwork.
      const localFile = await ExpoImage.getCachePathAsync(uri);
      if (cancelled) return;
      if (!localFile) throw new Error("Public thumbnail cache entry unavailable");
      const localUri = localFile.startsWith("/")
        ? `file://${localFile.split("/").map(encodeURIComponent).join("/")}` : localFile;
      await ExpoImage.writeToCacheAsync(localUri, cacheKey);
    };
    const schedule = () => {
      if (cancelled || index >= plan.warmImages.length) return;
      task = runWhenIdle(() => {
        if (cancelled) return;
        const input = plan.warmImages[index++];
        void warm(input).catch(() => {
          if (cancelled || warned) return;
          warned = true;
          console.warn("Profile collection thumbnail warmup failed; normal image loading remains available.");
        }).finally(schedule);
      });
    };
    schedule();
    return () => { cancelled = true; task?.cancel(); };
  }, [authKey, focused, plan, t]);
  return plan.priorityIds;
}
