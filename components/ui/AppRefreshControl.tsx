// ===== AppRefreshControl.tsx =====
// RefreshControl dùng chung cho mọi pull-to-refresh trong app.
// Màu spinner/nền lấy từ DesignSystem để đồng bộ giữa các màn hình.
import React, { type PropsWithChildren } from "react";
import { RefreshControl } from "react-native";

import { COLORS } from "~/constants/DesignSystem";

/**
 * AppRefreshControlProps – Props của AppRefreshControl.
 *
 * @param refreshing – true khi đang refresh (spinner hiển thị).
 * @param onRefresh – Callback được gọi khi người dùng kéo để làm mới.
 * @param enabled – (mặc định true) Cho phép thao tác pull-to-refresh hay không.
 * @param children – React node con (RefreshControl có thể bọc nội dung).
 */
type AppRefreshControlProps = PropsWithChildren<{
  refreshing: boolean;
  onRefresh: () => void;
  enabled?: boolean;
}>;

/**
 * AppRefreshControl – RefreshControl chuẩn hoá (màu ACCENT, nền SURFACE).
 * Dùng kèm FlatList/ScrollView; giữ component tồn tại cả khi empty state.
 *
 * @param refreshing – Trạng thái đang refresh.
 * @param onRefresh – Callback pull-to-refresh (phải gọi dữ liệu thật).
 * @param enabled – Có cho phép kéo làm mới không (mặc định true).
 * @param children – Node con được bọc bên trong RefreshControl.
 * @returns RefreshControl đã set colors/tintColor/progressBackgroundColor.
 */
export default function AppRefreshControl({
  refreshing,
  onRefresh,
  enabled = true,
  children,
}: AppRefreshControlProps) {
  return (
    <RefreshControl
      enabled={enabled}
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[COLORS.ACCENT]}
      tintColor={COLORS.ACCENT}
      progressBackgroundColor={COLORS.SURFACE}
    >
      {children}
    </RefreshControl>
  );
}
