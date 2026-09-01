/**
 * Khoảng trống cần chừa ở cuối các màn hình tab chính để nội dung cuối cùng
 * có thể cuộn hoàn toàn lên phía trên thanh điều hướng nổi.
 */
const PRIMARY_TAB_BAR_HEIGHT = 68;
const PRIMARY_TAB_BAR_TOP_GAP = 8;
const PRIMARY_TAB_BAR_MIN_BOTTOM_GAP = 8;
const PRIMARY_TAB_CONTENT_GAP = 16;

export function getPrimaryTabContentBottomPadding(bottomInset: number) {
  return (
    PRIMARY_TAB_BAR_HEIGHT +
    PRIMARY_TAB_BAR_TOP_GAP +
    Math.max(bottomInset, PRIMARY_TAB_BAR_MIN_BOTTOM_GAP) +
    PRIMARY_TAB_CONTENT_GAP
  );
}
