// ===== bundle-display.ts =====
// Helper thuần tuý cho hiển thị bundle: format giá VP theo Valorant client,
// đếm ngược dạng đầy đủ của bundle, và suy rộng độ rộng item trong carousel
// theo geometry tham chiếu (card = viewport trừ gutter, cell ≈ 24% card).
// Không chứa state hay side effect để dễ unit test.

import { SPACING } from "~/constants/DesignSystem";

/**
 * formatVp – Format số VP với dấu chấm phân cách hàng nghìn
 * (khớp hiển thị "6.640" của Valorant client).
 *
 * @param value – Giá VP gốc (có thể âm/nhỏ hơn 1 từ dữ liệu lỗi).
 * @returns Chuỗi số không âm, làm tròn về 0, nhóm 3 chữ số bằng ".".
 */
export function formatVp(value: number): string {
  return Math.max(0, Math.trunc(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * formatBundleCountdown – Đếm ngược đầy đủ "Xd HH:MM:SS" cho bundle card.
 * Dưới 1 ngày chỉ còn "HH:MM:SS"; hết hạn trả "Ended".
 *
 * @param timestamp – Mốc hết hạn (ms).
 * @param now – Thời gian hiện tại (ms), mặc định Date.now().
 * @returns "21d 06:04:27" | "06:04:27" | "Ended".
 */
export function formatBundleCountdown(
  timestamp: number,
  now: number = Date.now()
): string {
  const diff = Math.max(0, timestamp - now);
  if (diff <= 0) return "Ended";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad2 = (part: number) => part.toString().padStart(2, "0");
  const clock = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;

  return days > 0 ? `${days}d ${clock}` : clock;
}

/**
 * hasBundleDiscount – Chỉ hiển thị giá gốc bị gạch khi nó LỚN HƠN giá hiện tại.
 * Giá bằng nhau (không giảm) hoặc thiếu dữ liệu base đều trả false để tránh
 * hai dòng giá trùng lặp.
 *
 * @param originalPrice – Giá base từ Riot (tuỳ chọn).
 * @param price – Giá sau giảm hiện tại.
 */
export function hasBundleDiscount(
  originalPrice: number | undefined,
  price: number
): boolean {
  return typeof originalPrice === "number" && originalPrice > price;
}

// ── Geometry tham chiếu (ảnh IMG_3552) ────────────────────────────────────
// Card bundle full-width trong vùng nội dung padding 20dp mỗi bên của màn
// hình; cell chiếm ≈ 24% card width, clamp 72–136dp để ba cell đầy + cell
// thứ tư lộ một phần ("peek") ở dải viewport 360–430dp.

/** Gutter ngang của màn hình bundle (padding 20dp mỗi bên). */
export const BUNDLE_CARD_GUTTER = 40;
/** Khoảng cách ngang giữa các item cell trong carousel (dp). */
export const BUNDLE_CAROUSEL_GAP = SPACING.xs;
/** Padding ngang của content carousel bên trong card (dp). */
export const BUNDLE_CAROUSEL_CONTENT_PADDING = SPACING.sm;
/** Độ rộng tối thiểu của một item cell (dp) — đủ cho 5 chữ số VP. */
export const BUNDLE_ITEM_MIN_WIDTH = 72;
/** Độ rộng tối đa của một item cell (dp) trên tablet. */
export const BUNDLE_ITEM_MAX_WIDTH = 136;
/** Tỉ lệ giữa item cell và chiều rộng card. */
const BUNDLE_ITEM_WIDTH_RATIO = 0.24;
/** Trần tuyệt đối khi phóng đại cell theo font scale/chữ số dài. */
const BUNDLE_ITEM_ABSOLUTE_MAX_WIDTH = 200;
/** Số chữ số giá mặc định vừa cell cơ bản (không cần nới). */
const BUNDLE_ITEM_BASE_PRICE_CHARS = 5;
/** Độ rộng nới thêm cho mỗi chữ số vượt mức mặc định (dp). */
const BUNDLE_ITEM_EXTRA_CHAR_WIDTH = 6;
/** Font scale trần dùng để phóng đại cell (không phóng vô hạn). */
const BUNDLE_ITEM_MAX_FONT_SCALE = 2;

/** Tuỳ chọn nới độ rộng cell theo bối cảnh hiển thị thật. */
export type BundleItemWidthOptions = {
  /** fontScale của hệ thống (useWindowDimensions) — phóng lớn thì nới cell. */
  fontScale?: number;
  /** Độ dài chuỗi giá dài nhất trong bundle (đã format) để chừa chỗ chữ số. */
  maxPriceLength?: number;
};

/**
 * getBundleItemWidth – Độ rộng item cell theo geometry tham chiếu:
 * 24% chiều rộng card (viewport trừ gutter 40dp), clamp 72–136dp.
 * Font scale > 1 hoặc giá VP dài hơn 5 chữ số sẽ nới cell để chữ số
 * không bao giờ bị co/ellipsis; font nhỏ hơn mặc định không làm hẹp cell.
 *
 * @param windowWidth – Chiều rộng cửa sổ từ useAppWindowDimensions().
 * @param options – fontScale/maxPriceLength của bundle đang hiển thị.
 */
export function getBundleItemWidth(
  windowWidth: number,
  options?: BundleItemWidthOptions
): number {
  const cardWidth = Math.max(0, windowWidth - BUNDLE_CARD_GUTTER);
  const base = Math.min(
    BUNDLE_ITEM_MAX_WIDTH,
    Math.max(
      BUNDLE_ITEM_MIN_WIDTH,
      Math.round(cardWidth * BUNDLE_ITEM_WIDTH_RATIO)
    )
  );
  const fontScale = Math.min(
    BUNDLE_ITEM_MAX_FONT_SCALE,
    Math.max(1, options?.fontScale ?? 1)
  );
  const extraChars = Math.max(
    0,
    (options?.maxPriceLength ?? 0) - BUNDLE_ITEM_BASE_PRICE_CHARS
  );
  return Math.min(
    BUNDLE_ITEM_ABSOLUTE_MAX_WIDTH,
    Math.round((base + extraChars * BUNDLE_ITEM_EXTRA_CHAR_WIDTH) * fontScale)
  );
}

/**
 * getBundleItemMaxPriceTextLength – Độ dài chuỗi giá (đã format) dài nhất
 * trong các item của bundle. Dùng để nới cell trước khi render, bảo đảm
 * chữ số VP hợp lệ không bị cắt.
 *
 * @param items – Các item trong bundle (skin hoặc phụ kiện).
 */
export function getBundleItemMaxPriceTextLength(
  items: readonly (SkinShopItem | AccessoryShopItem)[]
): number {
  return items.reduce((longest, item) => {
    const current = formatVp(item.price).length;
    const original =
      typeof item.originalPrice === "number"
        ? formatVp(item.originalPrice).length
        : 0;
    return Math.max(longest, current, original);
  }, 0);
}
