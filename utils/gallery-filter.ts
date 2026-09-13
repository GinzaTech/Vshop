/**
 * gallery-filter.ts — Helper lọc/tìm kiếm danh sách skin ở màn Gallery.
 * Các hàm thuần, dễ test; screen chỉ gọi, không tự viết logic lọc.
 */

// Shape tối thiểu của một skin cần cho việc lọc (tên + levels để lấy UUID).
export type GalleryFilterSkin = Pick<GalleryItem, "displayName" | "levels">;

/**
 * normalizeGalleryQuery — Chuẩn hóa chuỗi tìm kiếm: trim + lowercase để
 * so khớp không phân biệt hoa/thường.
 * @param {string} value - Chuỗi người dùng gõ vào ô tìm kiếm
 * @returns {string} Chuỗi đã chuẩn hóa
 */
export const normalizeGalleryQuery = (value: string): string =>
  value.trim().toLocaleLowerCase();

/**
 * getGalleryWishlistId — Lấy UUID đại diện của skin (level đầu tiên) dùng
 * làm khóa wishlist/so khớp.
 * @param {GalleryFilterSkin} skin - Skin cần lấy UUID
 * @returns {string | null} UUID của level đầu tiên, hoặc null nếu skin không có levels
 */
export const getGalleryWishlistId = (skin: GalleryFilterSkin): string | null =>
  skin.levels?.[0]?.uuid ?? null;

/**
 * matchesGalleryQuery — Skin có khớp từ khóa tìm kiếm không.
 * @param {GalleryFilterSkin} skin - Skin cần kiểm tra
 * @param {string} normalizedQuery - Từ khóa đã qua normalizeGalleryQuery
 * @returns {boolean} true nếu query rỗng (hiện tất cả) hoặc tên skin chứa query
 */
export const matchesGalleryQuery = (
  skin: GalleryFilterSkin,
  normalizedQuery: string,
): boolean =>
  !normalizedQuery ||
  skin.displayName.toLocaleLowerCase().includes(normalizedQuery);
