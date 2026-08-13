import type { ImageProps, ImageSource } from "expo-image";

type ExpoImageSource = ImageProps["source"];
export type ImageCacheId = string | number | null | undefined;

const CACHE_KEY_PREFIX = "vshop-image-id-v2";

const isRemoteUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);

const isImageSourceObject = (value: unknown): value is ImageSource =>
  Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "uri" in value
  );

export function buildImageCacheKey(cacheId: ImageCacheId) {
  if (cacheId === null || cacheId === undefined) return null;

  const normalizedId = String(cacheId).trim().toLowerCase();
  return normalizedId ? `${CACHE_KEY_PREFIX}:${normalizedId}` : null;
}

function manageSourceItem(
  source: ImageSource | string,
  cacheKey: string | null
) {
  if (isRemoteUrl(source)) {
    return cacheKey ? { uri: source, cacheKey } : source;
  }

  if (!isImageSourceObject(source) || !isRemoteUrl(source.uri)) {
    return source;
  }

  return cacheKey ? { ...source, cacheKey } : source;
}

export function getManagedImageSource(
  source: ExpoImageSource,
  cacheId?: ImageCacheId
): ExpoImageSource {
  const baseCacheKey = buildImageCacheKey(cacheId);

  if (Array.isArray(source)) {
    return source.map((item, index) => {
      if (typeof item === "number") return item;

      const itemCacheKey = baseCacheKey
        ? `${baseCacheKey}:source-${index}`
        : null;
      return manageSourceItem(item, itemCacheKey);
    }) as ExpoImageSource;
  }

  if (typeof source === "number" || source == null) return source;
  if (typeof source === "string" || isImageSourceObject(source)) {
    return manageSourceItem(source, baseCacheKey);
  }

  return source;
}
