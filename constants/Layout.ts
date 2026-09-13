/**
 * Khoảng trống cần chừa ở cuối các màn hình tab chính để nội dung cuối cùng
 * có thể cuộn hoàn toàn lên phía trên thanh điều hướng nổi.
 */

// Chiều cao của thanh tab nổi (floating tab bar) ở dưới màn hình.
const PRIMARY_TAB_BAR_HEIGHT = 68;
// Khoảng hở giữa mép dưới nội dung và đỉnh thanh tab.
const PRIMARY_TAB_BAR_TOP_GAP = 8;
// Khoảng hở tối thiểu với safe area nếu inset hệ thống nhỏ hơn giá trị này.
const PRIMARY_TAB_BAR_MIN_BOTTOM_GAP = 8;
// Khoảng đệm thêm giữa nội dung và thanh tab để nhìn "thở".
const PRIMARY_TAB_CONTENT_GAP = 16;

/**
 * getPrimaryTabContentBottomPadding – Tính paddingBottom cho FlatList/ScrollView
 * của các tab chính (profile, gallery, history...) sao cho mục cuối cùng
 * cuộn lên được trên thanh điều hướng nổi, kể cả safe area iPhone.
 *
 * @param {number} bottomInset - Safe area bottom inset hiện tại (từ useSafeAreaInsets).
 * @returns {number} Tổng padding bottom (px) cần áp vào contentContainerStyle.
 */
export function getPrimaryTabContentBottomPadding(bottomInset: number) {
  return (
    PRIMARY_TAB_BAR_HEIGHT +
    PRIMARY_TAB_BAR_TOP_GAP +
    Math.max(bottomInset, PRIMARY_TAB_BAR_MIN_BOTTOM_GAP) +
    PRIMARY_TAB_CONTENT_GAP
  );
}
