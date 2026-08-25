// 📦 AppWarmup.tsx – Component "khởi động ngầm" ứng dụng
// Chạy các tác vụ nền sau khi đăng nhập: kết nối chat service,
// fetch matches, với độ trễ tùy theo loại mạng (WiFi/Cellular)

import React from "react";
import { useRouter } from "expo-router";
import {
  AppState,
  type AppStateStatus,
  NativeModules,
  Platform,
} from "react-native";

import { useMatchStore } from "~/hooks/useMatchStore";
import { useUserStore } from "~/hooks/useUserStore";
import {
  disconnectChatService,
  initChatService,
} from "~/utils/chat-service";
import { useChatStore } from "~/utils/chat-store";
import { getNetworkProfile } from "~/utils/network";
import {
  hasReusableAccessToken,
  isReauthenticationRequiredError,
  renewAuthenticatedSession,
  shouldProactivelyRefreshToken,
} from "~/utils/auth-session";
import { refreshShopAndBalances } from "~/utils/app-sync";
import { syncAllData } from "~/utils/data-sync";
import { getEntitlementsToken } from "~/utils/valorant-api";
import {
  isRiotAuthenticationError,
  isTransientNetworkError,
  subscribeSessionAuthFailures,
} from "~/utils/session-events";
import { runWhenIdle, type IdleTask } from "~/utils/idle-task";

const NETWORK_RECOVERY_POLL_MS = 15_000;
const AUTH_FAILURE_RECOVERY_COOLDOWN_MS = 5_000;

/**
 * createWarmupScheduler – Tạo scheduler cho phép lên lịch các tác vụ warmup
 * với khả năng hủy (cancel) để tránh chạy khi component unmount
 * @returns Object { isCancelled, schedule, cancel }
 */
function createWarmupScheduler() {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const idleTasks: IdleTask[] = [];

  return {
    // Kiểm tra scheduler đã bị hủy chưa
    isCancelled: () => cancelled,
    /**
     * schedule – Lên lịch một tác vụ chạy sau delayMs mili giây
     * Sau delay, chờ JS runtime rảnh để không block UI.
     * @param delayMs – Thời gian delay (ms)
     * @param task – Hàm cần thực thi
     */
    schedule(delayMs: number, task: () => void | Promise<void>) {
      const timer = setTimeout(() => {
        if (cancelled) return;
        const idleTask = runWhenIdle(() => {
          if (!cancelled) {
            void task();
          }
        });
        idleTasks.push(idleTask);
      }, delayMs);
      timers.push(timer);
    },
    // Hủy tất cả timer và interaction đang chờ
    cancel() {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
      idleTasks.forEach((task) => task.cancel());
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
  const router = useRouter();
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

  // Effect 4: Session recovery coordinator.
  // - App quay lại foreground: kiểm tra mạng, làm mới credentials rồi force sync.
  // - Mạng trở lại khi app đang active: chạy lại cùng flow recovery.
  // - Riot trả 401: thử silent re-auth bằng cookie; nếu cookie hết hạn mới mở /reauth.
  React.useEffect(() => {
    let cancelled = false;
    let currentAppState: AppStateStatus = AppState.currentState;
    let lastConnected: boolean | null = null;
    let recoveryInFlight: Promise<void> | null = null;
    let lastSuccessfulRecoveryAt = 0;
    let reauthRequested = false;

    const navigateToReauth = () => {
      if (cancelled || reauthRequested) return;
      reauthRequested = true;
      disconnectChatService();
      router.replace("/reauth");
    };

    const recoverSession = async (
      reason: string,
      forceAccessTokenRenewal = false
    ): Promise<void> => {
      if (recoveryInFlight) return recoveryInFlight;

      const recoveryTask = (async () => {
        const network = await getNetworkProfile({ force: true });
        lastConnected = network.isConnected;
        if (!network.isConnected || cancelled) return;

        const store = useUserStore.getState();
        const currentUser = store.user;
        if (!currentUser.accessToken || !currentUser.region || !currentUser.id) {
          return;
        }

        try {
          const mustRenewAccessToken =
            forceAccessTokenRenewal ||
            !hasReusableAccessToken(currentUser.accessToken) ||
            shouldProactivelyRefreshToken(currentUser.accessToken);

          let recoveredUser = currentUser;
          if (mustRenewAccessToken) {
            recoveredUser = await renewAuthenticatedSession(currentUser);
          } else {
            try {
              const entitlementsToken = await getEntitlementsToken(
                currentUser.accessToken
              );
              recoveredUser = { ...currentUser, entitlementsToken };
            } catch (error) {
              // Access token có thể bị Riot thu hồi trước thời điểm exp trong JWT.
              if (!isRiotAuthenticationError(error)) throw error;
              recoveredUser = await renewAuthenticatedSession(currentUser);
            }
          }

          if (cancelled) return;

          // Giữ dữ liệu UI mới nhất nếu một screen vừa cập nhật store trong lúc
          // recovery đang chạy, nhưng luôn ghi đè toàn bộ credentials vừa lấy.
          const latestUser = useUserStore.getState().user;
          const nextUser =
            latestUser.id === currentUser.id
              ? {
                  ...latestUser,
                  id: recoveredUser.id,
                  region: recoveredUser.region,
                  accessToken: recoveredUser.accessToken,
                  idToken: recoveredUser.idToken,
                  entitlementsToken: recoveredUser.entitlementsToken,
                }
              : recoveredUser;

          store.setUser(nextUser);
          // A process resumed after a long background interval can have a
          // live-looking token but stale sockets/config. Rebuild the complete
          // authenticated snapshot before allowing later actions to use it.
          await syncAllData(nextUser, nextUser.region);

          if (
            Platform.OS !== "web" &&
            NativeModules.TcpSockets &&
            useChatStore.getState().status === "disconnected"
          ) {
            const refreshedUser = useUserStore.getState().user;
            await initChatService(
              refreshedUser.accessToken,
              refreshedUser.entitlementsToken,
              refreshedUser.region,
              refreshedUser.id
            );
          }
          lastSuccessfulRecoveryAt = Date.now();

          if (__DEV__) {
            console.log("[warmup] Session recovered", { reason });
          }
        } catch (error) {
          if (cancelled) return;

          // Mạng rớt giữa recovery: giữ nguyên session/cache và chờ lần poll sau.
          if (isTransientNetworkError(error)) {
            lastConnected = false;
            if (__DEV__) {
              console.warn("[warmup] Session recovery deferred while offline", {
                reason,
              });
            }
            return;
          }

          const latestToken = useUserStore.getState().user.accessToken;
          const requiresInteractiveLogin =
            isReauthenticationRequiredError(error) ||
            isRiotAuthenticationError(error) ||
            !hasReusableAccessToken(latestToken);

          if (requiresInteractiveLogin) {
            navigateToReauth();
            return;
          }

          if (__DEV__) {
            console.warn("[warmup] Session recovery failed", { reason, error });
          }
        }
      })();

      recoveryInFlight = recoveryTask;
      try {
        await recoveryTask;
      } finally {
        if (recoveryInFlight === recoveryTask) {
          recoveryInFlight = null;
        }
      }
    };

    const inspectConnection = async () => {
      if (currentAppState !== "active" || cancelled) return;

      const network = await getNetworkProfile({ force: true });
      const wasConnected = lastConnected;
      lastConnected = network.isConnected;

      if (!network.isConnected) return;

      const currentToken = useUserStore.getState().user.accessToken;
      const tokenNeedsRenewal = shouldProactivelyRefreshToken(currentToken);
      if (wasConnected === false || tokenNeedsRenewal) {
        await recoverSession(
          wasConnected === false ? "network-restored" : "token-expiring",
          tokenNeedsRenewal
        );
      }
    };

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        const wasInBackground = currentAppState !== "active";
        currentAppState = nextState;
        if (nextState === "active" && wasInBackground) {
          void recoverSession("foreground");
        }
      }
    );

    const unsubscribeAuthFailures = subscribeSessionAuthFailures(() => {
      if (
        currentAppState === "active" &&
        Date.now() - lastSuccessfulRecoveryAt >=
          AUTH_FAILURE_RECOVERY_COOLDOWN_MS
      ) {
        void recoverSession("api-auth-failure", true);
      }
    });

    const networkPoll = setInterval(() => {
      void inspectConnection();
    }, NETWORK_RECOVERY_POLL_MS);

    // Ghi nhận trạng thái ban đầu; nếu app được mount trong lúc offline thì
    // lần poll đầu tiên sau khi có mạng sẽ tự động chạy recovery.
    void inspectConnection();

    return () => {
      cancelled = true;
      appStateSubscription.remove();
      unsubscribeAuthFailures();
      clearInterval(networkPoll);
    };
  }, [router]);

  // Component không render UI
  return null;
}
