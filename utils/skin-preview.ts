import type { MediaPopupEntry } from "~/components/popups/MediaPopup";

export type SkinPreviewSource = Pick<ValorantSkin, "uuid" | "displayName"> &
  Partial<Pick<ValorantSkin, "displayIcon" | "contentTierUuid" | "levels" | "chromas">>;

/** Keep still art, optional video and real swatches together for one skin. */
export function buildSkinPreviewMedia(item: SkinPreviewSource): MediaPopupEntry[] {
  const baseImage = item.levels?.[0]?.displayIcon || item.displayIcon || item.chromas?.[0]?.displayIcon || item.chromas?.[0]?.fullRender;
  return [
    ...(item.levels ?? []).map((level, index) => {
      const imageUri = level.displayIcon || baseImage;
      return {
        cacheId: `skin-level:${level.uuid}:media`, group: "level" as const,
        kind: level.streamedVideo ? "video" as const : "image" as const,
        label: level.displayName, uri: level.streamedVideo || imageUri || "",
        imageUri, imageCacheId: imageUri === baseImage ? `skin:${item.uuid}:display` : `skin-level:${level.uuid}:display`,
        videoUri: level.streamedVideo, contentTierUuid: item.contentTierUuid,
        levelNumber: index + 1,
      };
    }),
    ...(item.chromas ?? []).map((chroma) => {
      const imageUri = chroma.fullRender || chroma.displayIcon || baseImage;
      return {
        cacheId: `skin-chroma:${chroma.uuid}:media`, group: "chroma" as const,
        kind: chroma.streamedVideo ? "video" as const : "image" as const,
        label: chroma.displayName, uri: chroma.streamedVideo || imageUri || "",
        imageUri, imageCacheId: `skin-chroma:${chroma.uuid}:full-render`,
        videoUri: chroma.streamedVideo, swatchUri: chroma.swatch || imageUri,
        contentTierUuid: item.contentTierUuid,
      };
    }),
  ].filter(entry => Boolean(entry.uri));
}
