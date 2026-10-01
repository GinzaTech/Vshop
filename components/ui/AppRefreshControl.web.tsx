// ===== AppRefreshControl.web.tsx =====
// Bản web của AppRefreshControl: pull-to-refresh gesture không tồn tại trên
// trình duyệt, và react-native-web không vẽ spinner của RefreshControl.
//
// QUAN TRỌNG (hợp đồng wrapper): RNW render phần tử truyền qua prop
// `refreshControl` thành **wrapper bao ngoài** ScrollView (cloneElement với
// children = ScrollView). Vì vậy component này BẮT BUỘC render `children`
// nguyên ven — trả về null sẽ làm trắng toàn màn hình.
//
// Phản hồi refresh trên web: component đăng ký trạng thái refreshing vào
// một external store dùng chung; AppViewport đọc qua
// `useWebRefreshActivity()` để vẽ thanh tiến trình mỏng phía trên frame —
// mọi màn hình có pull-to-refresh đều có phản hồi mà không cần sửa từng screen.
import { useEffect, useSyncExternalStore, type PropsWithChildren } from "react";

type AppRefreshControlProps = PropsWithChildren<{
  refreshing: boolean;
  onRefresh: () => void;
  enabled?: boolean;
}>;

// --- External store đếm số refresh đang chạy (mini-zustand bằng tay) ---
let activeWebRefreshes = 0;
const webRefreshListeners = new Set<() => void>();

const emitWebRefreshChange = () => {
  webRefreshListeners.forEach((listener) => listener());
};

const subscribeWebRefresh = (listener: () => void) => {
  webRefreshListeners.add(listener);
  return () => {
    webRefreshListeners.delete(listener);
  };
};

const getWebRefreshSnapshot = () => activeWebRefreshes > 0;

const getWebRefreshServerSnapshot = () => false;

/**
 * useWebRefreshActivity – true khi có ít nhất một refresh đang chạy ở bất kỳ
 * màn hình nào (AppViewport dùng để hiển thị thanh tiến trình).
 * @returns boolean — có refresh đang chạy trên app không.
 */
export function useWebRefreshActivity(): boolean {
  return useSyncExternalStore(
    subscribeWebRefresh,
    getWebRefreshSnapshot,
    getWebRefreshServerSnapshot,
  );
}

/**
 * AppRefreshControl – Bản web: đăng ký trạng thái refreshing vào store dùng
 * chung và render children nguyên ven (bắt buộc — xem ghi chú wrapper ở đầu
 * file; RNW cloneElement refreshControl với children = ScrollView).
 *
 * @param refreshing – Trạng thái đang refresh.
 * @param children – ScrollView/FlatList được bọc ngoài.
 */
export default function AppRefreshControl({
  refreshing,
  children,
}: AppRefreshControlProps) {
  useEffect(() => {
    if (!refreshing) return undefined;
    activeWebRefreshes += 1;
    emitWebRefreshChange();
    return () => {
      activeWebRefreshes -= 1;
      emitWebRefreshChange();
    };
  }, [refreshing]);

  return <>{children}</>;
}
