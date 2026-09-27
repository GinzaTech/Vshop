// ===== AppRefreshControl.web.tsx =====
// Bản web của AppRefreshControl: react-native-web bỏ qua hoàn toàn prop
// `refreshControl` của ScrollView/FlatList — pull-to-refresh vừa không có
// gesture, vừa không có bất kỳ phản hồi thị giác nào khi refresh chạy ngầm.
//
// Giải pháp: component này (được truyền qua prop refreshControl) tự đăng ký
// trạng thái refreshing vào một external store dùng chung, và trả về null
// (dù sao cũng không được render). AppViewport đọc store qua
// `useWebRefreshActivity()` để vẽ thanh tiến trình mỏng phía trên frame —
// nhờ đó MỌI màn hình có pull-to-refresh đều có phản hồi trên web mà không
// cần sửa từng screen.
import { useEffect, useSyncExternalStore } from "react";
import { type PropsWithChildren } from "react";

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
 * chung rồi trả về null (react-native-web sẽ bỏ qua node này nếu có render).
 *
 * @param refreshing – Trạng thái đang refresh.
 */
export default function AppRefreshControl({
  refreshing,
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

  return null;
}
