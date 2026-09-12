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
import { useAccountStore } from "~/hooks/useAccountStore";
import {
  disconnectChatService,
  initChatService,
} from "~/utils/chat-service";
import { useChatStore } from "~/utils/chat-store";
import { getNetworkProfile } from "~/utils/network";
import {
  hasReusableAccessToken,
  isReauthenticationRequiredError,
  shouldProactivelyRefreshToken,
} from "~/utils/auth-session";
import { refreshShopAndBalances, getLastSync, shouldSkipFullSync } from "~/utils/app-sync";
import { syncAllData } from "~/utils/data-sync";
import {
  isRiotAuthenticationError,
  isCurrentSessionAuthFailure,
  isTransientNetworkError,
  subscribeSessionAuthFailures,
} from "~/utils/session-events";
import { runWhenIdle, type IdleTask } from "~/utils/idle-task";
import {
  isSessionRecoveryPaused,
  renewSavedAccountSession,
} from "~/services/accounts/session";
import { isSessionChangedError } from "~/utils/session-operations";

const NETWORK_RECOVERY_POLL_MS = 15_000;
const AUTH_FAILURE_RECOVERY_COOLDOWN_MS = 5_000;

// ===== Hằng số chống vòng lặp recovery (fix H3) =====
// Khi full sync lỗi PERSISTENT (không phải transient/reauth), poll 15s không
// được phép bắn lại full sync mãi mãi. Backoff nhân đôi từ 15s tới 10 phút,
// và sau MAX lần thất bại liên tiếp thì ngưng retry tự động (chờ sự kiện
// foreground/network-restored để có cơ hội mới).
const RECOVERY_BACKOFF_BASE_MS = 15_000;
const RECOVERY_BACKOFF_MAX_MS = 10 * 60_000;
const MAX_CONSECUTIVE_RECOVERY_FAILURES = 5;

// ===== Grace period sau full sync (fix H4) =====
// Bootstrap (_layout) vừa chạy syncAllData xong thì AppWarmup mount và poll
// đầu tiên có thể thấy token ≤5 phút nữa hết hạn → trước đây sẽ renew + full
// sync LẦN 2 chỉ vài giây sau lần 1. Nếu shop/balances vừa được stamp synced
// trong khoảng grace này và token vẫn còn dùng được thì bỏ qua recovery,
// đợi poll kế tiếp (sau khi grace hết) rồi mới renew.
const FULL_SYNC_GRACE_MS = 60_000;

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
  const accountsHydrated = useAccountStore((state) => state.hydrated);
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

  // (Đã bỏ sessionUserRef: mọi async callback đọc user tại thời điểm fire qua
  // useUserStore.getState() — fix M15a, tránh stale closure sau switch account.)

  // Đồng bộ identity/credentials mới nhất vào danh sách account. Chỉ lưu các
  // trường phiên nhỏ gọn, không nhân bản shop/profile lớn trong storage.
  React.useEffect(() => {
    if (!accountsHydrated || !user.id || !user.accessToken) return;
    useAccountStore.getState().saveAccount(user);
  }, [accountsHydrated, user]);

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
          if (isSessionRecoveryPaused()) return;
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

    // Cleanup: hủy scheduler và ngắt kết nối chat.
    // FIX (H8): so sánh user trong store TẠI THỜI ĐIỂM CLEANUP với user lúc
    // effect chạy. Token renew (cùng id) → chỉ ngắt socket, GIỮ friends/
    // messages để reconnect hiển thị liền mạch. Đổi account / logout (id khác
    // hoặc rỗng) → reset toàn bộ dữ liệu chat như cũ.
    return () => {
      scheduler.cancel();
      const userAtCleanup = useUserStore.getState().user;
      const sameAccount = Boolean(user.id) && userAtCleanup.id === user.id;
      disconnectChatService({ keepSessionData: sameAccount });
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

        // Cellular: delay 7800ms, WiFi: 5200ms
        scheduler.schedule(isCellular ? 7800 : 5200, async () => {
          if (isSessionRecoveryPaused()) return;
          // FIX (M15a): đọc user TẠI THỜI ĐIỂM FIRE thay vì dùng user captured
          // trước delay. Nếu user switch account trong 5-8s window, fetch với
          // user cũ sẽ reset nhầm cache match của account mới vừa sync xong.
          const fireTimeUser = useUserStore.getState().user;
          if (!fireTimeUser.accessToken || !fireTimeUser.region || !fireTimeUser.id) {
            return;
          }
          await useMatchStore.getState().fetchMatches(fireTimeUser);
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
      if (isSessionRecoveryPaused()) return;
      void refreshShopAndBalances(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [user.accessToken, user.entitlementsToken, user.region, user.id]);

  // Effect 4: Session recovery coordinator.
  // - App quay lại foreground: kiểm tra mạng, làm mới credentials rồi force sync.
  // - Mạng trở lại khi app đang active: chạy lại cùng flow recovery.
  // - Riot trả 401: thử silent re-auth bằng cookie; nếu cookie hết hạn mới mở /reauth.
  //
  // Guards chống lãng phí request (fix H3/H4/M4):
  // - Grace period sau full sync: vừa sync xong không recover lại ngay (H4).
  // - TTL check: foreground recovery chỉ full-sync khi data thực sự stale (M4).
  // - Backoff + cap: lỗi persistent không bắn full-sync mỗi 15s vô hạn (H3).
  React.useEffect(() => {
    let cancelled = false;
    let currentAppState: AppStateStatus = AppState.currentState;
    let lastConnected: boolean | null = null;
    let recoveryInFlight: Promise<void> | null = null;
    let lastSuccessfulRecoveryAt = 0;
    let reauthRequested = false;
    let recoveryNeeded = false;
    let recoveryFailureCount = 0;
    let recoveryBackoffUntil = 0;

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
      if (cancelled || isSessionRecoveryPaused()) return;
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

        // FIX (H4): grace period ngay sau full sync. Bootstrap vừa sync xong
        // thì các trigger thường (foreground/token-expiring) không cần renew
        // + sync lại ngay — đợi poll kế tiếp. Lỗi auth (force) luôn đi tiếp.
        const recentFullSync =
          Date.now() - getLastSync("shop") < FULL_SYNC_GRACE_MS;
        if (!forceAccessTokenRenewal && recentFullSync) {
          if (__DEV__) {
            console.log("[warmup] Recovery skipped: full sync just completed", {
              reason,
            });
          }
          return;
        }

        // FIX (M4): foreground/token-expiring recovery trước đây luôn chạy
        // full syncAllData (~10-20 request) dù mọi nguồn còn TTL. Khi shop +
        // matches còn fresh thì chỉ cần giữ session + chat, bỏ qua data sync.
        const dataSyncSkippedByTtl =
          !forceAccessTokenRenewal && shouldSkipFullSync();

        try {
          const mustRenewAccessToken =
            forceAccessTokenRenewal ||
            !hasReusableAccessToken(currentUser.accessToken) ||
            shouldProactivelyRefreshToken(currentUser.accessToken);

          let recoveredUser = currentUser;
          if (mustRenewAccessToken) {
            recoveredUser = await renewSavedAccountSession(currentUser);
          }

          if (cancelled || isSessionRecoveryPaused()) return;

          // Giữ dữ liệu UI mới nhất nếu một screen vừa cập nhật store trong lúc
          // recovery đang chạy, nhưng luôn ghi đè toàn bộ credentials vừa lấy.
          const latestUser = useUserStore.getState().user;
          if (latestUser.id !== currentUser.id) {
            // Người dùng đã đổi account trong lúc recovery đang chạy.
            // Bỏ toàn bộ kết quả cũ thay vì chạm vào phiên vừa chọn.
            return;
          }
          const nextUser =
            {
              ...latestUser,
              id: recoveredUser.id,
              region: recoveredUser.region,
              accessToken: recoveredUser.accessToken,
              idToken: recoveredUser.idToken,
              entitlementsToken: recoveredUser.entitlementsToken,
            };

          // A renewal can finish while this read-only recovery was running.
          if (!mustRenewAccessToken && latestUser.accessToken !== currentUser.accessToken) return;
          store.setUser(nextUser);
          useAccountStore.getState().saveAccount(nextUser);
          // A process resumed after a long background interval can have a
          // live-looking token but stale sockets/config. Rebuild the complete
          // authenticated snapshot before allowing later actions to use it —
          // trừ khi TTL check ở trên xác nhận mọi nguồn còn fresh (M4).
          if (!dataSyncSkippedByTtl) {
            try {
              await syncAllData(nextUser, nextUser.region);
            } catch (error) {
              if (mustRenewAccessToken || !isRiotAuthenticationError(error)) throw error;
              const renewed = await renewSavedAccountSession(useUserStore.getState().user);
              await syncAllData(renewed, renewed.region);
            }
          }

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
          recoveryNeeded = false;
          // FIX (H3): recovery thành công → reset toàn bộ bộ đếm backoff.
          recoveryFailureCount = 0;
          recoveryBackoffUntil = 0;
          // FIX (M15b): session đã sống lại sau reauth → mở khóa để lần token
          // chết KẾ TIẾP (giờ sau) có thể điều hướng /reauth trở lại.
          reauthRequested = false;

          if (__DEV__) {
            console.log("[warmup] Session recovered", {
              reason,
              dataSyncSkippedByTtl,
            });
          }
        } catch (error) {
          if (cancelled || isSessionRecoveryPaused() || isSessionChangedError(error)) return;

          // Mạng rớt giữa recovery: giữ nguyên session/cache và chờ lần poll sau.
          // (KHÔNG tính vào bộ đếm thất bại — đây là lỗi tạm thời, không phải
          // lỗi persistent cần backoff.)
          if (isTransientNetworkError(error)) {
            lastConnected = false;
            recoveryNeeded = true;
            if (__DEV__) {
              console.warn("[warmup] Session recovery deferred while offline", {
                reason,
              });
            }
            return;
          }

          const requiresInteractiveLogin =
            isReauthenticationRequiredError(error);

          if (requiresInteractiveLogin) {
            recoveryNeeded = false;
            navigateToReauth();
            return;
          }

          // FIX (H3): lỗi PERSISTENT → backoff nhân đôi + cap số lần liên tiếp.
          // Trước đây recoveryNeeded = true khiến poll 15s bắn lại full sync
          // vô hạn (vd clientconfig 404 dai dẳng) → tốn pin + risk rate-limit.
          recoveryFailureCount += 1;
          if (recoveryFailureCount >= MAX_CONSECUTIVE_RECOVERY_FAILURES) {
            recoveryNeeded = false;
            recoveryBackoffUntil = 0;
            if (__DEV__) {
              console.warn(
                "[warmup] Recovery suspended after repeated failures; waiting for foreground/network event",
                { reason, attempts: recoveryFailureCount }
              );
            }
            return;
          }
          recoveryNeeded = true;
          const backoffMs = Math.min(
            RECOVERY_BACKOFF_BASE_MS * 2 ** (recoveryFailureCount - 1),
            RECOVERY_BACKOFF_MAX_MS
          );
          recoveryBackoffUntil = Date.now() + backoffMs;

          if (__DEV__) {
            console.warn("[warmup] Session recovery failed", {
              reason,
              error,
              attempt: recoveryFailureCount,
              retryInMs: backoffMs,
            });
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
      if (currentAppState !== "active" || cancelled || isSessionRecoveryPaused()) return;

      // FIX (H3): đang trong window backoff sau lỗi persistent → chờ, không retry.
      if (recoveryNeeded && Date.now() < recoveryBackoffUntil) return;

      const network = await getNetworkProfile({ force: true });
      const wasConnected = lastConnected;
      lastConnected = network.isConnected;

      if (!network.isConnected) return;

      const currentToken = useUserStore.getState().user.accessToken;
      const tokenNeedsRenewal = shouldProactivelyRefreshToken(currentToken);
      if (wasConnected === false || tokenNeedsRenewal || recoveryNeeded) {
        // Mạng vừa phục hồi là một sự kiện mới → cho phép retry ngay cả khi
        // đã bị suspend vì lỗi persistent trước đó (reset bộ đếm).
        if (wasConnected === false) recoveryFailureCount = 0;
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

    const unsubscribeAuthFailures = subscribeSessionAuthFailures((failure) => {
      if (
        isCurrentSessionAuthFailure(failure, useUserStore.getState().user.accessToken) &&
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
