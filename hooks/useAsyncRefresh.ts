import React from "react";
import { sanitizeErrorForLog } from "~/utils/log-redaction";

/**
 * Hook chuẩn cho pull-to-refresh: bọc một hàm refresh bất đồng bộ và trả về
 * cờ `refreshing` + `onRefresh` để gắn vào AppRefreshControl/RefreshControl.
 * - Dedup: nếu lần refresh trước chưa xong, lần gọi sau bị bỏ qua (guard qua
 *   ref nên không tạo re-render thừa).
 * - An toàn lỗi: exception từ refresh được nuốt (chỉ warn ở DEV) để không
 *   crash app khi pull-to-refresh; `refreshing` luôn được reset trong finally.
 * @param refresh - Hàm tải dữ liệu thật của màn hình (Promise).
 * @param resetKey - Phiên/ngữ cảnh ổn định; đổi key để bỏ qua refresh cũ.
 * @returns { refreshing, onRefresh } — cờ trạng thái + handler cho RefreshControl.
 */
export function useAsyncRefresh(refresh: () => Promise<unknown>, resetKey?: unknown) {
  const [refreshing, setRefreshing] = React.useState(false);
  const refreshInFlight = React.useRef(false);
  const requestId = React.useRef(0);
  const lifecycle = React.useMemo(() => ({ resetKey }), [resetKey]);
  const activeLifecycle = React.useRef<typeof lifecycle | null>(null);

  React.useEffect(() => {
    activeLifecycle.current = lifecycle;
    setRefreshing(false);
    return () => {
      activeLifecycle.current = null;
      refreshInFlight.current = false;
      requestId.current += 1;
    };
  }, [lifecycle]);

  const onRefresh = React.useCallback(async () => {
    if (activeLifecycle.current !== lifecycle || refreshInFlight.current) return;

    const currentRequest = ++requestId.current;
    const isCurrent = () => activeLifecycle.current === lifecycle && requestId.current === currentRequest;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await refresh();
    } catch (error) {
      if (isCurrent() && __DEV__) console.warn("[refresh] Failed to refresh screen", sanitizeErrorForLog(error));
    } finally {
      if (isCurrent()) {
        refreshInFlight.current = false;
        setRefreshing(false);
      }
    }
  }, [lifecycle, refresh]);

  return { refreshing, onRefresh };
}
