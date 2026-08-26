export type GalleryFilterSkin = Pick<GalleryItem, "displayName" | "levels">;

export const normalizeGalleryQuery = (value: string): string =>
  value.trim().toLocaleLowerCase();

export const getGalleryWishlistId = (skin: GalleryFilterSkin): string | null =>
  skin.levels?.[0]?.uuid ?? null;

export const matchesGalleryQuery = (
  skin: GalleryFilterSkin,
  normalizedQuery: string,
): boolean =>
  !normalizedQuery ||
  skin.displayName.toLocaleLowerCase().includes(normalizedQuery);
