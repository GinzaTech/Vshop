import { useCallback, useEffect, useRef } from "react";
import { runIdleSequence, type IdleTask } from "~/utils/idle-task";
import { MOTION_DURATION } from "~/constants/Motion";

type Route = { key: string; name: string };
export type TabTransitionNavigation = {
  addListener: (
    type: "transitionStart" | "transitionEnd",
    listener: (event: { target?: string }) => void,
  ) => () => void;
};

/**
 * Preload (mount trước) các tab chính NGỒI navigator khi app rảnh (idle):
 * giúp lần đầu bấm tab không bị khựng vì mount component nặng.
 * - Hàng đợi mount chạy qua runIdleSequence (nền tảng rảnh mới mount tab kế).
 * - TẠM DỪNG trong lúc navigator đang transition (kể cả Back/điều hướng
 *   chương trình): mount giữa transition gây giật khung hình.
 * @param routes - Danh sách route của navigator.
 * @param activeKey - Key tab đang active (không cần preload chính nó).
 * @param enabled - Công tắc tổng (false = không schedule gì).
 * @param preload - Callback mount một tab theo name (thường là getStateMethods).
 * @param descriptors - Map routeKey → descriptor (lấy navigation để bind event).
 * @returns pause - Hàm tạm dừng hàng đợi (dùng khi bắt đầu transition).
 */
export function usePrimaryTabPreload({
  routes,
  activeKey,
  enabled,
  preload,
  descriptors,
}: {
  routes: readonly Route[];
  activeKey: string;
  enabled: boolean;
  preload?: (name: string) => void;
  descriptors: Record<string, { navigation?: TabTransitionNavigation }>;
}) {
  // Ref "latest" giữ giá trị props mới nhất để callback schedule (deps rỗng)
  // luôn đọc state hiện tại mà không cần khởi tạo lại.
  const latest = useRef({ routes, activeKey, enabled, preload });
  // Các tab đã preload — không mount lại lần nào nữa trong phiên.
  const loaded = useRef(new Set<string>());
  // Tab đang transition tới — preload phải dừng cho đến khi transition kết thúc.
  const transitionTarget = useRef<string | null>(null);
  // Idle task hiện tại (để cancel khi cần schedule lại).
  const task = useRef<IdleTask | undefined>(undefined);
  // Timer xử lý trường hợp A->B->A trong cùng batch không phát transitionEnd.
  const noTransitionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Cờ transition đã thật sự bắt đầu (phân biệt với target chưa kịp chạy).
  const transitionStarted = useRef(false);
  // Chuỗi hóa routeKeys để effect chỉ chạy lại khi danh sách route đổi thực sự.
  const routeKeys = routes.map((route) => route.key).join("|");

  /** Đặt lại hàng đợi idle: mount lần lượt các tab chưa load, bỏ tab active. */
  const schedule = useCallback(() => {
    task.current?.cancel();
    const current = latest.current;
    if (!current.enabled || !current.preload || transitionTarget.current) return;
    task.current = runIdleSequence(current.routes
      .filter((route) => route.key !== current.activeKey && !loaded.current.has(route.key))
      .map((route) => () => {
        const next = latest.current;
        if (!next.enabled || transitionTarget.current || !next.preload ||
            route.key === next.activeKey || loaded.current.has(route.key)) return;
        loaded.current.add(route.key);
        next.preload(route.name);
      }));
  }, []);

  /** Tạm dừng preload khi tab `key` bắt đầu transition sang vị trí mới. */
  const pause = useCallback((key: string) => {
    transitionTarget.current = key;
    transitionStarted.current = false;
    task.current?.cancel();
    task.current = undefined;
    clearTimeout(noTransitionTimer.current);
    // A->B->A trong cùng một batch React có thể giữ route không đổi →
    // navigator không phát transitionEnd. Chỉ settle đúng trường hợp này.
    noTransitionTimer.current = setTimeout(() => {
      if (transitionTarget.current === key && !transitionStarted.current &&
          latest.current.activeKey === key) {
        transitionTarget.current = null;
        schedule();
      }
    }, MOTION_DURATION.standard);
  }, [schedule]);

  useEffect(() => {
    latest.current = { routes, activeKey, enabled, preload };
    loaded.current.add(activeKey);
  }, [routes, activeKey, enabled, preload]);

  // Navigation/descriptors có thể đổi identity mỗi state update → bind lại
  // listener nhưng KHÔNG restart hàng đợi mount hay mất tiến độ đã load.
  useEffect(() => {
    const unsubscribe = Object.entries(descriptors).flatMap(([key, descriptor]) => {
      if (!descriptor.navigation) return [];
      return [
        descriptor.navigation.addListener("transitionStart", () => {
          pause(key);
          transitionStarted.current = true;
          clearTimeout(noTransitionTimer.current);
        }),
        descriptor.navigation.addListener("transitionEnd", () => {
          if (transitionTarget.current !== key || latest.current.activeKey !== key) return;
          transitionTarget.current = null;
          clearTimeout(noTransitionTimer.current);
          schedule();
        }),
      ];
    });
    return () => unsubscribe.forEach((remove) => remove());
  }, [descriptors, pause, schedule]);

  useEffect(() => {
    schedule();
  }, [routeKeys, enabled, schedule]);

  // Cleanup khi unmount: hủy idle task + timer, không rò rỉ tài nguyên.
  useEffect(() => () => {
    task.current?.cancel();
    clearTimeout(noTransitionTimer.current);
  }, []);
  return pause;
}
