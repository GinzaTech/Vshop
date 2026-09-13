import React from "react";

/**
 * Hook chuẩn cho pull-to-refresh: bọc một hàm refresh bất đồng bộ và trả về
 * cờ `refreshing` + `onRefresh` để gắn vào AppRefreshControl/RefreshControl.
 * - Dedup: nếu lần refresh trước chưa xong, lần gọi sau bị bỏ qua (guard qua
 *   ref nên không tạo re-render thừa).
 * - An toàn lỗi: exception từ refresh được nuốt (chỉ warn ở DEV) để không
 *   crash app khi pull-to-refresh; `refreshing` luôn được reset trong finally.
 * @param refresh - Hàm tải dữ liệu thật của màn hình (Promise).
 * @returns { refreshing, onRefresh } — cờ trạng thái + handler cho RefreshControl.
 */
export function useAsyncRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = React.useState(false);
  const refreshInFlight = React.useRef(false);

  const onRefresh = React.useCallback(async () => {
    if (refreshInFlight.current) return;

    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await refresh();
    } catch (error) {
      if (__DEV__) console.warn("[refresh] Failed to refresh screen", error);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [refresh]);

  return { refreshing, onRefresh };
}
