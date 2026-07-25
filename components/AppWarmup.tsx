// 📦 AppWarmup.tsx – Component "khởi động ngầm" ứng dụng
// Chạy các tác vụ nền sau khi đăng nhập: kết nối chat service,
// fetch matches, với độ trễ tùy theo loại mạng (WiFi/Cellular)

import React from "react";
import { InteractionManager, NativeModules, Platform } from "react-native";

import { useMatchStore } from "~/hooks/useMatchStore";
import { useUserStore } from "~/hooks/useUserStore";
import {
  disconnectChatService,
  initChatService,
} from "~/utils/chat-service";
import { useChatStore } from "~/utils/chat-store";
import { getNetworkProfile } from "~/utils/network";
import { shouldProactivelyRefreshToken, buildAuthenticatedUser } from "~/utils/auth-session";
import { fullBackgroundSync, refreshShopAndBalances, isStale } from "~/utils/app-sync";

/**
 * createWarmupScheduler – Tạo scheduler cho phép lên lịch các tác vụ warmup
 * với khả năng hủy (cancel) để tránh chạy khi component unmount
 * @returns Object { isCancelled, schedule, cancel }
 */
function createWarmupScheduler() {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const interactions: { cancel?: () => void | Promise<void> }[] = [];

  return {
    // Kiểm tra scheduler đã bị hủy chưa
    isCancelled: () => cancelled,
    /**
     * schedule – Lên lịch một tác vụ chạy sau delayMs mili giây
     * Sau delay, chờ InteractionManager (đảm bảo không block UI)
     * @param delayMs – Thời gian delay (ms)
     * @param task – Hàm cần thực thi
     */
    schedule(delayMs: number, task: () => void | Promise<void>) {
      const timer = setTimeout(() => {
        if (cancelled) return;
        const interactionTask = InteractionManager.runAfterInteractions(() => {
          if (!cancelled) {
            void task();
          }
        });
        interactions.push(interactionTask);
      }, delayMs);
      timers.push(timer);
    },
    // Hủy tất cả timer và interaction đang chờ
    cancel() {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
      interactions.forEach((task) => task.cancel?.());
    },
  };
}

/**
 * AppWarmup – Component (không render UI, return null)
 * Chạy các tác vụ nền:
 * 1. Kết nối chat service (sau 250-900ms)
 * 2. Fetch matches (sau 5200-7800ms)
 * Các độ trễ phụ thuộc vào loại mạng (Cellular chậm hơn WiFi)
 */
export default function AppWarmup() {
  // Thông tin user từ store
  const user = useUserStore((state) => state.user);
  // Ref: lưu user hiện tại để dùng trong callback async (tránh stale closure)
  const sessionUserRef = React.useRef(user);
  /**
   * warmupKey – Key dùng để trigger re-fetch khi dữ liệu shop thay đổi
   * Kết hợp: user.id, region, và UUID của các item trong shop/bundle/nightMarket
   */
  const warmupKey = React.useMemo(
    () =>
      [
        user.id,
        user.region,
        user.shops.main.map((item) => item.uuid).join(","),
        user.shops.bundles.map((bundle) => bundle.uuid).join(","),
        user.shops.nightMarket.map((item) => item.uuid).join(","),
      ].join("|"),
    [user.id, user.region, user.shops.bundles, user.shops.main, user.shops.nightMarket]
  );

  // Cập nhật ref mỗi khi user thay đổi
  React.useEffect(() => {
    sessionUserRef.current = user;
  }, [user]);

  // Effect 1: Kết nối chat service (chỉ trên native Android có TcpSockets)
  React.useEffect(() => {
    if (
      Platform.OS === "web" ||
      !NativeModules.TcpSockets ||
      !user.accessToken ||
      !user.entitlementsToken ||
      !user.region ||
      !user.id
    ) {
      return;
    }

    const scheduler = createWarmupScheduler();

    void getNetworkProfile()
      .then((network) => {
        if (scheduler.isCancelled() || !network.isConnected) return;

        // Nếu là mạng cellular: delay 900ms, WiFi: 250ms
        scheduler.schedule(network.isCellular ? 900 : 250, () => {
          if (useChatStore.getState().status !== "disconnected") return;

          return initChatService(
            user.accessToken,
            user.entitlementsToken,
            user.region,
            user.id
          );
        });
      })
      .catch((error) => {
        if (__DEV__ && !scheduler.isCancelled()) {
          console.warn("[warmup] chat connection failed", error);
        }
      });

    // Cleanup: hủy scheduler và ngắt kết nối chat
    return () => {
      scheduler.cancel();
      disconnectChatService();
    };
  }, [user.accessToken, user.entitlementsToken, user.id, user.region]);

  // Effect 2: Fetch matches trong nền (với độ trễ lớn hơn)
  React.useEffect(() => {
    if (
      !user.accessToken ||
      !user.entitlementsToken ||
      !user.region ||
      !user.id
    ) {
      return;
    }

    const scheduler = createWarmupScheduler();

    void (async () => {
      try {
        const network = await getNetworkProfile();
        if (scheduler.isCancelled() || !network.isConnected) {
          return;
        }

        const isCellular = network.isCellular;
        const currentUser = sessionUserRef.current;
        const matchStore = useMatchStore.getState();

        // Cellular: delay 7800ms, WiFi: 5200ms
        scheduler.schedule(isCellular ? 7800 : 5200, async () => {
          await matchStore.fetchMatches(currentUser);
        });
      } catch (error) {
        if (__DEV__ && !scheduler.isCancelled()) {
          console.warn("[warmup] background refresh failed", error);
        }
      }
    })();

    return scheduler.cancel;
  }, [
    user.accessToken,
    user.entitlementsToken,
    user.id,
    user.region,
    warmupKey,
  ]);

  // Effect 3: Background shop/balances refresh (sau 3s, silent)
  React.useEffect(() => {
    if (!user.accessToken || !user.entitlementsToken || !user.region || !user.id) return;
    const timer = setTimeout(() => {
      void refreshShopAndBalances(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [user.accessToken, user.entitlementsToken, user.region, user.id]);

  // Effect 4: Proactive token refresh — kiểm tra mỗi 2 phút
  // Nếu token sắp hết hạn (≤5 phút), rebuild session
  React.useEffect(() => {
    if (!user.accessToken || !user.region) return;

    const interval = setInterval(() => {
      if (shouldProactivelyRefreshToken(user.accessToken)) {
        if (__DEV__) console.warn("[warmup] Token sắp hết hạn, thực hiện reAuth");
        const store = useUserStore.getState();
        if (store.user.accessToken && store.user.region) {
          buildAuthenticatedUser(store.user.accessToken, store.user.region, store.user)
            .then((newUser) => store.setUser(newUser))
            .catch((err) => {
              if (__DEV__) console.warn("[warmup] Proactive reAuth failed", err);
            });
        }
      }
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user.accessToken, user.region]);

  // Component không render UI
  return null;
}
