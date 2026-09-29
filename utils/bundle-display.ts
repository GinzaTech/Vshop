// ===== bundle-display.ts =====
// Helper thuần tuý cho hiển thị bundle: format giá VP theo Valorant client,
// đếm ngược dạng đầy đủ của bundle, và suy rộng độ rộng item trong carousel.
// Không chứa state hay side effect để dễ unit test.

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

/** Độ rộng tối thiểu của một item cell trong carousel (dp). */
const BUNDLE_ITEM_MIN_WIDTH = 118;
/** Độ rộng tối đa của một item cell trong carousel (dp). */
const BUNDLE_ITEM_MAX_WIDTH = 164;
/** Tỉ lệ giữa item cell và chiều rộng màn hình trên phone. */
const BUNDLE_ITEM_WIDTH_RATIO = 0.34;

/**
 * getBundleItemWidth – Độ rộng item cell ổn định, clamp vào khoảng
 * compact/tablet. Cell luôn hẹp hơn card để card kế tiếp lộ một phần,
 * tạo hiệu ứng "peek" của carousel ngang.
 *
 * @param windowWidth – Chiều rộng cửa sổ từ useWindowDimensions().
 */
export function getBundleItemWidth(windowWidth: number): number {
  return Math.min(
    BUNDLE_ITEM_MAX_WIDTH,
    Math.max(
      BUNDLE_ITEM_MIN_WIDTH,
      Math.round(windowWidth * BUNDLE_ITEM_WIDTH_RATIO)
    )
  );
}
